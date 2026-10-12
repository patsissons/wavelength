import { describe, expect, it } from "vitest";
import {
  KONAMI_KEYS,
  KONAMI_TOUCH,
  SequenceMatcher,
  WORDS,
  circleOf,
  gestureOf,
  isTypingTarget,
  keyToken,
  twistOf,
  wrapAngle,
  type Point,
} from "./sequences";

/** `turns` laps around (cx, cy), `n` samples, clockwise on screen. */
function lap(turns: number, n = 36, r = 60, cx = 200, cy = 300): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * turns * 2 * Math.PI;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

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

  it("recognises a drawn circle, either way round, and nothing else", () => {
    expect(circleOf(lap(1.05))).toBe("cw");
    expect(circleOf(lap(1.05).reverse())).toBe("ccw");
    expect(circleOf(lap(0.92))).toBe("cw"); // a lap that nearly closes
    expect(circleOf(lap(1.5))).toBeNull(); // ends on the far side
    expect(circleOf(lap(0.6))).toBeNull(); // half a lap
    expect(circleOf(lap(1.05, 36, 20))).toBeNull(); // too small
    expect(circleOf(lap(1.05, 8))).toBeNull(); // too few samples
    // A line out and back through the middle turns no corner.
    const line = Array.from({ length: 30 }, (_, i) => ({
      x: 100 + (i < 15 ? i : 29 - i) * 10,
      y: 300 + (i < 15 ? i : 29 - i) * 10,
    }));
    expect(circleOf(line)).toBeNull();
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
  });

  it("measures how far two fingers twisted", () => {
    const a0 = { x: 100, y: 300 };
    const b0 = { x: 200, y: 300 };
    expect(twistOf(a0, b0, { x: 150, y: 250 }, { x: 150, y: 350 })).toBeCloseTo(
      90,
    );
    expect(twistOf(a0, b0, { x: 150, y: 350 }, { x: 150, y: 250 })).toBeCloseTo(
      -90,
    );
    expect(twistOf(a0, b0, { x: 110, y: 310 }, { x: 210, y: 310 })).toBe(0);
    // Across the ±180° seam the short way round wins (y points down, so
    // swinging from below the axis to above it is clockwise on screen).
    expect(
      twistOf(
        { x: 0, y: 0 },
        { x: -100, y: 1 },
        { x: 0, y: 0 },
        { x: -100, y: -1 },
      ),
    ).toBeCloseTo(1.15, 1);
    expect(WORDS.map((w) => w.id)).toEqual(["menu", "disco", "roll"]);
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
