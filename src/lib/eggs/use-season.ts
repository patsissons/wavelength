import { useMemo } from "react";
import { seasonFor, type Season } from "./seasons";
import { useEggs } from "./store";

/** Today's season, unless the console forced one. */
export function useSeason(): Season | null {
  const override = useEggs((s) => s.season);
  return useMemo(() => seasonFor(new Date(), override), [override]);
}
