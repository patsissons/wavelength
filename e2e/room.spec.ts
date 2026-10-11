import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

async function createGame(request: APIRequestContext, name: string) {
  const res = await request.post("/api/games", { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    code: string;
    playerId: string;
    token: string;
  };
}

async function joinGame(
  request: APIRequestContext,
  code: string,
  name: string,
) {
  const res = await request.post(`/api/games/${code}/join`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as {
    code: string;
    playerId: string;
    token: string;
    phase: string;
  };
}

/** Open a raw WebSocket from the page and collect the first N messages. */
async function openSocket(
  page: Page,
  code: string,
  playerId: string,
  token: string,
  count: number,
) {
  return page.evaluate(
    ({ code, playerId, token, count }) =>
      new Promise<{ messages: unknown[]; closeCode: number | null }>(
        (resolve) => {
          const proto = location.protocol === "https:" ? "wss" : "ws";
          const ws = new WebSocket(
            `${proto}://${location.host}/parties/game-room/${code}?playerId=${playerId}&token=${token}`,
          );
          const messages: unknown[] = [];
          let closeCode: number | null = null;
          const done = () => resolve({ messages, closeCode });
          ws.onmessage = (event) => {
            const message = JSON.parse(event.data as string) as {
              type: string;
            };
            messages.push(message);
            if (messages.length >= count) {
              ws.close();
              done();
            }
          };
          ws.onclose = (event) => {
            closeCode = event.code;
            done();
          };
          setTimeout(done, 5000);
        },
      ),
    { code, playerId, token, count },
  );
}

test("create, join and status over HTTP", async ({ request }) => {
  const host = await createGame(request, "Host");
  expect(host.code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  const guest = await joinGame(request, host.code.toLowerCase(), "Guest");
  expect(guest.phase).toBe("lobby");
  const status = await request.get(`/api/games/${host.code}`);
  expect(await status.json()).toMatchObject({
    exists: true,
    phase: "lobby",
    playerCount: 2,
  });
  const missing = await request.get("/api/games/ZZZZ");
  expect(missing.status()).toBe(404);
  const badName = await request.post("/api/games", { data: { name: "   " } });
  expect(badName.status()).toBe(400);
});

test("websocket sends a snapshot to a valid player and rejects a bad token", async ({
  page,
  request,
}) => {
  const host = await createGame(request, "Host");
  const guest = await joinGame(request, host.code, "Guest");
  await page.goto("/");

  const ok = await openSocket(page, host.code, guest.playerId, guest.token, 1);
  expect(ok.messages[0]).toMatchObject({
    type: "snapshot",
    you: { playerId: guest.playerId, target: null },
    state: { code: host.code, phase: "lobby", hostId: host.playerId },
  });
  const snapshot = ok.messages[0] as {
    state: { players: Record<string, { name: string }> };
  };
  expect(
    Object.values(snapshot.state.players)
      .map((p) => p.name)
      .sort(),
  ).toEqual(["Guest", "Host"]);

  const bad = await openSocket(page, host.code, guest.playerId, "wrong", 1);
  expect(bad.messages[0]).toMatchObject({
    type: "error",
    code: "unauthorized",
  });
});
