import type { Ephemeral } from "@shared/protocol/messages";

export type EffectPayload = Extract<
  Ephemeral,
  { kind: "effect" | "poke" | "reaction" }
>;

/** Tiny pub/sub decoupled from React state. */
export class Bus<T> {
  #listeners = new Set<(value: T) => void>();
  subscribe(listener: (value: T) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  emit(value: T) {
    for (const listener of this.#listeners) listener(value);
  }
}

/** Incoming player-sent effects. */
export const effectBus = new Bus<EffectPayload>();

/**
 * Celebrations the client derives from game events: the dial locking
 * because everyone accepted, and a guesser's own score at the reveal.
 */
export type Celebration =
  | { kind: "lock" }
  | { kind: "score"; points: 2 | 3 | 4 }
  | { kind: "newround" }
  | { kind: "gameover" }
  /** The clue was given; the eggs layer checks it for magic words. */
  | { kind: "clue"; clue: string }
  /** The dial timer ran out and every dial locked where it was. */
  | { kind: "timeup" };

export const celebrationBus = new Bus<Celebration>();
