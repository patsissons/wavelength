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

  it("renders the tagline", () => {
    render(<App />);
    expect(screen.getByText(/read your friends' minds/i)).toBeInTheDocument();
  });
});
