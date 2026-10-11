import type { DeckState } from "../deck/deck";
import { buildDeck, deckRemaining, drawCard } from "../deck/deck";
import type { GameEvent } from "../protocol/events";
import type {
  Command,
  ErrorCode,
  ServerMessage,
  SettingsPatch,
} from "../protocol/messages";
import { ulid } from "../util/id";
import { randomTarget, spinParams } from "./geometry";
import { applyEvent } from "./reducer";
import {
  nextColor,
  nextPsychic,
  playersInOrder,
  smallerTeam,
  teamMembers,
} from "./rotation";
import {
  coopLabel,
  initialTeamsScores,
  ranking,
  scoreFfaRound,
  scoreTeamsTurn,
  wedgeScore,
} from "./scoring";
import {
  activeOpponents,
  activeOwners,
  allDialsLocked,
  inRound,
  opponents,
} from "./selectors";
import type {
  DialState,
  GameOver,
  GameState,
  Player,
  Round,
  RoundResult,
  Settings,
  TeamId,
} from "./types";
import {
  DEFAULT_SETTINGS,
  LIMITS,
  PLAYER_COLORS,
  PROTOCOL_VERSION,
  otherTeam,
} from "./types";

/** Server-only state kept beside the public GameState. */
export interface SecretState {
  /** playerId → SHA-256 hex of the player's token. */
  tokens: Record<string, string>;
  /** Current round's target until reveal. */
  target: number | null;
  deck: DeckState | null;
  /** Per-player ring of recent command ids for idempotency. */
  lastCmdIds: Record<string, string[]>;
}

export interface ServerState {
  game: GameState;
  secret: SecretState;
  lastActivityAt: number;
}

export interface CommandContext {
  playerId: string;
  now: number;
  random: () => number;
}

export interface PrivateMessage {
  playerId: string;
  message: ServerMessage;
}

export type CommandResult =
  | {
      ok: true;
      events: GameEvent[];
      secret: SecretState;
      privates: PrivateMessage[];
    }
  | { ok: false; code: ErrorCode; message: string };

class CommandError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const fail = (code: ErrorCode, message: string): never => {
  throw new CommandError(code, message);
};

/** Collects events while keeping a live view of the resulting state. */
class Tx {
  events: GameEvent[] = [];
  privates: PrivateMessage[] = [];
  constructor(
    public game: GameState,
    public secret: SecretState,
  ) {}
  emit(event: GameEvent) {
    this.events.push(event);
    this.game = applyEvent(this.game, event);
  }
}

/* ---------- Game creation and joining (HTTP, not commands) ---------- */

export function createGame(input: {
  code: string;
  hostId: string;
  hostName: string;
  hostTokenHash: string;
  now: number;
}): ServerState {
  const host: Player = {
    id: input.hostId,
    name: input.hostName,
    color: 0,
    team: "left",
    order: 0,
    connected: false,
    away: false,
    disconnectedAt: null,
  };
  return {
    game: {
      protocolVersion: PROTOCOL_VERSION,
      version: 0,
      code: input.code,
      hostId: host.id,
      phase: "lobby",
      settings: { ...DEFAULT_SETTINGS },
      players: { [host.id]: host },
      activeTeam: null,
      psychicCursor: { left: -1, right: -1, all: -1 },
      scores: {},
      round: null,
      roundsPlayed: 0,
      history: [],
      suddenDeath: false,
      gameOver: null,
      deckRemaining: 0,
      createdAt: input.now,
    },
    secret: {
      tokens: { [host.id]: input.hostTokenHash },
      target: null,
      deck: null,
      lastCmdIds: {},
    },
    lastActivityAt: input.now,
  };
}

