import { Navigate, useParams } from "react-router";
import { ConnectionBanner } from "@/components/connection-banner";
import { EffectsLayer } from "@/components/effects/effects-layer";
import { GameOver } from "@/components/game-over";
import { Lounge } from "@/components/lounge/lounge";
import { RoundScreen } from "@/components/round/round-screen";
import { loadIdentity } from "@/lib/identity";
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
      <GameScreen />
    </ConnectionProvider>
  );
}

function GameScreen() {
  const phase = useGameStore((s) => s.game?.phase ?? null);
  if (phase === null) {
    return (
      <main className="safe-area flex min-h-dvh items-center justify-center p-6 text-muted-foreground">
        Joining the room…
      </main>
    );
  }
  if (phase === "lobby") return <Lounge />;
  if (phase === "gameover") return <GameOver />;
  return <RoundScreen />;
}
