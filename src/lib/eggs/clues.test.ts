import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({
  play: vi.fn(),
  setLoop: vi.fn(),
  ready: true,
  loop: null as string | null,
}));
vi.mock("@/lib/audio", () => ({ audio }));

import { CLUE_EFFECT_PREFIX, EFFECTS } from "@shared/effects/catalog";
import { eggBus, type EggEvent } from "./bus";
import {
  CLUE_EGGS,
  MAGIC_CLUES,
  MagicGate,
  castMagicClue,
  clueEffectId,
  clueEggOfEffect,
  clueIcon,
  fireClueEgg,
  matchClue,
} from "./clues";
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
    expect(matchClue("do-a-barrel-roll")?.id).toBe("barrelroll");
    expect(matchClue("42")?.subtitle).toBe("Don't panic.");
    expect(matchClue("abracadabra")?.shimmer).toBe(true);
    expect(matchClue("WAVELENGTH")?.id).toBe("meta");
    expect(matchClue("bananas")).toBeNull();
    expect(matchClue("a banana")).toBeNull();
    expect(matchClue("")).toBeNull();
    expect(matchClue(null)).toBeNull();
    expect(MAGIC_CLUES).toHaveLength(7);
  });

  it("has a hidden catalog effect for every egg, and only those", () => {
    const ids = CLUE_EGGS.map((egg) => clueEffectId(egg)).sort();
    const catalog = EFFECTS.filter((e) => e.id.startsWith(CLUE_EFFECT_PREFIX))
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual(catalog);
    expect(clueEggOfEffect("clue:marco")?.id).toBe("marco");
    expect(clueEggOfEffect("clue:nope")).toBeNull();
    expect(clueEggOfEffect("applause")).toBeNull();
    expect(clueIcon(matchClue("banana")!)).toBe("🍌");
  });

  it("gates a magic word: the egg first, the real clue when said again", () => {
    const gate = new MagicGate();
    expect(gate.take("Banana")?.id).toBe("banana");
    expect(gate.take("banana!")).toBeNull(); // the same word: send it
    expect(gate.take("banana")?.id).toBe("banana"); // and it is magic again
    expect(gate.take("marco")?.id).toBe("marco"); // a different word is new
    expect(gate.take("a real clue")).toBeNull();
    expect(gate.take("marco")?.id).toBe("marco"); // a real clue reset it
  });

  it("casts to the room when effects are on, locally when they are off", () => {
    castMagicClue(matchClue("banana")!, true);
    expect(seen).toEqual([{ kind: "effect", effectId: "clue:banana" }]);
    expect(audio.play).not.toHaveBeenCalled();
    castMagicClue(matchClue("banana")!, false);
    expect(seen.at(-1)).toMatchObject({ kind: "rain", id: "banana" });
    expect(audio.play).toHaveBeenCalledWith("squeak");
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
