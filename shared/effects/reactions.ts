import type { GameState, Phase } from "../game/types";

/**
 * Emoji players flick at each other between rounds (see the reactions
 * arena on the client). Validated here so the room never relays anything
 * off this list; the tally records them as `reaction:<emoji>` for the
 * sender and `reacted` for the target.
 */
export const REACTIONS: ReadonlyArray<string> = [
  "👏",
  "😂",
  "❤️",
  "🔥",
  "🤯",
  "😱",
  "🙈",
  "🎯",
  "🧠",
  "💩",
  "🏆",
  "👀",
];

const SET = new Set(REACTIONS);

export function isReaction(emoji: string): boolean {
  return SET.has(emoji);
}

/** The post-round moments when the arena is open. */
export const REACTION_PHASES: ReadonlyArray<Phase> = ["reveal", "gameover"];

export const REACTION_PREFIX = "reaction:";

export function reactionEffectId(emoji: string): string {
  return REACTION_PREFIX + emoji;
}

/** The emoji behind a `reaction:<emoji>` tally id, or null for other ids. */
export function reactionEmoji(effectId: string): string | null {
  return effectId.startsWith(REACTION_PREFIX)
    ? effectId.slice(REACTION_PREFIX.length)
    : null;
}

export function canReact(game: GameState): boolean {
  return game.settings.effects && REACTION_PHASES.includes(game.phase);
}
