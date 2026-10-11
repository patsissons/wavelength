import { Navigate, useParams } from "react-router";
import { ConnectionBanner } from "@/components/connection-banner";
import { RoomEggs } from "@/components/eggs/room-eggs";
import { EffectsLayer } from "@/components/effects/effects-layer";
import { GameOver } from "@/components/game-over";
import { OutdatedBanner } from "@/components/outdated-banner";
import { Lounge } from "@/components/lounge/lounge";
import { RoundScreen } from "@/components/round/round-screen";
import { loadIdentity } from "@/lib/identity";
import { releaseWakeLock, requestWakeLock } from "@/lib/wake-lock";
import { useEffect } from "react";
import { useGameStore } from "@/lib/store";
import { ConnectionProvider } from "@/components/connection-provider";

export function Game() {
  const { code = "" } = useParams();
  const normalized = code.toUpperCase();
  if (!loadIdentity(normalized)) {
    return <Navigate to={`/join/${normalized}`} replace />;
  }
  return (
    <ConnectionProvider code={normalized}>
      <ConnectionBanner />
      <EffectsLayer />
      <RoomEggs />
      <GameScreen />
      <OutdatedBanner />
    </ConnectionProvider>
  );
}

function GameScreen() {
  const phase = useGameStore((s) => s.game?.phase ?? null);
  useEffect(() => {
    // Best effort: Safari needs a gesture first (the lounge's sound button
    // re-requests it), but Chrome grants it here.
    void requestWakeLock();
    return () => releaseWakeLock();
  }, []);
  if (phase === null) {
    return (
      <main className="safe-area flex min-h-dvh items-center justify-center text-muted-foreground">
        Joining the room…
      </main>
    );
  }
  if (phase === "lobby") return <Lounge />;
  if (phase === "gameover") return <GameOver />;
  return <RoundScreen />;
}
