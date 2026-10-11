import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePrefs } from "@/lib/prefs";
import { Ambient } from "./ambient";

describe("Ambient", () => {
  beforeEach(() => usePrefs.getState().setReduceEffects(false));

  it("snows for the holidays and haunts Halloween", () => {
    const { rerender } = render(<Ambient season="winter" />);
    expect(screen.getByTestId("egg-ambient")).toHaveAttribute(
      "data-season",
      "winter",
    );
    expect(document.querySelectorAll(".egg-snow")).toHaveLength(14);
    rerender(<Ambient season="newyear" />);
    expect(document.querySelectorAll(".egg-snow")).toHaveLength(14);
    rerender(<Ambient season="halloween" />);
    expect(document.querySelectorAll(".egg-ghost")).toHaveLength(3);
    expect(document.querySelectorAll(".egg-snow")).toHaveLength(0);
    rerender(<Ambient season="fools" />);
    expect(screen.queryByTestId("egg-ambient")).toBeNull();
  });

  it("drops leaves and a turkey for Thanksgiving, shamrocks for St Patrick's", () => {
    const { rerender } = render(<Ambient season="thanksgiving" />);
    const leaves = document.querySelectorAll(".egg-snow");
    expect(leaves).toHaveLength(14);
    expect(leaves[0]).toHaveTextContent("🍂");
    expect(leaves[1]).toHaveTextContent("🍁");
    expect(document.querySelectorAll(".egg-ghost")).toHaveLength(1);
    expect(document.querySelector(".egg-ghost")).toHaveTextContent("🦃");
    rerender(<Ambient season="stpatricks" />);
    expect(document.querySelectorAll(".egg-snow")).toHaveLength(0);
    expect(document.querySelectorAll(".egg-ghost")).toHaveLength(3);
    expect(screen.getByTestId("egg-ambient")).toHaveTextContent("☘️");
  });

  it("sits still under reduce effects", () => {
    usePrefs.getState().setReduceEffects(true);
    const { rerender } = render(<Ambient season="halloween" />);
    expect(screen.getByTestId("egg-ambient")).toHaveTextContent("🎃");
    expect(document.querySelectorAll(".egg-ghost")).toHaveLength(0);
    rerender(<Ambient season="thanksgiving" />);
    expect(screen.getByTestId("egg-ambient")).toHaveTextContent("🦃");
    expect(document.querySelectorAll(".egg-snow")).toHaveLength(0);
  });
});
