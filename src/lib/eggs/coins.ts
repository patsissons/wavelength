import { audio } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import { eggBus } from "./bus";
import { useEggs } from "./store";

export const COINS_PER_LIFE = 100;

/**
 * The Wavelength title is a coin block: hit it from below and a coin
 * pops out. The count lives in the egg store for the session; the
 * hundredth coin is a 1-UP and the count starts over.
 */
export function bumpBlock(): { coins: number; oneUp: boolean } {
  const next = useEggs.getState().coins + 1;
  const oneUp = next >= COINS_PER_LIFE;
  const coins = oneUp ? 0 : next;
  useEggs.getState().set({ coins });
  eggBus.emit({ kind: "coin", coins, oneUp });
  audio.play("coin");
  vibrate(15);
  if (oneUp) {
    audio.play("oneup");
    eggBus.emit({ kind: "chip", id: "oneup", text: "1-UP" });
    eggBus.emit({ kind: "rain", id: "oneup", glyphs: ["🟢", "🍄"], count: 8 });
  }
  return { coins, oneUp };
}
