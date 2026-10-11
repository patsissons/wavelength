import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CY, VIEW, positionToPoint } from "@shared/game/geometry";
import { Board } from "./board";

const WIDTH = 400;
const HEIGHT = (VIEW.height / VIEW.width) * WIDTH;

function mockRect() {
  vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: WIDTH,
    height: HEIGHT,
    right: WIDTH,
    bottom: HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function pointer(
  type: string,
  x: number,
  y: number,
  extra: Record<string, unknown> = {},
) {
  fireEvent(
    screen.getByTestId("board"),
    new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, ...extra }),
  );
}

describe("Board", () => {
  it("renders dials, the wedge and the shroud state", () => {
    render(
      <Board
        target={0.5}
        shroudOpen
        dials={[
          { id: "shared", position: 0.25, color: "red", emphasized: true },
          { id: "p2", position: 0.75, color: "blue", locked: true },
        ]}
      />,
    );
    expect(screen.getByTestId("dial-shared")).toHaveAttribute(
      "data-position",
      "0.2500",
    );
    expect(screen.getByTestId("dial-p2")).toHaveAttribute(
      "data-position",
      "0.7500",
    );
    expect(screen.getByTestId("wedge-4")).toBeInTheDocument();
    expect(screen.getAllByTestId("wedge-2")).toHaveLength(2);
    expect(screen.getByTestId("shroud")).toHaveAttribute("data-open", "true");
  });

  it("hides the wedge without a target and closes the shroud", () => {
    render(<Board target={null} shroudOpen={false} dials={[]} />);
    expect(screen.queryByTestId("wedge-4")).not.toBeInTheDocument();
    expect(screen.getByTestId("shroud")).not.toHaveAttribute("data-open");
  });

  it("maps pointer drags on the surface to spectrum positions", () => {
    mockRect();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    render(
      <Board
        target={null}
        shroudOpen={false}
        dials={[]}
        drag={{ enabled: true, onMove, onEnd }}
      />,
    );
    const top = positionToPoint(0.5, 150);
    const left = positionToPoint(0.1, 150);
    fireEvent.pointerDown(screen.getByTestId("board"), {
      clientX: top.x,
      clientY: top.y,
      isPrimary: true,
      pointerId: 1,
    });
    expect(onMove).toHaveBeenLastCalledWith(expect.closeTo(0.5, 3));
    fireEvent.pointerMove(screen.getByTestId("board"), {
      clientX: left.x,
      clientY: left.y,
      pointerId: 1,
    });
    expect(onMove).toHaveBeenLastCalledWith(expect.closeTo(0.1, 3));
    // below the baseline on the right pins to 1
    fireEvent.pointerUp(screen.getByTestId("board"), {
      clientX: 390,
      clientY: CY + 20,
      pointerId: 1,
    });
    expect(onEnd).toHaveBeenCalledWith(1);
    pointer("pointermove", 10, 10);
  });

  it("ignores drags when disabled", () => {
    mockRect();
    const onMove = vi.fn();
    render(
      <Board
        target={null}
        shroudOpen={false}
        dials={[]}
        drag={{ enabled: false, onMove, onEnd: onMove }}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId("board"), {
      clientX: 200,
      clientY: 50,
      isPrimary: true,
      pointerId: 1,
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("reports a flick velocity when spinning is enabled", () => {
    mockRect();
    const onFlick = vi.fn();
    render(
      <Board
        target={null}
        shroudOpen={false}
        dials={[]}
        spin={{ enabled: true, onFlick }}
      />,
    );
    const board = screen.getByTestId("board");
    const a = positionToPoint(0.2, 150);
    const b = positionToPoint(0.5, 150);
    const c = positionToPoint(0.8, 150);
    fireEvent.pointerDown(board, {
      clientX: a.x,
      clientY: a.y,
      isPrimary: true,
      pointerId: 1,
      timeStamp: 0,
    });
    fireEvent.pointerMove(board, {
      clientX: b.x,
      clientY: b.y,
      pointerId: 1,
      timeStamp: 30,
    });
    fireEvent.pointerMove(board, {
      clientX: c.x,
      clientY: c.y,
      pointerId: 1,
      timeStamp: 60,
    });
    fireEvent.pointerUp(board, {
      clientX: c.x,
      clientY: c.y,
      pointerId: 1,
      timeStamp: 60,
    });
    expect(onFlick).toHaveBeenCalledTimes(1);
    expect(onFlick.mock.calls[0]![0]).toBeLessThan(0); // left → right is clockwise
  });

  it("fires onShroudTap for a tap on the shroud or its handle, not on a drag", () => {
    mockRect();
    const onShroudTap = vi.fn();
    const onFlick = vi.fn();
    const { rerender } = render(
      <Board
        target={null}
        shroudOpen={false}
        dials={[]}
        spin={{ enabled: true, onFlick }}
        onShroudTap={onShroudTap}
      />,
    );
    expect(screen.queryByTestId("shroud-handle")).toBeNull();
    const shroud = screen.getByTestId("shroud");
    fireEvent.pointerDown(shroud, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(shroud, { clientX: 203, clientY: 102 });
    expect(onShroudTap).toHaveBeenCalledTimes(1);
    expect(onFlick).not.toHaveBeenCalled(); // the tap never reaches the board
    fireEvent.pointerDown(shroud, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(shroud, { clientX: 200, clientY: 100 });
    expect(onShroudTap).toHaveBeenCalledTimes(1);

    rerender(
      <Board
        target={null}
        shroudOpen
        dials={[]}
        spin={{ enabled: true, onFlick }}
        onShroudTap={onShroudTap}
      />,
    );
    const handle = screen.getByTestId("shroud-handle");
    fireEvent.pointerDown(handle, { clientX: 200, clientY: CY + 10 });
    fireEvent.pointerUp(handle, { clientX: 200, clientY: CY + 10 });
    expect(onShroudTap).toHaveBeenCalledTimes(2);
  });
});
