/** Dev-only hooks the app installs on window (see connection-provider.tsx). */
interface Window {
  __wsDrop?: () => void;
  __audio?: {
    render(
      what: { loop: "lounge" | "disco" } | { patch: string },
      seconds: number,
    ): Promise<Float32Array>;
  };
  __gameStore?: {
    getState(): {
      conn: string;
      game: { phase: string; version: number } | null;
      you: { playerId: string } | null;
      error: { code: string } | null;
    };
  };
  /** The easter-egg console API (see src/lib/eggs/console.ts). */
  wavelength?: {
    list(): string;
    party(): string;
    disco(seconds?: number): string;
    jukebox(): string;
    play(name: string): string;
    loop(name: string | null): string;
    rain(glyph?: string, count?: number): string;
    season(name?: string | null): string;
    barrelRoll(): string;
    crt(): string;
    pet(glyph?: string | null): string;
    reset(): string;
  };
}
