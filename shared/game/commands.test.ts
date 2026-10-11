import { describe, expect, it } from "vitest";
import type { Command } from "../protocol/messages";
import { mulberry32 } from "../util/random";
import {
  connectPlayer,
  createGame,
  disconnectPlayer,
  expireGrace,
  handleCommand,
  joinGame,
  type PrivateMessage,
  type ServerState,
} from "./commands";
import { SEGMENT } from "./geometry";
import { applyEvents } from "./reducer";
import { roleOf } from "./selectors";
import type { Mode } from "./types";

/* ---------- harness ---------- */

const random = mulberry32(1234);
let clock = 1_000_000;
let cmdCounter = 0;

function cmd<T extends Command["type"]>(
  type: T,
  extra: Omit<Extract<Command, { type: T }>, "type" | "cmdId"> = {} as never,
): Extract<Command, { type: T }> {
  cmdCounter += 1;
  return {
    cmdId: `CMD${String(cmdCounter).padStart(10, "0")}`,
    type,
    ...extra,
  } as Extract<Command, { type: T }>;
}

let lastPrivates: PrivateMessage[] = [];

function run(
  state: ServerState,
  playerId: string,
  command: Command,
): ServerState {
  const result = handleCommand(state, command, {
    playerId,
    now: clock,
    random,
  });
  if (!result.ok)
    throw new Error(
      `${command.type} by ${playerId}: ${result.code} ${result.message}`,
    );
  clock += 10;
  lastPrivates = result.privates;
  return {
    game: applyEvents(state.game, result.events),
    secret: result.secret,
    lastActivityAt: clock,
  };
}

function expectError(
  state: ServerState,
  playerId: string,
  command: Command,
  code: string,
) {
  const result = handleCommand(state, command, {
    playerId,
    now: clock,
    random,
  });
  expect(result.ok, `${command.type} should fail`).toBe(false);
  if (!result.ok) expect(result.code).toBe(code);
}

function setup(
  mode: Mode,
  names: string[],
): { state: ServerState; ids: string[] } {
  let state = createGame({
    code: "TEST",
    hostId: "p0",
    hostName: names[0]!,
    hostTokenHash: "h0",
    now: clock,
  });
  const ids = ["p0"];
  names.slice(1).forEach((name, i) => {
    const id = `p${i + 1}`;
    const joined = joinGame(state, {
      playerId: id,
      name,
      tokenHash: `h${i + 1}`,
    });
    if (!joined.ok) throw new Error(joined.message);
    state = {
      ...state,
      game: applyEvents(state.game, joined.events),
      secret: joined.secret,
    };
    ids.push(id);
  });
  if (mode !== "teams") {
    state = run(state, "p0", cmd("settings.update", { patch: { mode } }));
  }
  for (const id of ids) {
    state = {
      ...state,
      game: applyEvents(state.game, connectPlayer(state.game, id)),
    };
  }
  return { state, ids };
}

/** Play the psychic's part up to the guessing phase; returns the target. */
function psychicTurn(
  state: ServerState,
  clue = "banana",
): { state: ServerState; target: number } {
  const psychic = state.game.round!.psychicId;
  state = run(state, psychic, cmd("card.draw"));
  state = run(state, psychic, cmd("card.pickSide", { side: 1 }));
  expect(state.game.round!.shroudOpen).toBe(true);
  state = run(state, psychic, cmd("spin.flick", { velocity: 20 }));
  const target = state.secret.target!;
  expect(lastPrivates[0]).toEqual({
    playerId: psychic,
    message: { type: "private", target },
  });
  state = run(state, psychic, cmd("clue.submit", { clue }));
  expect(state.game.phase).toBe("guessing");
  expect(state.game.round!.shroudOpen).toBe(false);
  return { state, target };
}

/* ---------- lobby ---------- */

