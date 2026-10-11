import { create } from "zustand";

interface Prefs {
  muted: boolean;
  /** Looping lounge groove while waiting for the game to start. */
  music: boolean;
  reduceEffects: boolean;
  /** iOS requires a user gesture before audio can play. */
  soundUnlocked: boolean;
  setMuted: (muted: boolean) => void;
  setMusic: (music: boolean) => void;
  setReduceEffects: (reduce: boolean) => void;
  setSoundUnlocked: (unlocked: boolean) => void;
}

const KEY = "wavelength:prefs";

type Saved = Pick<Prefs, "muted" | "music" | "reduceEffects">;

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw)
      return {
        muted: false,
        music: true,
        reduceEffects: false,
        ...JSON.parse(raw),
      };
  } catch {
    /* ignore */
  }
  const reduce =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  return { muted: false, music: true, reduceEffects: reduce };
}

function save(prefs: Saved) {
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
    save({ muted, music: get().music, reduceEffects: get().reduceEffects });
  },
  setMusic: (music) => {
    set({ music });
    save({ muted: get().muted, music, reduceEffects: get().reduceEffects });
  },
  setReduceEffects: (reduceEffects) => {
    set({ reduceEffects });
    save({ muted: get().muted, music: get().music, reduceEffects });
  },
  setSoundUnlocked: (soundUnlocked) => set({ soundUnlocked }),
}));
