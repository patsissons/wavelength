import { usePrefs } from "./prefs";

/** Progressive enhancement: Android Chrome vibrates, iOS Safari ignores it. */
export function vibrate(pattern: ReadonlyArray<number> | number): void {
  if (usePrefs.getState().reduceEffects) return;
  try {
    navigator.vibrate?.(pattern as number[] | number);
  } catch {
    /* unsupported */
  }
}
