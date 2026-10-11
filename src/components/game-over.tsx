import { ranking } from "@shared/game/scoring";
import { TEAM_NAMES } from "@shared/game/types";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { selectIsHost, useGameStore } from "@/lib/store";
import { useCommand } from "@/lib/use-game-connection";
import { cn } from "@/lib/utils";

export function GameOver() {
  const game = useGameStore((s) => s.game)!;
  const isHost = useGameStore(selectIsHost);
  const send = useCommand();
  const over = game.gameOver!;
  const mode = game.settings.mode;

  let headline: string;
  let sub: string | null = null;
  if (mode === "teams") {
    headline = over.winner
      ? `${TEAM_NAMES[over.winner as "left" | "right"]} wins!`
      : "It's a tie!";
    sub = `${game.scores.left ?? 0} – ${game.scores.right ?? 0}`;
  } else if (mode === "coop") {
    headline = over.label ?? "Game over";
    sub = `${game.scores.coop ?? 0} of ${game.settings.rounds * 4} points`;
  } else {
    headline = over.winner
      ? `${game.players[over.winner]?.name ?? "Someone"} wins!`
      : "It's a tie!";
  }

  return (
    <main
      className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6"
      data-testid="game-over"
    >
      <header className="text-center">
        <p className="text-sm tracking-widest text-muted-foreground uppercase">
          Game over
        </p>
        <h1 className="mt-2 text-4xl font-black" data-testid="winner">
          {headline}
        </h1>
        {sub && (
          <p className="mt-2 text-2xl font-bold tabular-nums text-muted-foreground">
            {sub}
          </p>
        )}
      </header>

      {mode === "ffa" && (
        <ol className="flex flex-col gap-1">
          {ranking(game.scores).map((r) => {
            const p = game.players[r.id];
            if (!p) return null;
            return (
              <li
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl bg-card px-3 py-2",
                  r.rank === 1 && "ring-2 ring-primary",
                )}
              >
                <span className="w-6 text-center font-bold text-muted-foreground">
                  {r.rank}
                </span>
                <PlayerAvatar player={p} size="sm" />
                <span className="flex-1 truncate">{p.name}</span>
                <strong className="tabular-nums">{r.score}</strong>
              </li>
            );
          })}
        </ol>
      )}

      {isHost ? (
        <Button
          size="lg"
          className="h-14 text-lg"
          onClick={() => send({ type: "game.playAgain" })}
          data-testid="play-again"
        >
          Play again
        </Button>
      ) : (
        <p className="text-center text-muted-foreground">
          Waiting for {game.players[game.hostId]?.name ?? "the host"} to start
          another game…
        </p>
      )}
    </main>
  );
}
