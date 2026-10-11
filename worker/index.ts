import { routePartykitRequest } from "partyserver";
import { handleApi } from "./api";

export { GameRoom } from "./room/game-room";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }
    if (url.pathname.startsWith("/parties/")) {
      const response = await routePartykitRequest(request, env);
      return response ?? new Response("not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
