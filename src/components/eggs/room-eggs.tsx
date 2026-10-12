import { useEffect } from "react";
import { eggBus } from "@/lib/eggs/bus";
import { useConnection } from "@/lib/use-game-connection";

/**
 * The bridge from local egg triggers to the room: mounted inside the
 * ConnectionProvider so an egg (Konami, a magic clue) can fire a hidden
 * catalog effect through the normal (validated, rate-limited) effect
 * command.
 */
export function RoomEggs() {
  const { send } = useConnection();
  useEffect(() => {
    return eggBus.subscribe((event) => {
      if (event.kind === "effect") {
        void send({ type: "effect.send", effectId: event.effectId });
      }
    });
  }, [send]);
  return null;
}
