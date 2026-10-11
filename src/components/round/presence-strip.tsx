import { playersInOrder } from "@shared/game/rotation";
import type { GameState } from "@shared/game/types";
import { PlayerAvatar } from "@/components/player-avatar";
import { usePoke } from "@/lib/use-poke";
import { cn } from "@/lib/utils";

/** Compact row of everyone in the game with connection state. */
export function PresenceStrip({
  game,
  playerId,
}: {
  game: GameState;
  playerId: string;
}) {
  const psychicId = game.round?.psychicId;
  const poke = usePoke();
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="presence">
      {playersInOrder(game).map((p) => (
        <li
          key={p.id}
          className={cn(
            "flex items-center gap-1 rounded-full bg-card py-0.5 pr-2 pl-0.5 text-xs",
            p.id === psychicId && "ring-1 ring-primary",
            p.away && "opacity-50",
          )}
          data-testid="presence-player"
          data-player-name={p.name}
          data-away={p.away || undefined}
          data-connected={p.connected || undefined}
          title={
            p.away
              ? `${p.name} is away`
              : p.connected
                ? p.name
                : `${p.name} is reconnecting`
          }
        >
          <button
            type="button"
            className="flex items-center gap-1 disabled:cursor-default"
            onClick={() => poke?.(p.id)}
            disabled={!poke || p.id === playerId}
            aria-label={poke && p.id !== playerId ? `Poke ${p.name}` : p.name}
            data-testid="poke"
          >
            <PlayerAvatar player={p} size="sm" />
            <span
              className={cn(
                "max-w-20 truncate",
                p.id === playerId && "font-semibold",
              )}
            >
              {p.name}
            </span>
          </button>
          {!p.connected && (
            <span
              className={cn(
                "size-1.5 rounded-full",
                p.away ? "bg-destructive" : "bg-muted-foreground",
              )}
              aria-label={p.away ? "away" : "reconnecting"}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
