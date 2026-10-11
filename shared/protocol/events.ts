import type {
  Card,
  GameOver,
  Phase,
  Player,
  Round,
  RoundResult,
  Settings,
  Side,
  Spectrum,
  Spin,
  TeamId,
} from "../game/types";

/**
 * Events are the only way game state changes. The server emits them and both
 * the server and every client apply them through `applyEvent`.
 */
export type GameEvent =
  | { type: "player.joined"; player: Player }
  | { type: "player.left"; playerId: string }
  | {
      type: "player.presence";
      playerId: string;
      connected: boolean;
      away: boolean;
      disconnectedAt: number | null;
    }
  | { type: "player.renamed"; playerId: string; name: string }
  | { type: "team.changed"; playerId: string; team: TeamId | null }
  | { type: "host.changed"; hostId: string }
  | { type: "settings.changed"; settings: Settings }
  | {
      type: "game.started";
      round: Round;
      activeTeam: TeamId | null;
      psychicCursor: { left: number; right: number; all: number };
      psychicStart: { left: number; right: number; all: number };
      scores: Record<string, number>;
      deckRemaining: number;
    }
  | { type: "card.drawn"; card: Card; deckRemaining: number; at: number }
  | { type: "side.picked"; side: 0 | 1; spectrum: Spectrum; at: number }
  | { type: "spin.started"; spin: Spin }
  | { type: "shroud.toggled"; open: boolean; at: number }
  | { type: "clue.submitted"; clue: string; at: number }
  | {
      type: "dial.set";
      dialId: string;
      position: number;
      by: string;
      at: number;
    }
  | { type: "dial.accepted"; dialId: string; playerId: string; at: number }
  | { type: "dial.unaccepted"; dialId: string; playerId: string; at: number }
  | { type: "dial.locked"; dialId: string; at: number }
  | { type: "phase.changed"; phase: Phase }
  | { type: "vote.cast"; playerId: string; side: Side; at: number }
  | {
      type: "round.revealed";
      result: RoundResult;
      scores: Record<string, number>;
      suddenDeath: boolean;
    }
  | {
      type: "round.advanced";
      round: Round;
      activeTeam: TeamId | null;
      psychicCursor: { left: number; right: number; all: number };
      roundsPlayed: number;
      deckRemaining: number;
    }
  | { type: "game.over"; gameOver: GameOver }
  | { type: "effect.sent"; by: string; effectId: string; to: string | null }
  | { type: "game.reset"; scores: Record<string, number> };

export type GameEventType = GameEvent["type"];
