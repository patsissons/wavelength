import { Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { effectsFor } from "@shared/effects/catalog";
import type { Role } from "@shared/game/selectors";
import { Button } from "@/components/ui/button";
import { audio } from "@/lib/audio";
import { usePrefs } from "@/lib/prefs";
import { useCommand } from "@/lib/use-game-connection";
import { cn } from "@/lib/utils";

const COOLDOWN_MS = 1000;

export function EffectsBar({ role }: { role: Role }) {
  const send = useCommand();
  const muted = usePrefs((s) => s.muted);
  const unlocked = usePrefs((s) => s.soundUnlocked);
  const setMuted = usePrefs((s) => s.setMuted);
  const [cooling, setCooling] = useState<Record<string, boolean>>({});
  const [limited, setLimited] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fire = async (id: string) => {
    if (cooling[id]) return;
    setCooling((c) => ({ ...c, [id]: true }));
    timers.current[id] = setTimeout(
      () => setCooling((c) => ({ ...c, [id]: false })),
      COOLDOWN_MS,
    );
    const outcome = await send({ type: "effect.send", effectId: id });
    if (!outcome.ok && outcome.code === "rate_limited") {
      setLimited(true);
      setTimeout(() => setLimited(false), 1500);
    }
  };

  return (
    <section
      className="flex items-center gap-2"
      data-testid="effects-bar"
      data-limited={limited || undefined}
    >
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={
          muted ? "Unmute sounds" : unlocked ? "Mute sounds" : "Tap for sound"
        }
        title={!muted && !unlocked ? "Tap to enable sound" : undefined}
        aria-pressed={muted}
        onClick={() => {
          // The document-level gesture listener in lib/audio.ts unlocks on
          // this tap too; the dot just tells the player sound is not on yet.
          setMuted(!muted);
          if (muted) void audio.unlock();
        }}
        data-testid="mute-toggle"
        data-unlocked={unlocked || undefined}
      >
        {muted ? <VolumeX /> : <Volume2 />}
        {!muted && !unlocked && (
          <span
            className="absolute top-1 right-1 size-2 rounded-full bg-primary"
            aria-hidden
          />
        )}
      </Button>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
        {effectsFor(role).map((e) => (
          <button
            key={e.id}
            type="button"
            title={e.label}
            aria-label={e.label}
            data-testid={`effect-${e.id}`}
            disabled={cooling[e.id]}
            onClick={() => fire(e.id)}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-2xl transition-transform active:scale-90 disabled:opacity-40",
              limited && "animate-pulse",
            )}
          >
            {e.icon}
          </button>
        ))}
      </div>
    </section>
  );
}
