import { describe, expect, it } from "vitest";
import {
  KONAMI_KEYS,
  KONAMI_TOUCH,
  SequenceMatcher,
  gestureOf,
  isTypingTarget,
  keyToken,
} from "./sequences";

describe("SequenceMatcher", () => {
  it("completes once the whole sequence arrives in order", () => {
    const m = new SequenceMatcher(KONAMI_KEYS);
    const hits = KONAMI_KEYS.map((k) => m.push(k));
    expect(hits.slice(0, -1).every((h) => !h)).toBe(true);
    expect(hits.at(-1)).toBe(true);
    // It re-arms afterwards.
    expect(KONAMI_KEYS.map((k) => m.push(k)).at(-1)).toBe(true);
  });

  it("survives mistakes and overlapping prefixes", () => {
    const m = new SequenceMatcher(Array.from("wavelength"));
    for (const ch of "wavewavelengt") expect(m.push(ch)).toBe(false);
    expect(m.push("h")).toBe(true);
    const k = new SequenceMatcher(KONAMI_KEYS);
    for (const key of ["ArrowUp", "ArrowUp", "ArrowDown", "x"]) k.push(key);
    expect(KONAMI_KEYS.map((key) => k.push(key)).at(-1)).toBe(true);
    k.push("ArrowUp");
    k.reset();
    expect(KONAMI_KEYS.map((key) => k.push(key)).at(-1)).toBe(true);
  });
});

describe("tokens and gestures", () => {
  it("keeps arrows, lower-cases letters and drops the rest", () => {
    expect(keyToken("ArrowLeft")).toBe("ArrowLeft");
    expect(keyToken("B")).toBe("b");
    expect(keyToken("Shift")).toBeNull();
    expect(keyToken("1")).toBeNull();
  });

  it("classifies swipes by their dominant axis and taps by stillness", () => {
    expect(gestureOf(0, -80, 200)).toBe("ArrowUp");
    expect(gestureOf(5, 90, 200)).toBe("ArrowDown");
    expect(gestureOf(-70, 10, 200)).toBe("ArrowLeft");
    expect(gestureOf(70, -10, 200)).toBe("ArrowRight");
    expect(gestureOf(3, 4, 120)).toBe("tap");
    expect(gestureOf(3, 4, 900)).toBeNull(); // a long press
    expect(gestureOf(20, 20, 200)).toBeNull(); // too short
    expect(gestureOf(60, 60, 200)).toBeNull(); // diagonal
    expect(KONAMI_TOUCH.slice(-2)).toEqual(["tap", "tap"]);
  });

  it("knows a text field when it sees one", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    const div = document.createElement("div");
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(area)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
