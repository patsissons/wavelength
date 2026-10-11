import { SEGMENT } from "./geometry";
import type { Side, TeamId, WedgeScore } from "./types";
import { otherTeam } from "./types";

/** Tolerance so a guess exactly on a boundary scores the inner band. */
const EPSILON = 1e-9;

/** Points for a guess given the target: 4 / 3 / 2 for the wedge, else 0. */
export function wedgeScore(guess: number, target: number): WedgeScore {
  const d = Math.abs(guess - target) / SEGMENT;
  if (d <= 0.5 + EPSILON) return 4;
  if (d <= 1.5 + EPSILON) return 3;
  if (d <= 2.5 + EPSILON) return 2;
  return 0;
}

/** Which side of the dial the target centre lies on (null if dead on). */
export function sideOfTarget(guess: number, target: number): Side | null {
  if (target < guess) return "left";
  if (target > guess) return "right";
  return null;
}

export function tallyVotes(votes: Record<string, Side>): {
  left: number;
  right: number;
  majority: Side | null;
} {
  let left = 0;
  let right = 0;
  for (const side of Object.values(votes)) {
    if (side === "left") left++;
    else right++;
  }
  const majority = left > right ? "left" : right > left ? "right" : null;
  return { left, right, majority };
}

export function initialTeamsScores(firstTeam: TeamId): Record<TeamId, number> {
  return firstTeam === "left" ? { left: 0, right: 1 } : { left: 1, right: 0 };
}

export interface TeamsTurnInput {
  scores: Record<string, number>;
  psychicTeam: TeamId;
  guess: number;
  target: number;
  votes: Record<string, Side>;
  targetScore: number;
  catchUp: boolean;
  suddenDeath: boolean;
}

export interface TeamsTurnOutcome {
  scores: Record<string, number>;
  deltas: Record<string, number>;
  wedge: WedgeScore;
  vote: {
    left: number;
    right: number;
    majority: Side | null;
    correct: Side | null;
    bonusTo: TeamId | null;
  };
  goAgain: boolean;
  gameOver: boolean;
  winner: TeamId | null;
  suddenDeath: boolean;
}

/**
 * Official Teams scoring for one turn:
 * - psychic team scores the wedge value;
 * - the other team scores 1 for a correct majority left/right call, unless
 *   the psychic team scored 4;
 * - catch-up: a 4 while still behind grants another turn;
 * - first to `targetScore` wins; a tie at or above it is sudden death and
 *   play continues until the scores differ.
 */
export function scoreTeamsTurn(input: TeamsTurnInput): TeamsTurnOutcome {
  const other = otherTeam(input.psychicTeam);
  const wedge = wedgeScore(input.guess, input.target);
  const tally = tallyVotes(input.votes);
  const correct = sideOfTarget(input.guess, input.target);
  const bonus =
    wedge < 4 && tally.majority !== null && tally.majority === correct;

  const deltas: Record<string, number> = {
    [input.psychicTeam]: wedge,
    [other]: bonus ? 1 : 0,
  };
  const scores = {
    ...input.scores,
    [input.psychicTeam]: (input.scores[input.psychicTeam] ?? 0) + wedge,
    [other]: (input.scores[other] ?? 0) + (bonus ? 1 : 0),
  };

  const mine = scores[input.psychicTeam]!;
  const theirs = scores[other]!;
  const goAgain = input.catchUp && wedge === 4 && mine < theirs;

  let gameOver = false;
  let winner: TeamId | null = null;
  let suddenDeath = input.suddenDeath;
  if (Math.max(mine, theirs) >= input.targetScore || suddenDeath) {
    if (mine !== theirs) {
      gameOver = true;
      winner = mine > theirs ? input.psychicTeam : other;
      suddenDeath = false;
    } else {
      suddenDeath = true;
    }
  }

  return {
    scores,
    deltas,
    wedge,
    vote: { ...tally, correct, bonusTo: bonus ? other : null },
    goAgain: goAgain && !gameOver,
    gameOver,
    winner,
    suddenDeath,
  };
}

/* ---------- Co-op ---------- */

/** Benchmarks as a fraction of the maximum possible score (4 per round). */
export const COOP_BENCHMARKS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0, label: "Are you even on the same planet?" },
  { min: 0.15, label: "Static on the line" },
  { min: 0.3, label: "Faint signal" },
  { min: 0.45, label: "Tuned in" },
  { min: 0.6, label: "Same wavelength" },
  { min: 0.75, label: "Telepathic" },
  { min: 0.9, label: "Galaxy brain" },
];

export function coopLabel(total: number, rounds: number): string {
  const max = Math.max(1, rounds * 4);
  const ratio = total / max;
  let label = COOP_BENCHMARKS[0]!.label;
  for (const benchmark of COOP_BENCHMARKS) {
    if (ratio >= benchmark.min) label = benchmark.label;
  }
  return label;
}

/* ---------- Free-for-all ---------- */

export function scoreFfaRound(
  guesses: Record<string, number>,
  target: number,
  psychicId: string,
  psychicScoring: "none" | "average",
): Record<string, number> {
  const deltas: Record<string, number> = {};
  const values: number[] = [];
  for (const [playerId, guess] of Object.entries(guesses)) {
    const points = wedgeScore(guess, target);
    deltas[playerId] = points;
    values.push(points);
  }
  if (psychicScoring === "average" && values.length > 0) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    deltas[psychicId] = Math.round(mean);
  } else {
    deltas[psychicId] = 0;
  }
  return deltas;
}

export function ranking(
  scores: Record<string, number>,
): Array<{ id: string; score: number; rank: number }> {
  const sorted = Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((entry, index) => {
    if (entry.score !== previous) {
      rank = index + 1;
      previous = entry.score;
    }
    return { ...entry, rank };
  });
}
