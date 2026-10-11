import { createContext } from "react";
import type { ClientMessage } from "@shared/protocol/messages";
import type { CommandInput, CommandOutcome } from "./connection";

export interface ConnectionApi {
  send: (command: CommandInput) => Promise<CommandOutcome>;
  sendEphemeral: (message: Exclude<ClientMessage, { cmdId: string }>) => void;
  reconnectNow: () => void;
}

export const ConnectionContext = createContext<ConnectionApi | null>(null);
