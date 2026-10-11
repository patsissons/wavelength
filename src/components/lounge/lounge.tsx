import { LogOut, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { teamMembers } from "@shared/game/rotation";
import { LIMITS } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { audio } from "@/lib/audio";
import { loungeLoop } from "@/lib/eggs/disco";
import { useEggs } from "@/lib/eggs/store";
import { saveIdentity, loadIdentity } from "@/lib/identity";
import { usePrefs } from "@/lib/prefs";
import { selectIsHost, useGameStore } from "@/lib/store";
import { useCommand } from "@/lib/use-game-connection";
import { EnableSound } from "./enable-sound";
import { HostSettings } from "./host-settings";
import { PlayerList } from "./player-list";
import { ShareCard } from "./share-card";

const MODE_LABEL = {
  teams: "Teams",
  coop: "Co-op",
  ffa: "Free-for-all",
} as const;

export function Lounge() {
  const game = useGameStore((s) => s.game)!;
  const you = useGameStore((s) => s.you)!;
  const isHost = useGameStore(selectIsHost);
  const send = useCommand();
  const navigate = useNavigate();
  const me = game.players[you.playerId];
  const count = Object.keys(game.players).length;
  const unlocked = usePrefs((s) => s.soundUnlocked);
  const muted = usePrefs((s) => s.muted);
  const music = usePrefs((s) => s.music);
  const disco = useEggs((s) => s.disco);

  // A looping groove while everyone gathers: the easiest way to tell that
  // sound really works on this phone (disco mode swaps the record).
  useEffect(() => {
    audio.setLoop(loungeLoop({ unlocked, muted, music, disco }));
    return () => audio.setLoop(null);
  }, [unlocked, muted, music, disco]);

  let startBlocker: string | null = null;
  if (game.settings.mode === "teams") {
    const left = teamMembers(game, "left").length;
    const right = teamMembers(game, "right").length;
    if (left < 2 || right < 2)
      startBlocker = "Each team needs at least 2 players";
  } else if (count < 2) {
    startBlocker = "Need at least 2 players";
  }

  return (
    <main className="safe-x safe-top mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black tracking-tight">Lounge</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          data-testid="leave-game"
          title="Back to the home screen; your seat stays open"
        >
          <LogOut /> Leave
        </Button>
      </div>
      <ShareCard code={game.code} />

      <section className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Mode
          </p>
          <p className="font-semibold" data-testid="mode-label">
            {MODE_LABEL[game.settings.mode]}
            <span className="font-normal text-muted-foreground">
              {game.settings.mode === "teams"
                ? ` · first to ${game.settings.targetScore}`
                : ` · ${game.settings.rounds} round${game.settings.rounds === 1 ? "" : "s"} · ${count} turn${count === 1 ? "" : "s"} each`}
            </span>
          </p>
        </div>
        {isHost && <HostSettings settings={game.settings} />}
      </section>

      <EnableSound />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
            Players · {count}
          </h2>
          {me && (
            <RenameDialog
              code={game.code}
              name={me.name}
              onRename={(name) => send({ type: "player.rename", name })}
            />
          )}
        </div>
        <PlayerList />
      </section>

      <footer className="safe-x safe-bottom fixed inset-x-0 bottom-0 mx-auto w-full max-w-md bg-gradient-to-t from-background via-background to-transparent pt-4">
        {isHost ? (
          <Button
            size="lg"
            className="h-14 w-full text-lg"
            disabled={startBlocker !== null}
            onClick={() => send({ type: "game.start" })}
            data-testid="start-game"
          >
            {startBlocker ?? "Start game"}
          </Button>
        ) : (
          <p
            className="rounded-2xl bg-card py-4 text-center text-muted-foreground"
            data-testid="waiting"
          >
            Waiting for {game.players[game.hostId]?.name ?? "the host"} to
            start…
          </p>
        )}
      </footer>
    </main>
  );
}

function RenameDialog({
  code,
  name,
  onRename,
}: {
  code: string;
  name: string;
  onRename: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(name);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Change your name">
          <Pencil /> {name}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your name</DialogTitle>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) return;
            onRename(trimmed);
            const identity = loadIdentity(code);
            if (identity) saveIdentity(code, { ...identity, name: trimmed });
            setOpen(false);
          }}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={LIMITS.nameMax}
            autoFocus
          />
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
