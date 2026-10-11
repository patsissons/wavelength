import { ranking } from "@shared/game/scoring";
import type { GameState } from "@shared/game/types";
import { TEAM_NAMES } from "@shared/game/types";
import { cn } from "@/lib/utils";

/**
 * One compact line: where we are in the game on the left, the score on the
 * right. Per-player scores live on the pills below (see PresenceStrip).
 */
export function ScoreHeader({ game }: { game: GameState }) {
  const round = game.round;
  const players = Object.keys(game.players).length;
  const roundLabel = round
    ? game.settings.mode === "teams"
      ? `Turn ${game.roundsPlayed + 1}`
      : `Round ${game.roundsPlayed + 1} of ${game.settings.rounds} · Turn ${game.history.length + 1}`
    : "";
  const flags = (
    <>
      {game.suddenDeath && (
        <span className="ml-2 font-bold text-primary">Sudden death</span>
      )}
      {round?.catchUp && (
        <span className="ml-2 font-bold text-primary">Catch-up turn</span>
      )}
    </>
  );

  let score: React.ReactNode;
  if (game.settings.mode === "teams") {
    score = (["left", "right"] as const).map((team) => (
      <span
        key={team}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wider uppercase transition-opacity",
          team === "left"
            ? "bg-team-left/15 text-team-left"
            : "bg-team-right/15 text-team-right",
          game.activeTeam !== team && "opacity-50",
        )}
        data-testid={`score-${team}`}
      >
        {TEAM_NAMES[team]}
        <strong className="text-base tabular-nums">
          {game.scores[team] ?? 0}
        </strong>
      </span>
    ));
  } else if (game.settings.mode === "coop") {
    score = (
      <span
        className="text-lg font-black tabular-nums"
        data-testid="score-coop"
      >
        {game.scores.coop ?? 0}
        <span className="text-xs font-normal text-muted-foreground">
          {" "}
          / {game.settings.rounds * players * 4}
        </span>
      </span>
    );
  } else {
    const top = ranking(game.scores)[0];
    const lead = top && top.score > 0 && game.players[top.id];
    score = lead ? (
      <span className="text-xs text-muted-foreground" data-testid="score-lead">
        🏆 {lead.name}{" "}
        <strong className="text-sm text-foreground tabular-nums">
          {top.score}
        </strong>
      </span>
    ) : null;
  }

  return (
    <header
      className="flex min-h-8 items-center justify-between gap-2"
      data-testid="score-header"
    >
      <p className="min-w-0 truncate text-xs text-muted-foreground">
        {roundLabel}
        {flags}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">{score}</div>
    </header>
  );
}
