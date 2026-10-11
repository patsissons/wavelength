import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { GameConnection } from "@/lib/connection";
import {
  ConnectionContext,
  type ConnectionApi,
} from "@/lib/connection-context";
import { clearIdentity, loadIdentity } from "@/lib/identity";
import { useGameStore } from "@/lib/store";

declare global {
  interface Window {
    /** Test hook: simulate the OS killing the socket. */
    __wsDrop?: () => void;
  }
}

/**
 * Owns the GameConnection for a game code, wires it to the store and
 * exposes send() to the tree. One connection per mounted provider.
 */
export function ConnectionProvider({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const ref = useRef<GameConnection | null>(null);

  useEffect(() => {
    const store = useGameStore.getState();
    store.reset();
    const conn = new GameConnection({
      code,
      identity: () => loadIdentity(code),
      onStatus: (status) => useGameStore.getState().setConn(status),
      onMessage: (message) => {
        const result = useGameStore.getState().receive(message);
        if (result === "gap") conn.resync();
        if (
          message.type === "error" &&
          (message.code === "unauthorized" || message.code === "no_game")
        ) {
          clearIdentity(code);
          conn.close();
          toast.error(
            message.code === "no_game"
              ? "That game no longer exists."
              : "You were removed from the game.",
          );
          navigate(message.code === "no_game" ? "/" : `/join/${code}`, {
            replace: true,
          });
        }
      },
    });
    ref.current = conn;
    window.__wsDrop = () => conn.simulateDrop();
    return () => {
      delete window.__wsDrop;
      conn.close();
      ref.current = null;
    };
  }, [code, navigate]);

  const api = useMemo<ConnectionApi>(
    () => ({
      send: (command) =>
        ref.current?.send(command) ??
        Promise.resolve({
          ok: false,
          code: "bad_message",
          message: "not connected",
        }),
      sendEphemeral: (message) => ref.current?.sendEphemeral(message),
      reconnectNow: () => ref.current?.reconnectNow(),
    }),
    [],
  );

  return (
    <ConnectionContext.Provider value={api}>
      {children}
    </ConnectionContext.Provider>
  );
}
