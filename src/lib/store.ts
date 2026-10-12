import { create } from "zustand";
import { applyEvent } from "@shared/game/reducer";
import { activeOwners, allDialsLocked } from "@shared/game/selectors";
import { PROTOCOL_VERSION, type GameState } from "@shared/game/types";
import type { GameEvent } from "@shared/protocol/events";
import type { ErrorCode, ServerMessage } from "@shared/protocol/messages";
import { useArena } from "./arena";
import { celebrationBus, effectBus } from "./effect-bus";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface LiveState {
  /** Other players' in-progress dial positions (not yet committed). */
  dials: Record<string, { position: number; by: string }>;
  /** This device's dial while dragging; wins over everything visually. */
  localDial: { dialId: string; position: number } | null;
}

export interface GameError {
  code: ErrorCode;
  message: string;
  cmdId?: string;
  at: number;
}

export interface GameStore {
  game: GameState | null;
  you: { playerId: string; target: number | null } | null;
  conn: ConnStatus;
  live: LiveState;
  error: GameError | null;
  /** The server runs a newer protocol than this bundle. */
  outdated: boolean;
  /** Server time minus local time, measured when the clue arrives. */
  clockSkew: number;
  /** Handle a server message; returns "gap" when a resync is required. */
  receive: (message: ServerMessage) => "gap" | undefined;
  setConn: (status: ConnStatus) => void;
  setLocalDial: (dial: LiveState["localDial"]) => void;
  clearError: () => void;
  reset: () => void;
}

const emptyLive = (): LiveState => ({
  dials: {},
  localDial: null,
});

const ROUND_RESETS = new Set([
  "game.started",
  "round.advanced",
  "round.revealed",
  "game.reset",
]);

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  you: null,
  conn: "connecting",
  live: emptyLive(),
  error: null,
  outdated: false,
  clockSkew: 0,

  receive(message) {
    switch (message.type) {
      case "snapshot":
        set({
          game: message.state,
          you: message.you,
          live: emptyLive(),
          outdated: message.state.protocolVersion > PROTOCOL_VERSION,
        });
        return;
      case "event": {
        const game = get().game;
        if (!game) return "gap";
        if (message.version <= game.version) return; // duplicate
        if (message.version !== game.version + 1) return "gap";
        const next = applyEvent(game, message.event);
        celebrate(game, next, message.event, get().you?.playerId ?? null);
        if (
          message.event.type === "dial.set" ||
          message.event.type === "dial.locked"
        ) {
          // A committed position supersedes any live preview of that dial.
          const dials = { ...get().live.dials };
          delete dials[message.event.dialId];
          set({ game: next, live: { ...get().live, dials } });
          return;
        }
        if (message.event.type === "clue.submitted") {
          // The dial deadline is server time; remember how far off we are.
          set({ game: next, clockSkew: message.event.at - Date.now() });
          return;
        }
        if (ROUND_RESETS.has(message.event.type)) {
          const you = get().you;
          set({
            game: next,
            live: emptyLive(),
            you:
              you && message.event.type !== "round.revealed"
                ? { ...you, target: null }
                : you,
          });
        } else {
          set({ game: next });
        }
        return;
      }
      case "private":
        set((s) =>
          s.you ? { you: { ...s.you, target: message.target } } : {},
        );
        return;
      case "ephemeral": {
        const payload = message.payload;
        if (payload.kind === "dial.live") {
          set((s) => ({
            live: {
              ...s.live,
              dials: {
                ...s.live.dials,
                [payload.dialId]: {
                  position: payload.position,
                  by: payload.by,
                },
              },
            },
          }));
        } else if (payload.kind === "arena") {
          // Someone opened the arena after the reveal: everyone follows.
          if (get().game?.phase === "reveal") useArena.getState().setOpen(true);
        } else {
          effectBus.emit(payload);
        }
        return;
      }
      case "error":
        set({
          error: {
            code: message.code,
            message: message.message,
            cmdId: message.cmdId,
            at: Date.now(),
          },
        });
        return;
      case "ack":
        return;
    }
  },

  setConn: (conn) => set({ conn }),
  setLocalDial: (localDial) => set((s) => ({ live: { ...s.live, localDial } })),
  clearError: () => set({ error: null }),
  reset: () =>
    set({
      game: null,
      you: null,
      conn: "connecting",
      live: emptyLive(),
      error: null,
      outdated: false,
    }),
}));

/**
 * Confetti moments derived from events: a dial locking because every
 * active owner accepted (not a host force-lock), and this player's own
 * wedge score at the reveal.
 */
function celebrate(
  before: GameState,
  after: GameState,
  event: GameEvent,
  playerId: string | null,
) {
  if (event.type === "dial.locked") {
    const dial = before.round?.dials[event.dialId];
    if (!dial) return;
    const owners = activeOwners(before, dial);
    const unanimous =
      owners.length > 0 && owners.every((id) => dial.accepts.includes(id));
    if (!unanimous) return;
    if (dial.id === "shared" || allDialsLocked(after)) {
      celebrationBus.emit({ kind: "lock" });
    }
  } else if (event.type === "game.started" || event.type === "round.advanced") {
    celebrationBus.emit({ kind: "newround" });
  } else if (event.type === "game.over") {
    celebrationBus.emit({ kind: "gameover" });
  } else if (event.type === "guess.expired") {
    celebrationBus.emit({ kind: "timeup" });
  } else if (event.type === "round.revealed" && playerId) {
    const mine = Object.values(event.result.dials).find((d) =>
      d.owners.includes(playerId),
    );
    if (mine && mine.wedge >= 2) {
      celebrationBus.emit({ kind: "score", points: mine.wedge as 2 | 3 | 4 });
    }
  }
}

/* ---------- selectors ---------- */

export const selectGame = (s: GameStore) => s.game;
export const selectYou = (s: GameStore) => s.you;
export const selectMe = (s: GameStore) =>
  s.game && s.you ? (s.game.players[s.you.playerId] ?? null) : null;
export const selectIsHost = (s: GameStore) =>
  !!s.game && !!s.you && s.game.hostId === s.you.playerId;
