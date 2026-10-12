import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EGGS, howFor } from "@/lib/eggs/registry";
import {
  detectPlatform,
  PLATFORM_LABEL,
  type Platform,
} from "@/lib/eggs/platform";
import { useEggs } from "@/lib/eggs/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Jukebox } from "./jukebox";

/**
 * Every easter egg and how to set it off on this device. Opens after five
 * quick taps on a QR code. The console calls are listed apart for the
 * desktop crowd; the jukebox and the off switch live at the bottom so a
 * phone can reach them too.
 */
export function EggCheatsheet({
  open,
  onOpenChange,
  platform: forced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tests pin the platform; otherwise it is sniffed from the browser. */
  platform?: Platform;
}) {
  const platform = useMemo(() => forced ?? detectPlatform(), [forced]);
  const [jukebox, setJukebox] = useState(false);
  const hands = EGGS.filter((e) => !e.consoleOnly);
  const console = EGGS.filter((e) => e.api);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0"
        data-testid="egg-cheatsheet"
        data-platform={platform}
      >
        <DialogHeader className="px-5 pt-5 pb-3 text-left">
          <DialogTitle>🥚 Easter eggs</DialogTitle>
          <DialogDescription>
            How to find them on {PLATFORM_LABEL[platform]}. Every one of them
            calms down under “Reduce effects”.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-5 pb-5">
          <ol className="flex flex-col gap-3" data-testid="egg-list">
            {hands.map((egg) => (
              <li key={egg.id} data-egg={egg.id}>
                <p className="font-semibold">{egg.name}</p>
                <p className="text-sm">{howFor(egg, platform)}</p>
                <p className="text-sm text-muted-foreground">{egg.what}</p>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Also from a desktop console
          </h3>
          <ol className="flex flex-col gap-3" data-testid="egg-console-list">
            {console.map((egg) => (
              <li key={egg.id} data-egg={egg.id}>
                <p className="font-semibold">{egg.name}</p>
                <code className="block text-sm break-words text-primary">
                  {egg.api}
                </code>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-12"
              onClick={() => setJukebox(true)}
              data-testid="egg-jukebox-open"
            >
              🎵 Jukebox
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12"
              onClick={() => {
                useEggs.getState().reset();
                toast("All eggs off.");
              }}
              data-testid="egg-reset"
            >
              Switch everything off
            </Button>
          </div>
        </div>
        <Jukebox open={jukebox} onOpenChange={setJukebox} />
      </DialogContent>
    </Dialog>
  );
}
