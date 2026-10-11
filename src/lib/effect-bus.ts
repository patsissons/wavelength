import type { Ephemeral } from "@shared/protocol/messages";

export type EffectPayload = Extract<Ephemeral, { kind: "effect" }>;
type Listener = (effect: EffectPayload) => void;

/** Tiny pub/sub for incoming effects, decoupled from React state. */
class EffectBus {
  #listeners = new Set<Listener>();
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  emit(effect: EffectPayload) {
    for (const listener of this.#listeners) listener(effect);
  }
}

export const effectBus = new EffectBus();
