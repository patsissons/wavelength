import { useState } from "react";
import { dialsFor, roleOf } from "@shared/game/selectors";
import { useGameStore } from "@/lib/store";
import { BoardStage } from "./board-stage";
import { GuesserPanel } from "./guesser-panel";
import { PsychicPanel, Panel } from "./psychic-panel";
import { ScoreHeader } from "./score-header";
import { SpectrumLabels } from "./spectrum-labels";

export function RoundScreen() {
  const game = useGameStore((s) => s.game)!;
  const you = useGameStore((s) => s.you)!;
  const peekingRemote = useGameStore((s) => s.live.psychicPeeking);
  const [peeking, setPeeking] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const round = game.round!;
  const role = roleOf(game, you.playerId);
  const psychic = game.players[round.psychicId];

  return (
    <main className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-4">
      <ScoreHeader game={game} />
      <SpectrumLabels spectrum={round.spectrum} />
      <BoardStage
        game={game}
        playerId={you.playerId}
        peeking={peeking}
        onSpinDone={() => setSpinDone(true)}
      />
      {round.clue && (
        <p
          className="rounded-2xl bg-primary/15 px-4 py-3 text-center text-xl font-bold"
          data-testid="clue"
        >
          “{round.clue}”
        </p>
      )}
      {role === "psychic" ? (
        <PsychicPanel
          game={game}
          peeking={peeking}
          setPeeking={setPeeking}
          spinDone={spinDone || game.phase !== "clue" || round.spin === null}
        />
      ) : role === "guesser" &&
        (game.phase === "guessing" || game.phase === "voting") ? (
        <GuesserPanel
          game={game}
          playerId={you.playerId}
          dial={dialsFor(game, you.playerId)[0]!}
        />
      ) : (
        <Panel
          title={statusLine(
            game.phase,
            psychic?.name ?? "The psychic",
            peekingRemote,
          )}
        />
      )}
    </main>
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
