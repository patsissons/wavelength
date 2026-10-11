import { Check, Lock } from "lucide-react";
import { activeOwners } from "@shared/game/selectors";
import type { DialState, GameState } from "@shared/game/types";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { useCommand } from "@/lib/use-game-connection";
import { cn } from "@/lib/utils";
import { Panel } from "./psychic-panel";

export function GuesserPanel({
  game,
  playerId,
  dial,
}: {
  game: GameState;
  playerId: string;
  dial: DialState;
}) {
  const send = useCommand();
  const shared = dial.id === "shared";
  const accepted = dial.accepts.includes(playerId);
  const owners = activeOwners(game, dial);

  if (dial.locked) {
    return (
      <Panel
        title="Locked in"
        hint={shared ? "Your team's guess is set." : "Your guess is set."}
      >
        <p
          className="flex items-center justify-center gap-2 text-primary"
          data-testid="locked"
        >
          <Lock className="size-5" /> Waiting for the others…
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={shared ? "Turn the dial together" : "Turn your dial"}
      hint={
        shared
          ? "Anyone on your team can move it. Lock in when everyone accepts; moving it resets the accepts."
          : "Drag the needle, then lock it in."
      }
    >
      {shared && (
        <ul className="flex flex-wrap gap-2" data-testid="accepts">
          {owners.map((id) => {
            const p = game.players[id];
            if (!p) return null;
            const ok = dial.accepts.includes(id);
            return (
              <li
                key={id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm",
                  ok
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
                data-testid="accept-chip"
                data-accepted={ok || undefined}
              >
                <PlayerAvatar player={p} size="sm" />
                {p.name}
                {ok && <Check className="size-4" />}
              </li>
            );
          })}
        </ul>
      )}
      <Button
        size="lg"
        className="h-14 w-full text-lg"
        variant={accepted ? "secondary" : "default"}
        onClick={() =>
          send({
            type: accepted ? "dial.unaccept" : "dial.accept",
            dialId: dial.id,
          })
        }
        data-testid="accept-dial"
        aria-pressed={accepted}
      >
        {accepted ? (
          <>
            <Check /> Accepted · tap to undo
          </>
        ) : shared ? (
          "Accept this position"
        ) : (
          "Lock it in"
        )}
      </Button>
    </Panel>
  );
}
