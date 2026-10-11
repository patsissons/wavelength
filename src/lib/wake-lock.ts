/**
 * Keep the phone awake during a game (Screen Wake Lock API, Safari 16.4+).
 * Must be requested after a user gesture; re-requested when the page
 * becomes visible again because the OS releases it on background.
 */
let sentinel: WakeLockSentinel | null = null;
let wanted = false;

export async function requestWakeLock(): Promise<void> {
  wanted = true;
  if (
    sentinel ||
    typeof navigator === "undefined" ||
    !("wakeLock" in navigator)
  )
    return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    /* denied or unsupported; not fatal */
  }
}

export function releaseWakeLock(): void {
  wanted = false;
  void sentinel?.release().catch(() => {});
  sentinel = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wanted)
      void requestWakeLock();
  });
}