export function joinGame(
  state: ServerState,
  input: { playerId: string; name: string; tokenHash: string },
): CommandResult {
  const { game } = state;
  if (game.phase === "gameover") return error("no_game", "game is over");
  if (Object.keys(game.players).length >= LIMITS.maxPlayers)
    return error("room_full", "room is full");
  const tx = new Tx(game, state.secret);
  const order =
    Math.max(-1, ...Object.values(game.players).map((p) => p.order)) + 1;
  tx.emit({
    type: "player.joined",
    player: {
      id: input.playerId,
      name: input.name,
      color: nextColor(game, PLAYER_COLORS),
      team: game.settings.mode === "teams" ? smallerTeam(game) : null,
      order,
      connected: false,
      away: false,
      disconnectedAt: null,
    },
  });
  return {
    ok: true,
    events: tx.events,
    secret: {
      ...state.secret,
      tokens: { ...state.secret.tokens, [input.playerId]: input.tokenHash },
    },
    privates: [],
  };
}

/* ---------- Presence (driven by sockets and alarms) ---------- */

export function connectPlayer(game: GameState, playerId: string): GameEvent[] {
  const player = game.players[playerId];
  if (!player || (player.connected && !player.away)) return [];
  return [
    {
      type: "player.presence",
      playerId,
      connected: true,
      away: false,
      disconnectedAt: null,
    },
  ];
}

export function disconnectPlayer(
  game: GameState,
  playerId: string,
  now: number,
): GameEvent[] {
  const player = game.players[playerId];
  if (!player || !player.connected) return [];
  return [
    {
      type: "player.presence",
      playerId,
      connected: false,
      away: false,
      disconnectedAt: now,
    },
  ];
}

/**
 * Mark players away whose grace period has expired, migrate the host if
 * needed and auto-advance anything that was only waiting on them.
 */
export function expireGrace(
  state: ServerState,
  now: number,
  graceMs: number,
): { events: GameEvent[]; nextDeadline: number | null } {
  const tx = new Tx(state.game, state.secret);
  let nextDeadline: number | null = null;
  for (const player of playersInOrder(tx.game)) {
    if (player.connected || player.away || player.disconnectedAt === null)
      continue;
    const deadline = player.disconnectedAt + graceMs;
    if (deadline <= now) {
      tx.emit({
        type: "player.presence",
        playerId: player.id,
        connected: false,
        away: true,
        disconnectedAt: player.disconnectedAt,
      });
    } else {
      nextDeadline =
        nextDeadline === null ? deadline : Math.min(nextDeadline, deadline);
    }
  }
  migrateHost(tx);
  autoAdvance(tx);
  return { events: tx.events, nextDeadline };
}

function migrateHost(tx: Tx) {
  const host = tx.game.players[tx.game.hostId];
  if (host && !host.away) return;
  const candidate = playersInOrder(tx.game).find((p) => !p.away);
  if (candidate) tx.emit({ type: "host.changed", hostId: candidate.id });
}

/* ---------- Commands ---------- */

export function handleCommand(
  state: ServerState,
  cmd: Command,
  ctx: CommandContext,
): CommandResult {
  const tx = new Tx(state.game, state.secret);
  try {
    dispatch(tx, cmd, ctx);
  } catch (err) {
    if (err instanceof CommandError) return error(err.code, err.message);
    throw err;
  }
  return {
    ok: true,
    events: tx.events,
    secret: tx.secret,
    privates: tx.privates,
  };
}

function error(code: ErrorCode, message: string): CommandResult {
  return { ok: false, code, message };
}

