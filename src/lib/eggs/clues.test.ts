import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({
  play: vi.fn(),
  setLoop: vi.fn(),
  ready: true,
  loop: null as string | null,
}));
vi.mock("@/lib/audio", () => ({ audio }));

import { eggBus, type EggEvent } from "./bus";
import { MAGIC_CLUES, fireClueEgg, matchClue } from "./clues";
import { useEggs } from "./store";

describe("magic clues", () => {
  let seen: EggEvent[];
  let off: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    useEggs.getState().reset();
    audio.play.mockClear();
    audio.setLoop.mockClear();
    seen = [];
    off = eggBus.subscribe((e) => seen.push(e));
  });
  afterEach(() => {
    off();
    vi.useRealTimers();
  });

  it("matches exactly, ignoring case, quotes and spacing", () => {
    expect(matchClue("Banana")?.id).toBe("banana");
    expect(matchClue('  "marco!" ')?.id).toBe("marco");
    expect(matchClue("Do  a Barrel   Roll")?.id).toBe("barrelroll");
    expect(matchClue("42")?.subtitle).toBe("Don't panic.");
    expect(matchClue("abracadabra")?.shimmer).toBe(true);
    expect(matchClue("WAVELENGTH")?.id).toBe("meta");
    expect(matchClue("bananas")).toBeNull();
    expect(matchClue("a banana")).toBeNull();
    expect(matchClue("")).toBeNull();
    expect(matchClue(null)).toBeNull();
    expect(MAGIC_CLUES).toHaveLength(7);
  });

  it("rains, chips, rolls and sounds per clue", () => {
    fireClueEgg(matchClue("banana")!);
    expect(seen.at(-1)).toMatchObject({ kind: "rain", id: "banana" });
    expect(audio.play).toHaveBeenLastCalledWith("squeak");

    fireClueEgg(matchClue("marco")!);
    expect(seen.some((e) => e.kind === "chip" && e.text === "POLO!")).toBe(
      true,
    );
    expect(audio.play).toHaveBeenLastCalledWith("splash");

    fireClueEgg(matchClue("42")!);
    expect(seen.at(-1)).toMatchObject({ kind: "rain", id: "42" });

    fireClueEgg(matchClue("abracadabra")!);
    expect(audio.play).toHaveBeenLastCalledWith("sparkle");

    fireClueEgg(matchClue("do a barrel roll")!);
    expect(seen.at(-1)).toEqual({ kind: "roll" });
    expect(audio.play).toHaveBeenLastCalledWith("whoosh");

    fireClueEgg(matchClue("wavelength")!);
    expect(seen.at(-1)).toMatchObject({ kind: "chip", id: "meta" });
  });

  it("the disco clue is a ten-second drop with the record spinning", () => {
    fireClueEgg(matchClue("disco")!);
    expect(useEggs.getState().disco).toBe(true);
    expect(audio.setLoop).toHaveBeenCalledWith("disco");
    audio.loop = "disco";
    vi.advanceTimersByTime(10_100);
    expect(useEggs.getState().disco).toBe(false);
    expect(audio.setLoop).toHaveBeenLastCalledWith(null);

    // Someone else's loop is left alone when the drop ends.
    audio.setLoop.mockClear();
    fireClueEgg(matchClue("disco")!);
    audio.loop = "lounge";
    vi.advanceTimersByTime(10_100);
    expect(audio.setLoop).not.toHaveBeenCalledWith(null);
  });
});
