import { toast } from "sonner";
import type { GameState } from "@shared/game/types";
import { audio } from "@/lib/audio";
import { useGameStore } from "@/lib/store";
import { vibrate } from "@/lib/haptics";
import { eggBus } from "./bus";
import { bumpBlock } from "./coins";
import { printMenu } from "./console";
import { toggleDisco } from "./disco";
import {
  KONAMI_KEYS,
  KONAMI_TOUCH,
  SequenceMatcher,
  TWIST_MIN,
  WORDS,
  circleOf,
  gestureOf,
  isTypingTarget,
  keyToken,
  twistOf,
  type Point,
} from "./sequences";
import { useEggs } from "./store";

/**
 * Konami toggles party mode. Switching it on also asks the room egg to
 * broadcast it (RoomEggs sends the hidden `konami` effect when a game is
 * connected), so everyone in the lounge or round sees who knows the code.
 */
export function toggleParty(): boolean {
  const party = !useEggs.getState().party;
  useEggs.getState().set({ party });
  if (party) {
    audio.play("konami");
    vibrate([30, 30, 30, 30, 90]);
    toast("🕹️ +30 lives");
    eggBus.emit({
      kind: "rain",
      id: "konami",
      glyphs: ["🕹️", "🌈", "⭐"],
      count: 18,
    });
    eggBus.emit({ kind: "effect", effectId: "konami" });
  } else {
    toast("Party's over.");
  }
  return party;
}

export function magicWord() {
  toast("👀 Psst. The console knows more.");
  printMenu();
}

/** Disco by hand: the drawn circle or the typed word. */
export function discoByHand(): boolean {
  const disco = toggleDisco();
  toast(disco ? "🪩 Disco." : "Disco off.");
  return disco;
}

/** A roll by hand: the two-finger twist or the typed words. */
export function rollByHand(): void {
  eggBus.emit({ kind: "roll" });
  audio.play("whoosh");
}

/**
 * Gestures stay off the round itself (the wheel and the dial own the
 * touches there): the home screen, the lounge and game over only.
 */
export function gesturesAllowed(phase: GameState["phase"] | null): boolean {
  return phase === null || phase === "lobby" || phase === "gameover";
}

const TRAIL_STEP = 6;
const TRAIL_MAX = 300;

/**
 * Document-level listeners: Konami on the keyboard (anywhere) and typed
 * words outside a field; and, where gestures are allowed, Konami as
 * swipes, a drawn circle (disco) and a two-finger twist (a roll). Returns
 * the uninstaller.
 */
export function installTriggers(doc: Document = document): () => void {
  const konami = new SequenceMatcher(KONAMI_KEYS);
  const words = WORDS.map((w) => ({
    id: w.id,
    matcher: new SequenceMatcher(Array.from(w.word)),
  }));
  const swipes = new SequenceMatcher(KONAMI_TOUCH);
  const phase = () => useGameStore.getState().game?.phase ?? null;

  const onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    const token = keyToken(event.key);
    if (!token) return;
    if (konami.push(token)) {
      for (const w of words) w.matcher.reset();
      toggleParty();
      return;
    }
    // ↑ hits the coin block from below wherever one is on screen (the
    // home title); the first two Konami keys pop two coins, by design.
    if (token === "ArrowUp" && doc.querySelector("[data-egg-block]"))
      bumpBlock();
    if (token.length !== 1) return;
    for (const w of words) {
      if (!w.matcher.push(token)) continue;
      if (w.id === "menu") magicWord();
      else if (w.id === "disco") discoByHand();
      else rollByHand();
    }
  };

  // One finger: a trail from touchstart to touchend, and whether it
  // began on a coin block.
  let start: { x: number; y: number; t: number } | null = null;
  let trail: Point[] = [];
  let onBlock = false;
  // Two fingers: where each started and where it is now.
  let pair: {
    ids: [number, number];
    a0: Point;
    b0: Point;
    a1: Point;
    b1: Point;
  } | null = null;

  const onTouchStart = (event: TouchEvent) => {
    start = null;
    trail = [];
    if (event.touches.length === 2) {
      const a = event.touches[0]!;
      const b = event.touches[1]!;
      const pa = { x: a.clientX, y: a.clientY };
      const pb = { x: b.clientX, y: b.clientY };
      pair = {
        ids: [a.identifier, b.identifier],
        a0: pa,
        b0: pb,
        a1: pa,
        b1: pb,
      };
      return;
    }
    pair = null;
    const touch = event.touches[0];
    if (!touch || event.touches.length > 1) return;
    start = { x: touch.clientX, y: touch.clientY, t: event.timeStamp };
    trail = [{ x: touch.clientX, y: touch.clientY }];
    const target = event.target;
    onBlock =
      target instanceof Element && target.closest("[data-egg-block]") !== null;
  };
  const onTouchMove = (event: TouchEvent) => {
    if (pair) {
      for (const touch of Array.from(event.touches)) {
        const p = { x: touch.clientX, y: touch.clientY };
        if (touch.identifier === pair.ids[0]) pair.a1 = p;
        else if (touch.identifier === pair.ids[1]) pair.b1 = p;
      }
      return;
    }
    if (!start || event.touches.length !== 1) return;
    const touch = event.touches[0]!;
    const last = trail[trail.length - 1]!;
    if (trail.length >= TRAIL_MAX) return;
    if (Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < TRAIL_STEP)
      return;
    trail.push({ x: touch.clientX, y: touch.clientY });
  };
  // iOS ignores `user-scalable=no`: while a twist is in progress, this
  // (non-passive) listener stops the page pinch-zooming. One finger is
  // never touched, so scrolling stays smooth.
  const onTouchMoveBlockZoom = (event: TouchEvent) => {
    if (pair && gesturesAllowed(phase())) event.preventDefault();
  };
  const onTouchEnd = (event: TouchEvent) => {
    if (pair) {
      // The pair breaks as soon as either finger lifts.
      const twist = twistOf(pair.a0, pair.b0, pair.a1, pair.b1);
      pair = null;
      if (gesturesAllowed(phase()) && Math.abs(twist) >= TWIST_MIN)
        rollByHand();
      return;
    }
    const touch = event.changedTouches[0];
    const s = start;
    const points = trail;
    start = null;
    trail = [];
    if (!touch || !s) return;
    if (!gesturesAllowed(phase())) return;
    if (circleOf([...points, { x: touch.clientX, y: touch.clientY }])) {
      swipes.reset();
      discoByHand();
      return;
    }
    const gesture = gestureOf(
      touch.clientX - s.x,
      touch.clientY - s.y,
      event.timeStamp - s.t,
    );
    if (!gesture) {
      swipes.reset();
      return;
    }
    if (gesture === "ArrowUp" && onBlock) bumpBlock();
    if (swipes.push(gesture)) toggleParty();
  };

  doc.addEventListener("keydown", onKey);
  doc.addEventListener("touchstart", onTouchStart, { passive: true });
  doc.addEventListener("touchmove", onTouchMove, { passive: true });
  doc.addEventListener("touchmove", onTouchMoveBlockZoom, { passive: false });
  doc.addEventListener("touchend", onTouchEnd, { passive: true });
  return () => {
    doc.removeEventListener("keydown", onKey);
    doc.removeEventListener("touchstart", onTouchStart);
    doc.removeEventListener("touchmove", onTouchMove);
    doc.removeEventListener("touchmove", onTouchMoveBlockZoom);
    doc.removeEventListener("touchend", onTouchEnd);
  };
}
