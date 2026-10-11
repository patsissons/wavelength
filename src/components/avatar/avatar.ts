import { avatarById, type AvatarDef } from "@shared/avatars/catalog";
import type { Player } from "@shared/game/types";
import { firstGrapheme } from "@/lib/utils";

/** What to draw for a player: a catalog figure, a single emoji or an initial. */
export type AvatarRender =
  | { kind: "figure"; def: AvatarDef }
  | { kind: "emoji"; text: string }
  | { kind: "initial"; text: string };

export function avatarOf(
  player: Pick<Player, "name"> & { avatar?: string | null },
): AvatarRender {
  const value = player.avatar ?? null;
  if (value) {
    const def = avatarById(value);
    if (def) return { kind: "figure", def };
    return { kind: "emoji", text: value };
  }
  return { kind: "initial", text: firstGrapheme(player.name) };
}
