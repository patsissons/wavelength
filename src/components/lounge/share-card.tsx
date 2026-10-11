import { Check, Copy, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/button";

export function ShareCard({ code }: { code: string }) {
  const url = `${location.origin}/join/${code}`;
  const [copied, setCopied] = useState(false);
  const qr = useMemo(
    () =>
      renderSVG(url, {
        pixelSize: 4,
        blackColor: "oklch(0.17 0.045 290)",
        whiteColor: "white",
      }),
    [url],
  );
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Join my Wavelength game", url });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <section className="flex items-center gap-4 rounded-2xl bg-card p-4">
      <div
        className="size-24 shrink-0 overflow-hidden rounded-lg bg-white p-1 [&>svg]:size-full"
        dangerouslySetInnerHTML={{ __html: qr }}
        aria-label="QR code to join"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">
          Game code
        </p>
        <p
          className="font-mono text-4xl font-black tracking-[0.2em]"
          data-testid="game-code"
        >
          {code}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare && (
            <Button variant="secondary" size="sm" onClick={share}>
              <Share2 /> Share
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
