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
    rerender(<Ambient season="fools" />);
    expect(screen.queryByTestId("egg-ambient")).toBeNull();
  });

  it("sits still under reduce effects", () => {
    usePrefs.getState().setReduceEffects(true);
    render(<Ambient season="halloween" />);
    expect(screen.getByTestId("egg-ambient")).toHaveTextContent("🎃");
    expect(document.querySelectorAll(".egg-ghost")).toHaveLength(0);
  });
});
