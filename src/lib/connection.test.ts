import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@shared/protocol/messages";
import { GameConnection } from "./connection";
import type { ConnStatus } from "./store";

/** Minimal WebSocket double that the test drives by hand. */
class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  sent: string[] = [];
  url: string;
  binaryType = "blob";
  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000, reason = "") {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent("close", { code, reason }));
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  receive(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
  get onopen() {
    return null;
  }
  set onopen(_: unknown) {}
  set onclose(_: unknown) {}
  set onerror(_: unknown) {}
  set onmessage(_: unknown) {}
}

function setup() {
  const messages: ServerMessage[] = [];
  const statuses: ConnStatus[] = [];
  const events = new EventTarget() as EventTarget & {
    document?: { visibilityState: string };
  };
  events.document = { visibilityState: "visible" };
  const conn = new GameConnection({
    code: "BCDF",
    identity: () => ({ playerId: "p1", token: "t" }),
    onMessage: (m) => messages.push(m),
    onStatus: (s) => statuses.push(s),
    host: "localhost:1",
    protocol: "ws",
    WebSocket: FakeWebSocket,
    events,
    heartbeatMs: 1000,
    pongTimeoutMs: 300,
    wakePongTimeoutMs: 100,
    ackTimeoutMs: 2000,
  });
  const latest = () => FakeWebSocket.instances.at(-1)!;
  return { conn, messages, statuses, events, latest };
}

describe("GameConnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects with the identity in the query and reports status", async () => {
    const { conn, statuses, latest } = setup();
    await vi.advanceTimersByTimeAsync(10);
    expect(latest().url).toContain("/parties/game-room/BCDF?");
    expect(latest().url).toContain("playerId=p1");
    expect(latest().url).toContain("token=t");
    latest().open();
    expect(statuses).toEqual(["connecting", "open"]);
    conn.close();
    expect(statuses.at(-1)).toBe("closed");
  });

  it("resolves commands on ack and error, and stamps a cmdId", async () => {
    const { conn, latest } = setup();
    await vi.advanceTimersByTimeAsync(10);
    latest().open();
    const p1 = conn.send({ type: "game.start" });
    const p2 = conn.send({ type: "card.draw" });
    const sent = latest().sent.map(
      (s) => JSON.parse(s) as { cmdId: string; type: string },
    );
    expect(sent.map((s) => s.type)).toEqual(["game.start", "card.draw"]);
    expect(sent[0]!.cmdId).toHaveLength(26);
    latest().receive(
      JSON.stringify({ type: "ack", cmdId: sent[0]!.cmdId, version: 7 }),
    );
    latest().receive(
      JSON.stringify({
        type: "error",
        cmdId: sent[1]!.cmdId,
        code: "wrong_phase",
        message: "no",
      }),
    );
    await expect(p1).resolves.toEqual({ ok: true, version: 7 });
    await expect(p2).resolves.toEqual({
      ok: false,
      code: "wrong_phase",
      message: "no",
    });
    conn.close();
  });

  it("fails commands immediately when not connected", async () => {
    const { conn } = setup();
    await expect(conn.send({ type: "game.start" })).resolves.toMatchObject({
      ok: false,
    });
    conn.close();
  });

  it("pings on the heartbeat and reconnects when no pong arrives", async () => {
    const { conn, statuses, latest } = setup();
    await vi.advanceTimersByTimeAsync(10);
    const first = latest();
    first.open();
    await vi.advanceTimersByTimeAsync(1000);
    expect(first.sent).toEqual(["ping"]);
    first.receive("pong");
    await vi.advanceTimersByTimeAsync(1000);
    expect(first.sent).toEqual(["ping", "ping"]);
    // no pong this time → forced reconnect
    await vi.advanceTimersByTimeAsync(300);
    expect(statuses.at(-1)).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
    expect(latest()).not.toBe(first);
    conn.close();
  });

  it("reconnects right away when the page wakes with a dead socket", async () => {
    const { conn, statuses, events, latest } = setup();
    await vi.advanceTimersByTimeAsync(10);
    const first = latest();
    first.open();
    first.readyState = 3; // the OS killed it silently
    events.dispatchEvent(new Event("pageshow"));
    expect(statuses.at(-1)).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(300);
    expect(latest()).not.toBe(first);
    conn.close();
  });

  it("verifies an open socket on wake with a short pong deadline", async () => {
    const { conn, statuses, events, latest } = setup();
    await vi.advanceTimersByTimeAsync(10);
    const first = latest();
    first.open();
    events.dispatchEvent(new Event("visibilitychange"));
    expect(first.sent).toEqual(["ping"]);
    first.receive("pong");
    await vi.advanceTimersByTimeAsync(200);
    expect(statuses.at(-1)).toBe("open");
    events.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(100);
    expect(statuses.at(-1)).toBe("reconnecting");
    conn.close();
  });

  it("delivers parsed server messages", async () => {
    const { conn, messages, latest } = setup();
    await vi.advanceTimersByTimeAsync(10);
    latest().open();
    latest().receive(
      JSON.stringify({
        type: "event",
        version: 1,
        event: { type: "host.changed", hostId: "x" },
      }),
    );
    latest().receive("not json");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ type: "event", version: 1 });
    conn.close();
  });
});
