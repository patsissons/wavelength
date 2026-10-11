import type { SoundPatch } from "@shared/effects/catalog";
import { usePrefs } from "./prefs";

/**
 * All sounds are synthesised with the Web Audio API: no assets to license
 * or download. Mobile browsers only start audio after a user gesture, so
 * `unlock()` must run synchronously inside a tap handler; it is wired to
 * the lounge button and to a document-level listener so the first tap
 * anywhere (including after an iOS interruption) restores audio.
 *
 * iPhone ringer switch: Web Audio counts as "ambient" and is muted by the
 * silent switch, but once an HTMLMediaElement is playing the page's audio
 * session becomes "playback" and Web Audio is audible again. `unlock()`
 * therefore also starts a looping, inaudible <audio> element.
 */
class AudioManager {
  #ctx: AudioContext | null = null;
  #master: AudioNode | null = null;
  #keepAlive: HTMLAudioElement | null = null;

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
      const ctx = this.#ctx;
      // Everything below runs synchronously inside the gesture.
      this.#playKeepAlive();
      const resumed = ctx.state !== "running" ? ctx.resume() : null;
      // A silent buffer inside the gesture fully unlocks iOS.
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, 22050);
      source.connect(ctx.destination);
      source.start(0);
      if (resumed) await withTimeout(resumed, 1000);
      const ok = ctx.state === "running";
      usePrefs.getState().setSoundUnlocked(ok);
      return ok;
    } catch {
      return false;
    }
  }

  /** Best-effort resume after backgrounding (works once unlocked). */
  resume(): void {
    this.#playKeepAlive();
    if (this.#ctx && this.#ctx.state !== "running") {
      void this.#ctx.resume().catch(() => {});
    }
  }

  get ready(): boolean {
    return this.#ctx?.state === "running";
  }

  play(patch: SoundPatch, volume = 1): void {
    const ctx = this.#ctx;
    if (!ctx || usePrefs.getState().muted) return;
    if (ctx.state !== "running") {
      // Safari reports "interrupted" after a call or lock screen; a resume
      // outside a gesture sometimes works, and the document listener below
      // covers the rest.
      this.resume();
      return;
    }
    try {
      PATCHES[patch](ctx, this.#out(ctx), volume);
    } catch {
      /* never let audio break the game */
    }
  }

  /** Gain + compressor so synth patches are audible on phone speakers. */
  #out(ctx: AudioContext): AudioNode {
    if (this.#master) return this.#master;
    const gain = ctx.createGain();
    gain.gain.value = 1.6;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 6;
    gain.connect(compressor).connect(ctx.destination);
    this.#master = gain;
    return gain;
  }

  #playKeepAlive(): void {
    try {
      if (!this.#keepAlive) {
        const el = document.createElement("audio");
        el.setAttribute("playsinline", "");
        el.setAttribute("aria-hidden", "true");
        el.loop = true;
        el.volume = 0.01;
        el.preload = "auto";
        el.src = SILENT_WAV;
        el.dataset.testid = "audio-keepalive";
        document.body.appendChild(el);
        this.#keepAlive = el;
      }
      if (this.#keepAlive.paused) {
        void this.#keepAlive.play()?.catch(() => {});
      }
    } catch {
      /* no DOM or media element support */
    }
  }
}

export const audio = new AudioManager();

/** One second of 8 kHz, 8-bit silence as a WAV data URI (~8 KB). */
const SILENT_WAV = (() => {
  const rate = 8000;
  const samples = rate;
  const header = new Uint8Array(44 + samples);
  const view = new DataView(header.buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  str(36, "data");
  view.setUint32(40, samples, true);
  header.fill(128, 44); // 8-bit PCM silence is 0x80
  let binary = "";
  for (const byte of header) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
})();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") audio.resume();
  });
  // Any tap re-arms audio when the context is missing or not running. The
  // handler must stay synchronous so the gesture still counts.
  const onGesture = () => {
    if (usePrefs.getState().muted) return;
    if (!audio.ready) void audio.unlock();
  };
  for (const type of ["touchend", "click", "keydown"] as const) {
    document.addEventListener(type, onGesture, {
      capture: true,
      passive: true,
    });
  }
}

/* ---------- synth helpers ---------- */

type Patch = (ctx: AudioContext, out: AudioNode, volume: number) => void;

