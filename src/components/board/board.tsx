import { useRef, type ReactNode } from "react";
import {
  CX,
  CY,
  R,
  SEGMENTS,
  VIEW,
  positionToPoint,
  sectorPath,
  wedgeSectors,
} from "@shared/game/geometry";
import { cn } from "@/lib/utils";
import { useDialDrag } from "./use-dial-drag";
import { useSpinDrag } from "./use-spin";

export interface BoardDial {
  id: string;
  position: number;
  color: string;
  /** Larger needle with a grab knob. */
  emphasized?: boolean;
  locked?: boolean;
  faded?: boolean;
}

export interface BoardProps {
  /** Spectrum position of the wedge centre; null hides the wedge. */
  target: number | null;
  /** Disc rotation in radians (spin animation / drag); 0 = wedge on target. */
  discAngle?: number;
  shroudOpen: boolean;
  dials: BoardDial[];
  /** When set, the board surface drags this dial. */
  drag?: {
    enabled: boolean;
    onStart?: () => void;
    onMove: (position: number) => void;
    onEnd: (position: number) => void;
  };
  /** When set, the shrouded wheel can be flicked. */
  spin?: { enabled: boolean; onFlick: (velocity: number) => void };
  /** Extra SVG content drawn above the dials. */
  children?: ReactNode;
  className?: string;
}

const INNER = R * 0.55;
const SHROUD_R = R + 8;
const TICK_COUNT = SEGMENTS * 2; // full circle, so a spinning disc looks continuous

export function Board({
  target,
  discAngle = 0,
  shroudOpen,
  dials,
  drag,
  spin,
  children,
  className,
}: BoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragHandlers = useDialDrag(svgRef, {
    enabled: drag?.enabled ?? false,
    onStart: drag?.onStart,
    onMove: drag?.onMove ?? noop,
    onEnd: drag?.onEnd ?? noop,
  });
  const { handlers: spinHandlers, dragAngle } = useSpinDrag(svgRef, {
    enabled: spin?.enabled ?? false,
    onFlick: spin?.onFlick ?? noop,
  });
  const rotation =
    -((spin?.enabled ? dragAngle : 0) + discAngle) * (180 / Math.PI);
  const handlers = spin?.enabled
    ? spinHandlers
    : drag?.enabled
      ? dragHandlers
      : {};
  const interactive = spin?.enabled || drag?.enabled;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className={cn(
        "block w-full touch-none select-none",
        interactive && "cursor-grab",
        className,
      )}
      role="img"
      aria-label="Wavelength board"
      data-testid="board"
      {...handlers}
    >
      <defs>
        <clipPath id="board-window">
          <path d={windowPath(R + 2)} />
        </clipPath>
        <radialGradient id="board-glow" cx="50%" cy="100%" r="80%">
          <stop offset="0%" stopColor="var(--wheel)" />
          <stop offset="100%" stopColor="var(--color-background)" />
        </radialGradient>
      </defs>

      {/* window */}
      <path
        d={windowPath(R)}
        fill="url(#board-glow)"
        stroke="var(--color-border)"
        strokeWidth={2}
      />

      {/* rotating disc: ticks + wedge */}
      <g clipPath="url(#board-window)">
        <g
          transform={`rotate(${rotation.toFixed(3)} ${CX} ${CY})`}
          data-testid="disc"
          data-target={target === null ? undefined : target.toFixed(4)}
        >
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const angle = (i / TICK_COUNT) * Math.PI * 2;
            const major = i % 4 === 0;
            const r0 = R - (major ? 14 : 8);
            return (
              <line
                key={i}
                x1={CX + r0 * Math.cos(angle)}
                y1={CY - r0 * Math.sin(angle)}
                x2={CX + (R - 2) * Math.cos(angle)}
                y2={CY - (R - 2) * Math.sin(angle)}
                stroke="var(--color-muted-foreground)"
                strokeOpacity={major ? 0.8 : 0.4}
                strokeWidth={major ? 2 : 1}
              />
            );
          })}
          {target !== null &&
            wedgeSectors(target).map((s, i) => {
              const mid = (s.p0 + s.p1) / 2;
              const label = positionToPoint(mid, R * 0.8);
              return (
                <g key={i} data-testid={`wedge-${s.score}`}>
                  <path
                    d={sectorPath(s.p0, s.p1, INNER, R - 4)}
                    fill={`var(--wedge-${s.score})`}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={18}
                    fontWeight={800}
                    fill="var(--color-primary-foreground)"
                  >
                    {s.score}
                  </text>
                </g>
              );
            })}
        </g>
      </g>

      {/* shroud, hinged at the centre */}
      <g
        data-testid="shroud"
        data-open={shroudOpen || undefined}
        className="transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        style={{
          transformOrigin: `${CX}px ${CY}px`,
          transform: `rotate(${shroudOpen ? 180 : 0}deg)`,
        }}
      >
        <path
          d={windowPath(SHROUD_R)}
          fill="var(--shroud)"
          stroke="var(--color-border)"
          strokeWidth={2}
        />
        <text
          x={CX}
          y={CY - R * 0.55}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          letterSpacing={3}
          fill="var(--color-muted-foreground)"
        >
          WAVELENGTH
        </text>
        <rect
          x={CX - 24}
          y={CY - SHROUD_R - 10}
          width={48}
          height={16}
          rx={8}
          fill="var(--color-muted-foreground)"
          opacity={0.7}
        />
      </g>

      {/* dials */}
      {dials.map((dial) => (
        <Needle key={dial.id} dial={dial} />
      ))}

      {/* hinge */}
      <circle
        cx={CX}
        cy={CY}
        r={10}
        fill="var(--color-card)"
        stroke="var(--color-border)"
        strokeWidth={2}
      />
      {children}
    </svg>
  );
}

function Needle({ dial }: { dial: BoardDial }) {
  const tip = positionToPoint(dial.position, R * 0.9);
  const knob = positionToPoint(dial.position, R + 2);
  const big = dial.emphasized;
  return (
    <g
      data-testid={`dial-${dial.id}`}
      data-position={dial.position.toFixed(4)}
      className={cn(dial.faded && "opacity-40")}
    >
      <line
        x1={CX}
        y1={CY}
        x2={tip.x}
        y2={tip.y}
        stroke={dial.color}
        strokeWidth={big ? 5 : 3}
        strokeLinecap="round"
      />
      <circle
        cx={knob.x}
        cy={knob.y}
        r={big ? 20 : 11}
        fill={dial.color}
        stroke="var(--color-background)"
        strokeWidth={3}
      />
      {dial.locked && (
        <circle
          cx={knob.x}
          cy={knob.y}
          r={big ? 8 : 5}
          fill="var(--color-background)"
        />
      )}
    </g>
  );
}

/** Half-disc above the baseline through C with the given radius. */
function windowPath(radius: number): string {
  return `M ${CX - radius} ${CY} A ${radius} ${radius} 0 0 1 ${CX + radius} ${CY} Z`;
}

function noop() {}
