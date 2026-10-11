import type { GameState, Player, TeamId } from "./types";

export function playersInOrder(state: GameState): Player[] {
  return Object.values(state.players).sort((a, b) => a.order - b.order);
}

export function teamMembers(state: GameState, team: TeamId): Player[] {
  return playersInOrder(state).filter((p) => p.team === team);
}

/** Players eligible to be psychic: in order, skipping away players if any remain. */
function eligible(players: Player[]): Player[] {
  const present = players.filter((p) => !p.away);
  return present.length > 0 ? present : players;
}

/**
 * Pick the next psychic for a team (or everyone when `team` is null). The
 * cursor remembers the join `order` of the last psychic (-1 before the first
 * pick); the next psychic is the first eligible player after it, wrapping
 * around. Kicks and late joins therefore never skip anyone.
 */
export function nextPsychic(
  state: GameState,
  team: TeamId | null,
): { psychicId: string; psychicCursor: GameState["psychicCursor"] } | null {
  const key = team ?? "all";
  const pool = eligible(
    team ? teamMembers(state, team) : playersInOrder(state),
  );
  if (pool.length === 0) return null;
  const cursor = state.psychicCursor[key];
  const psychic = pool.find((p) => p.order > cursor) ?? pool[0]!;
  return {
    psychicId: psychic.id,
    psychicCursor: { ...state.psychicCursor, [key]: psychic.order },
  };
}

/** Smaller team (ties → left) for auto-balancing joins. */
export function smallerTeam(state: GameState): TeamId {
  const left = teamMembers(state, "left").length;
  const right = teamMembers(state, "right").length;
  return right < left ? "right" : "left";
}

export function nextColor(state: GameState, palette: number): number {
  const used = new Set(Object.values(state.players).map((p) => p.color));
  for (let i = 0; i < palette; i++) if (!used.has(i)) return i;
  return Object.keys(state.players).length % palette;
}
