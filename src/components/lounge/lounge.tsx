import { Pencil } from "lucide-react";
import { useState } from "react";
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
import { saveIdentity, loadIdentity } from "@/lib/identity";
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
  const me = game.players[you.playerId];
  const count = Object.keys(game.players).length;

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
    <main className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pb-28">
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
                : ` · ${game.settings.rounds} rounds`}
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

      <footer
        className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md bg-gradient-to-t from-background via-background to-transparent p-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
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
