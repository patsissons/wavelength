import { useState } from "react";
import { audio } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import { eggBus } from "./bus";
import { useLongPress, type LongPressHandlers } from "./press";

/** How long the code spends down the pipe (matches the CSS). */
export const WARP_MS = 1200;

/** The game code is a warp pipe: a chip, a slide and a buzz. */
export function warp(): void {
  eggBus.emit({ kind: "chip", id: "warp", text: "🟢 Welcome to Warp Zone!" });
  audio.play("warp");
  vibrate([30, 60, 30]);
}

/**
 * Props for a game-code element: a one-second hold warps it (the element
 * drops down the pipe and climbs back while `warping`).
 */
export function useWarpPipe(): LongPressHandlers & { warping: boolean } {
  const [warping, setWarping] = useState(false);
  const press = useLongPress(1000, () => {
    warp();
    setWarping(true);
    setTimeout(() => setWarping(false), WARP_MS);
  });
  return { ...press, warping };
}
