import { useCallback, useRef, type PointerEvent, type RefObject } from "react";
import { clientToView, pointToPosition } from "@shared/game/geometry";

export interface DialDragHandlers {
  onPointerDown: (event: PointerEvent<SVGElement>) => void;
  onPointerMove: (event: PointerEvent<SVGElement>) => void;
  onPointerUp: (event: PointerEvent<SVGElement>) => void;
  onPointerCancel: (event: PointerEvent<SVGElement>) => void;
}

/**
 * Pointer → spectrum position for the whole board surface. The pointer is
 * captured on down so a finger sliding off the arc keeps control.
 */
export function useDialDrag(
  svgRef: RefObject<SVGSVGElement | null>,
  options: {
    enabled: boolean;
    onStart?: () => void;
    onMove: (position: number) => void;
    onEnd: (position: number) => void;
  },
): DialDragHandlers {
  const dragging = useRef(false);
  const last = useRef(0.5);

  const positionOf = useCallback(
    (event: PointerEvent<SVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return last.current;
      const { x, y } = clientToView(
        event.clientX,
        event.clientY,
        svg.getBoundingClientRect(),
      );
      return pointToPosition(x, y);
    },
    [svgRef],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (!options.enabled || !event.isPrimary) return;
      dragging.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      options.onStart?.();
      last.current = positionOf(event);
      options.onMove(last.current);
    },
    [options, positionOf],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (!dragging.current) return;
      last.current = positionOf(event);
      options.onMove(last.current);
    },
    [options, positionOf],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<SVGElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      last.current = positionOf(event);
      options.onEnd(last.current);
    },
    [options, positionOf],
  );

  const onPointerCancel = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    options.onEnd(last.current);
  }, [options]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
