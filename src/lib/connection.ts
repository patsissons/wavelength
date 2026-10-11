import { PartySocket } from "partysocket";
import type {
  ClientMessage,
  Command,
  ErrorCode,
  ServerMessage,
} from "@shared/protocol/messages";
import { PING, PONG } from "@shared/protocol/messages";
import { ulid } from "@shared/util/id";
import type { ConnStatus } from "./store";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** A command without its idempotency id (stamped by send()). */
export type CommandInput = DistributiveOmit<Command, "cmdId">;

export type CommandOutcome =
  | { ok: true; version: number }
  | { ok: false; code: ErrorCode; message: string };

export interface ConnectionOptions {
  code: string;
  identity: () => { playerId: string; token: string } | null;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnStatus) => void;
  host?: string;
  protocol?: "ws" | "wss";
  /** Injectable for tests. */
  WebSocket?: unknown;
  /** Injectable event source for visibility/focus/online (defaults to window). */
  events?: EventTarget & { document?: { visibilityState: string } };
  heartbeatMs?: number;
  pongTimeoutMs?: number;
  wakePongTimeoutMs?: number;
  ackTimeoutMs?: number;
}

const WAKE_EVENTS = ["pageshow", "focus", "online"] as const;

/**
 * Resilient WebSocket client for one game room.
 *
 * partysocket reconnects with backoff; on top of that this class keeps a
 * heartbeat (a dead-but-"open" socket is the classic iOS background failure),
 * reconnects immediately when the page wakes up, tracks command acks and
 * stamps every command with an idempotency id.
 */
export class GameConnection {
  readonly socket: PartySocket;
  #opts: Required<
    Pick<
      ConnectionOptions,
      "heartbeatMs" | "pongTimeoutMs" | "wakePongTimeoutMs" | "ackTimeoutMs"
    >
  > &
    ConnectionOptions;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #pongTimer: ReturnType<typeof setTimeout> | null = null;
  #pending = new Map<
    string,
    {
      resolve: (o: CommandOutcome) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  #closed = false;
  #events: ConnectionOptions["events"];

  constructor(options: ConnectionOptions) {
    this.#opts = {
      heartbeatMs: 20_000,
      pongTimeoutMs: 5_000,
      wakePongTimeoutMs: 1_500,
      ackTimeoutMs: 10_000,
      ...options,
    };
    this.#events =
      options.events ??
      (typeof window !== "undefined" ? (window as never) : undefined);
    const host =
      options.host ??
      (typeof location !== "undefined" ? location.host : "localhost");
    const protocol =
      options.protocol ??
      (typeof location !== "undefined" && location.protocol === "https:"
        ? "wss"
        : "ws");
    this.socket = new PartySocket({
      host,
      protocol,
      party: "game-room",
      room: options.code,
      query: () => {
        const id = options.identity();
        return { playerId: id?.playerId, token: id?.token };
      },
      minReconnectionDelay: 250,
      maxReconnectionDelay: 5_000,
      reconnectionDelayGrowFactor: 1.6,
      connectionTimeout: 5_000,
      maxRetries: Infinity,
      // Never replay stale frames after a reconnect; the snapshot wins.
      maxEnqueuedMessages: 0,
      ...(options.WebSocket ? { WebSocket: options.WebSocket } : {}),
    });

    this.socket.addEventListener("open", this.#onOpen);
    this.socket.addEventListener("close", this.#onClose);
    this.socket.addEventListener("message", this.#onMessage);
    this.#listenForWake();
    options.onStatus("connecting");
  }

  get isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  /** Send a state-changing command; resolves with the server's ack/error. */
  send(command: CommandInput): Promise<CommandOutcome> {
    const cmdId = ulid();
    const message = { ...command, cmdId } as Command;
    return new Promise((resolve) => {
      if (!this.isOpen) {
        resolve({ ok: false, code: "bad_message", message: "not connected" });
        return;
      }
      const timer = setTimeout(() => {
        this.#pending.delete(cmdId);
        resolve({ ok: false, code: "bad_message", message: "timed out" });
      }, this.#opts.ackTimeoutMs);
      this.#pending.set(cmdId, { resolve, timer });
      this.socket.send(JSON.stringify(message));
    });
  }

  /** Fire-and-forget relay (dial moves, shroud peeks); dropped when offline. */
  sendEphemeral(message: Exclude<ClientMessage, { cmdId: string }>): void {
    if (!this.isOpen) return;
    this.socket.send(JSON.stringify(message));
  }

  resync(): void {
    this.sendEphemeral({ type: "resync" });
  }

  /** Force a fresh socket now, bypassing the backoff schedule. */
  reconnectNow(): void {
    if (this.#closed) return;
    this.#opts.onStatus("reconnecting");
    this.socket.reconnect();
  }

  /** Dev/test hook: simulate the OS killing the socket without a close event. */
  simulateDrop(): void {
    this.socket.reconnect(4000, "simulated drop");
  }

  close(): void {
    this.#closed = true;
    this.#stopHeartbeat();
    this.#events?.removeEventListener("visibilitychange", this.#onWake);
    for (const name of WAKE_EVENTS) {
      this.#events?.removeEventListener(name, this.#onWake);
    }
    for (const [, p] of this.#pending) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, code: "bad_message", message: "closed" });
    }
    this.#pending.clear();
    this.socket.close();
    this.#opts.onStatus("closed");
  }

  /* ---------- internals ---------- */

  #onOpen = () => {
    this.#opts.onStatus("open");
    this.#startHeartbeat();
  };

  #onClose = () => {
    this.#stopHeartbeat();
    if (!this.#closed) this.#opts.onStatus("reconnecting");
  };

  #onMessage = (event: MessageEvent) => {
    const data = event.data;
    if (typeof data !== "string") return;
    if (data === PONG) {
      this.#clearPongTimer();
      return;
    }
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === "ack" || (message.type === "error" && message.cmdId)) {
      const pending = this.#pending.get(message.cmdId!);
      if (pending) {
        clearTimeout(pending.timer);
        this.#pending.delete(message.cmdId!);
        pending.resolve(
          message.type === "ack"
            ? { ok: true, version: message.version }
            : { ok: false, code: message.code, message: message.message },
        );
      }
    }
    this.#opts.onMessage(message);
  };

  #listenForWake() {
    this.#events?.addEventListener("visibilitychange", this.#onWake);
    for (const name of WAKE_EVENTS) {
      this.#events?.addEventListener(name, this.#onWake);
    }
  }

  #onWake = (event: Event) => {
    if (this.#closed) return;
    if (
      event.type === "visibilitychange" &&
      this.#events?.document?.visibilityState !== "visible" &&
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    if (!this.isOpen) {
      this.reconnectNow();
      return;
    }
    // The socket claims to be open; prove it quickly or replace it.
    this.#ping(this.#opts.wakePongTimeoutMs);
  };

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.#heartbeat = setInterval(
      () => this.#ping(this.#opts.pongTimeoutMs),
      this.#opts.heartbeatMs,
    );
  }

  #stopHeartbeat() {
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
    this.#clearPongTimer();
  }

  #ping(timeoutMs: number) {
    if (!this.isOpen) {
      this.reconnectNow();
      return;
    }
    this.#clearPongTimer();
    this.socket.send(PING);
    this.#pongTimer = setTimeout(() => {
      this.#pongTimer = null;
      this.reconnectNow();
    }, timeoutMs);
  }

  #clearPongTimer() {
    if (this.#pongTimer) clearTimeout(this.#pongTimer);
    this.#pongTimer = null;
  }
}
