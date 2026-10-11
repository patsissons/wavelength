import { SPIN } from "@shared/game/geometry";
import {
  TEAM_NAMES,
  type GameState,
  type RoundResult,
} from "@shared/game/types";
import { audio } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import { eggBus } from "./bus";

/** Flat out: a tap tops out at 36 rad/s, so only a real flick gets here. */
export const HOT_VELOCITY = SPIN.maxVelocity * 0.95;

/** The psychic flicked the wheel at (nearly) full speed. */
export function hotWheel(velocity: number): boolean {
  if (Math.abs(velocity) < HOT_VELOCITY) return false;
  eggBus.emit({ kind: "hot" });
  eggBus.emit({
    kind: "rain",
    id: "hot",
    glyphs: ["💨", "🔥", "💨"],
    count: 10,
    direction: "rise",
  });
  audio.play("squeal");
  vibrate([20, 20, 60]);
  return true;
}

export const NEUTRAL_TOLERANCE = 0.004;

/** A dial dropped dead centre. */
export function neutralDrop(position: number): boolean {
  if (Math.abs(position - 0.5) > NEUTRAL_TOLERANCE) return false;
  eggBus.emit({ kind: "chip", id: "neutral", text: "🇨🇭 Very neutral." });
  return true;
}

const STREAK = 3;

/**
 * Who just completed three bullseyes in a row, if anyone: the guessing
 * team in Teams, the whole table in Co-op, or a guesser's own dial in
 * free-for-all. Only ever looks at revealed results.
 */
export function hatTrick(
  game: Pick<GameState, "history" | "settings">,
): string | null {
  const last = game.history.slice(-STREAK);
  if (last.length < STREAK) return null;
  const mode = game.settings.mode;
  if (mode === "ffa") {
    const first = last[0]!;
    for (const [dialId, dial] of Object.entries(first.dials)) {
      if (dial.wedge !== 4) continue;
      if (last.every((r) => r.dials[dialId]?.wedge === 4)) return dialId;
    }
    return null;
  }
  if (!last.every((r) => bullseye(r))) return null;
  if (mode === "coop") return "coop";
  const team = last[0]!.psychicTeam;
  return team && last.every((r) => r.psychicTeam === team) ? team : null;
}

function bullseye(result: RoundResult): boolean {
  return result.dials.shared?.wedge === 4;
}

export function hatTrickText(game: GameState, who: string): string {
  if (who === "coop") return "🎩 Hat trick!";
  if (who === "left" || who === "right")
    return `🎩 Hat trick, ${TEAM_NAMES[who]}!`;
  const name = game.players[who]?.name;
  return name ? `🎩 Hat trick, ${name}!` : "🎩 Hat trick!";
}

/** Fire the hat trick moment for everyone. */
export function celebrateHatTrick(game: GameState, who: string): void {
  eggBus.emit({ kind: "chip", id: "hattrick", text: hatTrickText(game, who) });
  eggBus.emit({ kind: "rain", id: "hattrick", glyphs: ["🎩"], count: 16 });
  audio.play("fanfare");
}
