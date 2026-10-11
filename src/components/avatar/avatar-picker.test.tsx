import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvatarPicker, AvatarPreviewButton } from "./avatar-picker";
import { EMOJI_CHOICES } from "./emoji-choices";

function mount(value: string | null) {
  const onChange = vi.fn();
  render(
    <AvatarPicker
      value={value}
      onChange={onChange}
      trigger={<AvatarPreviewButton avatar={value} />}
    />,
  );
  return onChange;
}

describe("AvatarPicker", () => {
  it("offers the characters, the emoji grid and the monogram", async () => {
    const user = userEvent.setup();
    const onChange = mount(null);
    await user.click(screen.getByTestId("open-avatar"));
    await user.click(screen.getByTestId("avatar-dancing-unicorn"));
    expect(onChange).toHaveBeenLastCalledWith("dancing-unicorn");

    await user.click(screen.getByTestId("open-avatar"));
    await user.click(screen.getByTestId(`avatar-emoji-${EMOJI_CHOICES[0]}`));
    expect(onChange).toHaveBeenLastCalledWith(EMOJI_CHOICES[0]);

    await user.click(screen.getByTestId("open-avatar"));
    await user.click(screen.getByTestId("avatar-none"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("accepts a typed emoji but not text or two emoji", async () => {
    const user = userEvent.setup();
    const onChange = mount(null);
    await user.click(screen.getByTestId("open-avatar"));
    const input = screen.getByTestId("avatar-custom");
    const submit = screen.getByRole("button", { name: "Use it" });
    await user.type(input, "ab");
    expect(submit).toBeDisabled();
    await user.clear(input);
    await user.type(input, "🦄🦄");
    expect(submit).toBeDisabled();
    await user.clear(input);
    await user.type(input, "👩‍🚀");
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onChange).toHaveBeenLastCalledWith("👩‍🚀");
  });

  it("marks the current choice and previews it on the trigger", async () => {
    const user = userEvent.setup();
    mount("🦊");
    expect(screen.getByTestId("open-avatar")).toHaveTextContent("🦊");
    await user.click(screen.getByTestId("open-avatar"));
    expect(screen.getByTestId("avatar-emoji-🦊")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("avatar-none")).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });
});
