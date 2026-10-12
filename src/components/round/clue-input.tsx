import { useRef, useState, type FormEvent } from "react";
import { LIMITS } from "@shared/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClueInput({
  onSubmit,
  disabled,
}: {
  /**
   * Returns false when the clue was not sent (a magic word went to the
   * room instead): the box clears and keeps focus for the real clue.
   */
  onSubmit: (clue: string) => boolean;
  disabled: boolean;
}) {
  const [clue, setClue] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = clue.trim();
    if (!trimmed) return;
    if (onSubmit(trimmed)) return;
    setClue("");
    input.current?.focus();
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        ref={input}
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
