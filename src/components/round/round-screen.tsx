import { useState } from "react";
import { dialsFor, roleOf } from "@shared/game/selectors";
import { matchClue } from "@/lib/eggs/clues";
import { useGameStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EffectsBar, MuteToggle } from "@/components/effects/effects-bar";
import { ShareStrip } from "@/components/lounge/share-card";
import { BoardStage } from "./board-stage";
import { GuesserPanel } from "./guesser-panel";
import { HostControls } from "./host-controls";
import { OpponentPanel } from "./opponent-panel";
import { PresenceStrip } from "./presence-strip";
import { PsychicPanel, Panel } from "./psychic-panel";
import { RevealPanel } from "./reveal-panel";
import { ScoreHeader } from "./score-header";
import { SpectrumLabels } from "./spectrum-labels";

export function RoundScreen() {
  const game = useGameStore((s) => s.game)!;
  const you = useGameStore((s) => s.you)!;
  const [spinDone, setSpinDone] = useState(false);
  const [lastSpin, setLastSpin] = useState<string | null>(null);
  const round = game.round!;
  const spinId = round.spin?.id ?? null;
  if (spinId !== lastSpin) {
    // A new spin (or re-spin) is in flight until the board says it landed.
    setLastSpin(spinId);
    setSpinDone(false);
  }
  const role = roleOf(game, you.playerId);
  const psychic = game.players[round.psychicId];
  const clueEgg = matchClue(round.clue);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="safe-x safe-top flex flex-1 flex-col gap-3 pb-3">
        <ScoreHeader game={game} />
        <PresenceStrip game={game} playerId={you.playerId} />
        {psychic?.away && game.phase !== "reveal" && (
          <p
            className="rounded-xl bg-destructive/15 px-3 py-2 text-center text-sm"
            data-testid="psychic-away"
          >
            {psychic.name} seems to have left.
            {game.hostId === you.playerId
              ? " Use the host controls to skip this round."
              : " The host can skip this round."}
          </p>
        )}
        <SpectrumLabels spectrum={round.spectrum} />
        <BoardStage
          game={game}
          playerId={you.playerId}
          onSpinDone={() => setSpinDone(true)}
        />
        {round.clue && (
          <p
            className={cn(
              "rounded-2xl bg-primary/15 px-4 py-3 text-center text-xl font-bold",
              clueEgg?.shimmer && "egg-shimmer",
            )}
            data-testid="clue"
            data-egg-clue={clueEgg?.id}
          >
            “{round.clue}”
            {clueEgg?.subtitle && (
              <span className="block text-sm font-medium text-muted-foreground">
                {clueEgg.subtitle}
              </span>
            )}
          </p>
        )}
        {game.phase === "reveal" && round.result ? (
          <RevealPanel game={game} playerId={you.playerId} />
        ) : role === "psychic" ? (
          <PsychicPanel
            game={game}
            spinDone={spinDone || game.phase !== "clue" || round.spin === null}
          />
        ) : role === "guesser" &&
          (game.phase === "guessing" || game.phase === "voting") ? (
          <GuesserPanel
            game={game}
            playerId={you.playerId}
            dial={dialsFor(game, you.playerId)[0]!}
          />
        ) : role === "opponent" &&
          (game.phase === "guessing" || game.phase === "voting") ? (
          <OpponentPanel game={game} playerId={you.playerId} />
        ) : (
          <Panel
            title={statusLine(
              game.phase,
              psychic?.name ?? "The psychic",
              round.shroudOpen,
            )}
          />
        )}
        <ShareStrip code={game.code} className="mt-auto" />
      </main>
      {/* Sticky toolbar: sound, effects, host. It sits outside the padded
          main so it can span the full width without ever overflowing it. */}
      <footer
        className="safe-x safe-bottom sticky bottom-0 z-20 flex items-center gap-2 border-t border-border bg-background pt-2"
        data-testid="toolbar"
      >
        <MuteToggle />
        {game.settings.effects ? (
          <EffectsBar role={role} />
        ) : (
          <div className="flex-1" />
        )}
        {game.hostId === you.playerId && (
          <HostControls game={game} playerId={you.playerId} />
        )}
      </footer>
    </div>
  );
}

function statusLine(phase: string, name: string, peeking: boolean): string {
  switch (phase) {
    case "drawing":
      return `${name} is drawing a card…`;
    case "spinning":
      return `${name} is spinning the wheel…`;
    case "clue":
      return peeking
        ? `${name} is peeking at the target…`
        : `${name} is thinking of a clue…`;
    case "guessing":
      return "Guessing time";
    case "voting":
      return "Left or right?";
    case "reveal":
      return "The reveal";
    default:
      return "";
  }
}
