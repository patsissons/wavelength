import { Check, Copy, Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { renderSVG } from "uqr";
import { Button } from "@/components/ui/button";
import { EggCheatsheet } from "@/components/eggs/cheatsheet";
import { isPalindrome, TapCounter } from "@/lib/eggs/charm";
import { cn } from "@/lib/utils";

function useShare(code: string) {
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
  // Five quick taps on the QR code: the easter-egg cheat sheet.
  const taps = useRef(new TapCounter(5, 5000));
  const [eggs, setEggs] = useState(false);
  const tapQr = () => {
    if (taps.current.push(Date.now())) setEggs(true);
  };
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
  return { url, qr, copied, canShare, copy, share, eggs, setEggs, tapQr };
}

/** The QR image; five quick taps open the easter-egg cheat sheet. */
function QrCode({
  qr,
  onTap,
  className,
}: {
  qr: string;
  onTap: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 overflow-hidden bg-white [&>svg]:size-full",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: qr }}
      aria-label="QR code to join"
      onClick={onTap}
      data-testid="qr-code"
    />
  );
}

export function ShareCard({ code }: { code: string }) {
  const { qr, copied, canShare, copy, share, eggs, setEggs, tapQr } =
    useShare(code);
  return (
    <section className="flex items-center gap-4 rounded-2xl bg-card p-4">
      <QrCode qr={qr} onTap={tapQr} className="size-24 rounded-lg p-1" />
      <EggCheatsheet open={eggs} onOpenChange={setEggs} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">
          Game code
        </p>
        <p className="flex items-center gap-2">
          <span
            className="font-mono text-4xl font-black tracking-[0.2em]"
            data-testid="game-code"
          >
            {code}
          </span>
          {isPalindrome(code) && (
            <span
              className="text-xl"
              title="A palindrome! Reads the same backwards."
              data-testid="egg-palindrome"
            >
              🪞
            </span>
          )}
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

/** One-row invite for in-game screens so late arrivals can still join. */
export function ShareStrip({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const { url, qr, copied, canShare, copy, share, eggs, setEggs, tapQr } =
    useShare(code);
  return (
    <section
      className={cn(
        "flex items-center gap-3 rounded-2xl bg-card/70 px-3 py-2",
        className,
      )}
      data-testid="share-compact"
    >
      <QrCode qr={qr} onTap={tapQr} className="size-14 rounded-md p-0.5" />
      <EggCheatsheet open={eggs} onOpenChange={setEggs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
          Join with code
        </p>
        <p
          className="font-mono text-xl font-black tracking-[0.2em]"
          data-testid="share-compact-code"
        >
          {code}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {url.replace(/^https?:\/\//, "")}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={copy}
          aria-label="Copy join link"
        >
          {copied ? <Check /> : <Copy />}
        </Button>
        {canShare && (
          <Button
            variant="ghost"
            size="icon"
            onClick={share}
            aria-label="Share join link"
          >
            <Share2 />
          </Button>
        )}
      </div>
    </section>
  );
}
