import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { playersInOrder } from "@shared/game/rotation";
import type { GameState } from "@shared/game/types";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCommand } from "@/lib/use-game-connection";

export function HostControls({
  game,
  playerId,
}: {
  game: GameState;
  playerId: string;
}) {
  const send = useCommand();
  const [open, setOpen] = useState(false);
  const run = async (command: Parameters<typeof send>[0]) => {
    await send(command);
    setOpen(false);
  };
  const inGuess = game.phase === "guessing" || game.phase === "voting";
  const inRound = game.phase !== "lobby" && game.phase !== "gameover";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-11 shrink-0"
          data-testid="host-controls"
        >
          <ShieldCheck /> Host
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Host controls</SheetTitle>
          <SheetDescription>Keep the game moving.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-8">
          {inGuess && (
            <Button
              variant="secondary"
              onClick={() => run({ type: "host.forceLock" })}
              data-testid="force-lock"
            >
              {game.phase === "guessing"
                ? "Lock the dial now"
                : "Close the vote now"}
            </Button>
          )}
          {inRound && game.phase !== "reveal" && (
            <Button
              variant="secondary"
              onClick={() => run({ type: "host.skipRound" })}
              data-testid="skip-round"
            >
              Skip this round (new psychic)
            </Button>
          )}
          {inRound && (
            <Button
              variant="destructive"
              onClick={() => run({ type: "host.endGame" })}
              data-testid="end-game"
            >
              End the game now
            </Button>
          )}
          <p className="mt-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Players
          </p>
          <ul className="flex flex-col gap-1">
            {playersInOrder(game)
              .filter((p) => p.id !== playerId)
              .map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <PlayerAvatar player={p} size="sm" />
                  <span className="flex-1 truncate">
                    {p.name}
                    {p.away && (
                      <span className="text-muted-foreground"> · away</span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      run({ type: "host.transfer", playerId: p.id })
                    }
                  >
                    Make host
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run({ type: "host.kick", playerId: p.id })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
