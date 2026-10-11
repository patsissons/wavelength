import type { GameEvent } from "../protocol/events";
import type { DialState, GameState, Round } from "./types";

/**
 * Apply one event to the public game state. Pure: returns a new state and
 * bumps `version`. Both the server and every client run exactly this code,
 * which is why the handler layer must put every state change in an event.
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
  const next = reduce(state, event);
  return { ...next, version: state.version + 1 };
}

export function applyEvents(
  state: GameState,
  events: ReadonlyArray<GameEvent>,
): GameState {
  return events.reduce(applyEvent, state);
}

function reduce(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case "player.joined":
      return {
        ...state,
        players: { ...state.players, [event.player.id]: event.player },
      };

    case "player.left": {
      const players = { ...state.players };
      delete players[event.playerId];
      return {
        ...state,
        players,
        round: state.round
          ? removePlayerFromRound(state.round, event.playerId)
          : null,
      };
    }

    case "player.presence":
      return updatePlayer(state, event.playerId, {
        connected: event.connected,
        away: event.away,
        disconnectedAt: event.disconnectedAt,
      });

    case "player.renamed":
      return updatePlayer(state, event.playerId, { name: event.name });

    case "team.changed":
      return updatePlayer(state, event.playerId, { team: event.team });

    case "host.changed":
      return { ...state, hostId: event.hostId };

    case "settings.changed":
      return { ...state, settings: event.settings };

    case "game.started":
      return {
        ...state,
        phase: "drawing",
        round: event.round,
        activeTeam: event.activeTeam,
        psychicCursor: event.psychicCursor,
        scores: event.scores,
        deckRemaining: event.deckRemaining,
        roundsPlayed: 0,
        history: [],
        suddenDeath: false,
        gameOver: null,
      };

    case "card.drawn":
      return updateRound(state, { card: event.card }, event.deckRemaining);

    case "side.picked":
      return updateRound(state, { side: event.side, spectrum: event.spectrum });

    case "spin.started":
      return updateRound(state, { spin: event.spin });

    case "clue.submitted":
      return updateRound(state, { clue: event.clue });

    case "dial.set":
      return updateDial(state, event.dialId, (dial) => ({
        ...dial,
        position: event.position,
        movedBy: event.by,
        accepts: [],
      }));

    case "dial.accepted":
      return updateDial(state, event.dialId, (dial) => ({
        ...dial,
        accepts: dial.accepts.includes(event.playerId)
          ? dial.accepts
          : [...dial.accepts, event.playerId],
      }));

    case "dial.unaccepted":
      return updateDial(state, event.dialId, (dial) => ({
        ...dial,
        accepts: dial.accepts.filter((id) => id !== event.playerId),
      }));

    case "dial.locked":
      return updateDial(state, event.dialId, (dial) => ({
        ...dial,
        locked: true,
      }));

    case "phase.changed":
      return { ...state, phase: event.phase };

    case "vote.cast":
      return updateRound(state, {
        votes: { ...(state.round?.votes ?? {}), [event.playerId]: event.side },
      });

    case "round.revealed":
      return {
        ...updateRound(state, {
          result: event.result,
          target: event.result.target,
        }),
        phase: "reveal",
        scores: event.scores,
        suddenDeath: event.suddenDeath,
        history: [...state.history, event.result],
      };

    case "round.advanced":
      return {
        ...state,
        phase: "drawing",
        round: event.round,
        activeTeam: event.activeTeam,
        psychicCursor: event.psychicCursor,
        roundsPlayed: event.roundsPlayed,
        deckRemaining: event.deckRemaining,
      };

    case "game.over":
      return { ...state, phase: "gameover", gameOver: event.gameOver };

    case "game.reset":
      return {
        ...state,
        phase: "lobby",
        round: null,
        activeTeam: null,
        scores: event.scores,
        roundsPlayed: 0,
        history: [],
        suddenDeath: false,
        gameOver: null,
      };
  }
}

function updatePlayer(
  state: GameState,
  playerId: string,
  patch: Partial<GameState["players"][string]>,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, ...patch } },
  };
}

function updateRound(
  state: GameState,
  patch: Partial<Round>,
  deckRemaining?: number,
): GameState {
  if (!state.round) return state;
  return {
    ...state,
    round: { ...state.round, ...patch },
    deckRemaining: deckRemaining ?? state.deckRemaining,
  };
}

function updateDial(
  state: GameState,
  dialId: string,
  update: (dial: DialState) => DialState,
): GameState {
  const dial = state.round?.dials[dialId];
  if (!state.round || !dial) return state;
  return {
    ...state,
    round: {
      ...state.round,
      dials: { ...state.round.dials, [dialId]: update(dial) },
    },
  };
}

function removePlayerFromRound(round: Round, playerId: string): Round {
  const dials: Record<string, DialState> = {};
  for (const [id, dial] of Object.entries(round.dials)) {
    if (id === playerId) continue; // their own FFA dial
    dials[id] = {
      ...dial,
      owners: dial.owners.filter((o) => o !== playerId),
      accepts: dial.accepts.filter((o) => o !== playerId),
    };
  }
  const votes = { ...round.votes };
  delete votes[playerId];
  return { ...round, dials, votes };
}