function dispatch(tx: Tx, cmd: Command, ctx: CommandContext) {
  const { game } = tx;
  const me =
    game.players[ctx.playerId] ?? fail("unauthorized", "unknown player");
  const host = () => game.hostId === me.id || fail("not_allowed", "host only");
  const phase = (...phases: GameState["phase"][]) =>
    phases.includes(game.phase) ||
    fail("wrong_phase", `not allowed during ${game.phase}`);
  const round = () => game.round ?? fail("wrong_phase", "no round in progress");
  const psychic = () =>
    round().psychicId === me.id || fail("not_allowed", "psychic only");

  switch (cmd.type) {
    case "settings.update":
      host();
      phase("lobby");
      updateSettings(tx, cmd.patch);
      return;

    case "team.join":
      phase("lobby");
      if (game.settings.mode !== "teams") fail("invalid", "not a teams game");
      if (me.team !== cmd.team)
        tx.emit({ type: "team.changed", playerId: me.id, team: cmd.team });
      return;

    case "player.rename":
      if (me.name !== cmd.name)
        tx.emit({ type: "player.renamed", playerId: me.id, name: cmd.name });
      return;

    case "game.start":
      host();
      phase("lobby");
      startGame(tx, ctx);
      return;

    case "card.draw": {
      phase("drawing");
      psychic();
      if (round().card) fail("invalid", "card already drawn");
      const deck = tx.secret.deck ?? fail("invalid", "no deck");
      const drawn = drawCard(deck, ctx.random);
      tx.secret = { ...tx.secret, deck: drawn.deck };
      tx.emit({
        type: "card.drawn",
        card: drawn.card,
        deckRemaining: deckRemaining(drawn.deck),
      });
      return;
    }

    case "card.pickSide": {
      phase("drawing");
      psychic();
      const card = round().card ?? fail("invalid", "draw a card first");
      tx.emit({
        type: "side.picked",
        side: cmd.side,
        spectrum: card.sides[cmd.side],
      });
      tx.emit({ type: "phase.changed", phase: "spinning" });
      return;
    }

    case "spin.flick": {
      // Re-spins are allowed until the clue is given; each one draws a
      // fresh target.
      phase("spinning", "clue");
      psychic();
      if (round().clue !== null) fail("invalid", "the clue is already given");
      const target = randomTarget(ctx.random);
      tx.secret = { ...tx.secret, target };
      tx.emit({
        type: "spin.started",
        spin: {
          id: ulid(ctx.now),
          ...spinParams(cmd.velocity),
          startedAt: ctx.now,
        },
      });
      if (game.phase === "spinning")
        tx.emit({ type: "phase.changed", phase: "clue" });
      tx.privates.push({
        playerId: me.id,
        message: { type: "private", target },
      });
      return;
    }

    case "shroud.toggle":
      phase("spinning", "clue", "guessing", "voting");
      psychic();
      if (round().shroudOpen !== cmd.open)
        tx.emit({ type: "shroud.toggled", open: cmd.open, at: ctx.now });
      return;

    case "clue.submit":
      phase("clue");
      psychic();
      tx.emit({ type: "clue.submitted", clue: cmd.clue });
      tx.emit({ type: "phase.changed", phase: "guessing" });
      return;

    case "dial.set": {
      phase("guessing");
      const dial = ownedDial(game, me.id, cmd.dialId);
      if (dial.locked) fail("invalid", "dial is locked");
      tx.emit({
        type: "dial.set",
        dialId: dial.id,
        position: cmd.position,
        by: me.id,
      });
      return;
    }

    case "dial.accept": {
      phase("guessing");
      const dial = ownedDial(game, me.id, cmd.dialId);
      if (dial.locked) fail("invalid", "dial is locked");
      if (!dial.accepts.includes(me.id))
        tx.emit({ type: "dial.accepted", dialId: dial.id, playerId: me.id });
      autoAdvance(tx);
      return;
    }

    case "dial.unaccept": {
      phase("guessing");
      const dial = ownedDial(game, me.id, cmd.dialId);
      if (dial.locked) fail("invalid", "dial is locked");
      if (dial.accepts.includes(me.id))
        tx.emit({ type: "dial.unaccepted", dialId: dial.id, playerId: me.id });
      return;
    }

    case "vote.cast":
      phase("voting");
      if (!opponents(game).some((p) => p.id === me.id))
        fail("not_allowed", "only the other team votes");
      if (round().votes[me.id] !== cmd.side)
        tx.emit({ type: "vote.cast", playerId: me.id, side: cmd.side });
      autoAdvance(tx);
      return;

    case "round.next":
      phase("reveal");
      if (game.hostId !== me.id && round().psychicId !== me.id)
        fail("not_allowed", "host or psychic only");
      advanceRound(tx, ctx);
      return;

    case "host.forceLock":
      host();
      phase("guessing", "voting");
      if (game.phase === "guessing") {
        for (const dial of Object.values(round().dials)) {
          if (!dial.locked) tx.emit({ type: "dial.locked", dialId: dial.id });
        }
        afterGuessing(tx);
      } else {
        reveal(tx);
      }
      return;

    case "host.skipRound":
      host();
      phase("drawing", "spinning", "clue", "guessing", "voting");
      skipRound(tx, ctx);
      return;

    case "host.kick": {
      host();
      if (cmd.playerId === me.id) fail("invalid", "cannot kick yourself");
      const target =
        game.players[cmd.playerId] ?? fail("invalid", "no such player");
      const wasPsychic = game.round?.psychicId === target.id;
      tx.emit({ type: "player.left", playerId: target.id });
      const tokens = { ...tx.secret.tokens };
      delete tokens[target.id];
      tx.secret = { ...tx.secret, tokens };
      if (wasPsychic && inRound(tx.game) && tx.game.phase !== "reveal") {
        skipRound(tx, ctx);
      } else {
        autoAdvance(tx);
      }
      return;
    }

    case "host.transfer":
      host();
      if (!game.players[cmd.playerId]) fail("invalid", "no such player");
      if (cmd.playerId !== game.hostId)
        tx.emit({ type: "host.changed", hostId: cmd.playerId });
      return;

    case "host.endGame":
      host();
      phase("drawing", "spinning", "clue", "guessing", "voting", "reveal");
      tx.emit({ type: "game.over", gameOver: finalStanding(tx.game) });
      return;

    case "game.playAgain":
      host();
      phase("gameover");
      tx.secret = { ...tx.secret, target: null };
      tx.emit({ type: "game.reset", scores: {} });
      return;

    case "effect.send":
      // Relayed by the room as an ephemeral; nothing to persist.
      return;
  }
}

