import type { LoopName } from "@/lib/audio";
import { useEggs } from "./store";

/** Which record the lounge spins, if any. */
export function loungeLoop(opts: {
  unlocked: boolean;
  muted: boolean;
  music: boolean;
  disco: boolean;
}): LoopName | null {
  if (!opts.unlocked || opts.muted || !opts.music) return null;
  return opts.disco ? "disco" : "lounge";
}

export function toggleDisco(): boolean {
  const disco = !useEggs.getState().disco;
  useEggs.getState().set({ disco });
  return disco;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * A timed drop (the "disco" clue): disco on for `ms`, then back to how it
 * was. A second drop while one is running just extends it.
 */
export function discoFor(ms: number): void {
  const store = useEggs.getState();
  const wasOn = timer === null ? store.disco : false;
  if (timer !== null) clearTimeout(timer);
  store.set({ disco: true });
  timer = setTimeout(() => {
    timer = null;
    useEggs.getState().set({ disco: wasOn });
  }, ms);
}
