import { useEffect, useRef, useState } from "react";
import { audio } from "@/lib/audio";
import { useGameStore } from "@/lib/store";
import { formatRemaining } from "@/lib/time";
import { cn } from "@/lib/utils";

const URGENT_MS = 10_000;

/**
 * Countdown to the dial deadline. The deadline is server time, so the
 * clock skew measured when the clue arrived corrects the local clock. The
 * last ten seconds turn urgent and the last three tick.
 */
export function GuessTimer({
  deadline,
  totalSeconds,
}: {
  deadline: number;
  totalSeconds: number;
}) {
  const skew = useGameStore((s) => s.clockSkew);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - (Date.now() + skew)),
  );
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, deadline - (Date.now() + skew));
      setRemaining(left);
      const second = Math.ceil(left / 1000);
      if (left > 0 && second <= 3 && lastTick.current !== second) {
        lastTick.current = second;
        audio.play("tick", 0.8);
      }
    };
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [deadline, skew]);

  const total = Math.max(1, totalSeconds * 1000);
  const fraction = Math.min(1, remaining / total);
  const urgent = remaining <= URGENT_MS;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl bg-card px-3 py-2",
        urgent && "bg-destructive/15",
      )}
      role="timer"
      aria-label="Time left to move the dial"
      data-testid="guess-timer"
      data-urgent={urgent || undefined}
      data-remaining={Math.ceil(remaining / 1000)}
    >
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-200 ease-linear",
            urgent && "bg-destructive",
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <strong
        className={cn(
          "w-12 text-right text-sm tabular-nums",
          urgent && "animate-pulse text-destructive",
        )}
      >
        {formatRemaining(remaining)}
      </strong>
    </div>
  );
}
