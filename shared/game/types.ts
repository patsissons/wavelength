/**
 * Public game state model. Everything here is visible to every client; the
 * secret target lives in the server-only `SecretState` until reveal.
 */

export const PROTOCOL_VERSION = 2;

export type Mode = "teams" | "coop" | "ffa";
export type TeamId = "left" | "right";
export type Side = "left" | "right";
export type Phase =
  | "lobby"
  | "drawing"
  | "spinning"
  | "clue"
  | "guessing"
  | "voting"
  | "reveal"
  | "gameover";

export type WedgeScore = 0 | 2 | 3 | 4;

export interface Player {
  id: string;
  name: string;
  /** Index into the player colour palette. */
  color: number;
  /** Teams mode only. */
  team: TeamId | null;
  /** Join order; drives psychic rotation. */
  order: number;
  /** Has at least one live socket. */
  connected: boolean;
  /** Disconnected longer than the grace period; excluded from "active" sets. */
  away: boolean;
  disconnectedAt: number | null;
}

export interface Spectrum {
  left: string;
  right: string;
}

export interface Card {
  id: string;
  sides: [Spectrum, Spectrum];
}

export interface Settings {
  mode: Mode;
  /** Teams: points to win. */
  targetScore: number;
  /** Co-op / FFA: number of rounds. */
  rounds: number;
  /** FFA: does the psychic score the guessers' average? */
  psychicScoring: "none" | "average";
  /** Teams: a 4-point turn while behind grants another turn. */
  catchUp: boolean;
  firstTeam: TeamId | "random";
  /** Host-entered extra spectra, mixed into the deck. */
  customSpectra: Spectrum[];
  useBuiltInDeck: boolean;
  effects: boolean;
}

export interface Spin {
  id: string;
  direction: 1 | -1;
  turns: number;
  durationMs: number;
  startedAt: number;
}

export interface DialState {
  /** "shared" for a team dial, or the owning player's id in FFA. */
  id: string;
  /** Players allowed to move/accept this dial. */
  owners: string[];
  /** 0..1 along the spectrum, last committed position. */
  position: number;
  movedBy: string | null;
  /** Owners who have accepted the current position; cleared on any move. */
  accepts: string[];
  locked: boolean;
}

export interface VoteResult {
  left: number;
  right: number;
  majority: Side | null;
  /** Which side of the dial the target actually was. */
  correct: Side | null;
  bonusTo: TeamId | null;
}

export interface RoundResult {
  roundIndex: number;
  psychicId: string;
  psychicTeam: TeamId | null;
  spectrum: Spectrum;
  clue: string;
  target: number;
  dials: Record<
    string,
    { position: number; wedge: WedgeScore; owners: string[] }
  >;
  vote: VoteResult | null;
  /** Score deltas keyed like `GameState.scores`. */
  deltas: Record<string, number>;
  /** Teams catch-up: the same team goes again. */
  goAgain: boolean;
  /** Decided at reveal; applied when the round advances. */
  gameOver: GameOver | null;
}

export interface Round {
  index: number;
  psychicId: string;
  psychicTeam: TeamId | null;
  card: Card | null;
  side: 0 | 1 | null;
  spectrum: Spectrum | null;
  spin: Spin | null;
  /** Times the wheel has been spun this round (re-spins allowed until the clue). */
  spins: number;
  /** The psychic's shroud: open from the side pick until the clue, then toggled. */
  shroudOpen: boolean;
  /** Explicit peeks (shroud opened by the psychic) this round. */
  peeks: number;
  clue: string | null;
  dials: Record<string, DialState>;
  /** Teams: opposing players' left/right calls. */
  votes: Record<string, Side>;
  /** Only populated from reveal onward. */
  target: number | null;
  result: RoundResult | null;
  /** This round was granted by the catch-up rule. */
  catchUp: boolean;
  startedAt: number;
}

export interface GameOver {
  /** Team id (teams), player id (ffa), or null (co-op / tie). */
  winner: string | null;
  /** Co-op benchmark label. */
  label: string | null;
}

export interface GameState {
  protocolVersion: number;
  /** Monotonic; bumped by every persisted event. */
  version: number;
  code: string;
  hostId: string;
  phase: Phase;
  settings: Settings;
  players: Record<string, Player>;
  /** Teams: whose turn it is. */
  activeTeam: TeamId | null;
  /** Psychic rotation: join `order` of the last psychic per pool (-1 = none). */
  psychicCursor: { left: number; right: number; all: number };
  /**
   * Scores keyed by "left"/"right" (teams), "coop" (co-op) or player id
   * (ffa).
   */
  scores: Record<string, number>;
  round: Round | null;
  /** Completed rounds (co-op / ffa round limit). */
  roundsPlayed: number;
  history: RoundResult[];
  suddenDeath: boolean;
  gameOver: GameOver | null;
  deckRemaining: number;
  createdAt: number;
}

export const TEAM_NAMES: Record<TeamId, string> = {
  left: "Left Brain",
  right: "Right Brain",
};

export const PLAYER_COLORS = 12;

export const DEFAULT_SETTINGS: Settings = {
  mode: "teams",
  targetScore: 10,
  rounds: 7,
  psychicScoring: "average",
  catchUp: true,
  firstTeam: "random",
  customSpectra: [],
  useBuiltInDeck: true,
  effects: true,
};

export const LIMITS = {
  maxPlayers: 16,
  nameMax: 20,
  clueMax: 60,
  labelMax: 28,
  customSpectraMax: 60,
  minTargetScore: 5,
  maxTargetScore: 20,
  minRounds: 1,
  maxRounds: 30,
} as const;

export function otherTeam(team: TeamId): TeamId {
  return team === "left" ? "right" : "left";
}
