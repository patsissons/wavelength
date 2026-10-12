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

/**
 * The flagpole rule: with the dial timer on, locking the last dial while
 * the countdown's ones digit reads 1, 3 or 6 earns that many fireworks.
 * Both times are server time, so every client agrees. A timeout clears
 * the deadline before the locks land, so it never counts.
 */
export function flagpole(
  deadline: number | null,
  lockedAt: number | null,
): 0 | 1 | 3 | 6 {
  if (deadline === null || lockedAt === null) return 0;
  const seconds = Math.ceil((deadline - lockedAt) / 1000);
  if (seconds <= 0) return 0;
  const digit = seconds % 10;
  return digit === 1 || digit === 3 || digit === 6 ? digit : 0;
}

/** When the most recent dial locked this round, from the public log. */
export function lastLockAt(game: Pick<GameState, "round">): number | null {
  const log = game.round?.log ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]!;
    if (entry.t === "lock") return entry.at;
  }
  return null;
}

/** Fire the hat trick moment for everyone. */
export function celebrateHatTrick(game: GameState, who: string): void {
  eggBus.emit({ kind: "chip", id: "hattrick", text: hatTrickText(game, who) });
  eggBus.emit({ kind: "rain", id: "hattrick", glyphs: ["🎩"], count: 16 });
  audio.play("fanfare");
}
