import { useState } from "react";
import type { SoundPatch } from "@shared/effects/catalog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { audio, soundNames, type LoopName } from "@/lib/audio";

/**
 * Every synthesised sound and loop, playable by tap. Opens from a long
 * press on the mute button or from the cheat sheet. A loop started here
 * lasts until the lounge next re-asserts its own record (any sound
 * preference change) or a game sound takes over; that is fine for a toy.
 */
export function Jukebox({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { patches, loops } = soundNames();
  // `audio.loop` is not reactive; re-render after each change here.
  const [, bump] = useState(0);
  const current = audio.loop;
  const setLoop = (name: LoopName | null) => {
    audio.setLoop(name);
    bump((n) => n + 1);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-3xl"
        data-testid="egg-jukebox"
      >
        <SheetHeader>
          <SheetTitle>🎵 Jukebox</SheetTitle>
          <SheetDescription>
            {audio.ready
              ? "Every sound the game can make. Tap one."
              : "Tap the page once first so the browser allows sound."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-8">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Sounds
            </h3>
            <div className="flex flex-wrap gap-2">
              {patches.map((name) => (
                <Button
                  key={name}
                  type="button"
                  variant="secondary"
                  className="h-11"
                  onClick={() => audio.play(name as SoundPatch)}
                  data-testid={`juke-${name}`}
                >
                  ▶ {name}
                </Button>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Loops
            </h3>
            <div className="flex flex-wrap gap-2">
              {loops.map((name) => (
                <Button
                  key={name}
                  type="button"
                  variant={current === name ? "default" : "secondary"}
                  className="h-11"
                  aria-pressed={current === name}
                  onClick={() => setLoop(name as LoopName)}
                  data-testid={`juke-loop-${name}`}
                >
                  🔁 {name}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                disabled={current === null}
                onClick={() => setLoop(null)}
                data-testid="juke-stop"
              >
                ⏹ Stop
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
