import { useGameStore } from "@/lib/store";
import { useConnection } from "@/lib/use-game-connection";

export function ConnectionBanner() {
  const conn = useGameStore((s) => s.conn);
  const { reconnectNow } = useConnection();
  if (conn === "open") return null;
  const label =
    conn === "connecting"
      ? "Connecting…"
      : conn === "reconnecting"
        ? "Reconnecting…"
        : "Disconnected";
  return (
    <button
      type="button"
      onClick={reconnectNow}
      className="fixed inset-x-0 top-0 z-40 bg-primary/90 px-4 py-2 text-center text-sm font-semibold text-primary-foreground backdrop-blur"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      data-testid="connection-banner"
    >
      {label} · tap to retry
    </button>
  );
}
