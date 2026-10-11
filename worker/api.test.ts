import { describe, expect, it } from "vitest";
import { handleApi } from "./api";

const env = {} as Env;

describe("handleApi", () => {
  it("answers the health check", async () => {
    const url = new URL("http://localhost/api/health");
    const res = await handleApi(new Request(url), env, url);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 404 for unknown routes", async () => {
    const url = new URL("http://localhost/api/nope");
    const res = await handleApi(new Request(url), env, url);
    expect(res.status).toBe(404);
  });
});
