/**
 * Player avatars. A player's `avatar` is either an id from this catalog (a
 * composed, animated character) or a single emoji; `null` falls back to the
 * monogram. The catalog is pure data so the Worker can validate ids and the
 * client can render them.
 */

/** How the whole character moves. */
export type FigureAnim =
  | "dance"
  | "bob"
  | "float"
  | "buzz"
  | "spin"
  | "breathe"
  | "hop"
  | "wiggle"
  | "stomp"
  | "chomp"
  | "sway"
  | "zoom"
  | "glitch"
  | "pulse"
  | "waddle"
  | "creep";

/** How the prop moves relative to the character. */
export type PropAnim = "ride" | "sparkle" | "orbit" | "rise" | "spin" | "hover";

export type PropAnchor = "top" | "top-right" | "top-left" | "right" | "left";

export interface AvatarDef {
  id: string;
  label: string;
  /** The character itself. */
  base: string;
  /** A second glyph layered on the character (hat, sidekick, trail…). */
  prop?: string;
  anchor?: PropAnchor;
  anim: FigureAnim;
  propAnim?: PropAnim;
}

export const AVATARS: ReadonlyArray<AvatarDef> = [
  {
    id: "dancing-unicorn",
    label: "Dancing unicorn",
    base: "🦄",
    prop: "✨",
    anchor: "top-right",
    anim: "dance",
    propAnim: "sparkle",
  },
  {
    id: "disco-cat",
    label: "Disco cat",
    base: "🐱",
    prop: "🪩",
    anchor: "top-right",
    anim: "dance",
    propAnim: "spin",
  },
  {
    id: "space-dog",
    label: "Space dog",
    base: "🐶",
    prop: "🚀",
    anchor: "right",
    anim: "float",
    propAnim: "orbit",
  },
  {
    id: "wizard-frog",
    label: "Wizard frog",
    base: "🐸",
    prop: "🎩",
    anchor: "top",
    anim: "bob",
    propAnim: "ride",
  },
  {
    id: "pirate-duck",
    label: "Pirate duck",
    base: "🦆",
    prop: "🏴‍☠️",
    anchor: "top-right",
    anim: "sway",
    propAnim: "ride",
  },
  {
    id: "sleepy-sloth",
    label: "Sleepy sloth",
    base: "🦥",
    prop: "💤",
    anchor: "top-right",
    anim: "breathe",
    propAnim: "rise",
  },
  {
    id: "ninja-panda",
    label: "Ninja panda",
    base: "🐼",
    prop: "⚔️",
    anchor: "right",
    anim: "zoom",
    propAnim: "ride",
  },
  {
    id: "robot-buddy",
    label: "Robot buddy",
    base: "🤖",
    prop: "⚡",
    anchor: "top-right",
    anim: "glitch",
    propAnim: "sparkle",
  },
  {
    id: "taco-tuesday",
    label: "Taco Tuesday",
    base: "🌮",
    prop: "🎉",
    anchor: "top-right",
    anim: "wiggle",
    propAnim: "sparkle",
  },
  {
    id: "friendly-ghost",
    label: "Friendly ghost",
    base: "👻",
    anim: "float",
  },
  {
    id: "dino-rawr",
    label: "Dino rawr",
    base: "🦖",
    prop: "💥",
    anchor: "right",
    anim: "stomp",
    propAnim: "sparkle",
  },
  {
    id: "speedy-hot-dog",
    label: "Speedy hot dog",
    base: "🌭",
    prop: "💨",
    anchor: "left",
    anim: "zoom",
    propAnim: "ride",
  },
  {
    id: "party-llama",
    label: "Party llama",
    base: "🦙",
    prop: "🎊",
    anchor: "top-left",
    anim: "hop",
    propAnim: "sparkle",
  },
  {
    id: "zen-koala",
    label: "Zen koala",
    base: "🐨",
    prop: "🍃",
    anchor: "top-right",
    anim: "breathe",
    propAnim: "hover",
  },
  {
    id: "mirror-ball",
    label: "Mirror ball",
    base: "🪩",
    anim: "spin",
  },
  {
    id: "pizza-shark",
    label: "Pizza shark",
    base: "🦈",
    prop: "🍕",
    anchor: "right",
    anim: "chomp",
    propAnim: "ride",
  },
  {
    id: "rocket-snail",
    label: "Rocket snail",
    base: "🐌",
    prop: "🔥",
    anchor: "left",
    anim: "creep",
    propAnim: "sparkle",
  },
  {
    id: "detective-owl",
    label: "Detective owl",
    base: "🦉",
    prop: "🔍",
    anchor: "right",
    anim: "bob",
    propAnim: "hover",
  },
  {
    id: "cowboy-cactus",
    label: "Cowboy cactus",
    base: "🌵",
    prop: "🤠",
    anchor: "top",
    anim: "sway",
    propAnim: "ride",
  },
  {
    id: "chef-octopus",
    label: "Chef octopus",
    base: "🐙",
    prop: "🍳",
    anchor: "top-right",
    anim: "wiggle",
    propAnim: "orbit",
  },
  {
    id: "moon-bunny",
    label: "Moon bunny",
    base: "🐰",
    prop: "🌙",
    anchor: "top-left",
    anim: "hop",
    propAnim: "hover",
  },
  {
    id: "lava-penguin",
    label: "Lava penguin",
    base: "🐧",
    prop: "🌋",
    anchor: "left",
    anim: "waddle",
    propAnim: "ride",
  },
  {
    id: "busy-bee",
    label: "Busy bee",
    base: "🐝",
    anim: "buzz",
  },
  {
    id: "ice-cream-dragon",
    label: "Ice cream dragon",
    base: "🐲",
    prop: "🍦",
    anchor: "right",
    anim: "pulse",
    propAnim: "ride",
  },
  {
    id: "rainbow-otter",
    label: "Rainbow otter",
    base: "🦦",
    prop: "🌈",
    anchor: "top",
    anim: "float",
    propAnim: "hover",
  },
  {
    id: "sushi-samurai",
    label: "Sushi samurai",
    base: "🍣",
    prop: "⚔️",
    anchor: "top-right",
    anim: "glitch",
    propAnim: "ride",
  },
  {
    id: "coffee-raccoon",
    label: "Coffee raccoon",
    base: "🦝",
    prop: "☕",
    anchor: "right",
    anim: "buzz",
    propAnim: "ride",
  },
  {
    id: "avocado-yogi",
    label: "Avocado yogi",
    base: "🥑",
    prop: "✨",
    anchor: "top",
    anim: "breathe",
    propAnim: "sparkle",
  },
  {
    id: "cosmic-whale",
    label: "Cosmic whale",
    base: "🐳",
    prop: "🪐",
    anchor: "top-right",
    anim: "float",
    propAnim: "orbit",
  },
  {
    id: "drama-chicken",
    label: "Drama chicken",
    base: "🐔",
    prop: "🎭",
    anchor: "top-right",
    anim: "pulse",
    propAnim: "ride",
  },
  {
    id: "ufo-cow",
    label: "UFO cow",
    base: "🐮",
    prop: "🛸",
    anchor: "top",
    anim: "bob",
    propAnim: "hover",
  },
  {
    id: "melty-snowman",
    label: "Melty snowman",
    base: "⛄",
    prop: "☀️",
    anchor: "top-right",
    anim: "wiggle",
    propAnim: "spin",
  },
];

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

export function avatarById(id: string): AvatarDef | undefined {
  return BY_ID.get(id);
}

/** Longest avatar value accepted on the wire (ZWJ emoji sequences are long). */
export const AVATAR_MAX = 32;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Number of user-perceived characters (a ZWJ family is one). */
export function graphemeCount(value: string): number {
  if (segmenter) {
    let n = 0;
    for (const _ of segmenter.segment(value)) n++;
    return n;
  }
  return Array.from(value).length;
}

const PICTOGRAPHIC =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})/u;

/** One emoji and nothing else. */
export function isEmojiAvatar(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= AVATAR_MAX &&
    PICTOGRAPHIC.test(value) &&
    graphemeCount(value) === 1
  );
}

/** A catalog id or a single emoji. */
export function isValidAvatar(value: string): boolean {
  return BY_ID.has(value) || isEmojiAvatar(value);
}
