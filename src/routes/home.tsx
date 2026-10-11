import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LIMITS } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { QUIPS, TapCounter } from "@/lib/eggs/charm";
import { tagline, useSeason } from "@/lib/eggs/seasons";
import { lastName, loadIdentity, saveIdentity } from "@/lib/identity";

export function Home() {
  const navigate = useNavigate();
  const season = useSeason();
  const [name, setName] = useState(lastName);
  const titleTaps = useRef(new TapCounter(7, 4000));
  const [waves, setWaves] = useState(0);
  const [waving, setWaving] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const normalized = code.toUpperCase().replace(/[^A-Z]/g, "");

  const host = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await api.createGame(trimmed);
      saveIdentity(created.code, { ...created, name: trimmed });
      navigate(`/game/${created.code}`);
    } catch {
      toast.error("Couldn't create a game. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // Joining with a code uses the same name field, so there is no second
  // "enter your name" screen; /join/:code remains for shared links.
  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (normalized.length !== 4) return;
    if (loadIdentity(normalized)) {
      navigate(`/game/${normalized}`);
      return;
    }
    if (!trimmed) {
      toast.error("Enter your name first.");
      return;
    }
    setBusy(true);
    try {
      const joined = await api.joinGame(normalized, trimmed);
      saveIdentity(normalized, { ...joined, name: trimmed });
      navigate(`/game/${normalized}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "request_failed";
      toast.error(
        code === "room_full"
          ? "That game is full."
          : code === "no_game"
            ? "No game with that code."
            : "Couldn't join. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 [--page-pad:1.5rem]">
      <header className="text-center">
        <h1
          className="text-5xl font-black tracking-tight"
          aria-label="Wavelength"
          data-egg-wave={waving || undefined}
          onClick={() => {
            // Seven quick taps: the letters do the wave, the tagline quips.
            if (!titleTaps.current.push(Date.now())) return;
            setWaves((n) => n + 1);
            setWaving(true);
            setTimeout(() => setWaving(false), 1800);
          }}
        >
          {Array.from("Wavelength", (ch, i) => (
            <span
              key={i}
              className="egg-letter inline-block"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {ch}
            </span>
          ))}
        </h1>
        <p className="mt-2 text-muted-foreground" data-testid="tagline">
          {waves > 0 ? QUIPS[(waves - 1) % QUIPS.length] : tagline(season)}
        </p>
      </header>

      <form onSubmit={host} className="flex flex-col gap-3">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.nameMax}
          autoComplete="nickname"
          placeholder="What should we call you?"
          className="h-12 text-lg"
          required
        />
        <Button
          type="submit"
          size="lg"
          className="h-12 text-base"
          disabled={busy || !trimmed}
        >
          Host a game
        </Button>
      </form>

      <form onSubmit={join} className="flex flex-col gap-3">
        <Label htmlFor="code">Have a code?</Label>
        <div className="flex gap-2">
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="BCDF"
            className="h-12 font-mono text-lg tracking-[0.3em] uppercase"
          />
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="h-12"
            disabled={busy || normalized.length !== 4 || !trimmed}
            data-testid="join-with-code"
          >
            Join
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Uses the name above. Got a link instead? Just open it.
        </p>
      </form>
    </main>
  );
}
