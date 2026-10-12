import { Crown, X } from "lucide-react";
import { playersInOrder } from "@shared/game/rotation";
import type { TeamId } from "@shared/game/types";
import { TEAM_NAMES } from "@shared/game/types";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { selectIsHost, useGameStore } from "@/lib/store";
import { useSelfPill } from "@/lib/eggs/avatar-eggs";
import { useCommand } from "@/lib/use-game-connection";
import { usePoke } from "@/lib/use-poke";
import { cn } from "@/lib/utils";

export function PlayerList() {
  const game = useGameStore((s) => s.game)!;
  const you = useGameStore((s) => s.you)!;
  const isHost = useGameStore(selectIsHost);
  const send = useCommand();
  const players = playersInOrder(game);
  const teams = game.settings.mode === "teams";
  const poke = usePoke();
  // Your own pill is an egg instead of a poke (see lib/eggs/avatar-eggs).
  const selfPill = useSelfPill(game.players[you.playerId] ?? { name: "?" });

  const column = (team: TeamId | null) => (
    <ul
      className="flex flex-col gap-1"
      data-testid={team ? `team-${team}` : "players"}
    >
      {players
        .filter((p) => !teams || p.team === team)
        .map((p) => (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-2 rounded-xl px-2 py-1.5",
              p.id === you.playerId && "bg-accent",
            )}
            data-testid="player"
            data-player-name={p.name}
            data-away={p.away || undefined}
            data-connected={p.connected || undefined}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left select-none disabled:cursor-default [-webkit-touch-callout:none]"
              {...(p.id === you.playerId
                ? selfPill
                : { onClick: () => poke?.(p.id) })}
              disabled={p.id !== you.playerId && !poke}
              title={
                poke && p.id !== you.playerId ? `Poke ${p.name}` : undefined
              }
              data-testid={p.id === you.playerId ? "self" : "poke"}
            >
              <PlayerAvatar player={p} size="sm" />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  p.away && "text-muted-foreground line-through",
                )}
              >
                {p.name}
                {p.id === you.playerId && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </span>
            </button>
            {p.id === game.hostId && (
              <Crown className="size-4 text-primary" aria-label="host" />
            )}
            {!p.connected && !p.away && (
              <span
                className="size-2 rounded-full bg-muted-foreground"
                aria-label="disconnected"
              />
            )}
            {isHost && p.id !== you.playerId && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${p.name}`}
                onClick={() => send({ type: "host.kick", playerId: p.id })}
              >
                <X />
              </Button>
            )}
          </li>
        ))}
    </ul>
  );

  if (!teams) return column(null);

  const me = game.players[you.playerId];
  return (
    <div className="grid grid-cols-2 gap-3">
      {(["left", "right"] as const).map((team) => (
        <section
          key={team}
          className={cn(
            "rounded-2xl border-2 p-2",
            team === "left" ? "border-team-left/60" : "border-team-right/60",
          )}
        >
          <button
            type="button"
            className={cn(
              "mb-1 w-full rounded-lg py-1 text-center text-xs font-bold tracking-wider uppercase",
              team === "left" ? "text-team-left" : "text-team-right",
              me?.team === team ? "bg-white/5" : "opacity-80",
            )}
            onClick={() => send({ type: "team.join", team })}
            disabled={me?.team === team}
          >
            {TEAM_NAMES[team]}
            {me?.team !== team && (
              <span className="block text-[10px] font-normal normal-case opacity-70">
                tap to join
              </span>
            )}
          </button>
          {column(team)}
        </section>
      ))}
    </div>
  );
}
