import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EGGS } from "@/lib/eggs/registry";
import { EggCheatsheet } from "./cheatsheet";

describe("EggCheatsheet", () => {
  it("lists every egg with phone wording on an iPhone", () => {
    render(<EggCheatsheet open onOpenChange={() => {}} platform="ios" />);
    const sheet = screen.getByTestId("egg-cheatsheet");
    expect(sheet).toHaveAttribute("data-platform", "ios");
    expect(sheet).toHaveTextContent("on iPhone");
    for (const egg of EGGS) expect(sheet).toHaveTextContent(egg.name);
    expect(sheet).toHaveTextContent("swipe ↑ ↑ ↓ ↓");
    expect(sheet).not.toHaveTextContent("B A on a keyboard");
    expect(sheet).toHaveTextContent("From the console (desktop browsers)");
    expect(screen.getByTestId("egg-console-list")).toHaveTextContent(
      "wavelength.barrelRoll()",
    );
  });

  it("uses the keyboard wording on a desktop", () => {
    render(<EggCheatsheet open onOpenChange={() => {}} platform="desktop" />);
    const sheet = screen.getByTestId("egg-cheatsheet");
    expect(sheet).toHaveTextContent("B A on a keyboard");
    expect(sheet).not.toHaveTextContent("(desktop browsers)");
  });

  it("renders nothing while closed", () => {
    render(<EggCheatsheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId("egg-cheatsheet")).toBeNull();
  });
});
