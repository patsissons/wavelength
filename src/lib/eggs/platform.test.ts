import { describe, expect, it } from "vitest";
import { detectPlatform } from "./platform";

describe("detectPlatform", () => {
  it("tells phones, iPads pretending to be Macs, and desktops apart", () => {
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 0,
      }),
    ).toBe("desktop");
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7)",
        maxTouchPoints: 5,
      }),
    ).toBe("android");
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        maxTouchPoints: 0,
      }),
    ).toBe("desktop");
  });
});
