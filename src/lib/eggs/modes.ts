import { useEggs } from "./store";

/** Scanlines and a vignette, on or off; returns the new state. */
export function toggleCrt(): boolean {
  const crt = !useEggs.getState().crt;
  useEggs.getState().set({ crt });
  return crt;
}
