import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audio", () => ({
  audio: { play: vi.fn(), setLoop: vi.fn(), ready: true, loop: null },
  soundNames: () => ({ patches: ["ding"], loops: ["lounge"] }),
}));

import { EGGS } from "@/lib/eggs/registry";
import { useEggs } from "@/lib/eggs/store";
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
    expect(sheet).toHaveTextContent("Also from a desktop console");
    expect(screen.getByTestId("egg-console-list")).toHaveTextContent(
      "wavelength.barrelRoll()",
    );
  });

  it("uses the keyboard wording on a desktop", () => {
    render(<EggCheatsheet open onOpenChange={() => {}} platform="desktop" />);
    const sheet = screen.getByTestId("egg-cheatsheet");
    expect(sheet).toHaveTextContent("B A on a keyboard");
  });

  it("opens the jukebox and switches every egg off", () => {
    useEggs.getState().set({ crt: true, pet: "🐈" });
    render(<EggCheatsheet open onOpenChange={() => {}} platform="ios" />);
    expect(screen.queryByTestId("egg-jukebox")).toBeNull();
    fireEvent.click(screen.getByTestId("egg-jukebox-open"));
    expect(screen.getByTestId("egg-jukebox")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("egg-reset"));
    expect(useEggs.getState().crt).toBe(false);
    expect(useEggs.getState().pet).toBeNull();
  });

  it("renders nothing while closed", () => {
    render(<EggCheatsheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId("egg-cheatsheet")).toBeNull();
  });
});
