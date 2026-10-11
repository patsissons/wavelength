import { Settings2 } from "lucide-react";
import { useState } from "react";
import { formatCustomSpectra, parseCustomSpectra } from "@shared/deck/custom";
import type { Mode, Settings, TeamId } from "@shared/game/types";
import { LIMITS, TEAM_NAMES } from "@shared/game/types";
import type { SettingsPatch } from "@shared/protocol/messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatTimer } from "@/lib/time";
import { useCommand } from "@/lib/use-game-connection";
import { cn } from "@/lib/utils";

const MODES: Array<{ id: Mode; label: string; blurb: string }> = [
  {
    id: "teams",
    label: "Teams",
    blurb:
      "Two teams, shared dial, left/right bonus. First to the target score.",
  },
  {
    id: "coop",
    label: "Co-op",
    blurb: "One team, everyone guesses together for a fixed number of rounds.",
  },
  {
    id: "ffa",
    label: "Free-for-all",
    blurb: "Everyone gets their own dial and scores for themselves.",
  },
];

/** Spins per turn offered in the settings; 0 means unlimited. */
const SPIN_OPTIONS = [1, 2, 3, 5, 0] as const;

/** Dial timer options in seconds; 0 means no limit. */
const TIMER_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 180] as const;

export function HostSettings({ settings }: { settings: Settings }) {
  const send = useCommand();
  const [customText, setCustomText] = useState(() =>
    formatCustomSpectra(settings.customSpectra),
  );
  const patch = (p: SettingsPatch) =>
    send({ type: "settings.update", patch: p });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          className="h-12"
          data-testid="open-settings"
        >
          <Settings2 /> Game settings
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-3xl"
      >
        <SheetHeader>
          <SheetTitle>Game settings</SheetTitle>
          <SheetDescription>
            Changes apply to everyone immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-8">
          <fieldset className="flex flex-col gap-2">
            <Label>Mode</Label>
            <div className="grid gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`mode-${m.id}`}
                  onClick={() => patch({ mode: m.id })}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-colors",
                    settings.mode === m.id
                      ? "border-primary bg-primary/10"
                      : "border-border",
                  )}
                >
                  <span className="block font-semibold">{m.label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {m.blurb}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {settings.mode === "teams" && (
            <>
              <fieldset className="flex flex-col gap-3">
                <Label>
                  Points to win: <strong>{settings.targetScore}</strong>
                </Label>
                <SettingSlider
                  min={LIMITS.minTargetScore}
                  max={LIMITS.maxTargetScore}
                  value={settings.targetScore}
                  onCommit={(v) => patch({ targetScore: v })}
                  label="Points to win"
                />
              </fieldset>
              <Row
                label="Catch-up rule"
                hint="A 4-point turn while behind grants another turn."
              >
                <Switch
                  checked={settings.catchUp}
                  onCheckedChange={(v) => patch({ catchUp: v })}
                />
              </Row>
              <fieldset className="flex flex-col gap-2">
                <Label>First team</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["random", "left", "right"] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={
                        settings.firstTeam === t ? "default" : "secondary"
                      }
                      onClick={() => patch({ firstTeam: t })}
                    >
                      {t === "random" ? "Random" : TEAM_NAMES[t as TeamId]}
                    </Button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {settings.mode !== "teams" && (
            <fieldset className="flex flex-col gap-3">
              <Label>
                Rounds:{" "}
                <strong data-testid="rounds-value">{settings.rounds}</strong>
              </Label>
              <p className="text-sm text-muted-foreground">
                Everyone is the psychic once per round.
              </p>
              <SettingSlider
                min={LIMITS.minRounds}
                max={LIMITS.maxRounds}
                value={settings.rounds}
                onCommit={(v) => patch({ rounds: v })}
                label="Rounds"
              />
            </fieldset>
          )}

          {settings.mode === "ffa" && (
            <Row
              label="Psychic scores the average"
              hint="The psychic earns the rounded average of the guessers' points."
            >
              <Switch
                checked={settings.psychicScoring === "average"}
                onCheckedChange={(v) =>
                  patch({ psychicScoring: v ? "average" : "none" })
                }
              />
            </Row>
          )}

          <fieldset className="flex flex-col gap-2">
            <Label>First psychic</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["random", "order"] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={
                    settings.firstPsychic === v ? "default" : "secondary"
                  }
                  onClick={() => patch({ firstPsychic: v })}
                  data-testid={`first-psychic-${v}`}
                >
                  {v === "random" ? "Random" : "Join order"}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <Label>Wheel spins per turn</Label>
            <p className="text-sm text-muted-foreground">
              How often the psychic may re-spin before giving the clue.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {SPIN_OPTIONS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={settings.maxSpins === v ? "default" : "secondary"}
                  onClick={() => patch({ maxSpins: v })}
                  data-testid={`max-spins-${v}`}
                  aria-label={v === 0 ? "Unlimited spins" : `${v} spins`}
                >
                  {v === 0 ? "∞" : v}
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <Label>Dial timer</Label>
            <p className="text-sm text-muted-foreground">
              Time to move the dial once the clue is given. When it runs out,
              every dial locks where it is.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {TIMER_OPTIONS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={
                    settings.guessSeconds === v ? "default" : "secondary"
                  }
                  onClick={() => patch({ guessSeconds: v })}
                  data-testid={`guess-seconds-${v}`}
                  aria-label={
                    v === 0 ? "No dial timer" : `${v} second dial timer`
                  }
                >
                  {formatTimer(v)}
                </Button>
              ))}
            </div>
          </fieldset>

          <Row
            label="Effects"
            hint="Let players send sounds and visual effects to each other."
          >
            <Switch
              checked={settings.effects}
              onCheckedChange={(v) => patch({ effects: v })}
            />
          </Row>

          <fieldset className="flex flex-col gap-2">
            <Label htmlFor="custom">Custom spectra</Label>
            <p className="text-sm text-muted-foreground">
              One per line, like <code>Cold | Hot</code>. They&apos;re shuffled
              into the deck.
            </p>
            <Textarea
              id="custom"
              rows={4}
              value={customText}
              placeholder={"Cold | Hot\nBad tattoo idea | Great tattoo idea"}
              onChange={(e) => setCustomText(e.target.value)}
              onBlur={() =>
                patch({ customSpectra: parseCustomSpectra(customText) })
              }
            />
            <Row
              label="Include the built-in deck"
              hint="Turn off to play with your custom spectra only."
            >
              <Switch
                checked={settings.useBuiltInDeck}
                onCheckedChange={(v) => patch({ useBuiltInDeck: v })}
              />
            </Row>
          </fieldset>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label>{label}</Label>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * A slider that follows the finger locally and only sends the value when
 * the interaction ends, then snaps to whatever the server confirms.
 */
function SettingSlider({
  min,
  max,
  value,
  onCommit,
  label,
}: {
  min: number;
  max: number;
  value: number;
  onCommit: (value: number) => void;
  label: string;
}) {
  const [local, setLocal] = useState(value);
  const [confirmed, setConfirmed] = useState(value);
  if (confirmed !== value) {
    // The server confirmed a new value: adopt it (derived-state pattern).
    setConfirmed(value);
    setLocal(value);
  }
  return (
    <Slider
      min={min}
      max={max}
      step={1}
      value={[local]}
      aria-label={label}
      onValueChange={([v]) => v !== undefined && setLocal(v)}
      onValueCommit={([v]) => v !== undefined && onCommit(v)}
    />
  );
}
