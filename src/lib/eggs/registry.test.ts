import { describe, expect, it } from "vitest";
import { EGGS, eggById, howFor, menuText } from "./registry";

describe("egg registry", () => {
  it("lists unique eggs that each say how and what", () => {
    const ids = EGGS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const egg of EGGS) {
      expect(egg.name.trim()).not.toBe("");
      expect(egg.how.trim()).not.toBe("");
      expect(egg.what.trim()).not.toBe("");
      if (egg.api) expect(egg.api).toMatch(/^wavelength\./);
    }
    expect(eggById("menu")?.api).toBe("wavelength.list()");
    expect(eggById("nope")).toBeUndefined();
  });

  it("words the trigger for the platform and knows the console-only ones", () => {
    const konami = eggById("konami")!;
    expect(howFor(konami, "desktop")).toContain("keyboard");
    expect(howFor(konami, "ios")).toContain("swipe");
    expect(howFor(konami, "android")).toContain("swipe");
    const sheet = eggById("cheatsheet")!;
    expect(howFor(sheet, "ios")).toBe(howFor(sheet, "desktop"));
    expect(sheet.how).toContain("QR code five times");
    for (const egg of EGGS) {
      if (egg.consoleOnly) expect(egg.api).toBeDefined();
    }
    expect(eggById("rain")?.consoleOnly).toBeUndefined();
    expect(eggById("rain")?.how).toContain("avatar");
    expect(eggById("pet")?.how).toContain("hold");
    expect(eggById("titlewave")?.consoleOnly).toBeUndefined();
  });

  it("prints every egg in the menu", () => {
    const text = menuText();
    expect(text.startsWith("Wavelength easter eggs")).toBe(true);
    for (const egg of EGGS) {
      expect(text).toContain(egg.name);
      expect(text).toContain(egg.how);
      expect(text).toContain(egg.what);
      if (egg.api) expect(text).toContain(egg.api);
    }
    expect(text).toContain("Reduce effects");
  });
});
