/** Dev-only hooks the app installs on window (see connection-provider.tsx). */
interface Window {
  __wsDrop?: () => void;
  __gameStore?: {
    getState(): {
      conn: string;
      game: { phase: string; version: number } | null;
      error: { code: string } | null;
    };
  };
}
