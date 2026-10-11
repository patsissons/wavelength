import { describe, expect, it } from "vitest";
import {
  clearIdentity,
  lastName,
  loadIdentity,
  saveIdentity,
} from "./identity";

describe("identity", () => {
  it("round-trips per game code and remembers the last name", () => {
    expect(loadIdentity("BCDF")).toBeNull();
    saveIdentity("BCDF", { playerId: "p1", token: "t", name: "Ann" });
    expect(loadIdentity("BCDF")).toEqual({
      playerId: "p1",
      token: "t",
      name: "Ann",
    });
    expect(loadIdentity("GHJK")).toBeNull();
    expect(lastName()).toBe("Ann");
    clearIdentity("BCDF");
    expect(loadIdentity("BCDF")).toBeNull();
  });
});
