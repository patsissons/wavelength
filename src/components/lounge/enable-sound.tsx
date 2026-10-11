import { Music, Vibrate, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audio } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";
import { usePrefs } from "@/lib/prefs";
import { requestWakeLock } from "@/lib/wake-lock";

/** iOS only plays audio after a tap: this is that tap. Also tests haptics. */
export function EnableSound() {
  const unlocked = usePrefs((s) => s.soundUnlocked);
  const muted = usePrefs((s) => s.muted);
  const reduce = usePrefs((s) => s.reduceEffects);
  const music = usePrefs((s) => s.music);
  const setMuted = usePrefs((s) => s.setMuted);
  const setMusic = usePrefs((s) => s.setMusic);
  const setReduce = usePrefs((s) => s.setReduceEffects);

  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-card p-4">
      {!unlocked ? (
        <Button
          variant="secondary"
          className="h-12"
          data-testid="enable-sound"
          onClick={async () => {
            void requestWakeLock();
            const ok = await audio.unlock();
            if (ok) {
              setMuted(false);
              audio.play("ding");
            }
            vibrate(30);
          }}
        >
          <Volume2 /> Enable sound &amp; vibration
        </Button>
      ) : (
        <div className="flex flex-col gap-2" data-testid="sound-ready">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Volume2 className="size-4" />
            {muted ? "Sound is muted." : "Sound is on."}
            <button
              type="button"
              className="underline"
              onClick={() => setMuted(!muted)}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
          </p>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Music className="size-4" />
              {music && !muted
                ? "Lounge music is playing (hear it? sound works)"
                : "Lounge music"}
            </span>
            <input
              type="checkbox"
              checked={music}
              onChange={(e) => setMusic(e.target.checked)}
              className="size-5 accent-primary"
              data-testid="music-toggle"
            />
          </label>
        </div>
      )}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Vibrate className="size-4" /> Reduce flashing &amp; shaking
        </span>
        <input
          type="checkbox"
          checked={reduce}
          onChange={(e) => setReduce(e.target.checked)}
          className="size-5 accent-primary"
        />
      </label>
    </section>
  );
}
