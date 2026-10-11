import { Eye, EyeOff } from "lucide-react";
import type { GameState } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { useCommand, useConnection } from "@/lib/use-game-connection";
import { useState } from "react";
import { CardFlip, CardPile } from "./card-pile";
import { ClueInput } from "./clue-input";

export function PsychicPanel({
  game,
  peeking,
  setPeeking,
  spinDone,
}: {
  game: GameState;
  peeking: boolean;
  setPeeking: (open: boolean) => void;
  spinDone: boolean;
}) {
  const send = useCommand();
  const { sendEphemeral } = useConnection();
  const [busy, setBusy] = useState(false);
  const round = game.round!;
  const run = async (command: Parameters<typeof send>[0]) => {
    setBusy(true);
    await send(command);
    setBusy(false);
  };
  const togglePeek = () => {
    const next = !peeking;
    setPeeking(next);
    sendEphemeral({ type: "shroud", open: next });
  };

  switch (game.phase) {
    case "drawing":
      return (
        <Panel title="You're the psychic" hint="Draw a card and choose a side.">
          {round.card ? (
            <CardFlip
              card={round.card}
              busy={busy}
              onPick={(side) => run({ type: "card.pickSide", side })}
            />
          ) : (
            <CardPile
              remaining={game.deckRemaining}
              busy={busy}
              onDraw={() => run({ type: "card.draw" })}
            />
          )}
        </Panel>
      );
    case "spinning":
      return (
        <Panel
          title="Spin the wheel"
          hint="Flick the shrouded wheel to randomize the target. Keep it hidden from the others!"
        />
      );
    case "clue":
      return (
        <Panel
          title="Peek, then give a clue"
          hint="Open the shroud to see the target. Your clue must be one idea, on the spectrum, no numbers."
        >
          <PeekButton
            peeking={peeking}
            onToggle={togglePeek}
            disabled={!spinDone}
          />
          <ClueInput
            disabled={!spinDone || busy}
            onSubmit={(clue) => run({ type: "clue.submit", clue })}
          />
        </Panel>
      );
    case "guessing":
    case "voting":
      return (
        <Panel title="Poker face" hint="They're guessing. Don't react!">
          <PeekButton peeking={peeking} onToggle={togglePeek} />
        </Panel>
      );
    default:
      return null;
  }
}

function PeekButton({
  peeking,
  onToggle,
  disabled,
}: {
  peeking: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={peeking ? "default" : "secondary"}
      size="lg"
      className="h-12 w-full"
      onClick={onToggle}
      disabled={disabled}
      data-testid="peek-toggle"
      aria-pressed={peeking}
    >
      {peeking ? <EyeOff /> : <Eye />}{" "}
      {peeking ? "Close the shroud" : "Peek at the target"}
    </Button>
  );
}

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl bg-card p-4"
      data-testid="panel"
    >
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
