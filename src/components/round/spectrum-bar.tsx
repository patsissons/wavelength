import { WedgeStrip } from "@/components/board/wedge-strip";
import type { Spectrum } from "@shared/game/types";

/**
 * The spectrum at the top of the round screen: both ends as labels over a
 * bar. Whoever knows the target (the psychic once the wheel has landed,
 * everyone at the reveal) sees the scoring wedge on the bar; everyone else
 * sees a plain left-to-right gradient.
 */
export function SpectrumBar({
  spectrum,
  target,
}: {
  spectrum: Spectrum | null;
  /** The target when this client is allowed to know it. */
  target: number | null;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-1"
      data-testid="spectrum"
      data-known={target !== null || undefined}
    >
      <div className="flex items-baseline justify-between gap-3 text-sm leading-tight font-semibold">
        <span className="min-w-0">{spectrum?.left ?? "?"}</span>
        <span className="min-w-0 text-right">{spectrum?.right ?? "?"}</span>
      </div>
      <WedgeStrip target={target} spectrum={null} fill="gradient" />
    </div>
  );
}