/* ---------- Helpers ---------- */

function ownedDial(
  game: GameState,
  playerId: string,
  dialId: string,
): DialState {
  const dial = game.round?.dials[dialId] ?? fail("invalid", "no such dial");
  if (!dial.owners.includes(playerId)) fail("not_allowed", "not your dial");
  return dial;
}

function updateSettings(tx: Tx, patch: SettingsPatch) {
  const settings: Settings = { ...tx.game.settings, ...patch };
  tx.emit({ type: "settings.changed", settings });
  if (settings.mode === "teams") balanceTeams(tx);
}

/** Give every teamless player a team, smallest team first. */
function balanceTeams(tx: Tx) {
  for (const player of playersInOrder(tx.game)) {
    if (player.team) continue;
    tx.emit({
      type: "team.changed",
      playerId: player.id,
      team: smallerTeam(tx.game),
    });
  }
}

function startGame(tx: Tx, ctx: CommandContext) {
  const { game } = tx;
  const count = Object.keys(game.players).length;
  if (game.settings.mode === "teams") {
    balanceTeams(tx);
    const left = teamMembers(tx.game, "left").length;
    const right = teamMembers(tx.game, "right").length;
    if (left < 2 || right < 2)
      fail("invalid", "each team needs at least 2 players");
  } else if (count < 2) {
    fail("invalid", "need at least 2 players");
  }

  const deck = buildDeck(game.settings, ctx.random);
  tx.secret = { ...tx.secret, deck, target: null };

  let activeTeam: TeamId | null = null;
  let scores: Record<string, number> = {};
  if (game.settings.mode === "teams") {
    activeTeam =
      game.settings.firstTeam === "random"
        ? ctx.random() < 0.5
          ? "left"
          : "right"
        : game.settings.firstTeam;
    scores = initialTeamsScores(activeTeam);
  } else if (game.settings.mode === "coop") {
    scores = { coop: 0 };
  } else {
    for (const id of Object.keys(game.players)) scores[id] = 0;
  }

  const base: GameState = {
    ...tx.game,
    psychicCursor: { left: -1, right: -1, all: -1 },
  };
  const next = makeRound(base, {
    index: 0,
    team: activeTeam,
    catchUp: false,
    now: ctx.now,
  });
  tx.emit({
    type: "game.started",
    round: next.round,
    activeTeam,
    psychicCursor: next.psychicCursor,
    scores,
    deckRemaining: deckRemaining(deck),
  });
}

