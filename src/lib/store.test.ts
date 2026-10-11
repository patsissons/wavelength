import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "@shared/game/commands";
import type { RoundResult } from "@shared/game/types";
import { celebrationBus } from "./effect-bus";
import { useGameStore } from "./store";

const game = createGame({
  code: "BCDF",
  hostId: "p1",
  hostName: "Ann",
  hostTokenHash: "h",
  now: 0,
}).game;

describe("store.receive", () => {
  beforeEach(() => useGameStore.getState().reset());

  it("replaces state on snapshot and applies in-order events", () => {
    const s = useGameStore.getState();
    expect(
      s.receive({
        type: "event",
        version: 1,
        event: { type: "host.changed", hostId: "x" },
      }),
    ).toBe("gap");
    s.receive({
      type: "snapshot",
      state: game,
      you: { playerId: "p1", target: null },
    });
    expect(useGameStore.getState().game?.version).toBe(0);
    expect(
      s.receive({
        type: "event",
        version: 1,
        event: { type: "player.renamed", playerId: "p1", name: "Zed" },
      }),
    ).toBeUndefined();
    expect(useGameStore.getState().game?.players.p1?.name).toBe("Zed");
  });

  it("drops duplicates and flags gaps", () => {
    const s = useGameStore.getState();
    s.receive({
      type: "snapshot",
      state: { ...game, version: 5 },
      you: { playerId: "p1", target: null },
    });
    expect(
      s.receive({
        type: "event",
        version: 5,
        event: { type: "host.changed", hostId: "x" },
      }),
    ).toBeUndefined();
    expect(useGameStore.getState().game?.hostId).toBe("p1");
    expect(
      s.receive({
        type: "event",
        version: 8,
        event: { type: "host.changed", hostId: "x" },
      }),
    ).toBe("gap");
  });

  it("tracks private targets, live dials, peeking and errors", () => {
    const s = useGameStore.getState();
    s.receive({
      type: "snapshot",
      state: game,
      you: { playerId: "p1", target: null },
    });
    s.receive({ type: "private", target: 0.42 });
    expect(useGameStore.getState().you?.target).toBe(0.42);
    s.receive({
      type: "ephemeral",
      payload: { kind: "dial.live", dialId: "shared", position: 0.3, by: "p2" },
    });
    expect(useGameStore.getState().live.dials.shared).toEqual({
      position: 0.3,
      by: "p2",
    });
    s.receive({ type: "error", code: "rate_limited", message: "slow" });
    expect(useGameStore.getState().error?.code).toBe("rate_limited");
  });

  it("drops a dial's live preview once its position is committed", () => {
    const s = useGameStore.getState();
    const started = {
      ...game,
      round: {
        index: 0,
        psychicId: "p1",
        psychicTeam: null,
        card: null,
        side: null,
        spectrum: null,
        spin: null,
        spins: 0,
        shroudOpen: false,
        peeks: 0,
        clue: null,
        guessDeadline: null,
        dials: {
          shared: {
            id: "shared",
            owners: ["p2"],
            position: 0.5,
            movedBy: null,
            accepts: [],
            locked: false,
          },
        },
        votes: {},
        target: null,
        result: null,
        log: [],
        catchUp: false,
        startedAt: 0,
      },
    };
    s.receive({
      type: "snapshot",
      state: started,
      you: { playerId: "p1", target: null },
    });
    s.receive({
      type: "ephemeral",
      payload: { kind: "dial.live", dialId: "shared", position: 0.5, by: "p2" },
    });
    expect(useGameStore.getState().live.dials.shared?.position).toBe(0.5);
    s.receive({
      type: "event",
      version: 1,
      event: {
        type: "dial.set",
        dialId: "shared",
        position: 0.2,
        by: "p2",
        at: 1,
      },
    });
    expect(useGameStore.getState().live.dials.shared).toBeUndefined();
    expect(useGameStore.getState().game?.round?.dials.shared?.position).toBe(
      0.2,
    );
  });

  it("celebrates a unanimous lock and this player's own score", () => {
    const seen = vi.fn();
    const unsubscribe = celebrationBus.subscribe(seen);
    const s = useGameStore.getState();
    const p2 = { ...game.players.p1!, id: "p2", name: "Bob", order: 1 };
    const dial = {
      id: "shared",
      owners: ["p2"],
      position: 0.5,
      movedBy: "p2",
      accepts: ["p2"],
      locked: false,
    };
    const started = {
      ...game,
      phase: "guessing" as const,
      players: { ...game.players, p2 },
      round: {
        index: 0,
        psychicId: "p1",
        psychicTeam: null,
        card: null,
        side: null,
        spectrum: null,
        spin: null,
        spins: 1,
        shroudOpen: false,
        peeks: 0,
        clue: "x",
        guessDeadline: null,
        dials: { shared: dial },
        votes: {},
        target: null,
        result: null,
        log: [],
        catchUp: false,
        startedAt: 0,
      },
    };
    s.receive({
      type: "snapshot",
      state: started,
      you: { playerId: "p2", target: null },
    });
    s.receive({
      type: "event",
      version: 1,
      event: { type: "dial.locked", dialId: "shared", at: 1 },
    });
    expect(seen).toHaveBeenLastCalledWith({ kind: "lock" });

    // The clue is announced so the eggs layer can check it for magic words.
    s.receive({
      type: "event",
      version: 2,
      event: { type: "clue.submitted", clue: "Banana", at: 2, deadline: null },
    });
    expect(seen).toHaveBeenLastCalledWith({ kind: "clue", clue: "Banana" });

    // A host force-lock (nobody accepted) is not a celebration.
    s.receive({
      type: "snapshot",
      state: {
        ...started,
        round: {
          ...started.round,
          dials: { shared: { ...dial, accepts: [] } },
        },
      },
      you: { playerId: "p2", target: null },
    });
    s.receive({
      type: "event",
      version: 1,
      event: { type: "dial.locked", dialId: "shared", at: 1 },
    });
    expect(seen).toHaveBeenCalledTimes(2);

    const result: RoundResult = {
      roundIndex: 0,
      psychicId: "p1",
      psychicTeam: null,
      spectrum: { left: "a", right: "b" },
      clue: "x",
      target: 0.5,
      dials: { shared: { position: 0.5, wedge: 4, owners: ["p2"] } },
      vote: null,
      deltas: { coop: 4 },
      goAgain: false,
      psychicBonus: 0,
      gameOver: null,
      stats: {
        durationMs: 0,
        drawMs: null,
        pickMs: null,
        clueMs: null,
        guessMs: null,
        spins: 1,
        peeks: 0,
        clueLength: 1,
        players: {},
      },
    };
    s.receive({
      type: "event",
      version: 2,
      event: {
        type: "round.revealed",
        result,
        scores: { coop: 4 },
        suddenDeath: false,
      },
    });
    expect(seen).toHaveBeenLastCalledWith({ kind: "score", points: 4 });

    s.receive({
      type: "event",
      version: 3,
      event: {
        type: "round.advanced",
        round: started.round,
        activeTeam: null,
        psychicCursor: { left: -1, right: -1, all: 1 },
        roundsPlayed: 0,
        deckRemaining: 10,
      },
    });
    expect(seen).toHaveBeenLastCalledWith({ kind: "newround" });
    s.receive({
      type: "event",
      version: 4,
      event: { type: "game.over", gameOver: { winner: null, label: "x" } },
    });
    expect(seen).toHaveBeenLastCalledWith({ kind: "gameover" });
    unsubscribe();
  });

  it("flags an outdated client when the server protocol is newer", () => {
    const s = useGameStore.getState();
    s.receive({
      type: "snapshot",
      state: { ...game, protocolVersion: game.protocolVersion + 1 },
      you: { playerId: "p1", target: null },
    });
    expect(useGameStore.getState().outdated).toBe(true);
  });
});
