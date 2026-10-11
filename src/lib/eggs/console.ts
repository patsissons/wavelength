import { eggBus } from "./bus";
import { EGGS, menuText } from "./registry";
import { useEggs } from "./store";

/**
 * The console API behind `window.wavelength`. Every method returns a short
 * confirmation string so the console echoes what just happened.
 */
export interface EggApi {
  list: () => string;
  rain: (glyph?: string, count?: number) => string;
  barrelRoll: () => string;
  crt: () => string;
  pet: (glyph?: string | null) => string;
  reset: () => string;
}

declare global {
  interface Window {
    wavelength?: EggApi;
  }
}

const MENU_STYLE = [
  "font: 600 14px/1.5 ui-monospace, Menlo, monospace",
  "color: oklch(0.85 0.17 85)",
  "background: oklch(0.17 0.045 290)",
  "padding: 10px 14px",
  "border-radius: 10px",
].join(";");

export function printMenu(log: (...args: unknown[]) => void = console.log) {
  log(`%c${menuText()}`, MENU_STYLE);
}

export const eggApi: EggApi = {
  list() {
    printMenu();
    return `${EGGS.length} eggs`;
  },
  rain(glyph = "🌧️", count = 24) {
    const glyphs = Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(glyph),
      (s) => s.segment,
    ).filter((g) => g.trim());
    const n = Math.max(1, Math.min(60, Math.floor(count) || 1));
    eggBus.emit({
      kind: "rain",
      id: "custom",
      glyphs: glyphs.length ? glyphs : ["🌧️"],
      count: n,
    });
    return `raining ${n} × ${glyph}`;
  },
  barrelRoll() {
    eggBus.emit({ kind: "roll" });
    return "🛩️ rolling";
  },
  crt() {
    const crt = !useEggs.getState().crt;
    useEggs.getState().set({ crt });
    return crt ? "📺 CRT on" : "CRT off";
  },
  pet(glyph = "🐈") {
    const pet = glyph && glyph.trim() ? glyph.trim() : null;
    useEggs.getState().set({ pet });
    return pet ? `${pet} adopted` : "pet sent home";
  },
  reset() {
    useEggs.getState().reset();
    return "all eggs off";
  },
};

/**
 * Installs `window.wavelength` as a getter: reading it prints the menu and
 * returns the API. A method call like `wavelength.crt()` reads the getter
 * too, so the print is deferred a tick and skipped when a method ran in
 * the meantime: `wavelength` shows the menu, `wavelength.crt()` does not.
 */
export function installConsole(target: Window = window) {
  if (Object.getOwnPropertyDescriptor(target, "wavelength")) return;
  let suppress = false;
  const wrapped: Record<string, (...args: never[]) => string> = {};
  for (const [key, fn] of Object.entries(eggApi)) {
    wrapped[key] = (...args: never[]) => {
      suppress = true;
      return (fn as (...a: never[]) => string)(...args);
    };
  }
  const api = wrapped as unknown as EggApi;
  Object.defineProperty(target, "wavelength", {
    configurable: true,
    enumerable: false,
    get() {
      suppress = false;
      setTimeout(() => {
        if (!suppress) printMenu();
        suppress = false;
      }, 0);
      return api;
    },
  });
}
