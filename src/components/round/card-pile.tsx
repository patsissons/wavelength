import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { Card, Spectrum } from "@shared/game/types";
import { Button } from "@/components/ui/button";

/** A stack of face-down cards; dragging or tapping the top card draws it. */
export function CardPile({
  remaining,
  onDraw,
  busy,
}: {
  remaining: number;
  onDraw: () => void;
  busy: boolean;
}) {
  const reduced = useReducedMotion();
  const [lifted, setLifted] = useState(false);
  const draw = () => {
    if (busy) return;
    setLifted(true);
    onDraw();
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-40 w-28" data-testid="card-pile">
        {[2, 1].map((i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-2xl border border-border bg-shroud"
            style={{ transform: `translate(${i * 3}px, ${-i * 3}px)` }}
          />
        ))}
        <motion.button
          type="button"
          aria-label="Draw a card"
          data-testid="draw-card"
          className="absolute inset-0 flex cursor-grab items-center justify-center rounded-2xl border border-border bg-shroud text-xs font-bold tracking-widest text-muted-foreground uppercase active:cursor-grabbing"
          drag={reduced ? false : "y"}
          dragConstraints={{ top: -60, bottom: 0 }}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (info.offset.y < -30) draw();
          }}
          onTap={draw}
          whileTap={{ scale: 0.97 }}
          animate={
            lifted && !reduced ? { y: -120, opacity: 0 } : { y: 0, opacity: 1 }
          }
          transition={{ duration: 0.3 }}
          disabled={busy}
        >
          Wavelength
        </motion.button>
      </div>
      <p className="text-xs text-muted-foreground">
        {remaining} card{remaining === 1 ? "" : "s"} left · drag or tap to draw
      </p>
    </div>
  );
}

/** The drawn two-sided card: flip to see the other side, then pick one. */
export function CardFlip({
  card,
  onPick,
  busy,
}: {
  card: Card;
  onPick: (side: 0 | 1) => void;
  busy: boolean;
}) {
  const reduced = useReducedMotion();
  const [side, setSide] = useState<0 | 1>(0);
  const face = (s: 0 | 1, spectrum: Spectrum) => (
    <div
      className="absolute inset-0 flex flex-col justify-between rounded-2xl border-2 border-primary/50 bg-card p-4"
      // Inline so the 3D transforms can't be dropped by utility merging.
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: s === 1 ? "rotateY(180deg)" : "rotateY(0deg)",
      }}
      data-testid={`card-side-${s}`}
      aria-hidden={side !== s}
    >
      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
        Side {s === 0 ? "A" : "B"}
      </p>
      <div className="flex flex-col gap-2 text-center">
        <p className="text-lg leading-tight font-bold">{spectrum.left}</p>
        <p className="text-xs text-muted-foreground">↔</p>
        <p className="text-lg leading-tight font-bold">{spectrum.right}</p>
      </div>
      <Button
        size="sm"
        onClick={() => onPick(s)}
        disabled={busy}
        data-testid={`pick-side-${s}`}
      >
        Use this side
      </Button>
    </div>
  );
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-56 w-44" style={{ perspective: "1000px" }}>
        <AnimatePresence>
          <motion.div
            key={card.id}
            className="relative size-full"
            style={{ transformStyle: "preserve-3d" }}
            initial={reduced ? false : { y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1, rotateY: side === 1 ? 180 : 0 }}
            transition={{ duration: reduced ? 0 : 0.45 }}
          >
            {face(0, card.sides[0])}
            {face(1, card.sides[1])}
          </motion.div>
        </AnimatePresence>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setSide(side === 0 ? 1 : 0)}
        data-testid="flip-card"
      >
        Flip card
      </Button>
    </div>
  );
}
