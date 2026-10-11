import type { GameEvent } from "../protocol/events";
import type { DialState, GameState, Round, RoundLogEntry } from "./types";

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

    case "player.avatar":
      return updatePlayer(state, event.playerId, { avatar: event.avatar });

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
        psychicStart: event.psychicStart,
        scores: event.scores,
        deckRemaining: event.deckRemaining,
        roundsPlayed: 0,
        history: [],
        suddenDeath: false,
        gameOver: null,
        effectTally: {},
      };

    case "card.drawn":
      return updateRound(
        state,
        { card: event.card, log: logged(state, { t: "draw", at: event.at }) },
        event.deckRemaining,
      );

    case "side.picked":
      // The shroud swings open so the psychic (and the room) can watch the spin.
      return updateRound(state, {
        side: event.side,
        spectrum: event.spectrum,
        shroudOpen: true,
        log: logged(state, { t: "side", at: event.at }),
      });

    case "spin.started":
      return updateRound(state, {
        spin: event.spin,
        spins: (state.round?.spins ?? 0) + 1,
        log: logged(state, { t: "spin", at: event.spin.startedAt }),
      });

    case "shroud.toggled":
      return updateRound(state, {
        shroudOpen: event.open,
        peeks: (state.round?.peeks ?? 0) + (event.open ? 1 : 0),
        log: logged(state, { t: "shroud", at: event.at, open: event.open }),
      });

    case "clue.submitted":
      // Giving the clue covers the wheel again; the psychic can peek later.
      return updateRound(state, {
        clue: event.clue,
        shroudOpen: false,
        guessDeadline: event.deadline,
        log: logged(state, { t: "clue", at: event.at }),
      });

    case "guess.expired":
      return updateRound(state, {
        guessDeadline: null,
        log: logged(state, { t: "timeout", at: event.at }),
      });

    case "dial.set": {
      const from = state.round?.dials[event.dialId]?.position ?? 0.5;
      return updateDial(
        state,
        event.dialId,
        (dial) => ({
          ...dial,
          position: event.position,
          movedBy: event.by,
          accepts: [],
        }),
        {
          t: "move",
          at: event.at,
          by: event.by,
          dialId: event.dialId,
          from,
          to: event.position,
        },
      );
    }

    case "dial.accepted":
      return updateDial(
        state,
        event.dialId,
        (dial) => ({
          ...dial,
          accepts: dial.accepts.includes(event.playerId)
            ? dial.accepts
            : [...dial.accepts, event.playerId],
        }),
        { t: "accept", at: event.at, by: event.playerId, dialId: event.dialId },
      );

    case "dial.unaccepted":
      return updateDial(
        state,
        event.dialId,
        (dial) => ({
          ...dial,
          accepts: dial.accepts.filter((id) => id !== event.playerId),
        }),
        {
          t: "unaccept",
          at: event.at,
          by: event.playerId,
          dialId: event.dialId,
        },
      );

    case "dial.locked":
      return updateDial(
        state,
        event.dialId,
        (dial) => ({ ...dial, locked: true }),
        { t: "lock", at: event.at, dialId: event.dialId },
      );

    case "phase.changed":
      return { ...state, phase: event.phase };

    case "vote.cast":
      return updateRound(state, {
        votes: { ...(state.round?.votes ?? {}), [event.playerId]: event.side },
        log: logged(state, {
          t: "vote",
          at: event.at,
          by: event.playerId,
          side: event.side,
        }),
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

    case "effect.sent": {
      let tally = tallied(state.effectTally, event.by, event.effectId);
      if (event.to) tally = tallied(tally, event.to, "poked");
      return { ...state, effectTally: tally };
    }

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
  entry?: RoundLogEntry,
): GameState {
  const dial = state.round?.dials[dialId];
  if (!state.round || !dial) return state;
  return {
    ...state,
    round: {
      ...state.round,
      dials: { ...state.round.dials, [dialId]: update(dial) },
      log: entry ? [...state.round.log, entry] : state.round.log,
    },
  };
}

function tallied(
  tally: GameState["effectTally"],
  playerId: string,
  effectId: string,
): GameState["effectTally"] {
  const mine = tally[playerId] ?? {};
  return {
    ...tally,
    [playerId]: { ...mine, [effectId]: (mine[effectId] ?? 0) + 1 },
  };
}

function logged(state: GameState, entry: RoundLogEntry): RoundLogEntry[] {
  return [...(state.round?.log ?? []), entry];
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
