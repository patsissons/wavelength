/**
 * Every easter egg, as the console menu describes it. Behaviour lives next
 * to whatever triggers it; this list is the single place that says what
 * exists, so the menu and the docs never drift from the code.
 */
import type { Platform } from "./platform";

export interface EggDef {
  id: string;
  name: string;
  /** How a player triggers it (keyboard / desktop wording). */
  how: string;
  /** The same, worded for a phone, when it differs. */
  touch?: string;
  /** Only reachable from the console API (nothing to do on a phone). */
  consoleOnly?: boolean;
  /** What they get. */
  what: string;
  /** Console call that fires it by hand, if there is one. */
  api?: string;
}

/** The trigger wording for a platform (see `lib/eggs/platform.ts`). */
export function howFor(egg: EggDef, platform: Platform): string {
  return platform === "desktop" ? egg.how : (egg.touch ?? egg.how);
}

export const EGGS: ReadonlyArray<EggDef> = [
  {
    id: "menu",
    name: "The menu",
    how: "type `wavelength` in the browser console",
    touch:
      "needs a desktop browser console; on a phone this cheat sheet is the way in",
    what: "prints this list and hands back the egg API",
    api: "wavelength.list()",
  },
  {
    id: "cheatsheet",
    name: "Cheat sheet",
    how: "tap the QR code five times in five seconds (lounge or in-game)",
    what: "a sheet with every egg and how to trigger it on this device",
  },
  {
    id: "konami",
    name: "Konami code",
    how: "↑ ↑ ↓ ↓ ← → ← → B A on a keyboard (home or lounge)",
    touch:
      "swipe ↑ ↑ ↓ ↓ ← → ← → anywhere on the home screen or lounge, then tap twice",
    what: "party mode: a rainbow wheel, an 8-bit jingle, +30 lives, and the whole room learns you know the code",
    api: "wavelength.party()",
  },
  {
    id: "magicword",
    name: "The magic word",
    how: 'type "wavelength" on a keyboard, outside any field',
    touch: 'needs a hardware keyboard: type "wavelength" outside any field',
    what: "a nudge toward this very menu",
  },
  {
    id: "clues",
    name: "Magic clues",
    how: 'psychic: type "banana", "marco", "42", "abracadabra", "disco", "do a barrel roll", "wavelength", "mushroom", "star" or "1-up" as your clue and say it; the room gets the egg and your clue box clears (say the same word again to make it your actual clue)',
    what: "every screen in the room reacts: a banana-peel slip, a POLO!, a towel day, a shimmer, a ten-second disco drop, a roll, a very meta chip, ten seconds of everyone super-sized, ten seconds of invincibility, or an extra life",
  },
  {
    id: "hotwheel",
    name: "Hot wheel",
    how: "psychic: flick the wheel flat out (a tap never gets there)",
    what: "smoke off the rim, the ticks glow red and the tyres squeal",
  },
  {
    id: "hattrick",
    name: "Hat trick",
    how: "three bullseyes in a row: a team in Teams, the table in Co-op, your own dial in free-for-all",
    what: "every screen gets a rain of top hats and a fanfare",
  },
  {
    id: "neutral",
    name: "Switzerland",
    how: "drop your dial dead centre",
    what: "a very neutral chip",
  },
  {
    id: "disco",
    consoleOnly: true,
    name: "Disco",
    how: "ask for it (a number of seconds makes it a timed drop)",
    what: "the room hue-cycles, the wheel pulses and the lounge spins a 124 BPM stomp instead of the groove",
    api: "wavelength.disco()",
  },
  {
    id: "jukebox",
    consoleOnly: true,
    name: "Jukebox",
    how: "ask for it, then play any sound by name",
    what: "lists every synthesised sound and loop; play() and loop() fire them (tap the page once first so iOS allows audio)",
    api: 'wavelength.jukebox() · wavelength.play("fanfare") · wavelength.loop("disco")',
  },
  {
    id: "rain",
    consoleOnly: true,
    name: "Rain",
    how: "ask for it",
    what: "emoji rain down the screen (any emoji, any amount)",
    api: 'wavelength.rain("🍕", 24)',
  },
  {
    id: "barrelroll",
    consoleOnly: true,
    name: "Barrel roll",
    how: "ask for it",
    what: "the whole page rolls 360°",
    api: "wavelength.barrelRoll()",
  },
  {
    id: "crt",
    consoleOnly: true,
    name: "CRT",
    how: "ask for it",
    what: "scanlines and a vignette, like a 1987 arcade cabinet (toggle)",
    api: "wavelength.crt()",
  },
  {
    id: "pet",
    consoleOnly: true,
    name: "Pet",
    how: "ask for it",
    what: "a critter trots along the bottom edge now and then; null sends it home",
    api: 'wavelength.pet("🐈")',
  },
  {
    id: "titlewave",
    name: "Title wave",
    how: "tap the Wavelength title on the home screen seven times",
    what: "the letters do the wave and the tagline gets a new quip every time",
  },
  {
    id: "patience",
    name: "Patience",
    how: "wait in the lounge for a minute while the host dawdles",
    what: "the waiting line starts to editorialise",
  },
  {
    id: "fidget",
    name: "Fidget",
    how: "tap the mute button ten times in five seconds",
    what: "it has had enough",
  },
  {
    id: "palindrome",
    name: "Palindrome",
    how: "land a game code that reads the same backwards (BCCB)",
    what: "a little mirror next to the code",
  },
  {
    id: "seasons",
    name: "Seasons",
    how: "nothing to do: the calendar switches them on in Halloween week, over the Thanksgiving weekends (US and Canadian), the winter holidays, New Year's Eve and Day, St Patrick's Day and April 1st",
    what: "a pumpkin shroud and drifting ghosts; falling leaves and a turkey; snow on the home screen and in the lounge; fireworks at game over; shamrocks and a green shroud; a tagline with a disclaimer",
    api: 'wavelength.season("halloween" | "thanksgiving" | "winter" | "newyear" | "stpatricks" | "fools" | null)',
  },
  {
    id: "reset",
    consoleOnly: true,
    name: "Reset",
    how: "ask for it",
    what: "switches every egg mode off again",
    api: "wavelength.reset()",
  },
];

export function eggById(id: string): EggDef | undefined {
  return EGGS.find((e) => e.id === id);
}

/** Plain-text menu, one egg per block; the console adds the styling. */
export function menuText(): string {
  const lines = ["Wavelength easter eggs", ""];
  for (const egg of EGGS) {
    lines.push(`• ${egg.name} — ${egg.how}`);
    lines.push(`    → ${egg.what}`);
    if (egg.api) lines.push(`    ${egg.api}`);
  }
  lines.push("");
  lines.push('"Reduce effects" tones every one of them down.');
  return lines.join("\n");
}
