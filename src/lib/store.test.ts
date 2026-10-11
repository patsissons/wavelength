import { beforeEach, describe, expect, it } from "vitest";
import { createGame } from "@shared/game/commands";
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
    s.receive({
      type: "ephemeral",
      payload: { kind: "shroud", open: true, by: "p1" },
    });
    expect(useGameStore.getState().live.psychicPeeking).toBe(true);
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
        clue: null,
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
      event: { type: "dial.set", dialId: "shared", position: 0.2, by: "p2" },
    });
    expect(useGameStore.getState().live.dials.shared).toBeUndefined();
    expect(useGameStore.getState().game?.round?.dials.shared?.position).toBe(
      0.2,
    );
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
