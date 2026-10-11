import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class FakeNode {
  connect = vi.fn(() => new FakeNode());
  start = vi.fn();
  stop = vi.fn();
  gain = new FakeParam();
  threshold = new FakeParam();
  ratio = new FakeParam();
  frequency = new FakeParam();
  buffer: unknown = null;
  loop = false;
  type = "";
}
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = "suspended";
  currentTime = 0;
  sampleRate = 44100;
  started: FakeNode[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  createBuffer = vi.fn(() => ({
    sampleRate: this.sampleRate,
    getChannelData: () => new Float32Array(8),
  }));
  createBufferSource = vi.fn(() => {
    const node = new FakeNode();
    this.started.push(node);
    return node;
  });
  createOscillator = vi.fn(() => {
    const node = new FakeNode();
    this.started.push(node);
    return node;
  });
  createGain = vi.fn(() => new FakeNode());
  createBiquadFilter = vi.fn(() => new FakeNode());
  createDynamicsCompressor = vi.fn(() => new FakeNode());
  destination = new FakeNode();
}

const play = vi.fn(() => Promise.resolve());

async function load() {
  vi.resetModules();
  const mod = await import("./audio");
  const prefs = await import("./prefs");
  return { audio: mod.audio, usePrefs: prefs.usePrefs };
}

describe("audio manager", () => {
  beforeEach(() => {
    FakeAudioContext.instances = [];
    play.mockClear();
    Object.defineProperty(window, "AudioContext", {
      value: FakeAudioContext,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      value: play,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      get: () => true,
      configurable: true,
    });
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("unlock resumes the context, plays a silent buffer and starts the keep-alive element", async () => {
    const { audio, usePrefs } = await load();
    expect(await audio.unlock()).toBe(true);
    const ctx = FakeAudioContext.instances[0]!;
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.started.length).toBe(1); // the silent unlock buffer
    const el = document.querySelector<HTMLAudioElement>(
      "[data-testid=audio-keepalive]",
    );
    expect(el).not.toBeNull();
    expect(el!.loop).toBe(true);
    expect(el!.src.startsWith("data:audio/wav;base64,")).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(usePrefs.getState().soundUnlocked).toBe(true);
  });

  it("plays patches through the master chain only while running and unmuted", async () => {
    const { audio, usePrefs } = await load();
    await audio.unlock();
    const ctx = FakeAudioContext.instances[0]!;
    const before = ctx.started.length;
    audio.play("ding");
    expect(ctx.started.length).toBeGreaterThan(before);
    expect(ctx.createDynamicsCompressor).toHaveBeenCalledTimes(1);

    usePrefs.getState().setMuted(true);
    const muted = ctx.started.length;
    audio.play("ding");
    expect(ctx.started.length).toBe(muted);
    usePrefs.getState().setMuted(false);

    // Interrupted (iOS lock screen): nothing scheduled, a resume is attempted.
    ctx.state = "interrupted";
    ctx.resume.mockClear();
    audio.play("tick");
    expect(ctx.started.length).toBe(muted);
    expect(ctx.resume).toHaveBeenCalled();
  });

  it("any tap re-unlocks a context that is not running", async () => {
    const { audio } = await load();
    expect(audio.context).toBeNull();
    document.body.dispatchEvent(new Event("touchend", { bubbles: true }));
    await Promise.resolve();
    expect(FakeAudioContext.instances.length).toBe(1);
    const ctx = FakeAudioContext.instances[0]!;
    await vi.waitFor(() => expect(ctx.state).toBe("running"));

    ctx.state = "suspended";
    ctx.resume.mockClear();
    document.body.dispatchEvent(new Event("click", { bubbles: true }));
    await vi.waitFor(() => expect(ctx.resume).toHaveBeenCalled());
    expect(FakeAudioContext.instances.length).toBe(1);
  });
});
