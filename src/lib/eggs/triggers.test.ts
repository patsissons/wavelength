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

function touch(
  type: "touchstart" | "touchend",
  x: number,
  y: number,
  t: number,
) {
  const point = { clientX: x, clientY: y } as Touch;
  const event = new Event(type, { bubbles: true }) as TouchEvent;
  Object.defineProperty(event, "touches", {
    value: type === "touchstart" ? [point] : [],
  });
  Object.defineProperty(event, "changedTouches", { value: [point] });
  Object.defineProperty(event, "timeStamp", { value: t });
  document.dispatchEvent(event);
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
