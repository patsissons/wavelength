import { guessDeadline } from "@shared/game/commands";
import type { GameState } from "@shared/game/types";

export const DEFAULT_GRACE_MS = 60_000;
/** Idle rooms are deleted after this long so codes can be reused. */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

/** Earliest moment the room needs to wake up, or null if nothing is pending. */
export function nextAlarmAt(
  game: GameState,
  lastActivityAt: number,
  graceMs: number,
  ttlMs = ROOM_TTL_MS,
): number {
  let next = lastActivityAt + ttlMs;
  for (const player of Object.values(game.players)) {
    if (player.connected || player.away || player.disconnectedAt === null)
      continue;
    next = Math.min(next, player.disconnectedAt + graceMs);
  }
  const timer = guessDeadline(game);
  if (timer !== null) next = Math.min(next, timer);
  return next;
}
