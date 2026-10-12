/**
 * Pure input-sequence matching for the keyboard and touch triggers. The
 * matcher is a tiny KMP-style automaton: a wrong token restarts the match
 * from the longest prefix the recent tokens still satisfy, so typing
 * "wavewavelength" still lands.
 */
export class SequenceMatcher {
  #seq: ReadonlyArray<string>;
  #recent: string[] = [];

  constructor(sequence: ReadonlyArray<string>) {
    this.#seq = sequence;
  }

  /** Feed one token; true exactly when the sequence just completed. */
  push(token: string): boolean {
    this.#recent.push(token);
    if (this.#recent.length > this.#seq.length) this.#recent.shift();
    if (this.#recent.length < this.#seq.length) return false;
    const hit = this.#recent.every((t, i) => t === this.#seq[i]);
    if (hit) this.#recent = [];
    return hit;
  }

  reset() {
    this.#recent = [];
  }
}

export const KONAMI_KEYS: ReadonlyArray<string> = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/** The touch spelling: eight swipes, then B and A become two taps. */
export const KONAMI_TOUCH: ReadonlyArray<string> = [
  ...KONAMI_KEYS.slice(0, 8),
  "tap",
  "tap",
];

export const MAGIC_WORD = "wavelength";

/** Normalise a keydown into a token: arrows as-is, letters lower-cased. */
export function keyToken(key: string): string | null {
  if (key.startsWith("Arrow")) return key;
  if (key.length === 1 && /[a-z]/i.test(key)) return key.toLowerCase();
  return null;
}

export type Gesture =
  "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "tap";

const SWIPE_MIN = 40;
const TAP_MAX = 12;

/** Classify a touch from its start to its end; null for an unclear drag. */
export function gestureOf(
  dx: number,
  dy: number,
  durationMs: number,
): Gesture | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax <= TAP_MAX && ay <= TAP_MAX) return durationMs <= 500 ? "tap" : null;
  if (Math.max(ax, ay) < SWIPE_MIN) return null;
  // Needs a clear axis: a diagonal swipe is nobody's input.
  if (ax > ay * 1.5) return dx > 0 ? "ArrowRight" : "ArrowLeft";
  if (ay > ax * 1.5) return dy > 0 ? "ArrowDown" : "ArrowUp";
  return null;
}

/** Typing inside a field is never a trigger. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable === true
  );
}

export interface Point {
  x: number;
  y: number;
}

/** Fold an angle into (-π, π]. */
export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

const CIRCLE_MIN_SIDE = 60;
const CIRCLE_MIN_SAMPLES = 12;
/** A hand-drawn lap rarely closes exactly; nine tenths of a turn will do. */
const CIRCLE_MIN_TURN = 2 * Math.PI * 0.9;

/**
 * Did one finger draw a full circle? Samples are the trail from touchstart
 * to touchend. The turn is summed around the bounding-box centre (samples
 * near the centre are skipped so a scribble through the middle does not
 * count), and the trail has to end near where it began.
 */
export function circleOf(points: ReadonlyArray<Point>): "cw" | "ccw" | null {
  if (points.length < CIRCLE_MIN_SAMPLES) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const side = Math.min(maxX - minX, maxY - minY);
  if (side < CIRCLE_MIN_SIDE) return null;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const angles: number[] = [];
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (Math.hypot(dx, dy) < side * 0.25) continue;
    angles.push(Math.atan2(dy, dx));
  }
  if (angles.length < CIRCLE_MIN_SAMPLES) return null;
  let turn = 0;
  for (let i = 1; i < angles.length; i++) {
    const step = wrapAngle(angles[i]! - angles[i - 1]!);
    // A lap never turns a right angle between two samples; a trail that
    // does crossed the middle (a line, a figure of eight), not a circle.
    if (Math.abs(step) > Math.PI / 2) return null;
    turn += step;
  }
  if (Math.abs(turn) < CIRCLE_MIN_TURN) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (Math.hypot(last.x - first.x, last.y - first.y) > side * 0.5) return null;
  // Screen y points down, so a positive turn is clockwise on screen.
  return turn > 0 ? "cw" : "ccw";
}

export const TWIST_MIN = 90;

/** How far, in degrees, a pair of fingers rotated between two moments. */
export function twistOf(a0: Point, b0: Point, a1: Point, b1: Point): number {
  const before = Math.atan2(b0.y - a0.y, b0.x - a0.x);
  const after = Math.atan2(b1.y - a1.y, b1.x - a1.x);
  return (wrapAngle(after - before) * 180) / Math.PI;
}

/** Words typed outside a field (spaces are dropped by `keyToken`). */
export const WORDS: ReadonlyArray<{
  word: string;
  id: "menu" | "disco" | "roll";
}> = [
  { word: MAGIC_WORD, id: "menu" },
  { word: "disco", id: "disco" },
  { word: "doabarrelroll", id: "roll" },
];
