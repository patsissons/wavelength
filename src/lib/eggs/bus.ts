import { Bus } from "@/lib/effect-bus";

/** One-shot egg moments the EggsLayer renders. */
export type EggEvent =
  | {
      kind: "rain";
      id: string;
      glyphs: ReadonlyArray<string>;
      count: number;
      /** Falls from the top unless told to rise from the bottom. */
      direction?: "rise" | "fall";
    }
  /** The wheel was flicked flat out: the ticks glow for a moment. */
  | { kind: "hot" }
  | { kind: "chip"; id: string; text: string }
  | { kind: "roll" }
  /** Ask the room bridge to send a hidden catalog effect to the room. */
  | { kind: "effect"; effectId: string };

export const eggBus = new Bus<EggEvent>();
