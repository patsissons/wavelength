import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LIMITS } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { lastName, saveIdentity } from "@/lib/identity";

export function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState(lastName);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const host = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
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

  const join = (event: FormEvent) => {
    event.preventDefault();
    const normalized = code.toUpperCase().replace(/[^A-Z]/g, "");
    if (normalized.length !== 4) return;
    navigate(`/join/${normalized}`);
  };

  return (
    <main className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 p-6">
      <header className="text-center">
        <h1 className="text-5xl font-black tracking-tight">Wavelength</h1>
        <p className="mt-2 text-muted-foreground">
          Read your friends&apos; minds.
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
          disabled={busy || !name.trim()}
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
            disabled={code.replace(/[^A-Za-z]/g, "").length !== 4}
          >
            Join
          </Button>
        </div>
      </form>
    </main>
  );
}
