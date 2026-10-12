import { CLUE_EFFECT_PREFIX, effectById } from "@shared/effects/catalog";
import { audio } from "@/lib/audio";
import { eggBus } from "./bus";
import { discoFor } from "./disco";

/**
 * Magic clues. The psychic types one as their clue and, instead of being
 * submitted, it goes to the room as a hidden `clue:*` catalog effect
 * (validated and rate-limited like any effect) while the clue box clears
 * for the real clue. Saying the same word again sends it as the clue for
 * real. Nothing here knows or hints at the target.
 */
export interface ClueEgg {
  id: string;
  /** Shown under the clue in the bubble (when it is the real clue). */
  subtitle?: string;
  /** Shimmer animation on the clue bubble. */
  shimmer?: boolean;
}

const CLUES: Record<string, ClueEgg> = {
  banana: { id: "banana" },
  marco: { id: "marco" },
  "42": { id: "42", subtitle: "Don't panic." },
  abracadabra: { id: "abracadabra", shimmer: true },
  disco: { id: "disco" },
  "do a barrel roll": { id: "barrelroll" },
  wavelength: { id: "meta", subtitle: "Very meta." },
  mushroom: { id: "mushroom", subtitle: "Super." },
  star: { id: "star", shimmer: true },
  starman: { id: "star", shimmer: true },
  "1 up": { id: "oneup" },
  "1up": { id: "oneup" },
  "one up": { id: "oneup" },
};

export const MAGIC_CLUES: ReadonlyArray<string> = Object.keys(CLUES);

/** Every clue egg, once each (several spellings can share one). */
export const CLUE_EGGS: ReadonlyArray<ClueEgg> = [
  ...new Map(Object.values(CLUES).map((egg) => [egg.id, egg])).values(),
];

export function matchClue(clue: string | null | undefined): ClueEgg | null {
  if (!clue) return null;
  const key = clue
    .trim()
    .toLowerCase()
    .replace(/[“”"'!.?]+/g, "")
    .replace(/[-\s]+/g, " ");
  return CLUES[key] ?? null;
}

/** The hidden catalog effect that carries this egg to the room. */
export function clueEffectId(egg: ClueEgg): string {
  return `${CLUE_EFFECT_PREFIX}${egg.id}`;
}

/** The egg behind an incoming effect id, if it is a magic clue. */
export function clueEggOfEffect(effectId: string): ClueEgg | null {
  if (!effectId.startsWith(CLUE_EFFECT_PREFIX)) return null;
  const id = effectId.slice(CLUE_EFFECT_PREFIX.length);
  return CLUE_EGGS.find((egg) => egg.id === id) ?? null;
}

/** The emoji the catalog gives this egg (for the psychic's toast). */
export function clueIcon(egg: ClueEgg): string {
  return effectById(clueEffectId(egg))?.icon ?? "✨";
}

/**
 * Decides what a submitted clue is: a magic word the first time round
 * (the egg), or a clue to send for real (null), which includes the same
 * magic word said twice in a row.
 */
export class MagicGate {
  #last: string | null = null;

  take(clue: string): ClueEgg | null {
    const egg = matchClue(clue);
    if (!egg || egg.id === this.#last) {
      this.#last = null;
      return null;
    }
    this.#last = egg.id;
    return egg;
  }
}

/**
 * Send the egg to the room, or fire it here only when effects are off
 * for this game (the room relays effects back to the sender, so never
 * both).
 */
export function castMagicClue(egg: ClueEgg, roomwide: boolean): void {
  if (roomwide) eggBus.emit({ kind: "effect", effectId: clueEffectId(egg) });
  else fireClueEgg(egg);
}

/** Everything that happens on every screen when a magic clue lands. */
export function fireClueEgg(egg: ClueEgg): void {
  switch (egg.id) {
    case "banana":
      eggBus.emit({ kind: "rain", id: "banana", glyphs: ["🍌"], count: 18 });
      audio.play("squeak");
      return;
    case "marco":
      eggBus.emit({ kind: "chip", id: "marco", text: "POLO!" });
      eggBus.emit({
        kind: "rain",
        id: "marco",
        glyphs: ["💦", "🏊"],
        count: 10,
      });
      audio.play("splash");
      return;
    case "42":
      eggBus.emit({ kind: "rain", id: "42", glyphs: ["🐬", "🧺"], count: 12 });
      audio.play("hmm");
      return;
    case "abracadabra":
      eggBus.emit({
        kind: "rain",
        id: "abracadabra",
        glyphs: ["✨", "🪄", "🎩"],
        count: 16,
      });
      audio.play("sparkle");
      return;
    case "disco":
      discoFor(10_000);
      eggBus.emit({
        kind: "rain",
        id: "disco",
        glyphs: ["🪩", "🕺", "💃"],
        count: 14,
      });
      if (audio.ready) {
        audio.setLoop("disco");
        setTimeout(() => {
          if (audio.loop === "disco") audio.setLoop(null);
        }, 10_000);
      }
      return;
    case "barrelroll":
      eggBus.emit({ kind: "roll" });
      audio.play("whoosh");
      return;
    case "meta":
      eggBus.emit({ kind: "chip", id: "meta", text: "🎯 Very meta." });
      return;
    case "mushroom":
      eggBus.emit({ kind: "mode", attr: "super", ms: 10_000 });
      eggBus.emit({ kind: "rain", id: "mushroom", glyphs: ["🍄"], count: 12 });
      audio.play("powerup");
      return;
    case "star":
      eggBus.emit({ kind: "mode", attr: "star", ms: 10_000 });
      eggBus.emit({
        kind: "rain",
        id: "star",
        glyphs: ["⭐", "✨", "🌟"],
        count: 16,
      });
      audio.play("powerup");
      return;
    case "oneup":
      eggBus.emit({ kind: "chip", id: "oneup", text: "1-UP" });
      eggBus.emit({
        kind: "rain",
        id: "oneup",
        glyphs: ["🟢", "🍄"],
        count: 8,
      });
      audio.play("oneup");
      return;
  }
}
