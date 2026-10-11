import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the title", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Wavelength" }),
    ).toBeInTheDocument();
  });

  it("renders the host and join forms", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: "Host a game" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeInTheDocument();
  });
});
