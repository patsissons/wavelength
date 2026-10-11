import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { firstGrapheme } from "@/lib/utils";
import { PlayerAvatar } from "./player-avatar";

const player = (name: string) => ({
  name,
  color: 2,
  away: false,
  connected: true,
});

describe("firstGrapheme", () => {
  it("upper-cases a plain initial", () => {
    expect(firstGrapheme("ann")).toBe("A");
    expect(firstGrapheme("  bob")).toBe("B");
  });

  it("keeps a whole emoji together", () => {
    expect(firstGrapheme("🦄 Uni")).toBe("🦄");
    expect(firstGrapheme("👩‍🚀 Sam")).toBe("👩‍🚀");
    expect(firstGrapheme("👍🏽ok")).toBe("👍🏽");
  });

  it("falls back to ? for an empty name", () => {
    expect(firstGrapheme("   ")).toBe("?");
  });
});

describe("PlayerAvatar", () => {
  it("renders the initial", () => {
    render(<PlayerAvatar player={player("Cid")} />);
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("renders an emoji initial intact", () => {
    render(<PlayerAvatar player={player("🎯 Dee")} />);
    expect(screen.getByText("🎯")).toBeInTheDocument();
  });
});
