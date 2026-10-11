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
                <Slider
                  min={LIMITS.minTargetScore}
                  max={LIMITS.maxTargetScore}
                  step={1}
                  value={[settings.targetScore]}
                  onValueCommit={([v]) =>
                    v !== undefined && patch({ targetScore: v })
                  }
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
              <Slider
                min={LIMITS.minRounds}
                max={LIMITS.maxRounds}
                step={1}
                value={[settings.rounds]}
                onValueCommit={([v]) => v !== undefined && patch({ rounds: v })}
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
