import { useEffect, useState } from "react";

/** A game code that reads the same backwards (BCCB, GXXG). */
export function isPalindrome(code: string): boolean {
  const s = code.trim().toUpperCase();
  return s.length > 1 && s === [...s].reverse().join("");
}

export const QUIPS: ReadonlyArray<string> = [
  "Definitely not telepathy.",
  "Spin responsibly.",
  "No dials were harmed.",
  "Somewhere between a hunch and a guess.",
  "Left? Right? Yes.",
  "Your friends are thinking it too.",
  "Now with 100% more wedge.",
];

/** Counts quick taps: true on the n-th tap inside the window. */
export class TapCounter {
  #times: number[] = [];
  constructor(
    private readonly count: number,
    private readonly windowMs: number,
  ) {}

  push(now: number): boolean {
    this.#times.push(now);
    this.#times = this.#times.filter((t) => now - t <= this.windowMs);
    if (this.#times.length >= this.count) {
      this.#times = [];
      return true;
    }
    return false;
  }
}

export const PATIENCE_AFTER_MS = 60_000;
export const PATIENCE_EVERY_MS = 30_000;

const PATIENCE: ReadonlyArray<(host: string) => string> = [
  () => "Still waiting…",
  (host) => `${host} is probably getting snacks.`,
  () => "Have you tried turning the host off and on again?",
  (host) => `Any minute now. Probably. Right, ${host}?`,
  () => "The wheel is warming up. Allegedly.",
  (host) => `${host}, everyone can see you.`,
];

/** The lounge waiting line once the wait drags on; null keeps the default. */
export function patienceQuip(elapsedMs: number, host: string): string | null {
  if (elapsedMs < PATIENCE_AFTER_MS) return null;
  const index = Math.floor((elapsedMs - PATIENCE_AFTER_MS) / PATIENCE_EVERY_MS);
  return PATIENCE[index % PATIENCE.length]!(host);
}

/** Ticks every few seconds from mount and reports the current quip. */
export function usePatience(host: string): string | null {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 5000);
    return () => clearInterval(timer);
  }, []);
  return patienceQuip(elapsed, host);
}
