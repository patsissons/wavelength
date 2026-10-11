import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { firstGrapheme } from "@/lib/utils";
import { PlayerAvatar } from "./player-avatar";

const player = (name: string, avatar: string | null = null) => ({
  name,
  color: 2,
  avatar,
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
  it("renders the initial when no avatar is set", () => {
    const { container } = render(<PlayerAvatar player={player("Cid")} />);
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute(
      "data-avatar-kind",
      "initial",
    );
  });

  it("renders an emoji initial intact", () => {
    render(<PlayerAvatar player={player("🎯 Dee")} />);
    expect(screen.getByText("🎯")).toBeInTheDocument();
  });

  it("shows an emoji avatar instead of the initial", () => {
    const { container } = render(<PlayerAvatar player={player("Cid", "🦊")} />);
    expect(screen.getByText("🦊")).toBeInTheDocument();
    expect(screen.queryByText("C")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-avatar", "🦊");
    expect(container.firstElementChild).toHaveAttribute(
      "data-avatar-kind",
      "emoji",
    );
  });

  it("shows a catalog character with its prop and animation", () => {
    const { container } = render(
      <PlayerAvatar player={player("Cid", "dancing-unicorn")} />,
    );
    expect(screen.getByText("🦄")).toBeInTheDocument();
    expect(screen.getByText("✨")).toBeInTheDocument();
    expect(screen.queryByText("C")).toBeNull();
    expect(container.querySelector(".avatar-body")).toHaveAttribute(
      "data-anim",
      "dance",
    );
    expect(container.querySelector(".avatar-prop-glyph")).toHaveAttribute(
      "data-prop-anim",
      "sparkle",
    );
    expect(container.querySelector("[data-avatar-id]")).toHaveAttribute(
      "title",
      "Dancing unicorn",
    );
  });

  it("treats an unknown id as the initial rather than crashing", () => {
    // Not reachable through the server (ids are validated), but a stale
    // bundle could meet a newer catalog.
    render(<PlayerAvatar player={player("Cid", "future-avatar")} />);
    expect(screen.getByText("future-avatar")).toBeInTheDocument();
  });
});
