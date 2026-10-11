/** Which flavour of instructions to show: a phone has swipes, no console. */
export type Platform = "ios" | "android" | "desktop";

export function detectPlatform(
  nav: Pick<Navigator, "userAgent" | "maxTouchPoints"> = navigator,
): Platform {
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  // iPadOS reports itself as a Mac, but a Mac has no touch points.
  if (/Macintosh/.test(ua) && nav.maxTouchPoints > 1) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  ios: "iPhone",
  android: "Android",
  desktop: "desktop",
};
