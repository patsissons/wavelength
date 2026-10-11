import type { Spectrum } from "@shared/game/types";

export function SpectrumLabels({ spectrum }: { spectrum: Spectrum | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-1" data-testid="spectrum">
      <p className="rounded-xl bg-card px-3 py-2 text-center text-sm leading-tight font-semibold">
        {spectrum?.left ?? "?"}
      </p>
      <p className="rounded-xl bg-card px-3 py-2 text-center text-sm leading-tight font-semibold">
        {spectrum?.right ?? "?"}
      </p>
    </div>
  );
}
