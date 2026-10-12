import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/lib/audio", () => ({ audio }));

import { createGame } from "@shared/game/commands";
import type { GameState, RoundResult } from "@shared/game/types";
import { eggBus, type EggEvent } from "./bus";
import {
  HOT_VELOCITY,
  celebrateHatTrick,
  flagpole,
  hatTrick,
  hatTrickText,
  hotWheel,
  lastLockAt,
  neutralDrop,
} from "./round";

const base = createGame({
  code: "BCDF",
  hostId: "p1",
  hostName: "Ann",
  hostTokenHash: "h",
  now: 0,
}).game;

function result(
  dials: Record<string, number>,
  psychicTeam: "left" | "right" | null = null,
): RoundResult {
  return {
    roundIndex: 0,
    psychicId: "p1",
    psychicTeam,
    spectrum: { left: "a", right: "b" },
    clue: "x",
    target: 0.5,
    dials: Object.fromEntries(
      Object.entries(dials).map(([id, wedge]) => [
        id,
        { position: 0.5, wedge: wedge as 0 | 2 | 3 | 4, owners: [id] },
      ]),
    ),
    vote: null,
    deltas: {},
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
}

function withMode(
  mode: "teams" | "coop" | "ffa",
  history: RoundResult[],
): GameState {
  return { ...base, settings: { ...base.settings, mode }, history };
}

describe("hat trick", () => {
  it("needs three bullseyes in a row by the same scorer", () => {
    const four = result({ shared: 4 }, "left");
    const three = result({ shared: 3 }, "left");
    expect(hatTrick(withMode("teams", [four, four]))).toBeNull();
    expect(hatTrick(withMode("teams", [four, four, four]))).toBe("left");
    expect(hatTrick(withMode("teams", [four, three, four]))).toBeNull();
    expect(hatTrick(withMode("teams", [three, four, four, four]))).toBe("left");
    // A team swap in the middle (catch-up turns aside) is no streak.
    expect(
      hatTrick(withMode("teams", [four, result({ shared: 4 }, "right"), four])),
    ).toBeNull();
    expect(hatTrick(withMode("coop", [four, four, four]))).toBe("coop");
    expect(hatTrick(withMode("coop", [four, four, three]))).toBeNull();
  });

  it("tracks each guesser's own dial in free-for-all", () => {
    const r1 = result({ p2: 4, p3: 2 });
    const r2 = result({ p2: 4, p3: 4 });
    const r3 = result({ p2: 4, p3: 4 });
    expect(hatTrick(withMode("ffa", [r1, r2, r3]))).toBe("p2");
    expect(hatTrick(withMode("ffa", [r2, r3, result({ p3: 4 })]))).toBe("p3");
    expect(hatTrick(withMode("ffa", [r1, r2, result({ p3: 4 })]))).toBeNull();
  });

  it("names the scorer and fires the moment", () => {
    const game = withMode("ffa", []);
    expect(hatTrickText(game, "coop")).toBe("🎩 Hat trick!");
    expect(hatTrickText(game, "left")).toBe("🎩 Hat trick, Left Brain!");
    expect(hatTrickText(game, "p1")).toBe("🎩 Hat trick, Ann!");
    expect(hatTrickText(game, "ghost")).toBe("🎩 Hat trick!");
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));
    celebrateHatTrick(game, "p1");
    off();
    expect(seen.map((e) => e.kind)).toEqual(["chip", "rain"]);
    expect(audio.play).toHaveBeenCalledWith("fanfare");
  });
});

describe("hot wheel and the neutral drop", () => {
  let seen: EggEvent[];
  let off: () => void;
  beforeEach(() => {
    seen = [];
    off = eggBus.subscribe((e) => seen.push(e));
    audio.play.mockClear();
  });
  afterEach(() => off());

  it("only a flat-out flick heats the wheel", () => {
    expect(hotWheel(36)).toBe(false); // the fastest tap
    expect(seen).toEqual([]);
    expect(hotWheel(-HOT_VELOCITY)).toBe(true);
    expect(seen.map((e) => e.kind)).toEqual(["hot", "rain"]);
    expect(seen[1]).toMatchObject({ id: "hot", direction: "rise" });
    expect(audio.play).toHaveBeenCalledWith("squeal");
  });

  it("dead centre is very neutral", () => {
    expect(neutralDrop(0.49)).toBe(false);
    expect(neutralDrop(0.503)).toBe(true);
    expect(seen).toEqual([
      { kind: "chip", id: "neutral", text: "🇨🇭 Very neutral." },
    ]);
  });

  it("counts fireworks by the flagpole rule", () => {
    expect(flagpole(10_000, 4_600)).toBe(6); // 5.4 s left reads 6
    expect(flagpole(10_000, 7_000)).toBe(3);
    expect(flagpole(10_000, 9_000)).toBe(1);
    expect(flagpole(30_000, 9_000)).toBe(1); // 21
    expect(flagpole(10_000, 8_000)).toBe(0); // 2
    expect(flagpole(10_000, 10_000)).toBe(0); // out of time
    expect(flagpole(10_000, 12_000)).toBe(0);
    expect(flagpole(null, 1_000)).toBe(0); // no timer
    expect(flagpole(10_000, null)).toBe(0);
    expect(lastLockAt({ round: null })).toBeNull();
    expect(
      lastLockAt({
        round: {
          ...base.round!,
          log: [
            { t: "lock", at: 3, dialId: "a" },
            { t: "clue", at: 4 },
            { t: "lock", at: 5, dialId: "b" },
          ],
        },
      } as never),
    ).toBe(5);
  });
});
