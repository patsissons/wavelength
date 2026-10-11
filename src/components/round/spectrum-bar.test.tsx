import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpectrumBar } from "./spectrum-bar";

describe("SpectrumBar", () => {
  it("shows placeholders over a gradient before the card is drawn", () => {
    render(<SpectrumBar spectrum={null} target={null} />);
    expect(screen.getByTestId("spectrum")).toHaveTextContent("??");
    expect(screen.getByTestId("spectrum")).not.toHaveAttribute("data-known");
    expect(screen.getByTestId("wedge-strip")).toHaveAttribute(
      "data-fill",
      "gradient",
    );
  });

  it("labels both ends and keeps the gradient while the target is secret", () => {
    render(
      <SpectrumBar spectrum={{ left: "Cold", right: "Hot" }} target={null} />,
    );
    expect(screen.getByText("Cold")).toBeInTheDocument();
    expect(screen.getByText("Hot")).toBeInTheDocument();
    expect(screen.queryByTestId("strip-wedge-4")).toBeNull();
  });

  it("draws the wedge for whoever knows the target", () => {
    render(
      <SpectrumBar spectrum={{ left: "Cold", right: "Hot" }} target={0.4} />,
    );
    expect(screen.getByTestId("spectrum")).toHaveAttribute(
      "data-known",
      "true",
    );
    expect(screen.getByTestId("wedge-strip")).toHaveAttribute(
      "data-target",
      "0.4000",
    );
    expect(screen.getByTestId("strip-wedge-4")).toBeInTheDocument();
  });
});
