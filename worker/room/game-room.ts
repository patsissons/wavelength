import { Server, type Connection, type ConnectionContext } from "partyserver";
import {
  connectPlayer,
  createGame,
  disconnectPlayer,
  expireGrace,
  handleCommand,
  joinGame,
  type PrivateMessage,
  type ServerState,
} from "@shared/game/commands";
import { canSendEffect } from "@shared/effects/catalog";
import { applyEvent } from "@shared/game/reducer";
import { roleOf } from "@shared/game/selectors";
import type { GameEvent } from "@shared/protocol/events";
import {
  PING,
  PONG,
  isCommand,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from "@shared/protocol/messages";
import { randomHex, ulid } from "@shared/util/id";
import { mulberry32, secureRandom, seedFromString } from "@shared/util/random";
import { DEFAULT_GRACE_MS, ROOM_TTL_MS, nextAlarmAt } from "./alarms";
import { sha256Hex, verifyToken } from "./auth";
import { EFFECT_LIMITS, TokenBucket } from "./rate-limit";

interface ConnState {
  playerId: string;
}

const STATE_KEY = "state";
const CMD_RING = 20;

/**
 * One Durable Object per game code. Holds the authoritative state, applies
 * commands through the shared handler, persists after every command and
 * broadcasts the resulting events. WebSockets use the hibernation API so an
 * idle room costs nothing; "ping" frames are answered by the runtime without
 * waking the object.
 */
export class GameRoom extends Server<Env> {
  static options = { hibernate: true };

  #state: ServerState | null = null;
  #playerBuckets = new Map<string, TokenBucket>();
  #roomBucket = new TokenBucket(
    EFFECT_LIMITS.room.capacity,
    EFFECT_LIMITS.room.perMs,
  );

  async onStart() {
    this.#state = (await this.ctx.storage.get<ServerState>(STATE_KEY)) ?? null;
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(PING, PONG),
    );
  }

  /* ---------- RPC from the Worker (see worker/api.ts) ---------- */

  async create(input: {
    hostName: string;
  }): Promise<
    | { ok: true; playerId: string; token: string }
    | { ok: false; code: ErrorCode }
  > {
    const now = Date.now();
    if (this.#state && now - this.#state.lastActivityAt < ROOM_TTL_MS) {
      return { ok: false, code: "invalid" };
    }
    const playerId = ulid(now);
    const token = randomHex(32);
    this.#state = createGame({
      code: this.name,
      hostId: playerId,
      hostName: input.hostName,
      hostTokenHash: await sha256Hex(token),
      now,
    });
    await this.#persist();
    await this.#scheduleAlarm();
    return { ok: true, playerId, token };
  }

  async join(input: {
    name: string;
  }): Promise<
    | { ok: true; playerId: string; token: string; phase: string }
    | { ok: false; code: ErrorCode }
  > {
    const state = this.#state;
    if (!state) return { ok: false, code: "no_game" };
    const now = Date.now();
    const playerId = ulid(now);
    const token = randomHex(32);
    const result = joinGame(state, {
      playerId,
      name: input.name,
      tokenHash: await sha256Hex(token),
    });
    if (!result.ok) return { ok: false, code: result.code };
    this.#state = { ...state, secret: result.secret, lastActivityAt: now };
    this.#applyAndBroadcast(result.events);
    await this.#persist();
    return { ok: true, playerId, token, phase: this.#state.game.phase };
  }

  status(): {
    exists: boolean;
    phase: string | null;
    playerCount: number;
    mode: string | null;
  } {
    const game = this.#state?.game;
    if (!game)
      return { exists: false, phase: null, playerCount: 0, mode: null };
    return {
      exists: true,
      phase: game.phase,
      playerCount: Object.keys(game.players).length,
      mode: game.settings.mode,
    };
  }

  /* ---------- Connections ---------- */

  getConnectionTags(_connection: Connection, ctx: ConnectionContext): string[] {
    const playerId = new URL(ctx.request.url).searchParams.get("playerId");
    return playerId ? [tagFor(playerId)] : [];
  }

  async onConnect(connection: Connection<ConnState>, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get("playerId");
    const token = url.searchParams.get("token");
    const state = this.#state;
    if (
      !state ||
      !playerId ||
      !(await verifyToken(state.secret.tokens, playerId, token))
    ) {
      this.#send(connection, {
        type: "error",
        code: state ? "unauthorized" : "no_game",
        message: state ? "invalid player token" : "no such game",
      });
      // The error frame is what clients act on (they close and drop their
      // stored identity); the close itself may not complete locally.
      connection.close(4401, "unauthorized");
      return;
    }
    connection.setState({ playerId });
    // The snapshot already reflects the connected state, so the new socket
    // does not also need the presence event.
    this.#applyAndBroadcast(
      connectPlayer(state.game, playerId),
      [],
      [connection.id],
    );
    this.#touch();
    this.#sendSnapshot(connection, playerId);
    await this.#persist();
    await this.#scheduleAlarm();
  }

  async onMessage(connection: Connection<ConnState>, raw: unknown) {
    if (typeof raw !== "string") return;
    const playerId = connection.state?.playerId;
    const state = this.#state;
    if (!playerId || !state) return;
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.#send(connection, {
        type: "error",
        code: "bad_message",
        message: parsed.error,
      });
      return;
    }
    const message = parsed.message;
    if (!isCommand(message)) {
      this.#handleEphemeral(connection, playerId, message);
      return;
    }

    const ring = state.secret.lastCmdIds[playerId] ?? [];
    if (ring.includes(message.cmdId)) {
      this.#send(connection, {
        type: "ack",
        cmdId: message.cmdId,
        version: state.game.version,
      });
      return;
    }

    if (message.type === "effect.send") {
      this.#handleEffect(connection, playerId, message.cmdId, message.effectId);
      return;
    }

    const now = Date.now();
    const result = handleCommand(state, message, {
      playerId,
      now,
      random: this.#random(),
    });
    if (!result.ok) {
      this.#send(connection, {
        type: "error",
        cmdId: message.cmdId,
        code: result.code,
        message: result.message,
      });
      return;
    }
    this.#state = {
      ...state,
      secret: {
        ...result.secret,
        lastCmdIds: {
          ...result.secret.lastCmdIds,
          [playerId]: [...ring, message.cmdId].slice(-CMD_RING),
        },
      },
      lastActivityAt: now,
    };
    this.#applyAndBroadcast(result.events, result.privates);
    this.#send(connection, {
      type: "ack",
      cmdId: message.cmdId,
      version: this.#state.game.version,
    });
    if (message.type === "host.kick") this.#evict(message.playerId);
    await this.#persist();
    await this.#scheduleAlarm();
  }

  /** Tell a removed player's sockets to drop their seat and close them. */
  #evict(playerId: string) {
    for (const connection of this.getConnections(tagFor(playerId))) {
      this.#send(connection, {
        type: "error",
        code: "unauthorized",
        message: "removed by the host",
      });
      connection.close(4403, "kicked");
    }
  }

  async onClose(connection: Connection<ConnState>) {
    const playerId = connection.state?.playerId;
    const state = this.#state;
    if (!playerId || !state) return;
    for (const other of this.getConnections(tagFor(playerId))) {
      if (other.id !== connection.id && other.readyState === WebSocket.OPEN)
        return; // another tab still holds the seat
    }
    this.#applyAndBroadcast(disconnectPlayer(state.game, playerId, Date.now()));
    await this.#persist();
    await this.#scheduleAlarm();
  }

  async onError(connection: Connection<ConnState>, error: unknown) {
    console.error(`socket error for ${connection.state?.playerId}:`, error);
  }

  async onAlarm() {
    const state = this.#state;
    if (!state) return;
    const now = Date.now();
    if (now - state.lastActivityAt >= ROOM_TTL_MS) {
      await this.ctx.storage.deleteAll();
      this.#state = null;
      for (const connection of this.getConnections()) {
        connection.close(4410, "room expired");
      }
      return;
    }
    const { events } = expireGrace(state, now, this.#graceMs());
    this.#applyAndBroadcast(events);
    await this.#persist();
    await this.#scheduleAlarm();
  }

  /* ---------- Ephemerals & effects ---------- */

  #handleEphemeral(
    connection: Connection<ConnState>,
    playerId: string,
    message: Exclude<ClientMessage, { cmdId: string }>,
  ) {
    const game = this.#state!.game;
    switch (message.type) {
      case "resync":
        this.#sendSnapshot(connection, playerId);
        return;
      case "dial.move": {
        const dial = game.round?.dials[message.dialId];
        if (
          game.phase !== "guessing" ||
          !dial ||
          dial.locked ||
          !dial.owners.includes(playerId)
        )
          return;
        this.#broadcast(
          {
            type: "ephemeral",
            payload: {
              kind: "dial.live",
              dialId: dial.id,
              position: message.position,
              by: playerId,
            },
          },
          [connection.id],
        );
        return;
      }
      case "shroud":
        if (game.round?.psychicId !== playerId) return;
        this.#broadcast(
          {
            type: "ephemeral",
            payload: { kind: "shroud", open: message.open, by: playerId },
          },
          [connection.id],
        );
        return;
    }
  }

  #handleEffect(
    connection: Connection<ConnState>,
    playerId: string,
    cmdId: string,
    effectId: string,
  ) {
    const game = this.#state!.game;
    const now = Date.now();
    if (!canSendEffect(game, playerId, effectId)) {
      this.#send(connection, {
        type: "error",
        cmdId,
        code: "not_allowed",
        message: game.settings.effects
          ? "that effect isn't yours to send"
          : "effects are off",
      });
      return;
    }
    let bucket = this.#playerBuckets.get(playerId);
    if (!bucket) {
      bucket = new TokenBucket(
        EFFECT_LIMITS.player.capacity,
        EFFECT_LIMITS.player.perMs,
        now,
      );
      this.#playerBuckets.set(playerId, bucket);
    }
    if (!bucket.take(now) || !this.#roomBucket.take(now)) {
      this.#send(connection, {
        type: "error",
        cmdId,
        code: "rate_limited",
        message: "slow down",
      });
      return;
    }
    this.#broadcast({
      type: "ephemeral",
      payload: { kind: "effect", effectId, from: playerId, nonce: cmdId },
    });
    this.#send(connection, { type: "ack", cmdId, version: game.version });
  }

  /* ---------- Plumbing ---------- */

  #applyAndBroadcast(
    events: GameEvent[],
    privates: PrivateMessage[] = [],
    without?: string[],
  ) {
    const state = this.#state;
    if (!state) return;
    let game = state.game;
    for (const event of events) {
      game = applyEvent(game, event);
      this.#broadcast({ type: "event", version: game.version, event }, without);
    }
    this.#state = { ...state, game };
    for (const { playerId, message } of privates) {
      for (const connection of this.getConnections(tagFor(playerId))) {
        this.#send(connection, message);
      }
    }
  }

  #sendSnapshot(connection: Connection, playerId: string) {
    const state = this.#state!;
    const target =
      roleOf(state.game, playerId) === "psychic" ? state.secret.target : null;
    this.#send(connection, {
      type: "snapshot",
      state: state.game,
      you: { playerId, target },
    });
  }

  #send(connection: Connection, message: ServerMessage) {
    try {
      connection.send(JSON.stringify(message));
    } catch (err) {
      console.warn("send failed", err);
    }
  }

  #broadcast(message: ServerMessage, without?: string[]) {
    this.broadcast(JSON.stringify(message), without);
  }

  #touch() {
    if (this.#state)
      this.#state = { ...this.#state, lastActivityAt: Date.now() };
  }

  async #persist() {
    if (this.#state) await this.ctx.storage.put(STATE_KEY, this.#state);
  }

  async #scheduleAlarm() {
    const state = this.#state;
    if (!state) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const at = nextAlarmAt(state.game, state.lastActivityAt, this.#graceMs());
    await this.ctx.storage.setAlarm(at);
  }

  #graceMs(): number {
    const raw = Number(this.env.GRACE_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GRACE_MS;
  }

  /**
   * Random source for one command. With GAME_SEED set (e2e), the sequence is
   * derived from the seed, the room and the state version, so runs are
   * reproducible and survive hibernation.
   */
  #random(): () => number {
    const seed = this.env.GAME_SEED;
    if (!seed) return secureRandom;
    const version = this.#state?.game.version ?? 0;
    return mulberry32(seedFromString(`${seed}:${this.name}:${version}`));
  }
}

function tagFor(playerId: string): string {
  return `p:${playerId}`;
}
