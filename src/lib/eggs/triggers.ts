import { toast } from "sonner";
import { audio } from "@/lib/audio";
import { useGameStore } from "@/lib/store";
import { vibrate } from "@/lib/haptics";
import { eggBus } from "./bus";
import { printMenu } from "./console";
import {
  KONAMI_KEYS,
  KONAMI_TOUCH,
  MAGIC_WORD,
  SequenceMatcher,
  gestureOf,
  isTypingTarget,
  keyToken,
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
    eggBus.emit({ kind: "konami" });
  } else {
    toast("Party's over.");
  }
  return party;
}

export function magicWord() {
  toast("👀 Psst. The console knows more.");
  printMenu();
}

/**
 * Document-level listeners: Konami on the keyboard (anywhere) and as swipes
 * (home and lounge only: during a round the wheel owns the gestures), plus
 * the magic word typed outside a field. Returns the uninstaller.
 */
export function installTriggers(doc: Document = document): () => void {
  const konami = new SequenceMatcher(KONAMI_KEYS);
  const word = new SequenceMatcher(Array.from(MAGIC_WORD));
  const swipes = new SequenceMatcher(KONAMI_TOUCH);

  const onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    const token = keyToken(event.key);
    if (!token) return;
    if (konami.push(token)) {
      word.reset();
      toggleParty();
      return;
    }
    if (token.length === 1 && word.push(token)) magicWord();
  };

  let start: { x: number; y: number; t: number } | null = null;
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch || event.touches.length > 1) {
      start = null;
      return;
    }
    start = { x: touch.clientX, y: touch.clientY, t: event.timeStamp };
  };
  const onTouchEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    const s = start;
    start = null;
    if (!touch || !s) return;
    const phase = useGameStore.getState().game?.phase ?? null;
    if (phase !== null && phase !== "lobby") return;
    const gesture = gestureOf(
      touch.clientX - s.x,
      touch.clientY - s.y,
      event.timeStamp - s.t,
    );
    if (!gesture) {
      swipes.reset();
      return;
    }
    if (swipes.push(gesture)) toggleParty();
  };

  doc.addEventListener("keydown", onKey);
  doc.addEventListener("touchstart", onTouchStart, { passive: true });
  doc.addEventListener("touchend", onTouchEnd, { passive: true });
  return () => {
    doc.removeEventListener("keydown", onKey);
    doc.removeEventListener("touchstart", onTouchStart);
    doc.removeEventListener("touchend", onTouchEnd);
  };
}
