import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WedgeStrip } from "./wedge-strip";

const spectrum = { left: "Cold", right: "Hot" };

describe("WedgeStrip", () => {
  it("draws the five scoring bands around the target with the labels", () => {
    render(<WedgeStrip target={0.5} spectrum={spectrum} />);
    expect(screen.getByTestId("wedge-strip")).toHaveAttribute(
      "data-target",
      "0.5000",
    );
    expect(screen.getAllByTestId("strip-wedge-4")).toHaveLength(1);
    expect(screen.getAllByTestId("strip-wedge-3")).toHaveLength(2);
    expect(screen.getAllByTestId("strip-wedge-2")).toHaveLength(2);
    expect(screen.getByText("Cold")).toBeInTheDocument();
    expect(screen.getByText("Hot")).toBeInTheDocument();
  });

  it("hides the wedge without a target and draws markers instead of labels", () => {
    render(
      <WedgeStrip
        target={null}
        spectrum={spectrum}
        markers={[{ id: "bob", position: 0.2, color: "red", label: "B" }]}
      />,
    );
    expect(screen.queryByTestId("strip-wedge-4")).toBeNull();
    expect(screen.getByTestId("strip-marker-bob")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("Cold")).toBeNull();
  });

  it("draws a gradient when the target is unknown and asked for one", () => {
    render(<WedgeStrip target={null} spectrum={null} fill="gradient" />);
    const strip = screen.getByTestId("wedge-strip");
    expect(strip).toHaveAttribute("data-fill", "gradient");
    expect(strip).not.toHaveAttribute("data-target");
    expect(strip.querySelector("linearGradient")).not.toBeNull();
    expect(screen.queryByTestId("strip-wedge-4")).toBeNull();
  });

  it("keeps the wheel colour (no gradient) once the target is known", () => {
    render(<WedgeStrip target={0.5} spectrum={null} fill="gradient" />);
    const strip = screen.getByTestId("wedge-strip");
    expect(strip).not.toHaveAttribute("data-fill");
    expect(strip.querySelector("linearGradient")).toBeNull();
    expect(screen.getAllByTestId("strip-wedge-4")).toHaveLength(1);
  });

  it("trims the viewBox to the bar when nothing sits above or below it", () => {
    const { rerender } = render(<WedgeStrip target={0.5} spectrum={null} />);
    const height = () =>
      Number(
        screen
          .getByTestId("wedge-strip")
          .getAttribute("viewBox")!
          .split(" ")[3],
      );
    const bare = height();
    rerender(<WedgeStrip target={0.5} spectrum={spectrum} />);
    expect(height()).toBeGreaterThan(bare);
    rerender(
      <WedgeStrip
        target={0.5}
        spectrum={null}
        markers={[{ id: "a", position: 0.1, color: "red" }]}
      />,
    );
    expect(height()).toBeGreaterThan(bare);
  });
});