function makeRound(
  game: GameState,
  input: { index: number; team: TeamId | null; catchUp: boolean; now: number },
): {
  round: Round;
  psychicCursor: GameState["psychicCursor"];
  wrapped: boolean;
} {
  const pick =
    nextPsychic(game, input.team) ?? fail("invalid", "nobody can be psychic");
  const others = (
    input.team ? teamMembers(game, input.team) : playersInOrder(game)
  )
    .map((p) => p.id)
    .filter((id) => id !== pick.psychicId);
  const dials: Record<string, DialState> = {};
  if (game.settings.mode === "ffa") {
    for (const id of others) dials[id] = newDial(id, [id]);
  } else {
    dials.shared = newDial("shared", others);
  }
  return {
    round: {
      index: input.index,
      psychicId: pick.psychicId,
      psychicTeam: input.team,
      card: null,
      side: null,
      spectrum: null,
      spin: null,
      spins: 0,
      shroudOpen: false,
      peeks: 0,
      clue: null,
      dials,
      votes: {},
      target: null,
      result: null,
      catchUp: input.catchUp,
      startedAt: input.now,
    },
    psychicCursor: pick.psychicCursor,
    wrapped: pick.wrapped,
  };
}

function newDial(id: string, owners: string[]): DialState {
  return {
    id,
    owners,
    position: 0.5,
    movedBy: null,
    accepts: [],
    locked: false,
  };
}

/** Lock dials whose active owners all accepted; move on when everything is locked. */
export function autoAdvance(tx: Tx) {
  const { game } = tx;
  if (!game.round) return;
  if (game.phase === "guessing") {
    for (const dial of Object.values(game.round.dials)) {
      if (dial.locked) continue;
      const owners = activeOwners(game, dial);
      if (
        owners.length > 0 &&
        owners.every((id) => dial.accepts.includes(id))
      ) {
        tx.emit({ type: "dial.locked", dialId: dial.id });
      }
    }
    if (allDialsLocked(tx.game)) afterGuessing(tx);
  } else if (game.phase === "voting") {
    const voters = activeOpponents(game);
    if (voters.length === 0 || voters.every((p) => game.round!.votes[p.id])) {
      reveal(tx);
    }
  }
}

function afterGuessing(tx: Tx) {
  if (
    tx.game.settings.mode === "teams" &&
    activeOpponents(tx.game).length > 0
  ) {
    tx.emit({ type: "phase.changed", phase: "voting" });
  } else {
    reveal(tx);
  }
}

