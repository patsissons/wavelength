/**
 * Every easter egg, as the console menu describes it. Behaviour lives next
 * to whatever triggers it; this list is the single place that says what
 * exists, so the menu and the docs never drift from the code.
 */
export interface EggDef {
  id: string;
  name: string;
  /** How a player triggers it. */
  how: string;
  /** What they get. */
  what: string;
  /** Console call that fires it by hand, if there is one. */
  api?: string;
}

export const EGGS: ReadonlyArray<EggDef> = [
  {
    id: "menu",
    name: "The menu",
    how: "type `wavelength` in the console",
    what: "prints this list and hands back the egg API",
    api: "wavelength.list()",
  },
  {
    id: "konami",
    name: "Konami code",
    how: "↑ ↑ ↓ ↓ ← → ← → B A on a keyboard; on a phone swipe ↑ ↑ ↓ ↓ ← → ← → then tap twice (home or lounge)",
    what: "party mode: a rainbow wheel, an 8-bit jingle, +30 lives, and the whole room learns you know the code",
    api: "wavelength.party()",
  },
  {
    id: "magicword",
    name: "The magic word",
    how: 'type "wavelength" on a keyboard, outside any field',
    what: "a nudge toward this very menu",
  },
  {
    id: "disco",
    name: "Disco",
    how: "ask for it (a number of seconds makes it a timed drop)",
    what: "the room hue-cycles, the wheel pulses and the lounge spins a 124 BPM stomp instead of the groove",
    api: "wavelength.disco()",
  },
  {
    id: "jukebox",
    name: "Jukebox",
    how: "ask for it, then play any sound by name",
    what: "lists every synthesised sound and loop; play() and loop() fire them (tap the page once first so iOS allows audio)",
    api: 'wavelength.jukebox() · wavelength.play("fanfare") · wavelength.loop("disco")',
  },
  {
    id: "rain",
    name: "Rain",
    how: "ask for it",
    what: "emoji rain down the screen (any emoji, any amount)",
    api: 'wavelength.rain("🍕", 24)',
  },
  {
    id: "barrelroll",
    name: "Barrel roll",
    how: "ask for it",
    what: "the whole page rolls 360°",
    api: "wavelength.barrelRoll()",
  },
  {
    id: "crt",
    name: "CRT",
    how: "ask for it",
    what: "scanlines and a vignette, like a 1987 arcade cabinet (toggle)",
    api: "wavelength.crt()",
  },
  {
    id: "pet",
    name: "Pet",
    how: "ask for it",
    what: "a critter trots along the bottom edge now and then; null sends it home",
    api: 'wavelength.pet("🐈")',
  },
  {
    id: "reset",
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
