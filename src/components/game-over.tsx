import { useMemo } from "react";
import { ranking } from "@shared/game/scoring";
import { gameAwards, gameFacts, playerTotals } from "@shared/game/stats";
import type { GameState, RoundResult } from "@shared/game/types";
import { TEAM_NAMES } from "@shared/game/types";
import { WedgeStrip, type StripMarker } from "@/components/board/wedge-strip";
import { ShareStrip } from "@/components/lounge/share-card";
import { PlayerAvatar } from "@/components/player-avatar";
import { Arena } from "@/components/reactions/arena";
import { Button } from "@/components/ui/button";
import { useArena } from "@/lib/arena";
import { selectIsHost, useGameStore } from "@/lib/store";
import { useCommand } from "@/lib/use-game-connection";
import { cn, firstGrapheme, playerColor } from "@/lib/utils";

export function GameOver() {
  const game = useGameStore((s) => s.game)!;
  const isHost = useGameStore(selectIsHost);
  const send = useCommand();
  const arenaOpen = useArena((s) => s.open);
  const openArena = useArena((s) => s.setOpen);
  const over = game.gameOver!;
  const mode = game.settings.mode;

  let headline: string;
  let sub: string | null = null;
  if (mode === "teams") {
    headline = over.winner
      ? `${TEAM_NAMES[over.winner as "left" | "right"]} wins!`
      : "It's a tie!";
    sub = `${game.scores.left ?? 0} – ${game.scores.right ?? 0}`;
  } else if (mode === "coop") {
    headline = over.label ?? "Game over";
    sub = `${game.scores.coop ?? 0} of ${game.history.length * 4} points`;
  } else {
    headline = over.winner
      ? `${game.players[over.winner]?.name ?? "Someone"} wins!`
      : "It's a tie!";
  }

  return (
    <main
      className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6"
      data-testid="game-over"
    >
      {arenaOpen && <Arena />}
      <header className="text-center">
        <p className="text-sm tracking-widest text-muted-foreground uppercase">
          Game over
        </p>
        <h1 className="mt-2 text-4xl font-black" data-testid="winner">
          {headline}
        </h1>
        {sub && (
          <p className="mt-2 text-2xl font-bold tabular-nums text-muted-foreground">
            {sub}
          </p>
        )}
      </header>

      {mode === "ffa" && (
        <ol className="flex flex-col gap-1">
          {ranking(game.scores).map((r) => {
            const p = game.players[r.id];
            if (!p) return null;
            return (
              <li
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl bg-card px-3 py-2",
                  r.rank === 1 && "ring-2 ring-primary",
                )}
              >
                <span className="w-6 text-center font-bold text-muted-foreground">
                  {r.rank}
                </span>
                <PlayerAvatar player={p} size="sm" />
                <span className="flex-1 truncate">{p.name}</span>
                <strong className="tabular-nums">{r.score}</strong>
              </li>
            );
          })}
        </ol>
      )}

      {game.settings.effects && (
        <Button
          variant="secondary"
          className="h-12"
          onClick={() => openArena(true)}
          data-testid="open-arena"
        >
          🎯 Throw reactions
        </Button>
      )}
      {isHost ? (
        <Button
          size="lg"
          className="h-14 text-lg"
          onClick={() => send({ type: "game.playAgain" })}
          data-testid="play-again"
        >
          Play again
        </Button>
      ) : (
        <p className="text-center text-muted-foreground">
          Waiting for {game.players[game.hostId]?.name ?? "the host"} to start
          another game…
        </p>
      )}

      <Stats />
      <ShareStrip code={game.code} />
    </main>
  );
}

