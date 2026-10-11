import { beforeEach, describe, expect, it, vi } from "vitest";

// partyserver imports "cloudflare:workers", which only exists in workerd.
// Replace getServerByName with an in-memory fake room.
const rooms = new Map<string, FakeRoom>();
class FakeRoom {
  created = false;
  players = 0;
  async create({ hostName }: { hostName: string }) {
    if (this.created) return { ok: false as const, code: "invalid" as const };
    this.created = true;
    this.players = 1;
    return { ok: true as const, playerId: `host-${hostName}`, token: "t" };
  }
  async join({ name }: { name: string }) {
    if (!this.created) return { ok: false as const, code: "no_game" as const };
    this.players += 1;
    return {
      ok: true as const,
      playerId: `p-${name}`,
      token: "t",
      phase: "lobby",
    };
  }
  async status() {
    return {
      exists: this.created,
      phase: this.created ? "lobby" : null,
      playerCount: this.players,
      mode: this.created ? "teams" : null,
    };
  }
}
vi.mock("partyserver", () => ({
  getServerByName: async (_ns: unknown, name: string) => {
    let room = rooms.get(name);
    if (!room) {
      room = new FakeRoom();
      rooms.set(name, room);
    }
    return room;
  },
}));

const { handleApi } = await import("./api");
const env = { GameRoom: {} } as unknown as Env;

function call(path: string, init?: RequestInit) {
  const url = new URL(`http://localhost${path}`);
  return handleApi(new Request(url, init), env, url);
}

const post = (path: string, body: unknown) =>
  call(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("handleApi", () => {
  beforeEach(() => rooms.clear());

  it("answers the health check", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 404 for unknown routes", async () => {
    const res = await call("/api/nope");
    expect(res.status).toBe(404);
  });

  it("creates a game, joins it and reports status", async () => {
    const created = await post("/api/games", { name: "Ann" });
    expect(created.status).toBe(200);
    const { code, playerId, token } = (await created.json()) as {
      code: string;
      playerId: string;
      token: string;
    };
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    expect(playerId).toBe("host-Ann");
    expect(token).toBe("t");

    const joined = await post(`/api/games/${code.toLowerCase()}/join`, {
      name: "Bob",
    });
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({
      code,
      playerId: "p-Bob",
      phase: "lobby",
    });

    const status = await call(`/api/games/${code}`);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      code,
      exists: true,
      playerCount: 2,
    });
  });

  it("rejects bad names, bad codes and unknown rooms", async () => {
    expect((await post("/api/games", { name: "" })).status).toBe(400);
    expect((await post("/api/games", "garbage")).status).toBe(400);
    expect((await post("/api/games/AB/join", { name: "x" })).status).toBe(400);
    expect((await call("/api/games/ZZZZ")).status).toBe(404);
    expect((await post("/api/games/ZZZZ/join", { name: "Bob" })).status).toBe(
      404,
    );
  });
});
