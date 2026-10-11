import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { LIMITS } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api, type RoomStatus } from "@/lib/api";
import { lastName, loadIdentity, saveIdentity } from "@/lib/identity";

export function Join() {
  const { code = "" } = useParams();
  const normalized = code.toUpperCase();
  const navigate = useNavigate();
  const [name, setName] = useState(lastName);
  const [status, setStatus] = useState<RoomStatus | "missing" | null>(null);
  const [busy, setBusy] = useState(false);
  const existing = loadIdentity(normalized);

  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    api
      .status(normalized)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus("missing"));
    return () => {
      cancelled = true;
    };
  }, [normalized, existing]);

  if (existing) return <Navigate to={`/game/${normalized}`} replace />;

  const join = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const joined = await api.joinGame(normalized, trimmed);
      saveIdentity(normalized, { ...joined, name: trimmed });
      navigate(`/game/${normalized}`, { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "request_failed";
      toast.error(
        code === "room_full"
          ? "That game is full."
          : code === "no_game"
            ? "That game doesn't exist."
            : "Couldn't join. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="safe-area mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      <header className="text-center">
        <p className="text-sm tracking-widest text-muted-foreground uppercase">
          Joining game
        </p>
        <h1 className="mt-1 font-mono text-5xl font-black tracking-[0.2em]">
          {normalized}
        </h1>
        <p className="mt-3 text-muted-foreground" data-testid="room-status">
          {status === null
            ? "Looking up the game…"
            : status === "missing" || !status.exists
              ? "No game with that code."
              : `${status.playerCount} player${status.playerCount === 1 ? "" : "s"} · ${status.phase === "lobby" ? "in the lounge" : "in progress"}`}
        </p>
      </header>

      <form onSubmit={join} className="flex flex-col gap-3">
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
          disabled={
            busy ||
            !name.trim() ||
            status === "missing" ||
            (status !== null && !status.exists)
          }
        >
          Join game
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate("/")}>
          Back
        </Button>
      </form>
    </main>
  );
}
