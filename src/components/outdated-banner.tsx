import { useGameStore } from "@/lib/store";

/** Shown when the server speaks a newer protocol than this bundle. */
export function OutdatedBanner() {
  const outdated = useGameStore((s) => s.outdated);
  if (!outdated) return null;
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      className="fixed inset-x-0 bottom-0 z-40 bg-destructive px-4 py-3 text-center text-sm font-semibold text-white"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
      data-testid="outdated-banner"
    >
      A new version of Wavelength is available · tap to reload
    </button>
  );
}
