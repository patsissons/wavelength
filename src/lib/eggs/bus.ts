import { Bus } from "@/lib/effect-bus";

/** One-shot egg moments the EggsLayer renders. */
export type EggEvent =
  | { kind: "rain"; id: string; glyphs: ReadonlyArray<string>; count: number }
  | { kind: "chip"; id: string; text: string }
  | { kind: "roll" };

export const eggBus = new Bus<EggEvent>();
