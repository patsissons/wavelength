import { Check, Crown, Lock, Sparkles } from "lucide-react";
import { playersInOrder } from "@shared/game/rotation";
import { ranking } from "@shared/game/scoring";
import type { GameState, Player } from "@shared/game/types";
import { PlayerAvatar } from "@/components/player-avatar";
import { usePoke } from "@/lib/use-poke";
import { cn } from "@/lib/utils";

/**
 * One scrolling row of player pills, best score first. Each pill carries
 * everything about that player: score (FFA), psychic marker, whether they
 * have accepted / locked their dial, host crown and connection state.
 * Tapping a pill pokes that player.
 */
export function PresenceStrip({
  game,
  playerId,
}: {
  game: GameState;
  playerId: string;
}) {
  const psychicId = game.round?.psychicId;
  const poke = usePoke();
  const ffa = game.settings.mode === "ffa";
  const ranks = ffa
    ? Object.fromEntries(ranking(game.scores).map((r) => [r.id, r.rank]))
    : {};
  const guessing = game.phase === "guessing" || game.phase === "voting";

  return (
    <ul
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
      data-testid="presence"
    >
      {sortPlayers(game).map((p) => {
        const dial = guessing
          ? Object.values(game.round?.dials ?? {}).find((d) =>
              d.owners.includes(p.id),
            )
          : undefined;
        const locked = !!dial?.locked;
        const accepted = !locked && !!dial?.accepts.includes(p.id);
        const score = ffa ? (game.scores[p.id] ?? 0) : null;
        return (
          <li
            key={p.id}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border border-transparent bg-card py-0.5 pr-2 pl-0.5 text-xs",
              p.team === "left" && "border-team-left/60",
              p.team === "right" && "border-team-right/60",
              p.id === psychicId && "ring-1 ring-primary",
              p.id === playerId && "bg-accent",
              p.away && "opacity-50",
            )}
            data-testid="presence-player"
            data-player-name={p.name}
            data-away={p.away || undefined}
            data-connected={p.connected || undefined}
            data-locked={locked || undefined}
            data-accepted={accepted || undefined}
            data-score={score ?? undefined}
            data-rank={ffa ? ranks[p.id] : undefined}
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
                  "max-w-24 truncate",
                  p.id === playerId && "font-semibold",
                )}
              >
                {p.name}
              </span>
            </button>
            {score !== null && (
              <strong className="rounded-full bg-background/60 px-1.5 tabular-nums">
                {score}
              </strong>
            )}
            {p.id === psychicId && (
              <Sparkles
                className="size-3.5 text-primary"
                aria-label="psychic"
              />
            )}
            {locked && (
              <Lock className="size-3.5 text-primary" aria-label="locked in" />
            )}
            {accepted && (
              <Check className="size-3.5 text-primary" aria-label="accepted" />
            )}
            {p.id === game.hostId && (
              <Crown
                className="size-3 text-muted-foreground"
                aria-label="host"
              />
            )}
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
        );
      })}
    </ul>
  );
}

/** Best score first (FFA: own score; Teams: team score), then join order. */
function sortPlayers(game: GameState): Player[] {
  const players = playersInOrder(game);
  const score = (p: Player): number => {
    if (game.settings.mode === "ffa") return game.scores[p.id] ?? 0;
    if (game.settings.mode === "teams" && p.team)
      return game.scores[p.team] ?? 0;
    return 0;
  };
  return players.sort((a, b) => score(b) - score(a) || a.order - b.order);
}
