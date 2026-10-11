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