function reveal(tx: Tx) {
  const game = tx.game;
  const round = game.round ?? fail("wrong_phase", "no round");
  const target = tx.secret.target ?? fail("invalid", "no target");
  const spectrum = round.spectrum ?? fail("invalid", "no spectrum");
  const dials: RoundResult["dials"] = {};
  for (const dial of Object.values(round.dials)) {
    dials[dial.id] = {
      position: dial.position,
      wedge: wedgeScore(dial.position, target),
      owners: dial.owners,
    };
  }

  const result: RoundResult = {
    roundIndex: round.index,
    psychicId: round.psychicId,
    psychicTeam: round.psychicTeam,
    spectrum,
    clue: round.clue ?? "",
    target,
    dials,
    vote: null,
    deltas: {},
    goAgain: false,
    gameOver: null,
  };
  let scores = { ...game.scores };
  let suddenDeath = game.suddenDeath;
  // Co-op / FFA: the game ends when the last round's rotation completes,
  // i.e. the next psychic would wrap around to the first player again.
  const rotationDone = nextPsychic(game, null)?.wrapped ?? true;
  const lastRound =
    rotationDone && game.roundsPlayed + 1 >= game.settings.rounds;

  if (game.settings.mode === "teams") {
    const shared = round.dials.shared ?? fail("invalid", "no shared dial");
    const outcome = scoreTeamsTurn({
      scores,
      psychicTeam: round.psychicTeam!,
      guess: shared.position,
      target,
      votes: round.votes,
      targetScore: game.settings.targetScore,
      catchUp: game.settings.catchUp,
      suddenDeath,
    });
    scores = outcome.scores;
    suddenDeath = outcome.suddenDeath;
    result.vote = outcome.vote;
    result.deltas = outcome.deltas;
    result.goAgain = outcome.goAgain;
    result.gameOver = outcome.gameOver
      ? { winner: outcome.winner, label: null }
      : null;
  } else if (game.settings.mode === "coop") {
    const shared = round.dials.shared ?? fail("invalid", "no shared dial");
    const points = wedgeScore(shared.position, target);
    result.deltas = { coop: points };
    scores.coop = (scores.coop ?? 0) + points;
    result.gameOver = lastRound
      ? { winner: null, label: coopLabel(scores.coop, game.history.length + 1) }
      : null;
  } else {
    const guesses: Record<string, number> = {};
    for (const dial of Object.values(round.dials)) {
      if (dial.movedBy !== null || dial.accepts.length > 0)
        guesses[dial.id] = dial.position;
    }
    result.deltas = scoreFfaRound(
      guesses,
      target,
      round.psychicId,
      game.settings.psychicScoring,
    );
    for (const [id, delta] of Object.entries(result.deltas)) {
      scores[id] = (scores[id] ?? 0) + delta;
    }
    result.gameOver = lastRound ? finalStanding({ ...game, scores }) : null;
  }

  tx.secret = { ...tx.secret, target: null };
  tx.emit({ type: "round.revealed", result, scores, suddenDeath });
}

function advanceRound(tx: Tx, ctx: CommandContext) {
  const game = tx.game;
  const round = game.round ?? fail("wrong_phase", "no round");
  const result = round.result ?? fail("wrong_phase", "round not revealed");
  if (result.gameOver) {
    tx.emit({ type: "game.over", gameOver: result.gameOver });
    return;
  }
  let team: TeamId | null = null;
  if (game.settings.mode === "teams") {
    team = result.goAgain ? round.psychicTeam! : otherTeam(round.psychicTeam!);
  }
  const next = makeRound(game, {
    index: round.index + 1,
    team,
    catchUp: result.goAgain,
    now: ctx.now,
  });
  tx.emit({
    type: "round.advanced",
    round: next.round,
    activeTeam: team,
    psychicCursor: next.psychicCursor,
    // Teams count turns; the other modes count completed rotations.
    roundsPlayed:
      game.settings.mode === "teams" || next.wrapped
        ? game.roundsPlayed + 1
        : game.roundsPlayed,
    deckRemaining: game.deckRemaining,
  });
}

/** Abandon the current round and deal a fresh one for the same team. */
function skipRound(tx: Tx, ctx: CommandContext) {
  const game = tx.game;
  const round = game.round ?? fail("wrong_phase", "no round");
  tx.secret = { ...tx.secret, target: null };
  const next = makeRound(game, {
    index: round.index,
    team: round.psychicTeam,
    catchUp: round.catchUp,
    now: ctx.now,
  });
  tx.emit({
    type: "round.advanced",
    round: next.round,
    activeTeam: round.psychicTeam,
    psychicCursor: next.psychicCursor,
    roundsPlayed: game.roundsPlayed,
    deckRemaining: game.deckRemaining,
  });
}

/** Who is winning right now (used for early end and FFA final). */
export function finalStanding(game: GameState): GameOver {
  if (game.settings.mode === "teams") {
    const left = game.scores.left ?? 0;
    const right = game.scores.right ?? 0;
    return {
      winner: left === right ? null : left > right ? "left" : "right",
      label: null,
    };
  }
  if (game.settings.mode === "coop") {
    return {
      winner: null,
      label: coopLabel(game.scores.coop ?? 0, Math.max(1, game.history.length)),
    };
  }
  const ranked = ranking(game.scores);
  const top = ranked[0];
  const tied = ranked.filter((r) => r.rank === 1).length > 1;
  return { winner: top && !tied ? top.id : null, label: null };
}
