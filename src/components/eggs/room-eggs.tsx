import { useEffect } from "react";
import { eggBus } from "@/lib/eggs/bus";
import { useConnection } from "@/lib/use-game-connection";

/**
 * The bridge from local egg triggers to the room: mounted inside the
 * ConnectionProvider so Konami can fire the hidden `konami` effect through
 * the normal (validated, rate-limited) effect command.
 */
export function RoomEggs() {
  const { send } = useConnection();
  useEffect(() => {
    return eggBus.subscribe((event) => {
      if (event.kind === "konami") {
        void send({ type: "effect.send", effectId: "konami" });
      }
    });
  }, [send]);
  return null;
}
