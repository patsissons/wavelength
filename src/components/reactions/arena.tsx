import { ArrowLeft } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { REACTIONS } from "@shared/effects/reactions";
import { playersInOrder } from "@shared/game/rotation";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { useArena } from "@/lib/arena";
import { audio } from "@/lib/audio";
import { effectBus } from "@/lib/effect-bus";
import { vibrate } from "@/lib/haptics";
import { usePrefs } from "@/lib/prefs";
import { useGameStore } from "@/lib/store";
import { useCommand } from "@/lib/use-game-connection";
import { cn } from "@/lib/utils";
import {
  AIM,
  arenaLayout,
  pickTarget,
  velocityOf,
  type Point,
  type Sample,
  type Target,
} from "./aim";

const TRAY_HEIGHT = 84;
const NODE_RADIUS = 44;
const FLIGHT_MS = 480;
const DEFAULT_SIZE = { w: 360, h: 560 };

interface Drag {
  pointerId: number;
  emoji: string;
  x: number;
  y: number;
}

/**
 * The post-round arena: you at the centre of the baseline, everyone else
 * equidistant along a semicircle above you, and a tray of emoji to flick
 * at them. Drop an emoji on a player or flick it in their direction; it
 * flies over, pops on them and reaches their screen. Incoming reactions
 * fly in from the sender's spot. Closes itself when the round moves on.
 */
