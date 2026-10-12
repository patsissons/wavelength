import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({
  play: vi.fn(),
  setLoop: vi.fn((name: string | null) => {
    audio.loop = name;
  }),
  ready: true,
  loop: null as string | null,
}));
vi.mock("@/lib/audio", () => ({
  audio,
  soundNames: () => ({ patches: ["ding", "fanfare"], loops: ["lounge"] }),
}));

import { Jukebox } from "./jukebox";

describe("Jukebox", () => {
  beforeEach(() => {
    audio.play.mockClear();
    audio.setLoop.mockClear();
    audio.loop = null;
  });

  it("plays sounds and starts and stops loops by tap", () => {
    render(<Jukebox open onOpenChange={() => {}} />);
    expect(screen.getByTestId("egg-jukebox")).toHaveTextContent("Tap one");
    fireEvent.click(screen.getByTestId("juke-fanfare"));
    expect(audio.play).toHaveBeenCalledWith("fanfare");

    expect(screen.getByTestId("juke-stop")).toBeDisabled();
    fireEvent.click(screen.getByTestId("juke-loop-lounge"));
    expect(audio.setLoop).toHaveBeenCalledWith("lounge");
    expect(screen.getByTestId("juke-loop-lounge")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByTestId("juke-stop"));
    expect(audio.setLoop).toHaveBeenLastCalledWith(null);
  });

  it("asks for a tap first while the browser has not allowed sound", () => {
    audio.ready = false;
    render(<Jukebox open onOpenChange={() => {}} />);
    expect(screen.getByTestId("egg-jukebox")).toHaveTextContent(
      "Tap the page once first",
    );
    audio.ready = true;
  });
});
