import { beforeEach, describe, expect, it, vi } from "vitest";

const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/lib/audio", () => ({ audio: { play } }));

import { eggBus, type EggEvent } from "./bus";
import { COINS_PER_LIFE, bumpBlock } from "./coins";
import { useEggs } from "./store";

describe("coin block", () => {
  beforeEach(() => {
    useEggs.getState().reset();
    play.mockClear();
  });

  it("counts coins and hands out a life at a hundred", () => {
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));
    expect(bumpBlock()).toEqual({ coins: 1, oneUp: false });
    expect(useEggs.getState().coins).toBe(1);
    expect(seen).toEqual([{ kind: "coin", coins: 1, oneUp: false }]);
    expect(play).toHaveBeenCalledWith("coin");

    useEggs.getState().set({ coins: COINS_PER_LIFE - 1 });
    expect(bumpBlock()).toEqual({ coins: 0, oneUp: true });
    expect(useEggs.getState().coins).toBe(0);
    expect(play).toHaveBeenCalledWith("oneup");
    expect(seen).toContainEqual({ kind: "chip", id: "oneup", text: "1-UP" });
    off();
  });
});
