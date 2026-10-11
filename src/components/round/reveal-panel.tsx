import { motion, useReducedMotion } from "motion/react";
import type { GameState, RoundResult } from "@shared/game/types";
import { TEAM_NAMES } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { useArena } from "@/lib/arena";
import { useCommand } from "@/lib/use-game-connection";
import { cn } from "@/lib/utils";

export function RevealPanel({
  game,
  playerId,
}: {
  game: GameState;
  playerId: string;
}) {
  const send = useCommand();
  const openArena = useArena((s) => s.setOpen);
  const reduced = useReducedMotion();
  const round = game.round!;
  const result = round.result!;
  const canAdvance = game.hostId === playerId || round.psychicId === playerId;
  const psychicName = game.players[round.psychicId]?.name ?? "The psychic";

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl bg-card p-4"
      data-testid="reveal"
    >
      <motion.div
        initial={reduced ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex flex-col gap-2"
      >
        <Summary game={game} result={result} psychicName={psychicName} />
      </motion.div>
      {result.gameOver && (
        <p
          className="text-center text-sm font-semibold text-primary"
          data-testid="game-over-pending"
        >
          That's the game!
        </p>
      )}
      {result.goAgain && !result.gameOver && (
        <p className="text-center text-sm font-semibold text-primary">
          Catch-up! {TEAM_NAMES[round.psychicTeam!]} goes again.
        </p>
      )}
      {game.settings.effects && (
        <Button
          variant="secondary"
          className="h-12 w-full"
          onClick={() => openArena(true)}
          data-testid="open-arena"
        >
          🎯 Throw reactions
        </Button>
      )}
      {canAdvance ? (
        <Button
          size="lg"
          className="h-14 w-full text-lg"
          onClick={() => send({ type: "round.next" })}
          data-testid="next-round"
        >
          {result.gameOver ? "See final scores" : "Next round"}
        </Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for{" "}
          {game.hostId === round.psychicId
            ? psychicName
            : `${game.players[game.hostId]?.name ?? "the host"} or ${psychicName}`}
          …
        </p>
      )}
    </section>
  );
}

function Summary({
  game,
  result,
  psychicName,
}: {
  game: GameState;
  result: RoundResult;
  psychicName: string;
}) {
  const mode = game.settings.mode;
  if (mode === "teams") {
    const team = result.psychicTeam!;
    const other = team === "left" ? "right" : "left";
    const wedge = result.dials.shared?.wedge ?? 0;
    const vote = result.vote;
    return (
      <>
        <Big
          points={wedge}
          label={`${TEAM_NAMES[team]} · ${psychicName}'s clue`}
          team={team}
        />
        {vote && (
          <p className="text-center text-sm" data-testid="vote-result">
            <span
              className={cn(
                "font-semibold",
                other === "left" ? "text-team-left" : "text-team-right",
              )}
            >
              {TEAM_NAMES[other]}
            </span>{" "}
            {vote.majority === null
              ? "split the vote"
              : `called ${vote.majority}: ${vote.bonusTo ? "+1 point" : vote.correct === vote.majority ? "right, but no bonus on a bullseye" : "wrong"}`}
          </p>
        )}
      </>
    );
  }
  if (mode === "coop") {
    const wedge = result.dials.shared?.wedge ?? 0;
    return (
      <Big
        points={wedge}
        label={`${psychicName}'s clue · total ${game.scores.coop ?? 0}`}
      />
    );
  }
  const rows = Object.entries(result.deltas).sort((a, b) => b[1] - a[1]);
  return (
    <>
      {result.psychicBonus > 0 && (
        <p
          className="text-center text-sm font-semibold text-wedge-4"
          data-testid="sweep"
        >
          Clean sweep! Everyone hit a 4: +{result.psychicBonus} bonus for{" "}
          {psychicName}.
        </p>
      )}
      <ul className="flex flex-col gap-1" data-testid="ffa-results">
        {rows.map(([id, points]) => (
          <li
            key={id}
            className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm"
          >
            <span>
              {game.players[id]?.name ?? "?"}
              {id === result.psychicId && (
                <span className="text-muted-foreground"> · psychic</span>
              )}
            </span>
            <strong className="tabular-nums">+{points}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function Big({
  points,
  label,
  team,
}: {
  points: number;
  label: string;
  team?: "left" | "right";
}) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-6xl font-black tabular-nums",
          points === 4
            ? "text-wedge-4"
            : points === 3
              ? "text-wedge-3"
              : points === 2
                ? "text-wedge-2"
                : "text-muted-foreground",
          team &&
            points === 0 &&
            (team === "left" ? "text-team-left/60" : "text-team-right/60"),
        )}
        data-testid="points"
      >
        +{points}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
