import { SEGMENT, wedgeSectors } from "@shared/game/geometry";
import type { Spectrum } from "@shared/game/types";
import { cn } from "@/lib/utils";

export interface StripMarker {
  id: string;
  position: number;
  color: string;
  /** Short label under the marker (an initial, say). */
  label?: string;
}

const W = 400;
const H = 44;
const BAR_Y = 16;
const BAR_H = 18;
const PAD = 8;

const x = (position: number) => PAD + position * (W - 2 * PAD);

/**
 * The spectrum flattened into a bar: the scoring wedge (2/3/4) around the
 * target and optional markers for dial positions. Small enough to sit
 * above a text input with the keyboard open, or inside a turn summary.
 */
export function WedgeStrip({
  target,
  spectrum,
  markers = [],
  className,
}: {
  target: number | null;
  spectrum: Spectrum | null;
  markers?: StripMarker[];
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("block w-full", className)}
      role="img"
      aria-label="Where the points are on the spectrum"
      data-testid="wedge-strip"
      data-target={target === null ? undefined : target.toFixed(4)}
    >
      <rect
        x={PAD}
        y={BAR_Y}
        width={W - 2 * PAD}
        height={BAR_H}
        rx={BAR_H / 2}
        fill="var(--wheel)"
        stroke="var(--color-border)"
      />
      {target !== null &&
        wedgeSectors(target).map((s, i) => {
          const x0 = x(Math.max(0, s.p0));
          const x1 = x(Math.min(1, s.p1));
          return (
            <g key={i} data-testid={`strip-wedge-${s.score}`}>
              <rect
                x={x0}
                y={BAR_Y}
                width={Math.max(0, x1 - x0)}
                height={BAR_H}
                fill={`var(--wedge-${s.score})`}
              />
              {x1 - x0 > SEGMENT * (W - 2 * PAD) * 0.6 && (
                <text
                  x={(x0 + x1) / 2}
                  y={BAR_Y + BAR_H / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={800}
                  fill="var(--color-primary-foreground)"
                >
                  {s.score}
                </text>
              )}
            </g>
          );
        })}
      {markers.map((m) => (
        <g key={m.id} data-testid={`strip-marker-${m.id}`}>
          <path
            d={`M ${x(m.position) - 6} 2 L ${x(m.position) + 6} 2 L ${x(m.position)} ${BAR_Y - 2} Z`}
            fill={m.color}
            stroke="var(--color-background)"
            strokeWidth={1}
          />
          <line
            x1={x(m.position)}
            y1={BAR_Y}
            x2={x(m.position)}
            y2={BAR_Y + BAR_H}
            stroke={m.color}
            strokeWidth={2}
          />
          {m.label && (
            <text
              x={x(m.position)}
              y={H - 2}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={m.color}
            >
              {m.label}
            </text>
          )}
        </g>
      ))}
      {spectrum && markers.length === 0 && (
        <>
          <text
            x={PAD}
            y={H - 2}
            fontSize={10}
            fill="var(--color-muted-foreground)"
          >
            {spectrum.left}
          </text>
          <text
            x={W - PAD}
            y={H - 2}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-muted-foreground)"
          >
            {spectrum.right}
          </text>
        </>
      )}
    </svg>
  );
}
