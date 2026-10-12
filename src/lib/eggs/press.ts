import {
  useEffect,
  useMemo,
  useRef,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
import { vibrate } from "@/lib/haptics";

/**
 * Press-and-hold detection, pure enough to unit test: fires once after
 * `ms` unless the pointer lifts first or drifts more than `slop` px (so a
 * scroll that starts on the element never counts as a hold).
 */
export class HoldDetector {
  #timer: ReturnType<typeof setTimeout> | null = null;
  #origin: { x: number; y: number } | null = null;
  #fired = false;

  constructor(
    private readonly ms: number,
    private readonly onHold: () => void,
    private readonly slop = 10,
  ) {}

  down(x: number, y: number): void {
    this.cancel();
    this.#fired = false;
    this.#origin = { x, y };
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#fired = true;
      this.onHold();
    }, this.ms);
  }

  move(x: number, y: number): void {
    if (!this.#origin || this.#timer === null) return;
    if (Math.hypot(x - this.#origin.x, y - this.#origin.y) > this.slop)
      this.cancel();
  }

  /** The pointer lifted (or left): true when a hold already fired. */
  up(): boolean {
    this.cancel();
    return this.#fired;
  }

  cancel(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#origin = null;
  }

  /**
   * Whether the press that just ended was a hold; reading it clears it,
   * so the click that follows a hold is swallowed exactly once.
   */
  consume(): boolean {
    const fired = this.#fired;
    this.#fired = false;
    return fired;
  }
}

export interface LongPressHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onClickCapture: (e: SyntheticEvent) => void;
  onClick?: (e: SyntheticEvent) => void;
  onContextMenu: (e: SyntheticEvent) => void;
}

/**
 * Spread onto an element to make a press-and-hold of `ms` call `onHold`
 * (with a little haptic). The click a hold leaves behind is swallowed in
 * the capture phase, so the element's own tap handler (`onTap`) and any
 * parent only see real taps. Add `select-none` and
 * `[-webkit-touch-callout:none]` to the element so iOS does not select
 * text or pop a callout while the finger rests.
 */
export function useLongPress(
  ms: number,
  onHold: () => void,
  opts: { onTap?: (e: SyntheticEvent) => void } = {},
): LongPressHandlers {
  const { onTap } = opts;
  const latest = useRef({ onHold, onTap });
  useEffect(() => {
    latest.current = { onHold, onTap };
  }, [onHold, onTap]);
  const hasTap = onTap !== undefined;
  // Built on the first press (never during render), so the hold callback
  // can read the latest props through the ref when it fires.
  const detector = useRef<HoldDetector | null>(null);
  return useMemo(() => {
    const d = () =>
      (detector.current ??= new HoldDetector(ms, () => {
        vibrate(20);
        latest.current.onHold();
      }));
    const handlers: LongPressHandlers = {
      onPointerDown: (e) => {
        if (!e.isPrimary || e.button !== 0) return;
        d().down(e.clientX, e.clientY);
      },
      onPointerMove: (e) => detector.current?.move(e.clientX, e.clientY),
      onPointerUp: () => detector.current?.up(),
      onPointerCancel: () => detector.current?.cancel(),
      onPointerLeave: () => detector.current?.cancel(),
      onClickCapture: (e) => {
        if (!detector.current?.consume()) return;
        e.preventDefault();
        e.stopPropagation();
      },
      onContextMenu: (e) => e.preventDefault(),
    };
    if (hasTap) handlers.onClick = (e) => latest.current.onTap?.(e);
    return handlers;
  }, [ms, hasTap]);
}
