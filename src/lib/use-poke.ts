import { useCallback } from "react";
import { useGameStore } from "./store";
import { useCommand } from "./use-game-connection";

/**
 * Tap a player's name to poke them: their screen shakes with a boing.
 * Returns null when pokes are unavailable (effects off) so pills can
 * render as plain text.
 */
export function usePoke(): ((playerId: string) => void) | null {
  const send = useCommand();
  const enabled = useGameStore((s) => s.game?.settings.effects ?? false);
  const me = useGameStore((s) => s.you?.playerId ?? null);
  const poke = useCallback(
    (playerId: string) => {
      if (playerId === me) return;
      void send({ type: "poke.send", playerId });
    },
    [send, me],
  );
  return enabled ? poke : null;
}
