import type { Player } from "@shared/game/types";
import { AvatarFigure } from "@/components/avatar/avatar-figure";
import { avatarOf } from "@/components/avatar/avatar";
import { cn, playerColor } from "@/lib/utils";

/**
 * A player's badge: their chosen avatar (a catalog character or an emoji)
 * on their colour, or their monogram when they have not picked one.
 */
export function PlayerAvatar({
  player,
  size = "md",
  className,
}: {
  player: Pick<Player, "name" | "color" | "away" | "connected"> & {
    avatar?: string | null;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm"
      ? "size-6 text-xs"
      : size === "lg"
        ? "size-12 text-lg"
        : "size-9 text-sm";
  const render = avatarOf(player);
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
      data-avatar={player.avatar ?? undefined}
      data-avatar-kind={render.kind}
    >
      {render.kind === "figure" ? (
        <AvatarFigure def={render.def} className="text-[1.25em]" />
      ) : render.kind === "emoji" ? (
        <span className="text-[1.2em] leading-none">{render.text}</span>
      ) : (
        render.text
      )}
    </span>
  );
}
