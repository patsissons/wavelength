import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareCard, ShareStrip } from "./share-card";

describe("ShareCard", () => {
  it("mirrors a palindromic code", () => {
    const { rerender } = render(<ShareCard code="BCDF" />);
    expect(screen.getByTestId("game-code")).toHaveTextContent("BCDF");
    expect(screen.queryByTestId("egg-palindrome")).toBeNull();
    rerender(<ShareCard code="BCCB" />);
    expect(screen.getByTestId("egg-palindrome")).toHaveTextContent("🪞");
  });

  it("opens the easter-egg cheat sheet after five quick taps on the QR code", () => {
    render(<ShareStrip code="BCDF" />);
    const qr = screen.getByTestId("qr-code");
    for (let i = 0; i < 4; i++) fireEvent.click(qr);
    expect(screen.queryByTestId("egg-cheatsheet")).toBeNull();
    fireEvent.click(qr);
    expect(screen.getByTestId("egg-cheatsheet")).toBeInTheDocument();
    expect(screen.getByTestId("egg-list")).toHaveTextContent("Konami code");
  });
});