describe("lobby", () => {
  it("auto-balances teams as players join", () => {
    const { state } = setup("teams", ["Ann", "Bob", "Cid", "Dee", "Eve"]);
    const teams = Object.values(state.game.players).map((p) => p.team);
    expect(teams.filter((t) => t === "left")).toHaveLength(3);
    expect(teams.filter((t) => t === "right")).toHaveLength(2);
  });

  it("lets players switch teams and the host change settings", () => {
    let { state } = setup("teams", ["Ann", "Bob", "Cid"]);
    state = run(state, "p1", cmd("team.join", { team: "left" }));
    expect(state.game.players.p1!.team).toBe("left");
    state = run(
      state,
      "p0",
      cmd("settings.update", { patch: { targetScore: 12, catchUp: false } }),
    );
    expect(state.game.settings).toMatchObject({
      targetScore: 12,
      catchUp: false,
    });
    expectError(
      state,
      "p1",
      cmd("settings.update", { patch: { targetScore: 8 } }),
      "not_allowed",
    );
  });

  it("requires two players per team before starting", () => {
    const { state } = setup("teams", ["Ann", "Bob", "Cid"]);
    expectError(state, "p0", cmd("game.start"), "invalid");
    expectError(state, "p1", cmd("game.start"), "not_allowed");
  });

  it("assigns a team to players who join mid-game in teams mode", () => {
    let { state } = setup("teams", ["Ann", "Bob", "Cid", "Dee"]);
    state = run(state, "p0", cmd("game.start"));
    const joined = joinGame(state, {
      playerId: "p9",
      name: "Zed",
      tokenHash: "h9",
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const game = applyEvents(state.game, joined.events);
    expect(game.players.p9!.team).not.toBeNull();
    expect(roleOf(game, "p9")).toBe("spectator");
  });

  it("refuses joins when full or over", () => {
    const names = Array.from({ length: 16 }, (_, i) => `P${i}`);
    const { state } = setup("coop", names);
    const joined = joinGame(state, {
      playerId: "px",
      name: "X",
      tokenHash: "hx",
    });
    expect(joined.ok && joined).toBe(false);
  });
});

/* ---------- teams ---------- */

describe("teams round", () => {
  it("plays a full turn with shared-dial accepts, voting and scoring", () => {
    let { state } = setup("teams", ["Ann", "Bob", "Cid", "Dee"]);
    state = run(
      state,
      "p0",
      cmd("settings.update", { patch: { firstTeam: "left" } }),
    );
    state = run(state, "p0", cmd("game.start"));
    expect(state.game.phase).toBe("drawing");
    expect(state.game.scores).toEqual({ left: 0, right: 1 });
    const round = state.game.round!;
    expect(round.psychicTeam).toBe("left");
    expect(round.psychicId).toBe("p0");
    expect(round.dials.shared!.owners).toEqual(["p2"]);

    // guessers can't act yet, opponents never on the dial
    expectError(
      state,
      "p2",
      cmd("dial.set", { dialId: "shared", position: 0.3 }),
      "wrong_phase",
    );
    expectError(state, "p1", cmd("card.draw"), "not_allowed");

    const turn = psychicTurn(state);
    state = turn.state;
    const target = turn.target;
    expectError(
      state,
      "p1",
      cmd("dial.set", { dialId: "shared", position: 0.3 }),
      "not_allowed",
    );
    expectError(
      state,
      "p0",
      cmd("clue.submit", { clue: "again" }),
      "wrong_phase",
    );

    // guess two segments to the right of the target → 2 points
    const guess = target + 2 * SEGMENT;
    state = run(
      state,
      "p2",
      cmd("dial.set", { dialId: "shared", position: guess }),
    );
    state = run(state, "p2", cmd("dial.accept", { dialId: "shared" }));
    expect(state.game.phase).toBe("voting");
    expect(state.game.round!.dials.shared!.locked).toBe(true);

    state = run(state, "p1", cmd("vote.cast", { side: "left" }));
    expect(state.game.phase).toBe("voting");
    state = run(state, "p3", cmd("vote.cast", { side: "left" }));
    expect(state.game.phase).toBe("reveal");
    const result = state.game.round!.result!;
    expect(result.target).toBeCloseTo(target);
    expect(result.dials.shared!.wedge).toBe(2);
    expect(result.vote).toMatchObject({
      left: 2,
      right: 0,
      correct: "left",
      bonusTo: "right",
    });
    expect(state.game.scores).toEqual({ left: 2, right: 2 });

    state = run(state, "p0", cmd("round.next"));
    expect(state.game.phase).toBe("drawing");
    expect(state.game.round!.psychicTeam).toBe("right");
    expect(state.game.round!.psychicId).toBe("p1");
    expect(state.game.roundsPlayed).toBe(1);
  });

  it("resets accepts when the dial moves and rotates psychics within a team", () => {
    let { state } = setup("teams", ["Ann", "Bob", "Cid", "Dee", "Eve", "Fay"]);
    state = run(
      state,
      "p0",
      cmd("settings.update", { patch: { firstTeam: "left" } }),
    );
    state = run(state, "p0", cmd("game.start"));
    ({ state } = psychicTurn(state));
    // left team is p0 (psychic), p2, p4
    state = run(
      state,
      "p2",
      cmd("dial.set", { dialId: "shared", position: 0.2 }),
    );
    state = run(state, "p2", cmd("dial.accept", { dialId: "shared" }));
    expect(state.game.round!.dials.shared!.accepts).toEqual(["p2"]);
    state = run(
      state,
      "p4",
      cmd("dial.set", { dialId: "shared", position: 0.25 }),
    );
    expect(state.game.round!.dials.shared!.accepts).toEqual([]);
    state = run(state, "p4", cmd("dial.accept", { dialId: "shared" }));
    state = run(state, "p2", cmd("dial.unaccept", { dialId: "shared" }));
    state = run(state, "p2", cmd("dial.accept", { dialId: "shared" }));
    expect(state.game.phase).toBe("voting");
    state = run(state, "p0", cmd("host.forceLock"));
    expect(state.game.phase).toBe("reveal");
    state = run(state, "p0", cmd("round.next")); // right: p1
    expect(state.game.round!.psychicId).toBe("p1");
    ({ state } = psychicTurn(state));
    state = run(state, "p0", cmd("host.forceLock"));
    state = run(state, "p0", cmd("host.forceLock"));
    state = run(state, "p1", cmd("round.next")); // left again: p2
    expect(state.game.round!.psychicId).toBe("p2");
  });

  it("applies catch-up and ends the game at the target score", () => {
    let { state } = setup("teams", ["Ann", "Bob", "Cid", "Dee"]);
    state = run(
      state,
      "p0",
      cmd("settings.update", { patch: { firstTeam: "left", targetScore: 8 } }),
    );
    state = run(state, "p0", cmd("game.start"));
    state = {
      ...state,
      game: { ...state.game, scores: { left: 0, right: 4 } },
    };

    let target: number;
    ({ state, target } = psychicTurn(state));
    state = run(
      state,
      "p2",
      cmd("dial.set", { dialId: "shared", position: target }),
    );
    state = run(state, "p2", cmd("dial.accept", { dialId: "shared" }));
    state = run(state, "p1", cmd("vote.cast", { side: "left" }));
    state = run(state, "p3", cmd("vote.cast", { side: "right" }));
    expect(state.game.scores).toEqual({ left: 4, right: 4 });
    expect(state.game.round!.result!.goAgain).toBe(false); // level, not behind

    state = {
      ...state,
      game: { ...state.game, scores: { left: 0, right: 4 } },
    };
    state = run(state, "p0", cmd("round.next"));
    expect(state.game.round!.psychicTeam).toBe("right");
    state = run(state, "p0", cmd("host.skipRound"));
    expect(state.game.round!.psychicTeam).toBe("right");
    // skipping re-picks the psychic within the team: p1 → p3
    expect(state.game.round!.psychicId).toBe("p3");
    ({ state, target } = psychicTurn(state));
    state = {
      ...state,
      game: { ...state.game, scores: { left: 6, right: 0 } },
    };
    state = run(
      state,
      "p1",
      cmd("dial.set", { dialId: "shared", position: target }),
    );
    state = run(state, "p1", cmd("dial.accept", { dialId: "shared" }));
    state = run(state, "p0", cmd("vote.cast", { side: "left" }));
    state = run(state, "p2", cmd("vote.cast", { side: "left" }));
    const result = state.game.round!.result!;
    expect(result.dials.shared!.wedge).toBe(4);
    expect(result.goAgain).toBe(true);
    expect(result.gameOver).toBeNull();
    state = run(state, "p0", cmd("round.next"));
    expect(state.game.round!.psychicTeam).toBe("right");
    expect(state.game.round!.catchUp).toBe(true);
    expect(state.game.round!.psychicId).toBe("p1"); // wrapped around

    ({ state, target } = psychicTurn(state));
    state = run(
      state,
      "p3",
      cmd("dial.set", { dialId: "shared", position: target }),
    );
    state = run(state, "p3", cmd("dial.accept", { dialId: "shared" }));
    expect(state.game.phase).toBe("voting");
    state = run(state, "p0", cmd("host.forceLock")); // close voting early
    expect(state.game.scores).toEqual({ left: 6, right: 8 });
    expect(state.game.round!.result!.gameOver).toEqual({
      winner: "right",
      label: null,
    });
    state = run(state, "p0", cmd("round.next"));
    expect(state.game.phase).toBe("gameover");
    expect(state.game.gameOver!.winner).toBe("right");

    state = run(state, "p0", cmd("game.playAgain"));
    expect(state.game.phase).toBe("lobby");
    expect(state.game.round).toBeNull();
    expect(state.game.settings.targetScore).toBe(8);
    expect(state.secret.deck).not.toBeNull();
  });
});

/* ---------- co-op & ffa ---------- */

describe("co-op", () => {
  it("rotates psychics through everyone and ends with a label", () => {
    let { state } = setup("coop", ["Ann", "Bob", "Cid"]);
    state = run(state, "p0", cmd("settings.update", { patch: { rounds: 2 } }));
    state = run(state, "p0", cmd("game.start"));
    expect(state.game.scores).toEqual({ coop: 0 });
    expect(state.game.round!.dials.shared!.owners).toEqual(["p1", "p2"]);

    let target: number;
    ({ state, target } = psychicTurn(state));
    state = run(
      state,
      "p1",
      cmd("dial.set", { dialId: "shared", position: target + SEGMENT }),
    );
    state = run(state, "p1", cmd("dial.accept", { dialId: "shared" }));
    state = run(state, "p2", cmd("dial.accept", { dialId: "shared" }));
    expect(state.game.phase).toBe("reveal"); // no voting in co-op
    expect(state.game.scores.coop).toBe(3);
    state = run(state, "p0", cmd("round.next"));
    expect(state.game.round!.psychicId).toBe("p1");

    ({ state, target } = psychicTurn(state));
    state = run(
      state,
      "p0",
      cmd("dial.set", { dialId: "shared", position: target }),
    );
    state = run(state, "p0", cmd("dial.accept", { dialId: "shared" }));
    state = run(state, "p2", cmd("dial.accept", { dialId: "shared" }));
    expect(state.game.scores.coop).toBe(7);
    expect(state.game.round!.result!.gameOver).toEqual({
      winner: null,
      label: "Telepathic",
    });
    state = run(state, "p1", cmd("round.next"));
    expect(state.game.phase).toBe("gameover");
  });
});

describe("free-for-all", () => {
  it("gives every guesser a dial and scores individually", () => {
    let { state } = setup("ffa", ["Ann", "Bob", "Cid", "Dee"]);
    state = run(state, "p0", cmd("settings.update", { patch: { rounds: 1 } }));
    state = run(state, "p0", cmd("game.start"));
    expect(Object.keys(state.game.round!.dials).sort()).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
    expect(state.game.scores).toEqual({ p0: 0, p1: 0, p2: 0, p3: 0 });

    const turn = psychicTurn(state);
    state = turn.state;
    const target = turn.target;
    expectError(
      state,
      "p1",
      cmd("dial.set", { dialId: "p2", position: 0.1 }),
      "not_allowed",
    );
    state = run(
      state,
      "p1",
      cmd("dial.set", { dialId: "p1", position: target }),
    );
    state = run(state, "p1", cmd("dial.accept", { dialId: "p1" }));
    expect(state.game.round!.dials.p1!.locked).toBe(true);
    expect(state.game.phase).toBe("guessing");
    state = run(
      state,
      "p2",
      cmd("dial.set", { dialId: "p2", position: target + 2 * SEGMENT }),
    );
    state = run(state, "p2", cmd("dial.accept", { dialId: "p2" }));
    state = run(state, "p3", cmd("dial.accept", { dialId: "p3" })); // untouched centre dial
    expect(state.game.phase).toBe("reveal");
    const deltas = state.game.round!.result!.deltas;
    expect(deltas.p1).toBe(4);
    expect(deltas.p2).toBe(2);
    expect(deltas.p3).toBeDefined();
    expect(deltas.p0).toBe(Math.round((4 + 2 + deltas.p3!) / 3));
    expect(state.game.round!.result!.gameOver).toEqual({
      winner: "p1",
      label: null,
    });
    state = run(state, "p0", cmd("round.next"));
    expect(state.game.gameOver!.winner).toBe("p1");
  });
});

/* ---------- presence & host ---------- */

describe("presence", () => {
  it("marks players away after grace, auto-advances and migrates the host", () => {
    let { state } = setup("coop", ["Ann", "Bob", "Cid"]);
    state = run(state, "p0", cmd("game.start"));
    ({ state } = psychicTurn(state));
    state = run(
      state,
      "p1",
      cmd("dial.set", { dialId: "shared", position: 0.4 }),
    );
    state = run(state, "p1", cmd("dial.accept", { dialId: "shared" }));
    expect(state.game.phase).toBe("guessing"); // waiting on p2

    state = {
      ...state,
      game: applyEvents(state.game, disconnectPlayer(state.game, "p2", clock)),
    };
    state = {
      ...state,
      game: applyEvents(state.game, disconnectPlayer(state.game, "p0", clock)),
    };
    expect(state.game.players.p2!.connected).toBe(false);
    expect(state.game.players.p2!.away).toBe(false);

    const early = expireGrace(state, clock + 1000, 3000);
    expect(early.events).toEqual([]);
    expect(early.nextDeadline).toBe(clock + 3000);

    const late = expireGrace(state, clock + 3000, 3000);
    state = { ...state, game: applyEvents(state.game, late.events) };
    expect(state.game.players.p2!.away).toBe(true);
    expect(state.game.players.p0!.away).toBe(true);
    expect(state.game.hostId).toBe("p1");
    expect(state.game.phase).toBe("reveal"); // p2 no longer blocks the lock
    expect(late.nextDeadline).toBeNull();

    state = {
      ...state,
      game: applyEvents(state.game, connectPlayer(state.game, "p2")),
    };
    expect(state.game.players.p2).toMatchObject({
      connected: true,
      away: false,
    });
    expect(state.game.scores).toBeDefined();
  });

  it("kicks a player: psychic kicks skip the round, guesser kicks unblock it", () => {
    let { state } = setup("coop", ["Ann", "Bob", "Cid", "Dee"]);
    state = run(state, "p0", cmd("game.start"));
    expect(state.game.round!.psychicId).toBe("p0");
    state = run(state, "p0", cmd("host.transfer", { playerId: "p1" }));
    state = run(state, "p1", cmd("host.kick", { playerId: "p0" }));
    expect(state.game.players.p0).toBeUndefined();
    expect(state.secret.tokens.p0).toBeUndefined();
    expect(state.game.phase).toBe("drawing");
    expect(state.game.round!.psychicId).toBe("p1");
    expect(state.game.round!.dials.shared!.owners).toEqual(["p2", "p3"]);

    ({ state } = psychicTurn(state));
    state = run(state, "p2", cmd("dial.accept", { dialId: "shared" }));
    state = run(state, "p1", cmd("host.kick", { playerId: "p3" }));
    expect(state.game.phase).toBe("reveal");
    expectError(state, "p1", cmd("host.kick", { playerId: "p1" }), "invalid");
  });

  it("lets the host end a game early", () => {
    let { state } = setup("teams", ["Ann", "Bob", "Cid", "Dee"]);
    state = run(
      state,
      "p0",
      cmd("settings.update", { patch: { firstTeam: "right" } }),
    );
    state = run(state, "p0", cmd("game.start"));
    state = run(state, "p0", cmd("host.endGame"));
    expect(state.game.phase).toBe("gameover");
    expect(state.game.gameOver!.winner).toBe("left"); // left started on 1
  });
});

describe("spin and shroud", () => {
  it("lets the psychic re-spin until the clue and counts spins and peeks", () => {
    let { state } = setup("coop", ["Ann", "Bob"]);
    state = run(state, "p0", cmd("game.start"));
    expectError(
      state,
      "p0",
      cmd("spin.flick", { velocity: 20 }),
      "wrong_phase",
    );
    state = run(state, "p0", cmd("card.draw"));
    state = run(state, "p0", cmd("card.pickSide", { side: 0 }));
    expect(state.game.phase).toBe("spinning");
    expect(state.game.round!.shroudOpen).toBe(true);

    state = run(state, "p0", cmd("spin.flick", { velocity: 20 }));
    expect(state.game.phase).toBe("clue");
    const first = state.secret.target!;
    const firstSpin = state.game.round!.spin!.id;
    state = run(state, "p0", cmd("spin.flick", { velocity: -30 }));
    expect(state.game.phase).toBe("clue");
    expect(state.secret.target).not.toBe(first);
    expect(state.game.round!.spin!.id).not.toBe(firstSpin);
    expect(state.game.round!.spin!.direction).toBe(-1);
    expect(state.game.round!.spins).toBe(2);
    expect(lastPrivates[0]).toEqual({
      playerId: "p0",
      message: { type: "private", target: state.secret.target },
    });

    // Only the psychic touches the shroud; toggling to the same state is a no-op.
    expectError(
      state,
      "p1",
      cmd("shroud.toggle", { open: false }),
      "not_allowed",
    );
    const version = state.game.version;
    state = run(state, "p0", cmd("shroud.toggle", { open: true }));
    expect(state.game.version).toBe(version);
    state = run(state, "p0", cmd("shroud.toggle", { open: false }));
    expect(state.game.round!.shroudOpen).toBe(false);
    expect(state.game.round!.peeks).toBe(0);
    state = run(state, "p0", cmd("shroud.toggle", { open: true }));
    expect(state.game.round!.peeks).toBe(1);

    state = run(state, "p0", cmd("clue.submit", { clue: "x" }));
    expect(state.game.round!.shroudOpen).toBe(false);
    expectError(
      state,
      "p0",
      cmd("spin.flick", { velocity: 20 }),
      "wrong_phase",
    );
    // Peeking while they guess is allowed and counted.
    state = run(state, "p0", cmd("shroud.toggle", { open: true }));
    expect(state.game.round!.peeks).toBe(2);
    expectError(
      state,
      "p1",
      cmd("shroud.toggle", { open: false }),
      "not_allowed",
    );
  });
});
