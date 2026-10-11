import { Smile } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { AVATARS, isEmojiAvatar } from "@shared/avatars/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { avatarOf } from "./avatar";
import { AvatarFigure } from "./avatar-figure";
import { EMOJI_CHOICES } from "./emoji-choices";

/**
 * Bottom sheet for choosing an avatar: a catalog character, an emoji from
 * the grid (or any emoji typed in), or none for the monogram. The trigger
 * is supplied by the caller so it can be a bare preview (home) or the
 * player's live badge (lounge).
 */
export function AvatarPicker({
  value,
  onChange,
  trigger,
}: {
  value: string | null;
  onChange: (avatar: string | null) => void;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const customOk = isEmojiAvatar(custom.trim());
  const choose = (avatar: string | null) => {
    onChange(avatar);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-3xl"
        data-testid="avatar-picker"
      >
        <SheetHeader>
          <SheetTitle>Your avatar</SheetTitle>
          <SheetDescription>
            Shown next to your name and on your dial.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          <fieldset className="flex flex-col gap-2">
            <Label>Characters</Label>
            <div className="grid grid-cols-4 gap-2">
              {AVATARS.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => choose(def.id)}
                  aria-label={def.label}
                  aria-pressed={value === def.id}
                  data-testid={`avatar-${def.id}`}
                  className={cn(
                    "flex h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 bg-card transition-colors",
                    value === def.id
                      ? "border-primary bg-primary/10"
                      : "border-transparent",
                  )}
                >
                  <AvatarFigure def={def} className="text-3xl" />
                  <span className="w-full truncate px-1 text-center text-[10px] text-muted-foreground">
                    {def.label}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <Label>Emoji</Label>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CHOICES.map((glyph) => (
                <button
                  key={glyph}
                  type="button"
                  onClick={() => choose(glyph)}
                  aria-label={glyph}
                  aria-pressed={value === glyph}
                  data-testid={`avatar-emoji-${glyph}`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg border-2 text-2xl",
                    value === glyph
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-card",
                  )}
                >
                  {glyph}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (customOk) choose(custom.trim());
              }}
            >
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Or type any emoji"
                aria-label="Any emoji"
                maxLength={32}
                className="h-11"
                data-testid="avatar-custom"
              />
              <Button
                type="submit"
                variant="secondary"
                className="h-11"
                disabled={!customOk}
              >
                Use it
              </Button>
            </form>
          </fieldset>

          <Button
            type="button"
            variant={value === null ? "default" : "secondary"}
            className="h-11"
            onClick={() => choose(null)}
            data-testid="avatar-none"
          >
            Just my initial
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * A trigger for the picker where the player's colour is not known yet (the
 * home and join screens): the chosen avatar, or a smiley placeholder.
 */
export function AvatarPreviewButton({
  avatar,
  ...props
}: { avatar: string | null } & ComponentProps<typeof Button>) {
  const render = avatarOf({ name: "?", avatar });
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="size-12 shrink-0 text-2xl"
      aria-label="Choose your avatar"
      data-testid="open-avatar"
      data-avatar={avatar ?? undefined}
      {...props}
    >
      {render.kind === "figure" ? (
        <AvatarFigure def={render.def} />
      ) : render.kind === "emoji" ? (
        <span className="leading-none">{render.text}</span>
      ) : (
        <Smile className="size-6 text-muted-foreground" />
      )}
    </Button>
  );
}
