import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClueInput } from "./clue-input";

describe("ClueInput", () => {
  it("keeps the text when the clue was sent, clears it when an egg ate it", () => {
    const onSubmit = vi.fn((clue: string) => clue !== "banana");
    render(<ClueInput onSubmit={onSubmit} disabled={false} />);
    const input = screen.getByTestId("clue-input") as HTMLInputElement;
    const button = screen.getByTestId("submit-clue");
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "  banana " } });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith("banana");
    expect(input.value).toBe("");
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "cold" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenLastCalledWith("cold");
    expect(input.value).toBe("cold");
  });
});
