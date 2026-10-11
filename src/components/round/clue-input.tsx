import { useState, type FormEvent } from "react";
import { LIMITS } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClueInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (clue: string) => void;
  disabled: boolean;
}) {
  const [clue, setClue] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = clue.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={clue}
        onChange={(e) => setClue(e.target.value)}
        maxLength={LIMITS.clueMax}
        placeholder="Your clue"
        aria-label="Clue"
        className="h-12 text-lg"
        autoComplete="off"
        disabled={disabled}
        data-testid="clue-input"
      />
      <Button
        type="submit"
        size="lg"
        className="h-12"
        disabled={disabled || !clue.trim()}
        data-testid="submit-clue"
      >
        Say it
      </Button>
    </form>
  );
}