function tone(
  ctx: AudioContext,
  out: AudioNode,
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
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;
function noise(
  ctx: AudioContext,
  out: AudioNode,
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
  node.connect(env).connect(out);
  src.start(t0);
  src.stop(t0 + opts.duration + 0.05);
}

const PATCHES: Record<SoundPatch, Patch> = {
  ding: (ctx, out, v) => {
    tone(ctx, out, {
      type: "sine",
      from: 880,
      start: 0,
      duration: 0.5,
      gain: 0.3 * v,
    });
    tone(ctx, out, {
      type: "sine",
      from: 1320,
      start: 0.05,
      duration: 0.6,
      gain: 0.12 * v,
    });
  },
  buzz: (ctx, out, v) =>
    tone(ctx, out, {
      type: "sawtooth",
      from: 110,
      to: 80,
      start: 0,
      duration: 0.45,
      gain: 0.25 * v,
    }),
  drumroll: (ctx, out, v) => {
    for (let i = 0; i < 18; i++) {
      noise(ctx, out, {
        start: i * 0.07,
        duration: 0.05,
        gain: (0.12 + i * 0.01) * v,
        filter: { type: "lowpass", from: 900 },
      });
    }
    noise(ctx, out, {
      start: 1.3,
      duration: 0.4,
      gain: 0.35 * v,
      filter: { type: "lowpass", from: 2500 },
    });
  },
  whoosh: (ctx, out, v) =>
    noise(ctx, out, {
      start: 0,
      duration: 0.7,
      gain: 0.3 * v,
      filter: { type: "bandpass", from: 300, to: 4000 },
    }),
  tick: (ctx, out, v) =>
    noise(ctx, out, {
      start: 0,
      duration: 0.03,
      gain: 0.15 * v,
      filter: { type: "highpass", from: 2000 },
    }),
  gasp: (ctx, out, v) => {
    noise(ctx, out, {
      start: 0,
      duration: 0.5,
      gain: 0.2 * v,
      filter: { type: "bandpass", from: 500, to: 2500 },
    });
    tone(ctx, out, {
      type: "sine",
      from: 400,
      to: 900,
      start: 0.05,
      duration: 0.45,
      gain: 0.08 * v,
    });
  },
  applause: (ctx, out, v) => {
    for (let i = 0; i < 40; i++) {
      noise(ctx, out, {
        start: Math.random() * 1.2,
        duration: 0.03 + Math.random() * 0.03,
        gain: (0.05 + Math.random() * 0.1) * v,
        filter: { type: "bandpass", from: 1500 + Math.random() * 2000 },
      });
    }
  },
  boo: (ctx, out, v) => {
    tone(ctx, out, {
      type: "sawtooth",
      from: 220,
      to: 120,
      start: 0,
      duration: 0.9,
      gain: 0.12 * v,
    });
    tone(ctx, out, {
      type: "sawtooth",
      from: 230,
      to: 118,
      start: 0.05,
      duration: 0.9,
      gain: 0.1 * v,
    });
  },
  rimshot: (ctx, out, v) => {
    noise(ctx, out, {
      start: 0,
      duration: 0.06,
      gain: 0.3 * v,
      filter: { type: "lowpass", from: 1200 },
    });
    noise(ctx, out, {
      start: 0.14,
      duration: 0.06,
      gain: 0.3 * v,
      filter: { type: "lowpass", from: 1200 },
    });
    noise(ctx, out, {
      start: 0.3,
      duration: 0.5,
      gain: 0.3 * v,
      filter: { type: "highpass", from: 4000 },
    });
  },
  fanfare: (ctx, out, v) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(ctx, out, {
        type: "square",
        from: f,
        start: i * 0.12,
        duration: i === 3 ? 0.6 : 0.14,
        gain: 0.08 * v,
      }),
    );
  },
  crickets: (ctx, out, v) => {
    for (let i = 0; i < 6; i++) {
      tone(ctx, out, {
        type: "sine",
        from: 4200,
        start: i * 0.22,
        duration: 0.05,
        gain: 0.05 * v,
      });
      tone(ctx, out, {
        type: "sine",
        from: 4200,
        start: i * 0.22 + 0.07,
        duration: 0.05,
        gain: 0.05 * v,
      });
    }
  },
};