export function Arena() {
  const game = useGameStore((s) => s.game)!;
  const you = useGameStore((s) => s.you)!;
  const setOpen = useArena((s) => s.setOpen);
  const reduce = usePrefs((s) => s.reduceEffects);
  const send = useCommand();
  const body = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [drag, setDrag] = useState<Drag | null>(null);
  const samples = useRef<Sample[]>([]);
  const [limited, setLimited] = useState(false);
  const [hit, setHit] = useState<{ from: string; emoji: string } | null>(null);

  const me = game.players[you.playerId];
  const others = useMemo(
    () => playersInOrder(game).filter((p) => p.id !== you.playerId),
    [game, you.playerId],
  );
  const layout = useMemo(
    () =>
      arenaLayout(size.w, size.h, others.length, {
        trayHeight: TRAY_HEIGHT,
        nodeRadius: NODE_RADIUS,
      }),
    [size, others.length],
  );
  const targets = useMemo<Target[]>(
    () => others.map((p, i) => ({ id: p.id, ...layout.points[i]! })),
    [others, layout],
  );
  // Latest geometry for the event handlers and the bus subscription.
  const targetsRef = useRef(targets);
  const centre = useRef<Point>({ x: layout.cx, y: layout.cy });
  useLayoutEffect(() => {
    targetsRef.current = targets;
    centre.current = { x: layout.cx, y: layout.cy };
  }, [targets, layout]);

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth && el.clientHeight)
        setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const positionOf = useCallback(
    (id: string): Point | null => {
      if (id === you.playerId) return centre.current;
      const t = targetsRef.current.find((x) => x.id === id);
      return t ? { x: t.x, y: t.y } : null;
    },
    [you.playerId],
  );

  /** Fly an emoji from one point to another, then pop it on arrival. */
  const fly = useCallback(
    (emoji: string, from: Point, to: Point, onArrive?: () => void) => {
      const root = body.current;
      if (!root) return;
      const land = () => {
        pop(root, emoji, to, reduce);
        const node = nodes.current.get(
          targetIdAt(to, targetsRef.current, you.playerId, centre.current),
        );
        if (node && !reduce && typeof node.animate === "function") {
          node.animate(
            [
              { transform: "translate(-50%,-50%) scale(1)" },
              { transform: "translate(-50%,-50%) scale(1.18) rotate(-6deg)" },
              { transform: "translate(-50%,-50%) scale(0.96) rotate(5deg)" },
              { transform: "translate(-50%,-50%) scale(1)" },
            ],
            { duration: 420, easing: "ease-out" },
          );
        }
        onArrive?.();
      };
      const el = document.createElement("span");
      el.textContent = emoji;
      el.dataset.testid = "arena-flight";
      el.style.cssText = `position:absolute;left:0;top:0;font-size:36px;line-height:1;pointer-events:none;will-change:transform;transform:translate(${from.x}px,${from.y}px) translate(-50%,-50%);`;
      root.appendChild(el);
      if (reduce || typeof el.animate !== "function") {
        el.remove();
        land();
        return;
      }
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 };
      const anim = el.animate(
        [
          {
            transform: `translate(${from.x}px,${from.y}px) translate(-50%,-50%) scale(1)`,
          },
          {
            transform: `translate(${mid.x}px,${mid.y}px) translate(-50%,-50%) scale(1.35) rotate(${from.x < to.x ? 25 : -25}deg)`,
            offset: 0.5,
          },
          {
            transform: `translate(${to.x}px,${to.y}px) translate(-50%,-50%) scale(0.9)`,
          },
        ],
        {
          duration: FLIGHT_MS,
          easing: "cubic-bezier(.3,.7,.4,1)",
          fill: "forwards",
        },
      );
      anim.onfinish = () => {
        el.remove();
        land();
      };
    },
    [reduce, you.playerId],
  );

  // Reactions from the others: fly in from their seat (or from above if the
  // sender is not on this screen) and land on whoever they aimed at.
  useEffect(() => {
    return effectBus.subscribe((effect) => {
      if (effect.kind !== "reaction" || effect.from === you.playerId) return;
      const to = positionOf(effect.to);
      if (!to) return;
      const from = positionOf(effect.from) ?? { x: centre.current.x, y: -40 };
      const mine = effect.to === you.playerId;
      const name = useGameStore.getState().game?.players[effect.from]?.name;
      fly(effect.emoji, from, to, () => {
        if (!mine) return;
        setHit({ from: name ?? "Someone", emoji: effect.emoji });
        audio.play("squeak");
        vibrate([40, 30, 40]);
      });
    });
  }, [fly, positionOf, you.playerId]);

  useEffect(() => {
    if (!hit) return;
    const t = setTimeout(() => setHit(null), 1800);
    return () => clearTimeout(t);
  }, [hit]);

  const toBody = (event: ReactPointerEvent): Point => {
    const rect = body.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  };

  const onPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    emoji: string,
  ) => {
    if (!event.isPrimary) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const p = toBody(event);
    samples.current = [{ ...p, t: event.timeStamp }];
    setDrag({ pointerId: event.pointerId, emoji, ...p });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const p = toBody(event);
    samples.current = [
      ...samples.current.slice(-9),
      { ...p, t: event.timeStamp },
    ];
    setDrag({ ...drag, ...p });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const release = toBody(event);
    samples.current = [...samples.current, { ...release, t: event.timeStamp }];
    const velocity = velocityOf(samples.current);
    const targetId = pickTarget(release, velocity, targetsRef.current, AIM);
    const emoji = drag.emoji;
    setDrag(null);
    if (!targetId) {
      dropBack(body.current, emoji, release, reduce);
      return;
    }
    const to = positionOf(targetId)!;
    fly(emoji, release, to);
    audio.play("whoosh", 0.4);
    vibrate(15);
    void send({ type: "reaction.send", playerId: targetId, emoji }).then(
      (outcome) => {
        if (!outcome.ok && outcome.code === "rate_limited") {
          setLimited(true);
          setTimeout(() => setLimited(false), 1500);
        }
      },
    );
  };

  const onPointerCancel = () => setDrag(null);

  const canAdvance =
    game.phase === "reveal" &&
    (game.hostId === you.playerId || game.round?.psychicId === you.playerId);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-background"
      data-testid="arena"
      data-last-reaction={hit?.emoji}
      data-limited={limited || undefined}
      role="dialog"
      aria-label="Reactions"
    >
      <header className="safe-x safe-top flex items-center justify-between gap-2 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          data-testid="close-arena"
        >
          <ArrowLeft /> Results
        </Button>
        <div className="min-w-0 text-center">
          <h2 className="text-base font-bold">Reactions</h2>
          <p className="truncate text-xs text-muted-foreground">
            Flick an emoji at a player
          </p>
        </div>
        {canAdvance ? (
          <Button
            size="sm"
            onClick={() => send({ type: "round.next" })}
            data-testid="arena-next-round"
          >
            {game.round?.result?.gameOver ? "Final scores" : "Next round"}
          </Button>
        ) : (
          <span className="w-20" />
        )}
      </header>

      <div
        ref={body}
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
        data-testid="arena-body"
      >
        {others.map((p, i) => {
          const pt = layout.points[i]!;
          return (
            <div
              key={p.id}
              ref={(el) => {
                if (el) nodes.current.set(p.id, el);
                else nodes.current.delete(p.id);
              }}
              className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: pt.x, top: pt.y }}
              data-testid="arena-player"
              data-player-id={p.id}
              data-player-name={p.name}
            >
              <PlayerAvatar player={p} size="lg" className="text-2xl" />
              <span className="max-w-full truncate text-xs">{p.name}</span>
            </div>
          );
        })}
        {me && (
          <div
            ref={(el) => {
              if (el) nodes.current.set(me.id, el);
              else nodes.current.delete(me.id);
            }}
            className="absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: layout.cx, top: layout.cy }}
            data-testid="arena-you"
          >
            <PlayerAvatar player={me} size="lg" className="text-2xl" />
            <span className="text-xs text-muted-foreground">you</span>
          </div>
        )}
        {hit && (
          <p
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-card px-3 py-1 text-xs font-semibold shadow"
            style={{ top: layout.cy - NODE_RADIUS - 40 }}
            data-testid="arena-hit"
          >
            {hit.from} threw {hit.emoji} at you
          </p>
        )}
        {drag && (
          <span
            className="pointer-events-none absolute text-4xl leading-none"
            style={{
              left: drag.x,
              top: drag.y,
              transform: "translate(-50%,-50%) scale(1.3)",
            }}
            data-testid="arena-drag"
          >
            {drag.emoji}
          </span>
        )}

        <div
          className={cn(
            "safe-x safe-bottom absolute inset-x-0 bottom-0 flex items-center gap-2 overflow-x-auto bg-card/80 pt-2 backdrop-blur [scrollbar-width:none]",
            limited && "animate-pulse",
          )}
          style={{ minHeight: TRAY_HEIGHT }}
          data-testid="arena-tray"
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex size-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-full bg-card text-3xl active:cursor-grabbing"
              aria-label={`Throw ${emoji}`}
              data-testid={`arena-emoji-${emoji}`}
              onPointerDown={(e) => onPointerDown(e, emoji)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Which node (if any) sits at `at`: a target, or the thrower at the centre. */
function targetIdAt(
  at: Point,
  targets: ReadonlyArray<Target>,
  youId: string,
  centre: Point,
): string {
  for (const t of targets) if (t.x === at.x && t.y === at.y) return t.id;
  if (centre.x === at.x && centre.y === at.y) return youId;
  return "";
}

/** A little scatter of the emoji where it landed. */
function pop(root: HTMLElement, emoji: string, at: Point, reduce: boolean) {
  const n = reduce ? 1 : 6;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.textContent = emoji;
    el.dataset.testid = "arena-pop";
    el.style.cssText = `position:absolute;left:${at.x}px;top:${at.y}px;font-size:${18 + Math.random() * 10}px;line-height:1;pointer-events:none;transform:translate(-50%,-50%);`;
    root.appendChild(el);
    if (typeof el.animate !== "function") {
      setTimeout(() => el.remove(), 600);
      continue;
    }
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const d = 30 + Math.random() * 30;
    el.animate(
      [
        { transform: "translate(-50%,-50%) scale(0.6)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`,
          opacity: 0,
        },
      ],
      { duration: 600, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => el.remove();
  }
}

/** A throw that hit nobody falls back into the tray. */
function dropBack(
  root: HTMLElement | null,
  emoji: string,
  from: Point,
  reduce: boolean,
) {
  if (!root || reduce) return;
  const el = document.createElement("span");
  el.textContent = emoji;
  el.dataset.testid = "arena-miss";
  el.style.cssText = `position:absolute;left:0;top:0;font-size:32px;line-height:1;pointer-events:none;transform:translate(${from.x}px,${from.y}px) translate(-50%,-50%);`;
  root.appendChild(el);
  if (typeof el.animate !== "function") {
    el.remove();
    return;
  }
  el.animate(
    [
      {
        transform: `translate(${from.x}px,${from.y}px) translate(-50%,-50%)`,
        opacity: 1,
      },
      {
        transform: `translate(${from.x}px,${from.y + 80}px) translate(-50%,-50%) rotate(40deg) scale(0.6)`,
        opacity: 0,
      },
    ],
    { duration: 350, easing: "ease-in", fill: "forwards" },
  ).onfinish = () => el.remove();
}
