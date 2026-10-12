import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast, play } = vi.hoisted(() => ({ toast: vi.fn(), play: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/audio", () => ({ audio: { play } }));

import { createGame } from "@shared/game/commands";
import { useGameStore } from "@/lib/store";
import { eggBus, type EggEvent } from "./bus";
import { KONAMI_KEYS } from "./sequences";
import { useEggs } from "./store";
import { installTriggers, toggleParty } from "./triggers";

function press(key: string, target: EventTarget = document.body) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

type Finger = { id?: number; x: number; y: number };

/** Dispatch a touch event: `down` are the fingers still on the glass. */
function fingers(
  type: "touchstart" | "touchmove" | "touchend",
  down: Finger[],
  changed: Finger[],
  t = 0,
) {
  const touchOf = (f: Finger) =>
    ({ identifier: f.id ?? 0, clientX: f.x, clientY: f.y }) as Touch;
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: down.map(touchOf) });
  Object.defineProperty(event, "changedTouches", {
    value: changed.map(touchOf),
  });
  Object.defineProperty(event, "timeStamp", { value: t });
  document.dispatchEvent(event);
  return event;
}

function touch(
  type: "touchstart" | "touchend",
  x: number,
  y: number,
  t: number,
) {
  const f = { x, y };
  fingers(type, type === "touchstart" ? [f] : [], [f], t);
}

describe("egg triggers", () => {
  let uninstall: () => void;
  let seen: EggEvent[];
  let off: () => void;
  beforeEach(() => {
    useEggs.getState().reset();
    useGameStore.getState().reset();
    toast.mockClear();
    play.mockClear();
    seen = [];
    off = eggBus.subscribe((e) => seen.push(e));
    uninstall = installTriggers();
  });
  afterEach(() => {
    off();
    uninstall();
  });

  it("toggles party mode with sound, rain and a room broadcast only when switching on", () => {
    expect(toggleParty()).toBe(true);
    expect(useEggs.getState().party).toBe(true);
    expect(play).toHaveBeenCalledWith("konami");
    expect(seen.map((e) => e.kind)).toEqual(["rain", "effect"]);
    expect(seen[1]).toEqual({ kind: "effect", effectId: "konami" });
    expect(toast).toHaveBeenCalledWith("🕹️ +30 lives");
    expect(toggleParty()).toBe(false);
    expect(seen).toHaveLength(2);
    expect(toast).toHaveBeenLastCalledWith("Party's over.");
  });

  it("listens for the Konami keys outside text fields", () => {
    for (const key of KONAMI_KEYS) press(key);
    expect(useEggs.getState().party).toBe(true);

    const input = document.createElement("input");
    document.body.appendChild(input);
    for (const key of KONAMI_KEYS) press(key, input);
    expect(useEggs.getState().party).toBe(true); // ignored: still on
    input.remove();

    for (const key of KONAMI_KEYS.slice(0, 2)) press(key);
    uninstall();
    for (const key of KONAMI_KEYS.slice(2)) press(key);
    expect(useEggs.getState().party).toBe(true); // uninstalled: no toggle
    uninstall = () => {};
  });

  it("typed words outside a field drop the disco and roll the page", () => {
    for (const ch of "disco") press(ch);
    expect(useEggs.getState().disco).toBe(true);
    expect(toast).toHaveBeenLastCalledWith("🪩 Disco.");
    for (const ch of "do a barrel roll") press(ch);
    expect(seen.at(-1)).toEqual({ kind: "roll" });
    expect(play).toHaveBeenLastCalledWith("whoosh");
  });

  it("a drawn circle drops the disco on the home screen, not in a round", () => {
    const circle = (cx: number, cy: number, r = 60) => {
      const n = 36;
      const at = (i: number) => {
        const a = (i / (n - 1)) * 1.05 * 2 * Math.PI;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      };
      fingers("touchstart", [at(0)], [at(0)], 0);
      for (let i = 1; i < n - 1; i++)
        fingers("touchmove", [at(i)], [at(i)], i * 20);
      fingers("touchend", [], [at(n - 1)], n * 20);
    };
    circle(200, 300);
    expect(useEggs.getState().disco).toBe(true);
    expect(toast).toHaveBeenLastCalledWith("🪩 Disco.");
    circle(200, 300);
    expect(useEggs.getState().disco).toBe(false);

    const game = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    }).game;
    useGameStore.getState().receive({
      type: "snapshot",
      state: { ...game, phase: "guessing" },
      you: { playerId: "p1", target: null },
    });
    circle(200, 300);
    expect(useEggs.getState().disco).toBe(false);
  });

  it("a two-finger twist rolls the page and blocks the pinch-zoom", () => {
    const a = { id: 1, x: 100, y: 300 };
    const b = { id: 2, x: 200, y: 300 };
    fingers("touchstart", [a], [a], 0);
    fingers("touchstart", [a, b], [b], 10);
    const a1 = { id: 1, x: 150, y: 250 };
    const b1 = { id: 2, x: 150, y: 350 };
    const move = fingers("touchmove", [a1, b1], [a1, b1], 100);
    expect(move.defaultPrevented).toBe(true);
    fingers("touchend", [b1], [a1], 200);
    expect(seen).toContainEqual({ kind: "roll" });
    expect(play).toHaveBeenCalledWith("whoosh");
    // The second finger lifting is nothing on its own.
    seen.length = 0;
    fingers("touchend", [], [b1], 210);
    expect(seen).toEqual([]);

    // A small twist is not a roll, and nothing is prevented without a pair.
    fingers("touchstart", [a], [a], 300);
    fingers("touchstart", [a, b], [b], 310);
    const b2 = { id: 2, x: 200, y: 330 };
    fingers("touchmove", [a, b2], [b2], 400);
    fingers("touchend", [b2], [a], 500);
    expect(seen).toEqual([]);
    const lone = fingers("touchmove", [a], [a], 600);
    expect(lone.defaultPrevented).toBe(false);
  });

  it("the magic word nudges toward the console", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    for (const ch of "say wavelength") press(ch);
    expect(toast).toHaveBeenCalledWith("👀 Psst. The console knows more.");
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("reads the Konami swipes on the home screen and the lounge, not in a round", () => {
    const swipe = (dx: number, dy: number, t: number) => {
      touch("touchstart", 100, 300, t);
      touch("touchend", 100 + dx, 300 + dy, t + 150);
    };
    const tap = (t: number) => {
      touch("touchstart", 100, 300, t);
      touch("touchend", 102, 301, t + 80);
    };
    const code = (t0: number) => {
      const moves: [number, number][] = [
        [0, -90],
        [0, -90],
        [0, 90],
        [0, 90],
        [-90, 0],
        [90, 0],
        [-90, 0],
        [90, 0],
      ];
      moves.forEach(([dx, dy], i) => swipe(dx, dy, t0 + i * 300));
      tap(t0 + 3000);
      tap(t0 + 3300);
    };
    code(0);
    expect(useEggs.getState().party).toBe(true);

    const game = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    }).game;
    useGameStore.getState().receive({
      type: "snapshot",
      state: { ...game, phase: "guessing" },
      you: { playerId: "p1", target: null },
    });
    code(10_000);
    expect(useEggs.getState().party).toBe(true); // a round: ignored

    useGameStore.getState().receive({
      type: "snapshot",
      state: game,
      you: { playerId: "p1", target: null },
    });
    // A diagonal in the middle breaks the sequence; a clean one lands.
    swipe(60, 60, 20_000);
    code(21_000);
    expect(useEggs.getState().party).toBe(false);
  });
});
