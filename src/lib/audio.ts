import type { SoundPatch } from "@shared/effects/catalog";
import { usePrefs } from "./prefs";

/**
 * All sounds are synthesised with the Web Audio API: no assets to license
 * or download. iOS Safari only starts audio after a user gesture, so
 * `unlock()` must be called from a tap handler (the lounge button does
 * this); the context is resumed again whenever the page becomes visible.
 */
class AudioManager {
  #ctx: AudioContext | null = null;

  get context(): AudioContext | null {
    return this.#ctx;
  }

  /** Call from a user gesture. Returns true when audio is ready. */
  async unlock(): Promise<boolean> {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      this.#ctx ??= new Ctor();
      if (this.#ctx.state !== "running") await this.#ctx.resume();
      // A silent buffer inside the gesture fully unlocks iOS.
      const buffer = this.#ctx.createBuffer(1, 1, 22050);
      const source = this.#ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.#ctx.destination);
      source.start(0);
      const ok = this.#ctx.state === "running";
      usePrefs.getState().setSoundUnlocked(ok);
      return ok;
    } catch {
      return false;
    }
  }

  /** Best-effort resume after backgrounding (works once unlocked). */
  resume(): void {
    if (this.#ctx && this.#ctx.state !== "running") {
      void this.#ctx.resume().catch(() => {});
    }
  }

  play(patch: SoundPatch, volume = 1): void {
    const ctx = this.#ctx;
    if (!ctx || ctx.state !== "running" || usePrefs.getState().muted) return;
    try {
      PATCHES[patch](ctx, volume);
    } catch {
      /* never let audio break the game */
    }
  }
}

export const audio = new AudioManager();

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") audio.resume();
  });
}

/* ---------- synth helpers ---------- */

type Patch = (ctx: AudioContext, volume: number) => void;

function tone(
  ctx: AudioContext,
  opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    start: number;
    duration: number;
    gain: number;
  },
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = opts.type;
  const t0 = ctx.currentTime + opts.start;
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.duration);
  }
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(env).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(
  ctx: AudioContext,
  opts: {
    start: number;
    duration: number;
    gain: number;
    filter?: { type: BiquadFilterType; from: number; to?: number };
  },
) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const env = ctx.createGain();
  const t0 = ctx.currentTime + opts.start;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  let node: AudioNode = src;
  if (opts.filter) {
    const f = ctx.createBiquadFilter();
    f.type = opts.filter.type;
    f.frequency.setValueAtTime(opts.filter.from, t0);
    if (opts.filter.to !== undefined) {
      f.frequency.exponentialRampToValueAtTime(
        opts.filter.to,
        t0 + opts.duration,
      );
    }
    node = src.connect(f);
  }
  node.connect(env).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + opts.duration + 0.05);
}

const PATCHES: Record<SoundPatch, Patch> = {
  ding: (ctx, v) => {
    tone(ctx, {
      type: "sine",
      from: 880,
      start: 0,
      duration: 0.5,
      gain: 0.3 * v,
    });
    tone(ctx, {
      type: "sine",
      from: 1320,
      start: 0.05,
      duration: 0.6,
      gain: 0.12 * v,
    });
  },
  buzz: (ctx, v) =>
    tone(ctx, {
      type: "sawtooth",
      from: 110,
      to: 80,
      start: 0,
      duration: 0.45,
      gain: 0.25 * v,
    }),
  drumroll: (ctx, v) => {
    for (let i = 0; i < 18; i++) {
      noise(ctx, {
        start: i * 0.07,
        duration: 0.05,
        gain: (0.12 + i * 0.01) * v,
        filter: { type: "lowpass", from: 900 },
      });
    }
    noise(ctx, {
      start: 1.3,
      duration: 0.4,
      gain: 0.35 * v,
      filter: { type: "lowpass", from: 2500 },
    });
  },
  whoosh: (ctx, v) =>
    noise(ctx, {
      start: 0,
      duration: 0.7,
      gain: 0.3 * v,
      filter: { type: "bandpass", from: 300, to: 4000 },
    }),
  tick: (ctx, v) =>
    noise(ctx, {
      start: 0,
      duration: 0.03,
      gain: 0.15 * v,
      filter: { type: "highpass", from: 2000 },
    }),
  gasp: (ctx, v) => {
    noise(ctx, {
      start: 0,
      duration: 0.5,
      gain: 0.2 * v,
      filter: { type: "bandpass", from: 500, to: 2500 },
    });
    tone(ctx, {
      type: "sine",
      from: 400,
      to: 900,
      start: 0.05,
      duration: 0.45,
      gain: 0.08 * v,
    });
  },
  applause: (ctx, v) => {
    for (let i = 0; i < 40; i++) {
      noise(ctx, {
        start: Math.random() * 1.2,
        duration: 0.03 + Math.random() * 0.03,
        gain: (0.05 + Math.random() * 0.1) * v,
        filter: { type: "bandpass", from: 1500 + Math.random() * 2000 },
      });
    }
  },
  boo: (ctx, v) => {
    tone(ctx, {
      type: "sawtooth",
      from: 220,
      to: 120,
      start: 0,
      duration: 0.9,
      gain: 0.12 * v,
    });
    tone(ctx, {
      type: "sawtooth",
      from: 230,
      to: 118,
      start: 0.05,
      duration: 0.9,
      gain: 0.1 * v,
    });
  },
  rimshot: (ctx, v) => {
    noise(ctx, {
      start: 0,
      duration: 0.06,
      gain: 0.3 * v,
      filter: { type: "lowpass", from: 1200 },
    });
    noise(ctx, {
      start: 0.14,
      duration: 0.06,
      gain: 0.3 * v,
      filter: { type: "lowpass", from: 1200 },
    });
    noise(ctx, {
      start: 0.3,
      duration: 0.5,
      gain: 0.3 * v,
      filter: { type: "highpass", from: 4000 },
    });
  },
  fanfare: (ctx, v) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(ctx, {
        type: "square",
        from: f,
        start: i * 0.12,
        duration: i === 3 ? 0.6 : 0.14,
        gain: 0.08 * v,
      }),
    );
  },
  crickets: (ctx, v) => {
    for (let i = 0; i < 6; i++) {
      tone(ctx, {
        type: "sine",
        from: 4200,
        start: i * 0.22,
        duration: 0.05,
        gain: 0.05 * v,
      });
      tone(ctx, {
        type: "sine",
        from: 4200,
        start: i * 0.22 + 0.07,
        duration: 0.05,
        gain: 0.05 * v,
      });
    }
  },
};
