import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  SEGMENT,
  SPIN,
  TAU,
  angularVelocity,
  clamp,
  clientToView,
  normalizeAngle,
  pointToFullAngle,
  spinAngleAt,
  spinDelta,
  type AngleSample,
} from "@shared/game/geometry";
import type { Spin } from "@shared/game/types";

export interface SpinDragHandlers {
  onPointerDown: (event: PointerEvent<SVGElement>) => void;
  onPointerMove: (event: PointerEvent<SVGElement>) => void;
  onPointerUp: (event: PointerEvent<SVGElement>) => void;
  onPointerCancel: (event: PointerEvent<SVGElement>) => void;
}

/** A press shorter than this with less than TAP_TRAVEL of rotation is a tap. */
const TAP_MS = 300;
const TAP_TRAVEL = (8 * Math.PI) / 180;

/** Velocity for a tap-to-spin: a brisk random flick in a random direction. */
export function tapVelocity(random: () => number = Math.random): number {
  const speed = 14 + random() * 22;
  return random() < 0.5 ? -speed : speed;
}

/**
 * Tap- or flick-to-spin. While the psychic drags on the wheel the disc
 * follows the finger; on release the release velocity is reported (a tap
 * gets a random one) and the caller sends it to the server, which answers
 * with the real spin.
 */
export function useSpinDrag(
  svgRef: RefObject<SVGSVGElement | null>,
  options: { enabled: boolean; onFlick: (velocity: number) => void },
): { handlers: SpinDragHandlers; dragAngle: number } {
  const [dragAngle, setDragAngle] = useState(0);
  const base = useRef(0); // disc angle when the drag began
  const startPointer = useRef(0);
  const samples = useRef<AngleSample[]>([]);
  const dragging = useRef(false);

  const angleOf = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return 0;
      const { x, y } = clientToView(
        event.clientX,
        event.clientY,
        svg.getBoundingClientRect(),
      );
      return pointToFullAngle(x, y);
    },
    [svgRef],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (!options.enabled || !event.isPrimary) return;
      dragging.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      startPointer.current = angleOf(event);
      base.current = dragAngle;
      samples.current = [{ angle: startPointer.current, t: event.timeStamp }];
    },
    [angleOf, dragAngle, options.enabled],
  );

  // A new spin lands the disc on angle 0, so the drag offset resets too
  // (derived state: no effect, no cascading render).
  const [wasEnabled, setWasEnabled] = useState(options.enabled);
  if (wasEnabled !== options.enabled) {
    setWasEnabled(options.enabled);
    if (!options.enabled) setDragAngle(0);
  }

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (!dragging.current) return;
      const angle = angleOf(event);
      samples.current.push({ angle, t: event.timeStamp });
      if (samples.current.length > 12) samples.current.shift();
      let delta = angle - startPointer.current;
      if (delta > Math.PI) delta -= TAU;
      if (delta < -Math.PI) delta += TAU;
      setDragAngle(base.current + delta);
    },
    [angleOf],
  );

  const finish = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const first = samples.current[0];
    const last = samples.current[samples.current.length - 1];
    if (first && last) {
      let travel = last.angle - first.angle;
      if (travel > Math.PI) travel -= TAU;
      if (travel < -Math.PI) travel += TAU;
      if (last.t - first.t <= TAP_MS && Math.abs(travel) <= TAP_TRAVEL) {
        setDragAngle(base.current);
        options.onFlick(tapVelocity());
        return;
      }
    }
    // Fast flicks (and synthetic ones) can exceed the server's range.
    const raw = angularVelocity(samples.current);
    const velocity = Number.isFinite(raw)
      ? clamp(raw, -SPIN.maxVelocity, SPIN.maxVelocity)
      : 0;
    options.onFlick(velocity);
  }, [options]);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
    dragAngle,
  };
}

/**
 * Animate the disc from `from` so it completes the server's turns and lands
 * with the wedge exactly on the target (disc angle ≡ 0 mod 2π). Reports
 * segment-boundary crossings for ticks. Returns the current disc angle and
 * whether the animation is done.
 */
export function useSpinAnimation(
  spin: Spin | null,
  from: number,
  options: {
    onTick?: () => void;
    onDone?: () => void;
    reducedMotion?: boolean;
  },
): { angle: number; done: boolean } {
  const [angle, setAngle] = useState(from);
  const [done, setDone] = useState(spin === null);
  const seen = useRef<string | null>(null);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });

  useEffect(() => {
    let frame = 0;
    if (!spin) {
      // Round moved on: settle without a synchronous state update.
      frame = requestAnimationFrame(() => {
        setAngle(0);
        setDone(true);
      });
      return () => cancelAnimationFrame(frame);
    }
    if (seen.current === spin.id) return;
    seen.current = spin.id;
    const start0 = normalizeAngle(from);
    const delta = spinDelta(start0, 0, spin.direction, spin.turns);
    const start = performance.now();
    const elapsedAtStart = Math.max(0, start - spin.startedAt);
    const instant =
      callbacks.current.reducedMotion || elapsedAtStart >= spin.durationMs;
    let lastSegment = Math.floor(start0 / (SEGMENT * Math.PI));
    const step = (now: number) => {
      const t = instant
        ? 1
        : Math.min(1, (now - start + elapsedAtStart) / spin.durationMs);
      const a = spinAngleAt(start0, delta, t);
      const segment = Math.floor(a / (SEGMENT * Math.PI));
      if (segment !== lastSegment) {
        lastSegment = segment;
        callbacks.current.onTick?.();
      }
      setAngle(t >= 1 ? 0 : a);
      if (t < 1) {
        setDone(false);
        frame = requestAnimationFrame(step);
      } else {
        setDone(true);
        callbacks.current.onDone?.();
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [spin, from]);

  return { angle, done };
}
