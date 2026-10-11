import { Eye, EyeOff } from "lucide-react";
import type { GameState } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { spinsRemaining } from "@shared/game/selectors";
import { useCommand } from "@/lib/use-game-connection";
import { useState } from "react";
import { CardFlip, CardPile } from "./card-pile";
import { ClueInput } from "./clue-input";

export function PsychicPanel({
  game,
  spinDone,
}: {
  game: GameState;
  /** The latest spin has landed (clue input and re-spins wait for it). */
  spinDone: boolean;
}) {
  const send = useCommand();
  const [busy, setBusy] = useState(false);
  const round = game.round!;
  const run = async (command: Parameters<typeof send>[0]) => {
    setBusy(true);
    await send(command);
    setBusy(false);
  };
  const toggleShroud = () =>
    send({ type: "shroud.toggle", open: !round.shroudOpen });
  const spinsLeft = spinsRemaining(game);

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
          hint="Tap or flick the wheel to spin it. Keep your screen to yourself!"
        />
      );
    case "clue":
      return (
        <Panel
          title={spinDone ? "Give a clue" : "Spinning…"}
          hint={
            round.shroudOpen
              ? spinsLeft === 0
                ? "No spins left. Cover the wheel and give your clue: one idea, on the spectrum, no numbers."
                : `Not happy with the target? Tap the wheel to spin again (${spinsLeft === null ? "as often as you like" : `${spinsLeft} left`}). Otherwise cover it and give your clue: one idea, on the spectrum, no numbers.`
              : "Tap the shroud to peek again, or give your clue: one idea, on the spectrum, no numbers."
          }
        >
          <ShroudButton
            open={round.shroudOpen}
            onToggle={toggleShroud}
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
          <ShroudButton open={round.shroudOpen} onToggle={toggleShroud} />
        </Panel>
      );
    default:
      return null;
  }
}

function ShroudButton({
  open,
  onToggle,
  disabled,
}: {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={open ? "default" : "secondary"}
      size="lg"
      className="h-12 w-full"
      onClick={onToggle}
      disabled={disabled}
      data-testid="peek-toggle"
      aria-pressed={open}
    >
      {open ? <EyeOff /> : <Eye />}{" "}
      {open ? "Cover the target" : "Peek at the target"}
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
