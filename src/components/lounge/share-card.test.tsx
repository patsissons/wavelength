import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareCard } from "./share-card";

describe("ShareCard", () => {
  it("mirrors a palindromic code", () => {
    const { rerender } = render(<ShareCard code="BCDF" />);
    expect(screen.getByTestId("game-code")).toHaveTextContent("BCDF");
    expect(screen.queryByTestId("egg-palindrome")).toBeNull();
    rerender(<ShareCard code="BCCB" />);
    expect(screen.getByTestId("egg-palindrome")).toHaveTextContent("🪞");
  });
});
