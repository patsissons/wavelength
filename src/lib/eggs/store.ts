import { create } from "zustand";
import { SEASONS, type Season } from "./seasons";

export interface EggModes {
  /** Konami: rainbow wheel and accents. */
  party: boolean;
  /** Hue-cycling background and a faster lounge loop. */
  disco: boolean;
  /** Scanlines and a vignette. */
  crt: boolean;
  /** A critter trotting along the bottom edge, or null. */
  pet: string | null;
  /** Forced seasonal dressing (null = whatever the date says). */
  season: Season | null;
  /** Coins knocked out of the title so far (a hundred is a 1-UP). */
  coins: number;
}

interface EggsStore extends EggModes {
  set: (patch: Partial<EggModes>) => void;
  reset: () => void;
}

const KEY = "wavelength:eggs";

const DEFAULTS: EggModes = {
  party: false,
  disco: false,
  crt: false,
  pet: null,
  season: null,
  coins: 0,
};

/** Session-scoped: a reload keeps the vibe, a fresh tab starts clean. */
function load(): EggModes {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const p = parsed as Partial<Record<keyof EggModes, unknown>>;
    return {
      party: p.party === true,
      disco: p.disco === true,
      crt: p.crt === true,
      pet: typeof p.pet === "string" && p.pet ? p.pet : null,
      season: SEASONS.includes(p.season as Season)
        ? (p.season as Season)
        : null,
      coins:
        Number.isInteger(p.coins) && (p.coins as number) >= 0
          ? (p.coins as number) % 100
          : 0,
    };
  } catch {
    return DEFAULTS;
  }
}

function save(modes: EggModes) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(modes));
  } catch {
    /* private mode / quota */
  }
}

function pick(state: EggsStore): EggModes {
  const { party, disco, crt, pet, season, coins } = state;
  return { party, disco, crt, pet, season, coins };
}

export const useEggs = create<EggsStore>((set, get) => ({
  ...load(),
  set: (patch) => {
    set(patch);
    save(pick(get()));
  },
  reset: () => {
    set(DEFAULTS);
    save(DEFAULTS);
  },
}));
