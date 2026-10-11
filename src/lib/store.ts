import { create } from "zustand";
import { applyEvent } from "@shared/game/reducer";
import type { GameState } from "@shared/game/types";
import type { ErrorCode, ServerMessage } from "@shared/protocol/messages";
import { effectBus } from "./effect-bus";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface LiveState {
  /** Other players' in-progress dial positions (not yet committed). */
  dials: Record<string, { position: number; by: string }>;
  /** This device's dial while dragging; wins over everything visually. */
  localDial: { dialId: string; position: number } | null;
  /** The psychic is currently peeking under the shroud. */
  psychicPeeking: boolean;
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
  /** Handle a server message; returns "gap" when a resync is required. */
  receive: (message: ServerMessage) => "gap" | undefined;
  setConn: (status: ConnStatus) => void;
  setLocalDial: (dial: LiveState["localDial"]) => void;
  setPeeking: (peeking: boolean) => void;
  clearError: () => void;
  reset: () => void;
}

const emptyLive = (): LiveState => ({
  dials: {},
  localDial: null,
  psychicPeeking: false,
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

  receive(message) {
    switch (message.type) {
      case "snapshot":
        set({
          game: message.state,
          you: message.you,
          live: emptyLive(),
        });
        return;
      case "event": {
        const game = get().game;
        if (!game) return "gap";
        if (message.version <= game.version) return; // duplicate
        if (message.version !== game.version + 1) return "gap";
        const next = applyEvent(game, message.event);
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
        } else if (payload.kind === "shroud") {
          set((s) => ({ live: { ...s.live, psychicPeeking: payload.open } }));
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
  setPeeking: (psychicPeeking) =>
    set((s) => ({ live: { ...s.live, psychicPeeking } })),
  clearError: () => set({ error: null }),
  reset: () =>
    set({
      game: null,
      you: null,
      conn: "connecting",
      live: emptyLive(),
      error: null,
    }),
}));

/* ---------- selectors ---------- */

export const selectGame = (s: GameStore) => s.game;
export const selectYou = (s: GameStore) => s.you;
export const selectMe = (s: GameStore) =>
  s.game && s.you ? (s.game.players[s.you.playerId] ?? null) : null;
export const selectIsHost = (s: GameStore) =>
  !!s.game && !!s.you && s.game.hostId === s.you.playerId;