/** Awards, numbers and a per-player table computed from the round history. */
function Stats() {
  const game = useGameStore((s) => s.game)!;
  const { history, players, settings, effectTally } = game;
  const awards = useMemo(
    () => gameAwards(history, players, settings.mode, effectTally),
    [history, players, settings.mode, effectTally],
  );
  const facts = useMemo(
    () => gameFacts(history, players, effectTally),
    [history, players, effectTally],
  );
  const totals = useMemo(
    () => playerTotals(history, players),
    [history, players],
  );
  if (history.length === 0) return null;

  return (
    <div className="flex flex-col gap-6" data-testid="stats">
      {awards.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            Awards
          </h2>
          <ul className="grid grid-cols-2 gap-2" data-testid="awards">
            {awards.map((a) => {
              const p = players[a.playerId];
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-1 rounded-2xl bg-card p-3"
                  data-testid={`award-${a.id}`}
                  data-player-name={p?.name}
                >
                  <p className="text-2xl leading-none">{a.emoji}</p>
                  <p className="font-bold">{a.title}</p>
                  {p && (
                    <p className="flex items-center gap-1.5 text-sm">
                      <PlayerAvatar player={p} size="sm" />
                      <span className="truncate">{p.name}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{a.value}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          By the numbers
        </h2>
        <dl className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4">
          {facts.map((f) => (
            <div
              key={f.id}
              className="flex items-baseline justify-between gap-4 py-2 text-sm"
            >
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-semibold">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          Players
        </h2>
        <table className="w-full text-sm" data-testid="player-stats">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-normal">Player</th>
              <th className="py-1 text-right font-normal">Moves</th>
              <th className="py-1 text-right font-normal">Travel</th>
              <th className="py-1 text-right font-normal">On target</th>
              <th className="py-1 text-right font-normal">As psychic</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => {
              const p = players[t.id];
              if (!p) return null;
              const aimed = t.toward + t.away;
              return (
                <tr key={t.id} className="border-t border-border">
                  <td className="flex items-center gap-1.5 py-1.5">
                    <PlayerAvatar player={p} size="sm" />
                    <span className="truncate">{p.name}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{t.moves}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {Math.round(t.travel * 180)}°
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {aimed === 0
                      ? "–"
                      : `${Math.round((100 * t.toward) / aimed)}%`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {t.psychicTurns === 0
                      ? "–"
                      : `${(t.psychicPoints / t.psychicTurns).toFixed(1)} pts`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
          Play by play
        </h2>
        <ol className="flex flex-col gap-2" data-testid="turns">
          {history.map((r, i) => {
            // Teams has no rotations: a turn is a turn. Co-op / FFA group
            // the turns under their round, numbered within it.
            const rounds = settings.mode !== "teams" && r.round !== undefined;
            const newRound = rounds && history[i - 1]?.round !== r.round;
            const number = rounds
              ? i - history.findIndex((h) => h.round === r.round) + 1
              : i + 1;
            return (
              <li key={i} className="contents">
                {newRound && (
                  <h3
                    className="mt-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                    data-testid="round-heading"
                  >
                    Round {r.round}
                  </h3>
                )}
                <TurnCard
                  number={number}
                  label={rounds ? `Turn ${number}` : undefined}
                  result={r}
                  game={game}
                />
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/**
 * One turn, for everyone: the clue, where the target was, where every
 * dial ended up and what each player got out of it.
 */
function TurnCard({
  number,
  label,
  result: r,
  game,
}: {
  /** Turn number, within the round when rounds are shown. */
  number: number;
  label?: string;
  result: RoundResult;
  game: GameState;
}) {
  const { players, settings } = game;
  const mode = settings.mode;
  const psychic = players[r.psychicId];
  const wedges = Object.values(r.dials).map((d) => d.wedge);
  const best = wedges.length ? Math.max(...wedges) : 0;
  const markers: StripMarker[] = Object.values(r.dials).map((d, i) => {
    const owner = d.owners.length === 1 ? players[d.owners[0]!] : undefined;
    return {
      id: owner?.id ?? `dial-${i}`,
      position: d.position,
      color: owner ? playerColor(owner.color) : "var(--color-primary)",
      label: owner ? firstGrapheme(owner.name) : "team",
    };
  });

  // Per-player lines: what each person did this turn and what it earned.
  const lines: Array<{ id: string; role: string; points: string }> = [];
  const pointsFor = (dialOwner: string): string => {
    const dial = Object.values(r.dials).find((d) =>
      d.owners.includes(dialOwner),
    );
    if (!dial) return "";
    if (mode === "ffa") return `+${r.deltas[dialOwner] ?? dial.wedge}`;
    return `+${dial.wedge}`;
  };
  if (psychic) {
    lines.push({
      id: psychic.id,
      role: "psychic",
      points:
        mode === "ffa"
          ? `+${r.deltas[psychic.id] ?? 0}${r.psychicBonus ? " (sweep)" : ""}`
          : `+${r.dials.shared?.wedge ?? 0}`,
    });
  }
  for (const dial of Object.values(r.dials)) {
    for (const id of dial.owners) {
      if (!players[id]) continue;
      lines.push({ id, role: "guesser", points: pointsFor(id) });
    }
  }
  for (const [id, s] of Object.entries(r.stats.players)) {
    if (s.vote && players[id] && !lines.some((l) => l.id === id)) {
      lines.push({
        id,
        role: `called ${s.vote === "correct" ? "right" : "wrong"}`,
        points: s.vote === "correct" && r.vote?.bonusTo ? "+1" : "+0",
      });
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl bg-card px-3 py-2 text-sm"
      data-testid="turn"
      data-round={r.round}
      data-turn={number}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-5 text-center text-muted-foreground"
          title={label}
          aria-label={label}
        >
          {number}
        </span>
        {psychic && <PlayerAvatar player={psychic} size="sm" />}
        <span className="min-w-0 flex-1 truncate">
          <span className="text-muted-foreground">{psychic?.name ?? "?"}:</span>{" "}
          <strong>“{r.clue}”</strong>
        </span>
        <strong
          className={cn(
            "text-lg tabular-nums",
            best === 4 && "text-wedge-4",
            best === 3 && "text-wedge-3",
            best === 2 && "text-wedge-2",
            best === 0 && "text-muted-foreground",
          )}
          data-testid="turn-best"
        >
          {best}
        </strong>
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{r.spectrum.left}</span>
        <span className="truncate">{r.spectrum.right}</span>
      </div>
      <WedgeStrip target={r.target} spectrum={r.spectrum} markers={markers} />
      {mode === "teams" && r.vote && (
        <p className="text-xs text-muted-foreground" data-testid="turn-vote">
          {TEAM_NAMES[r.psychicTeam!]} +{r.deltas[r.psychicTeam!] ?? 0} ·{" "}
          {TEAM_NAMES[r.psychicTeam === "left" ? "right" : "left"]}{" "}
          {r.vote.majority === null
            ? "split the vote"
            : `called ${r.vote.majority}${r.vote.bonusTo ? " (+1)" : ""}`}
        </p>
      )}
      <ul className="flex flex-wrap gap-1.5" data-testid="turn-players">
        {lines.map((l) => {
          const p = players[l.id]!;
          return (
            <li
              key={l.id}
              className="flex items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-0.5 text-xs"
              data-player-name={p.name}
              data-role={l.role}
            >
              <PlayerAvatar player={p} size="sm" />
              <span className="max-w-24 truncate">{p.name}</span>
              <span className="text-muted-foreground">{l.role}</span>
              <strong className="tabular-nums">{l.points}</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
