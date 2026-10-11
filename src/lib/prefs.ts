import { create } from "zustand";

interface Prefs {
  muted: boolean;
  reduceEffects: boolean;
  /** iOS requires a user gesture before audio can play. */
  soundUnlocked: boolean;
  setMuted: (muted: boolean) => void;
  setReduceEffects: (reduce: boolean) => void;
  setSoundUnlocked: (unlocked: boolean) => void;
}

const KEY = "wavelength:prefs";

function load(): Pick<Prefs, "muted" | "reduceEffects"> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { muted: false, reduceEffects: false, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  const reduce =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { muted: false, reduceEffects: reduce };
}

function save(prefs: Pick<Prefs, "muted" | "reduceEffects">) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export const usePrefs = create<Prefs>((set, get) => ({
  ...load(),
  soundUnlocked: false,
  setMuted: (muted) => {
    set({ muted });
    save({ muted, reduceEffects: get().reduceEffects });
  },
  setReduceEffects: (reduceEffects) => {
    set({ reduceEffects });
    save({ muted: get().muted, reduceEffects });
  },
  setSoundUnlocked: (soundUnlocked) => set({ soundUnlocked }),
}));
