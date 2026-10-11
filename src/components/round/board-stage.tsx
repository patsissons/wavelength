import { useReducedMotion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { roleOf } from "@shared/game/selectors";
import type { GameState } from "@shared/game/types";
import { Board, type BoardDial } from "@/components/board/board";
import { useSpinAnimation } from "@/components/board/use-spin";
import { useGameStore } from "@/lib/store";
import { useCommand, useConnection } from "@/lib/use-game-connection";
import { playerColor } from "@/lib/utils";

const MOVE_THROTTLE_MS = 50;

/**
 * Connects the Board to game state: which dials to show, who may drag,
 * whether the wedge is visible, the shroud, and the spin animation.
 */
export function BoardStage({
  game,
  playerId,
  peeking,
  onSpinDone,
}: {
  game: GameState;
  playerId: string;
  peeking: boolean;
  onSpinDone?: () => void;
}) {
  const target = useGameStore((s) => s.you?.target ?? null);
  const live = useGameStore((s) => s.live);
  const setLocalDial = useGameStore((s) => s.setLocalDial);
  const send = useCommand();
  const { sendEphemeral } = useConnection();
  const reduced = useReducedMotion() ?? false;
  const round = game.round!;
  const role = roleOf(game, playerId);
  const isPsychic = role === "psychic";
  const [spinFrom, setSpinFrom] = useState(0);
  const lastMove = useRef(0);

  const { angle, done } = useSpinAnimation(round.spin, spinFrom, {
    reducedMotion: reduced,
    onDone: onSpinDone,
  });

  const phase = game.phase;
  const revealed = phase === "reveal";
  const showTarget = revealed ? round.target : isPsychic ? target : null;
  const shroudOpen = revealed || (isPsychic && peeking && done);

  const myDial = useMemo(
    () =>
      Object.values(round.dials).find((d) => d.owners.includes(playerId)) ??
      null,
    [round.dials, playerId],
  );
  const canDrag = phase === "guessing" && !!myDial && !myDial.locked;

  const dials: BoardDial[] = useMemo(() => {
    if (!["guessing", "voting", "reveal"].includes(phase)) return [];
    const list: BoardDial[] = [];
    for (const dial of Object.values(round.dials)) {
      const mine = dial.owners.includes(playerId);
      // FFA: other players' dials stay hidden until the reveal.
      if (game.settings.mode === "ffa" && !mine && !revealed) continue;
      const liveMove = live.dials[dial.id];
      const position =
        mine && live.localDial?.dialId === dial.id
          ? live.localDial.position
          : liveMove && !dial.locked
            ? liveMove.position
            : dial.position;
      const owner = game.players[dial.id] ?? game.players[dial.movedBy ?? ""];
      list.push({
        id: dial.id,
        position,
        color:
          dial.id === "shared"
            ? "var(--color-primary)"
            : playerColor(owner?.color ?? 0),
        emphasized: mine,
        locked: dial.locked,
        faded: !mine && game.settings.mode === "ffa",
      });
    }
    return list;
  }, [
    phase,
    round.dials,
    playerId,
    game.settings.mode,
    game.players,
    live,
    revealed,
  ]);

  const onMove = useCallback(
    (position: number) => {
      if (!myDial) return;
      setLocalDial({ dialId: myDial.id, position });
      const now = performance.now();
      if (now - lastMove.current >= MOVE_THROTTLE_MS) {
        lastMove.current = now;
        sendEphemeral({ type: "dial.move", dialId: myDial.id, position });
      }
    },
    [myDial, sendEphemeral, setLocalDial],
  );

  const onEnd = useCallback(
    async (position: number) => {
      if (!myDial) return;
      setLocalDial({ dialId: myDial.id, position });
      await send({ type: "dial.set", dialId: myDial.id, position });
      setLocalDial(null);
    },
    [myDial, send, setLocalDial],
  );

  const onFlick = useCallback(
    (velocity: number) => {
      setSpinFrom(0);
      void send({ type: "spin.flick", velocity });
    },
    [send],
  );

  return (
    <Board
      target={showTarget}
      discAngle={angle}
      shroudOpen={shroudOpen}
      dials={dials}
      drag={{ enabled: canDrag, onMove, onEnd }}
      spin={{ enabled: isPsychic && phase === "spinning", onFlick }}
    />
  );
}
