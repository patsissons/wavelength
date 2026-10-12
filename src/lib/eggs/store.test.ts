import { beforeEach, describe, expect, it } from "vitest";

const KEY = "wavelength:eggs";

async function load() {
  const { useEggs } = await import("./store");
  return useEggs;
}

describe("egg modes", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("start off and persist each change to sessionStorage", async () => {
    const useEggs = await load();
    useEggs.getState().reset();
    expect(useEggs.getState().crt).toBe(false);
    expect(useEggs.getState().pet).toBeNull();
    useEggs.getState().set({ crt: true, pet: "🐈" });
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({
      crt: true,
      pet: "🐈",
      party: false,
    });
    useEggs.getState().reset();
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toMatchObject({
      crt: false,
      pet: null,
    });
  });

  it("validates what it reads back", async () => {
    const { vi } = await import("vitest");
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        crt: "yes",
        pet: 7,
        season: "bogus",
        disco: true,
        coins: "7",
      }),
    );
    vi.resetModules();
    const useEggs = await load();
    const s = useEggs.getState();
    expect(s.crt).toBe(false);
    expect(s.pet).toBeNull();
    expect(s.season).toBeNull();
    expect(s.disco).toBe(true);
    expect(s.coins).toBe(0);

    sessionStorage.setItem(KEY, "{not json");
    vi.resetModules();
    const again = await load();
    expect(again.getState().disco).toBe(false);
  });
});
