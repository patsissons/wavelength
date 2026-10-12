import { useState } from "react";
import { toast } from "sonner";
import type { Player } from "@shared/game/types";
import { avatarOf } from "@/components/avatar/avatar";
import { audio } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import { eggBus } from "./bus";
import { TapCounter } from "./charm";
import { useLongPress, type LongPressHandlers } from "./press";
import { useEggs } from "./store";

type Who = Pick<Player, "name"> & { avatar?: string | null };

/** The one emoji that stands for this player's avatar, or the fallback. */
export function avatarGlyph(player: Who, fallback: string): string {
  const render = avatarOf(player);
  if (render.kind === "figure") return render.def.base;
  if (render.kind === "emoji") return render.text;
  return fallback;
}

/** Five quick taps on your own pill: your avatar pours down the screen. */
export function rainAvatar(player: Who): string {
  const glyph = avatarGlyph(player, "🌧️");
  eggBus.emit({ kind: "rain", id: "avatar", glyphs: [glyph], count: 20 });
  audio.play("splash");
  return glyph;
}

/** A hold on your own pill adopts your avatar as the pet; again sends it home. */
export function togglePet(player: Who): string | null {
  const glyph = avatarGlyph(player, "🐈");
  const pet = useEggs.getState().pet === glyph ? null : glyph;
  useEggs.getState().set({ pet });
  vibrate(pet ? [20, 30, 20] : 40);
  toast(pet ? `${pet} adopted. It will wander by.` : "Pet sent home.");
  return pet;
}

/** Handlers for the player's own pill in the lounge and the presence strip. */
export function useSelfPill(player: Who): LongPressHandlers {
  const [taps] = useState(() => new TapCounter(5, 3000));
  return useLongPress(1000, () => togglePet(player), {
    onTap: () => {
      if (taps.push(Date.now())) rainAvatar(player);
    },
  });
}
