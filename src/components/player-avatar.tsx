import type { Player } from "@shared/game/types";
import { cn, firstGrapheme, playerColor } from "@/lib/utils";

export function PlayerAvatar({
  player,
  size = "md",
  className,
}: {
  player: Pick<Player, "name" | "color" | "away" | "connected">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm"
      ? "size-6 text-xs"
      : size === "lg"
        ? "size-12 text-lg"
        : "size-9 text-sm";
  const initial = firstGrapheme(player.name);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-primary-foreground ring-2 ring-background",
        dim,
        player.away && "opacity-40 grayscale",
        className,
      )}
      style={{ background: playerColor(player.color) }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
