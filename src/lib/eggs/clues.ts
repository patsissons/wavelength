import { audio } from "@/lib/audio";
import { eggBus } from "./bus";
import { discoFor } from "./disco";

/**
 * Magic clues. The clue is public game state, so every client (the psychic
 * too) reacts the same way without any new message, and nothing here
 * knows or hints at the target.
 */
export interface ClueEgg {
  id: string;
  /** Shown under the clue in the bubble. */
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
};

export const MAGIC_CLUES: ReadonlyArray<string> = Object.keys(CLUES);

export function matchClue(clue: string | null | undefined): ClueEgg | null {
  if (!clue) return null;
  const key = clue
    .trim()
    .toLowerCase()
    .replace(/[“”"'!.?]+/g, "")
    .replace(/\s+/g, " ");
  return CLUES[key] ?? null;
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
  }
}
