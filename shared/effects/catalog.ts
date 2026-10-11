import type { GameState } from "../game/types";
import { roleOf, type Role } from "../game/selectors";

export type SoundPatch =
  | "ding"
  | "buzz"
  | "drumroll"
  | "whoosh"
  | "tick"
  | "gasp"
  | "applause"
  | "boo"
  | "rimshot"
  | "fanfare"
  | "crickets"
  | "celebrate"
  | "newround"
  | "laugh"
  | "hmm"
  | "sparkle"
  | "poke"
  | "konami";

export type ScreenFx = "shake" | "flash" | "fog" | "spotlight";

export interface EffectDef {
  id: string;
  label: string;
  /** Emoji shown on the button. */
  icon: string;
  /** Who may send it; "any" means every role including spectators. */
  roles: ReadonlyArray<Role | "any">;
  burst?: { glyphs: ReadonlyArray<string>; count: number };
  confetti?: boolean;
  fx?: ScreenFx;
  sound?: SoundPatch;
  haptic?: ReadonlyArray<number>;
  /** Not on the effects bar: fired by an easter egg, still validated here. */
  hidden?: boolean;
  /** Text after the sender's name on the burst chip. */
  caption?: string;
}

/**
 * Everything a player can fire at the room. The psychic's set never carries
 * information about the target (no warmer/colder) — it is for drama only.
 */
export const EFFECTS: ReadonlyArray<EffectDef> = [
  // psychic
  {
    id: "drumroll",
    label: "Drum roll",
    icon: "🥁",
    roles: ["psychic"],
    burst: { glyphs: ["🥁"], count: 6 },
    sound: "drumroll",
    haptic: [20, 40, 20, 40, 20, 40, 20],
  },
  {
    id: "zip",
    label: "Lips sealed",
    icon: "🤐",
    roles: ["psychic"],
    burst: { glyphs: ["🤐", "🔒"], count: 10 },
  },
  {
    id: "sweat",
    label: "Sweating",
    icon: "😅",
    roles: ["psychic"],
    burst: { glyphs: ["😅", "💦"], count: 12 },
  },
  {
    id: "facepalm",
    label: "Facepalm",
    icon: "🤦",
    roles: ["psychic"],
    burst: { glyphs: ["🤦", "🤦‍♀️"], count: 8 },
    sound: "buzz",
    haptic: [80],
  },
  {
    id: "spotlight",
    label: "Spotlight",
    icon: "🔦",
    roles: ["psychic"],
    fx: "spotlight",
    sound: "whoosh",
  },
  {
    id: "micdrop",
    label: "Mic drop",
    icon: "🎤",
    roles: ["psychic"],
    burst: { glyphs: ["🎤"], count: 4 },
    fx: "flash",
    sound: "rimshot",
    haptic: [40, 30, 90],
  },
  // guessers
  {
    id: "confident",
    label: "Confident",
    icon: "😎",
    roles: ["guesser"],
    burst: { glyphs: ["😎", "✨"], count: 10 },
    sound: "ding",
  },
  {
    id: "panic",
    label: "Panic",
    icon: "😱",
    roles: ["guesser"],
    burst: { glyphs: ["😱", "😰"], count: 12 },
    fx: "shake",
    sound: "gasp",
    haptic: [30, 30, 30, 30, 30],
  },
  {
    id: "left",
    label: "More left!",
    icon: "👈",
    roles: ["guesser"],
    burst: { glyphs: ["👈"], count: 8 },
  },
  {
    id: "right",
    label: "More right!",
    icon: "👉",
    roles: ["guesser"],
    burst: { glyphs: ["👉"], count: 8 },
  },
  {
    id: "thinking",
    label: "Thinking",
    icon: "🤔",
    roles: ["guesser"],
    burst: { glyphs: ["🤔", "💭"], count: 8 },
    fx: "fog",
    sound: "hmm",
  },
  {
    id: "brainblast",
    label: "Brain blast",
    icon: "🧠",
    roles: ["guesser"],
    burst: { glyphs: ["🧠", "⚡"], count: 10 },
    confetti: true,
    sound: "fanfare",
    haptic: [60, 40, 60],
  },
  // opponents (teams)
  {
    id: "heckle",
    label: "Heckle",
    icon: "🗣️",
    roles: ["opponent"],
    burst: { glyphs: ["🗣️", "💬"], count: 8 },
    sound: "boo",
  },
  {
    id: "popcorn",
    label: "Popcorn",
    icon: "🍿",
    roles: ["opponent"],
    burst: { glyphs: ["🍿"], count: 14 },
  },
  {
    id: "crickets",
    label: "Crickets",
    icon: "🦗",
    roles: ["opponent", "spectator"],
    burst: { glyphs: ["🦗"], count: 5 },
    sound: "crickets",
  },
  // everyone
  {
    id: "applause",
    label: "Applause",
    icon: "👏",
    roles: ["any"],
    burst: { glyphs: ["👏"], count: 14 },
    sound: "applause",
    haptic: [20, 20, 20, 20, 20, 20],
  },
  {
    id: "laugh",
    label: "Laugh",
    icon: "😂",
    roles: ["any"],
    burst: { glyphs: ["😂", "🤣"], count: 12 },
    sound: "laugh",
  },
  {
    id: "heart",
    label: "Love it",
    icon: "❤️",
    roles: ["any"],
    burst: { glyphs: ["❤️", "💖", "💛"], count: 14 },
    sound: "ding",
  },
  {
    id: "unicorn",
    label: "Magical",
    icon: "🦄",
    roles: ["any"],
    burst: { glyphs: ["🦄", "🌈", "✨"], count: 14 },
    confetti: true,
    sound: "sparkle",
    haptic: [30, 30, 60],
  },
  {
    id: "ghost",
    label: "Boo!",
    icon: "👻",
    roles: ["any"],
    burst: { glyphs: ["👻"], count: 10 },
    fx: "fog",
    sound: "boo",
    haptic: [80, 40, 80],
  },
  {
    id: "wow",
    label: "Mind blown",
    icon: "🤯",
    roles: ["any"],
    burst: { glyphs: ["🤯"], count: 8 },
    confetti: true,
    sound: "whoosh",
    haptic: [50],
  },
  // easter eggs (hidden from the bar; see src/lib/eggs)
  {
    id: "konami",
    label: "Knows the code",
    icon: "🕹️",
    roles: ["any"],
    hidden: true,
    caption: "knows the code",
    burst: { glyphs: ["🕹️", "🌈", "⭐"], count: 16 },
    confetti: true,
    sound: "konami",
    haptic: [30, 30, 30, 30, 90],
  },
];

const BY_ID = new Map(EFFECTS.map((e) => [e.id, e]));

export function effectById(id: string): EffectDef | undefined {
  return BY_ID.get(id);
}

export function effectsFor(role: Role): EffectDef[] {
  return EFFECTS.filter(
    (e) => !e.hidden && (e.roles.includes("any") || e.roles.includes(role)),
  );
}

/** Server-side check: does this effect exist and may this player send it now? */
export function canSendEffect(
  game: GameState,
  playerId: string,
  effectId: string,
): boolean {
  const def = BY_ID.get(effectId);
  if (!def || !game.settings.effects) return false;
  if (def.roles.includes("any")) return true;
  if (!game.round) return false;
  return def.roles.includes(roleOf(game, playerId));
}
