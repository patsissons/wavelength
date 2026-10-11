import { ArrowLeft, ArrowRight } from "lucide-react";
import { activeOpponents } from "@shared/game/selectors";
import type { GameState, Side } from "@shared/game/types";
import { TEAM_NAMES } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { useCommand } from "@/lib/use-game-connection";
import { cn } from "@/lib/utils";
import { Panel } from "./psychic-panel";

export function OpponentPanel({
  game,
  playerId,
}: {
  game: GameState;
  playerId: string;
}) {
  const send = useCommand();
  const round = game.round!;
  const mine = round.votes[playerId];
  const voters = activeOpponents(game);
  const voted = voters.filter((p) => round.votes[p.id]).length;
  const team = round.psychicTeam
    ? TEAM_NAMES[round.psychicTeam]
    : "The other team";

  if (game.phase === "guessing") {
    return (
      <Panel
        title={`${team} is guessing`}
        hint="Watch their dial. When it locks, your team calls whether the target is left or right of it."
      />
    );
  }

  const vote = (side: Side) => (
    <Button
      key={side}
      size="lg"
      variant={mine === side ? "default" : "secondary"}
      className={cn(
        "h-16 flex-1 text-lg",
        mine === side && "ring-2 ring-primary",
      )}
      onClick={() => send({ type: "vote.cast", side })}
      data-testid={`vote-${side}`}
      aria-pressed={mine === side}
    >
      {side === "left" ? <ArrowLeft /> : null}
      {side === "left" ? "Left" : "Right"}
      {side === "right" ? <ArrowRight /> : null}
    </Button>
  );

  return (
    <Panel
      title="Left or right?"
      hint="Is the target to the left or the right of their dial? Majority wins; a tie scores nothing."
    >
      <div className="flex gap-3">
        {vote("left")}
        {vote("right")}
      </div>
      <p
        className="text-center text-sm text-muted-foreground"
        data-testid="vote-progress"
      >
        {voted} of {voters.length} voted
      </p>
    </Panel>
  );
}
