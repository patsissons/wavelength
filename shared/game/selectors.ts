import type { DialState, GameState, Player, TeamId } from "./types";
import { otherTeam } from "./types";
import { teamMembers } from "./rotation";

export type Role = "psychic" | "guesser" | "opponent" | "spectator";

export const IN_ROUND_PHASES = new Set<GameState["phase"]>([
  "drawing",
  "spinning",
  "clue",
  "guessing",
  "voting",
  "reveal",
]);

export function inRound(state: GameState): boolean {
  return IN_ROUND_PHASES.has(state.phase) && state.round !== null;
}

export function isHost(state: GameState, playerId: string): boolean {
  return state.hostId === playerId;
}

/** Dials a player may move/accept in the current round. */
export function dialsFor(state: GameState, playerId: string): DialState[] {
  if (!state.round) return [];
  return Object.values(state.round.dials).filter((d) =>
    d.owners.includes(playerId),
  );
}

export function roleOf(state: GameState, playerId: string): Role {
  const round = state.round;
  if (!round) return "spectator";
  if (round.psychicId === playerId) return "psychic";
  if (dialsFor(state, playerId).length > 0) return "guesser";
  if (opponents(state).some((p) => p.id === playerId)) return "opponent";
  return "spectator";
}

/** Teams: the players who call left/right this round. */
export function opponents(state: GameState): Player[] {
  const team = state.round?.psychicTeam;
  if (!team || state.settings.mode !== "teams") return [];
  return teamMembers(state, otherTeam(team));
}

export function activeOwners(state: GameState, dial: DialState): string[] {
  return dial.owners.filter((id) => {
    const p = state.players[id];
    return p !== undefined && !p.away;
  });
}

export function activeOpponents(state: GameState): Player[] {
  return opponents(state).filter((p) => !p.away);
}

export function allDialsLocked(state: GameState): boolean {
  const dials = Object.values(state.round?.dials ?? {});
  return dials.length > 0 && dials.every((d) => d.locked);
}

export function scoreFor(state: GameState, key: TeamId | string): number {
  return state.scores[key] ?? 0;
}

/** Spins the psychic may still take this turn; null when unlimited. */
export function spinsRemaining(state: GameState): number | null {
  const max = state.settings.maxSpins;
  if (max <= 0) return null;
  return Math.max(0, max - (state.round?.spins ?? 0));
}
