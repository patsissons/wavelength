import { getServerByName } from "partyserver";
import { AvatarSchema, NameSchema } from "@shared/protocol/messages";
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
    const who = await readPlayer(request);
    if (!who) return json({ error: "invalid_name" }, { status: 400 });
    for (let i = 0; i < CREATE_ATTEMPTS; i++) {
      const code = generateCode(secureRandom);
      const room = await getServerByName(env.GameRoom, code);
      const result = await room.create({
        hostName: who.name,
        hostAvatar: who.avatar,
      });
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
      const who = await readPlayer(request);
      if (!who) return json({ error: "invalid_name" }, { status: 400 });
      const result = await room.join(who);
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

/** `{ name, avatar? }` from the request body; null when the name is invalid. */
async function readPlayer(
  request: Request,
): Promise<{ name: string; avatar: string | null } | null> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) return null;
    const { name, avatar } = body as { name?: unknown; avatar?: unknown };
    const parsedName = NameSchema.safeParse(name);
    if (!parsedName.success) return null;
    // A bad avatar is not worth refusing the join over; it just falls back.
    const parsedAvatar = AvatarSchema.safeParse(avatar ?? null);
    return {
      name: parsedName.data,
      avatar: parsedAvatar.success ? parsedAvatar.data : null,
    };
  } catch {
    return null;
  }
}
