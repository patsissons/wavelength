import { getServerByName } from "partyserver";
import { NameSchema } from "@shared/protocol/messages";
import { secureRandom } from "@shared/util/random";
import { generateCode, normalizeCode } from "./room/codes";

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

const CREATE_ATTEMPTS = 5;

export async function handleApi(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const path = url.pathname;
  if (path === "/api/health") return json({ ok: true });

  if (path === "/api/games" && request.method === "POST") {
    const name = await readName(request);
    if (!name) return json({ error: "invalid_name" }, { status: 400 });
    for (let i = 0; i < CREATE_ATTEMPTS; i++) {
      const code = generateCode(secureRandom);
      const room = await getServerByName(env.GameRoom, code);
      const result = await room.create({ hostName: name });
      if (result.ok) {
        return json({ code, playerId: result.playerId, token: result.token });
      }
    }
    return json({ error: "no_codes" }, { status: 503 });
  }

  const match = path.match(/^\/api\/games\/([A-Za-z]+)(\/join)?$/);
  if (match) {
    const code = normalizeCode(match[1]!);
    if (code.length !== 4)
      return json({ error: "invalid_code" }, { status: 400 });
    const room = await getServerByName(env.GameRoom, code);
    if (match[2] && request.method === "POST") {
      const name = await readName(request);
      if (!name) return json({ error: "invalid_name" }, { status: 400 });
      const result = await room.join({ name });
      if (!result.ok) {
        const status = result.code === "no_game" ? 404 : 409;
        return json({ error: result.code }, { status });
      }
      return json({
        code,
        playerId: result.playerId,
        token: result.token,
        phase: result.phase,
      });
    }
    if (!match[2] && request.method === "GET") {
      const status = await room.status();
      return json({ code, ...status }, { status: status.exists ? 200 : 404 });
    }
  }

  return json({ error: "not_found" }, { status: 404 });
}

async function readName(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json();
    const name =
      typeof body === "object" && body !== null && "name" in body
        ? (body as { name: unknown }).name
        : null;
    const parsed = NameSchema.safeParse(name);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
