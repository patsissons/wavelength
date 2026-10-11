import type { GameState } from "@shared/game/types";
import { TEAM_NAMES } from "@shared/game/types";
import { ranking } from "@shared/game/scoring";
import { cn } from "@/lib/utils";

export function ScoreHeader({ game }: { game: GameState }) {
  const round = game.round;
  const players = Object.keys(game.players).length;
  const roundLabel = round
    ? game.settings.mode === "teams"
      ? `Turn ${game.roundsPlayed + 1}`
      : `Round ${game.roundsPlayed + 1} of ${game.settings.rounds} · Turn ${game.history.length + 1}`
    : "";

  if (game.settings.mode === "teams") {
    return (
      <header
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
        data-testid="score-header"
      >
        {(["left", "right"] as const).map((team) => (
          <div
            key={team}
            className={cn(
              "rounded-2xl px-3 py-2 text-center transition-opacity",
              team === "left"
                ? "bg-team-left/15 text-team-left"
                : "bg-team-right/15 text-team-right",
              game.activeTeam !== team && "opacity-50",
            )}
            data-testid={`score-${team}`}
          >
            <p className="text-[10px] font-bold tracking-widest uppercase">
              {TEAM_NAMES[team]}
            </p>
            <p className="text-3xl font-black tabular-nums">
              {game.scores[team] ?? 0}
            </p>
          </div>
        ))}
        <p className="col-start-2 row-start-1 text-center text-xs text-muted-foreground">
          {roundLabel}
          {game.suddenDeath && (
            <span className="block font-bold text-primary">Sudden death</span>
          )}
          {round?.catchUp && (
            <span className="block font-bold text-primary">Catch-up turn</span>
          )}
        </p>
      </header>
    );
  }

  if (game.settings.mode === "coop") {
    return (
      <header
        className="flex items-center justify-between rounded-2xl bg-card px-4 py-2"
        data-testid="score-header"
      >
        <p className="text-xs text-muted-foreground">{roundLabel}</p>
        <p
          className="text-2xl font-black tabular-nums"
          data-testid="score-coop"
        >
          {game.scores.coop ?? 0}
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            / {game.settings.rounds * players * 4}
          </span>
        </p>
      </header>
    );
  }

  const top = ranking(game.scores).slice(0, 3);
  return (
    <header
      className="flex items-center justify-between rounded-2xl bg-card px-4 py-2"
      data-testid="score-header"
    >
      <p className="text-xs text-muted-foreground">{roundLabel}</p>
      <ol className="flex gap-3 text-sm">
        {top.map((r) => (
          <li key={r.id} className="tabular-nums">
            <span className="text-muted-foreground">
              {game.players[r.id]?.name ?? "?"}
            </span>{" "}
            <strong>{r.score}</strong>
          </li>
        ))}
      </ol>
    </header>
  );
}
