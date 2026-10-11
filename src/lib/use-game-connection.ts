import { useContext } from "react";
import { toast } from "sonner";
import type { CommandInput } from "./connection";
import { ConnectionContext, type ConnectionApi } from "./connection-context";

export function useConnection(): ConnectionApi {
  const api = useContext(ConnectionContext);
  if (!api) throw new Error("useConnection outside ConnectionProvider");
  return api;
}

/** send() that surfaces server errors as toasts. */
export function useCommand() {
  const { send } = useConnection();
  return async (command: CommandInput) => {
    const outcome = await send(command);
    if (!outcome.ok && outcome.code !== "rate_limited") {
      toast.error(outcome.message);
    }
    return outcome;
  };
}
