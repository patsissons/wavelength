import { useMemo } from "react";
import { ranking } from "@shared/game/scoring";
import { gameAwards, gameFacts, playerTotals } from "@shared/game/stats";
import { TEAM_NAMES } from "@shared/game/types";
import { ShareStrip } from "@/components/lounge/share-card";
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
    sub = `${game.scores.coop ?? 0} of ${game.history.length * 4} points`;
  } else {
    headline = over.winner
      ? `${game.players[over.winner]?.name ?? "Someone"} wins!`
      : "It's a tie!";
  }

  return (
    <main
      className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6"
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

      <Stats />
      <ShareStrip code={game.code} />
    </main>
  );
}

/** Awards, numbers and a per-player table computed from the round history. */
function Stats() {
  const game = useGameStore((s) => s.game)!;
  const { history, players, settings } = game;
  const awards = useMemo(
    () => gameAwards(history, players, settings.mode),
    [history, players, settings.mode],
  );
  const facts = useMemo(() => gameFacts(history, players), [history, players]);
  const totals = useMemo(
    () => playerTotals(history, players),
    [history, players],
  );
  if (history.length === 0) return null;

  return (
    <div className="flex flex-col gap-6" data-testid="stats">
      {awards.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            Awards
          </h2>
          <ul className="grid grid-cols-2 gap-2" data-testid="awards">
            {awards.map((a) => {
              const p = players[a.playerId];
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-1 rounded-2xl bg-card p-3"
                  data-testid={`award-${a.id}`}
                  data-player-name={p?.name}
                >
                  <p className="text-2xl leading-none">{a.emoji}</p>
                  <p className="font-bold">{a.title}</p>
                  {p && (
                    <p className="flex items-center gap-1.5 text-sm">
                      <PlayerAvatar player={p} size="sm" />
                      <span className="truncate">{p.name}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{a.value}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          By the numbers
        </h2>
        <dl className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4">
          {facts.map((f) => (
            <div
              key={f.id}
              className="flex items-baseline justify-between gap-4 py-2 text-sm"
            >
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          Players
        </h2>
        <table className="w-full text-sm" data-testid="player-stats">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-normal">Player</th>
              <th className="py-1 text-right font-normal">Moves</th>
              <th className="py-1 text-right font-normal">Travel</th>
              <th className="py-1 text-right font-normal">On target</th>
              <th className="py-1 text-right font-normal">As psychic</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => {
              const p = players[t.id];
              if (!p) return null;
              const aimed = t.toward + t.away;
              return (
                <tr key={t.id} className="border-t border-border">
                  <td className="flex items-center gap-1.5 py-1.5">
                    <PlayerAvatar player={p} size="sm" />
                    <span className="truncate">{p.name}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{t.moves}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {Math.round(t.travel * 180)}°
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {aimed === 0
                      ? "–"
                      : `${Math.round((100 * t.toward) / aimed)}%`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {t.psychicTurns === 0
                      ? "–"
                      : `${(t.psychicPoints / t.psychicTurns).toFixed(1)} pts`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          Turns
        </h2>
        <ol className="flex flex-col gap-1" data-testid="turns">
          {history.map((r, i) => {
            const points = Object.values(r.dials).map((d) => d.wedge);
            const best = points.length ? Math.max(...points) : 0;
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl bg-card px-3 py-2 text-sm"
              >
                <span className="w-5 text-center text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">
                    {players[r.psychicId]?.name ?? "?"}:
                  </span>{" "}
                  “{r.clue}”
                </span>
                <strong
                  className={cn(
                    "tabular-nums",
                    best === 4 && "text-wedge-4",
                    best === 3 && "text-wedge-3",
                    best === 2 && "text-wedge-2",
                    best === 0 && "text-muted-foreground",
                  )}
                >
                  {best}
                </strong>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
