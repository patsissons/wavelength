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
export type LoopName = "lounge" | "disco";

class AudioManager {
  #ctx: AudioContext | null = null;
  #master: AudioNode | null = null;
  #keepAlive: HTMLAudioElement | null = null;
  /** The tab is hidden or unfocused: nothing plays until it is back. */
  #background = false;
  #loop: {
    name: LoopName;
    gain: GainNode;
    timer: ReturnType<typeof setInterval>;
    step: number;
    nextAt: number;
  } | null = null;

  /** Which background loop is playing, if any. */
  get loop(): LoopName | null {
    return this.#loop?.name ?? null;
  }

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
    if (this.#background) return;
    this.#playKeepAlive();
    if (this.#ctx && this.#ctx.state !== "running") {
      void this.#ctx.resume().catch(() => {});
    }
  }

  /**
   * The tab lost focus or was hidden: silence everything (the loop, any
   * tails, the keep-alive element) until `foreground()`.
   */
  background(): void {
    this.#background = true;
    try {
      this.#keepAlive?.pause();
    } catch {
      /* ignore */
    }
    if (this.#ctx && this.#ctx.state === "running") {
      void this.#ctx.suspend().catch(() => {});
    }
  }

  foreground(): void {
    if (!this.#background) return;
    this.#background = false;
    if (usePrefs.getState().muted) return;
    this.resume();
  }

  get inBackground(): boolean {
    return this.#background;
  }

  get ready(): boolean {
    return this.#ctx?.state === "running";
  }

  play(patch: SoundPatch, volume = 1): void {
    const ctx = this.#ctx;
    if (!ctx || this.#background || usePrefs.getState().muted) return;
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

  /**
   * Start (or stop, with null) a background loop. Steps are scheduled a
   * little ahead on the audio clock so the groove survives timer jitter;
   * a suspended context simply pauses it.
   */
  setLoop(name: LoopName | null): void {
    if (this.#loop?.name === name) return;
    this.#stopLoop();
    const ctx = this.#ctx;
    if (!name || !ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    gain.connect(this.#out(ctx));
    const loop = {
      name,
      gain,
      step: 0,
      nextAt: ctx.currentTime + 0.05,
      timer: setInterval(() => this.#scheduleLoop(), 120),
    };
    this.#loop = loop;
    this.#scheduleLoop();
  }

  #scheduleLoop(): void {
    const ctx = this.#ctx;
    const loop = this.#loop;
    if (!ctx || !loop) return;
    if (usePrefs.getState().muted) {
      this.#stopLoop();
      return;
    }
    if (ctx.state !== "running") return;
    const pattern = LOOPS[loop.name];
    const stepDur = 60 / pattern.bpm / 4; // 16th notes
    while (loop.nextAt < ctx.currentTime + 0.35) {
      // Fell far behind (tab was asleep): skip ahead instead of catching up.
      if (loop.nextAt < ctx.currentTime - 0.5) loop.nextAt = ctx.currentTime;
      try {
        pattern.step(ctx, loop.gain, loop.step, loop.nextAt, stepDur);
      } catch {
        /* keep the loop alive */
      }
      loop.nextAt += stepDur;
      loop.step = (loop.step + 1) % pattern.steps;
    }
  }

  #stopLoop(): void {
    const loop = this.#loop;
    if (!loop) return;
    clearInterval(loop.timer);
    try {
      const t = this.#ctx?.currentTime ?? 0;
      loop.gain.gain.setValueAtTime(loop.gain.gain.value, t);
      loop.gain.gain.linearRampToValueAtTime(0, t + 0.15);
      setTimeout(() => loop.gain.disconnect(), 300);
    } catch {
      /* ignore */
    }
    this.#loop = null;
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

/** Every synthesised patch and loop, for the jukebox egg. */
export function soundNames(): { patches: SoundPatch[]; loops: LoopName[] } {
  return {
    patches: Object.keys(PATCHES) as SoundPatch[],
    loops: Object.keys(LOOPS) as LoopName[],
  };
}

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

/**
 * Render a loop or a patch offline to mono samples. Used by diagnostics
 * (e2e previews) rather than by gameplay.
 */
export async function renderOffline(
  what: { loop: LoopName } | { patch: SoundPatch },
  seconds: number,
): Promise<Float32Array> {
  const Offline =
    window.OfflineAudioContext ??
    (
      window as unknown as {
        webkitOfflineAudioContext: typeof OfflineAudioContext;
      }
    ).webkitOfflineAudioContext;
  const rate = 44100;
  const ctx = new Offline(1, Math.ceil(seconds * rate), rate);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  const live = ctx as unknown as AudioContext;
  if ("loop" in what) {
    const pattern = LOOPS[what.loop];
    const stepDur = 60 / pattern.bpm / 4;
    for (let i = 0, at = 0.05; at < seconds; i++, at += stepDur) {
      pattern.step(live, out, i % pattern.steps, at, stepDur);
    }
  } else {
    PATCHES[what.patch](live, out, 1);
  }
  const buffer = await ctx.startRendering();
  return buffer.getChannelData(0);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

if (typeof document !== "undefined") {
  // Sound belongs to the tab you are looking at: a hidden or unfocused tab
  // goes quiet and picks up again when it is back.
  const sync = () => {
    if (document.visibilityState === "hidden" || !document.hasFocus()) {
      audio.background();
    } else {
      audio.foreground();
    }
  };
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("blur", sync);
  window.addEventListener("focus", sync);
  window.addEventListener("pagehide", () => audio.background());
  window.addEventListener("pageshow", sync);
  // Any tap re-arms audio when the context is missing or not running. The
  // handler must stay synchronous so the gesture still counts.
  const onGesture = () => {
    if (usePrefs.getState().muted || audio.inBackground) return;
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

/* ---------- background loops ---------- */

interface LoopPattern {
  bpm: number;
  steps: number;
  step: (
    ctx: AudioContext,
    out: AudioNode,
    step: number,
    at: number,
    stepDur: number,
  ) => void;
}

/** Plucked bass: sawtooth through a closing low-pass filter. */
function pluck(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  at: number,
  duration: number,
  gain: number,
) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, at);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(1400, at);
  filter.frequency.exponentialRampToValueAtTime(180, at + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(filter).connect(env).connect(out);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

function kick(ctx: AudioContext, out: AudioNode, at: number, gain: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + 0.3);
}

// E minor pentatonic in Hz
const E2 = 82.41;
const G2 = 98;
const A2 = 110;
const B2 = 123.47;
const D3 = 146.83;
const E3 = 164.81;
const CHORD_EM7 = [329.63, 392, 493.88, 587.33];
const CHORD_A7 = [440, 554.37, 659.25, 783.99];

// A minor for the disco: bass octaves and a two-chord vamp
const A1 = 55;
const A2_ = 110;
const C2 = 65.41;
const F2 = 87.31;
const G2_ = 98;
const CHORD_AM = [440, 523.25, 659.25, 880];
const CHORD_F = [349.23, 440, 523.25, 698.46];
const CHORD_G = [392, 493.88, 587.33, 783.99];

/** Two bars of a laid-back funk groove at 104 BPM, and a disco stomp. */
const LOOPS: Record<LoopName, LoopPattern> = {
  disco: {
    bpm: 124,
    steps: 32,
    step(ctx, out, step, at, stepDur) {
      const t = at - ctx.currentTime;
      // four on the floor, open hat on every off-beat, claps on 2 and 4
      if (step % 4 === 0) kick(ctx, out, at, 0.6);
      if (step % 4 === 2) {
        noise(ctx, out, {
          start: t,
          duration: 0.16,
          gain: 0.09,
          filter: { type: "highpass", from: 6000 },
        });
      }
      if (step % 8 === 4) {
        noise(ctx, out, {
          start: t,
          duration: 0.1,
          gain: 0.2,
          filter: { type: "bandpass", from: 1500 },
        });
      }
      // octave bass: root on the beat, octave up on the "and"
      const bar = Math.floor(step / 8);
      const root = [A1, A1, F2, G2_][bar]!;
      if (step % 2 === 0) {
        pluck(
          ctx,
          out,
          step % 4 === 0 ? root : root * 2,
          at,
          stepDur * 1.4,
          0.3,
        );
      }
      // string-ish chord stabs
      if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) {
        const chord = [CHORD_AM, CHORD_AM, CHORD_F, CHORD_G][bar]!;
        for (const f of chord) {
          tone(ctx, out, {
            type: "sawtooth",
            from: f,
            start: t,
            duration: stepDur * (step % 8 === 6 ? 1.8 : 0.9),
            gain: 0.03,
          });
        }
      }
      // a little sparkle lead on the last bar
      if (bar === 3 && step % 2 === 1) {
        tone(ctx, out, {
          type: "triangle",
          from: [C2, A2_, G2_, F2][(step >> 1) % 4]! * 8,
          start: t,
          duration: stepDur * 0.8,
          gain: 0.05,
        });
      }
    },
  },
  lounge: {
    bpm: 104,
    steps: 32,
    step(ctx, out, step, at, stepDur) {
      const t = at - ctx.currentTime; // relative start for the helpers
      // drums
      if ([0, 6, 8, 14, 16, 22, 24, 28].includes(step)) kick(ctx, out, at, 0.5);
      if (step % 8 === 4) {
        noise(ctx, out, {
          start: t,
          duration: 0.12,
          gain: 0.22,
          filter: { type: "bandpass", from: 1800 },
        });
      }
      if (step % 2 === 0) {
        noise(ctx, out, {
          start: t,
          duration: step % 4 === 2 ? 0.05 : 0.025,
          gain: step % 4 === 2 ? 0.07 : 0.05,
          filter: { type: "highpass", from: 7000 },
        });
      }
      // bass line
      const bass: Record<number, number> = {
        0: E2,
        3: G2,
        6: A2,
        8: E2,
        11: B2,
        14: A2,
        16: E2,
        19: D3,
        22: E3,
        24: A2,
        27: G2,
        30: B2,
      };
      const note = bass[step];
      if (note !== undefined) pluck(ctx, out, note, at, stepDur * 2.2, 0.28);
      // chord stabs on the off-beats
      if ([2, 10, 18, 26].includes(step)) {
        const chord = step < 16 ? CHORD_EM7 : CHORD_A7;
        for (const f of chord) {
          tone(ctx, out, {
            type: "triangle",
            from: f,
            start: t,
            duration: stepDur * 1.5,
            gain: 0.045,
          });
        }
      }
    },
  },
};

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
  celebrate: (ctx, out, v) => {
    // Rising arpeggio, a held chord and sparkle.
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone(ctx, out, {
        type: "triangle",
        from: f,
        start: i * 0.07,
        duration: 0.18,
        gain: 0.14 * v,
      }),
    );
    for (const f of [523.25, 659.25, 783.99, 1046.5]) {
      tone(ctx, out, {
        type: "square",
        from: f,
        start: 0.4,
        duration: 1.1,
        gain: 0.05 * v,
      });
    }
    kick(ctx, out, ctx.currentTime + 0.4, 0.5 * v);
    for (let i = 0; i < 12; i++) {
      tone(ctx, out, {
        type: "sine",
        from: 2000 + Math.random() * 3000,
        start: 0.45 + Math.random() * 0.9,
        duration: 0.08,
        gain: 0.05 * v,
      });
    }
  },
  newround: (ctx, out, v) => {
    // A quick two-note chime with a soft riser underneath.
    tone(ctx, out, {
      type: "sine",
      from: 659.25,
      start: 0,
      duration: 0.16,
      gain: 0.22 * v,
    });
    tone(ctx, out, {
      type: "sine",
      from: 987.77,
      start: 0.14,
      duration: 0.45,
      gain: 0.22 * v,
    });
    noise(ctx, out, {
      start: 0,
      duration: 0.5,
      gain: 0.08 * v,
      filter: { type: "bandpass", from: 400, to: 2500 },
    });
  },
  laugh: (ctx, out, v) => {
    // "ha-ha-ha-ha": four falling chuckles with a breathy edge.
    for (let i = 0; i < 4; i++) {
      const start = i * 0.16;
      tone(ctx, out, {
        type: "triangle",
        from: 520 - i * 40,
        to: 380 - i * 40,
        start,
        duration: 0.12,
        gain: 0.16 * v,
      });
      noise(ctx, out, {
        start,
        duration: 0.09,
        gain: 0.07 * v,
        filter: { type: "bandpass", from: 1200 },
      });
    }
  },
  hmm: (ctx, out, v) => {
    // A pondering "hmm…?" that rises at the end.
    tone(ctx, out, {
      type: "sine",
      from: 180,
      to: 190,
      start: 0,
      duration: 0.5,
      gain: 0.2 * v,
    });
    tone(ctx, out, {
      type: "triangle",
      from: 360,
      to: 380,
      start: 0,
      duration: 0.5,
      gain: 0.05 * v,
    });
    tone(ctx, out, {
      type: "sine",
      from: 190,
      to: 300,
      start: 0.5,
      duration: 0.3,
      gain: 0.18 * v,
    });
  },
  sparkle: (ctx, out, v) => {
    // Magic glissando: a quick run up the pentatonic plus shimmer.
    [784, 880, 1047, 1175, 1319, 1568, 1760].forEach((f, i) =>
      tone(ctx, out, {
        type: "sine",
        from: f,
        start: i * 0.05,
        duration: 0.3,
        gain: 0.12 * v,
      }),
    );
    for (let i = 0; i < 10; i++) {
      tone(ctx, out, {
        type: "sine",
        from: 2500 + Math.random() * 3000,
        start: 0.3 + Math.random() * 0.6,
        duration: 0.1,
        gain: 0.04 * v,
      });
    }
  },
  konami: (ctx, out, v) => {
    // The 8-bit "cheat accepted" riff: a quick square arpeggio, a bend up
    // and a held top note with vibrato-ish stutter.
    [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      tone(ctx, out, {
        type: "square",
        from: f,
        start: i * 0.08,
        duration: 0.1,
        gain: 0.09 * v,
      }),
    );
    tone(ctx, out, {
      type: "square",
      from: 1046.5,
      to: 1568,
      start: 0.36,
      duration: 0.16,
      gain: 0.09 * v,
    });
    for (let i = 0; i < 4; i++) {
      tone(ctx, out, {
        type: "square",
        from: i % 2 ? 1568 : 1760,
        start: 0.56 + i * 0.07,
        duration: 0.06,
        gain: 0.08 * v,
      });
    }
  },
  squeak: (ctx, out, v) => {
    // A banana-peel slip: two rubbery chirps and a thud.
    for (let i = 0; i < 2; i++) {
      tone(ctx, out, {
        type: "sine",
        from: 1400,
        to: 2600,
        start: i * 0.14,
        duration: 0.1,
        gain: 0.16 * v,
      });
      tone(ctx, out, {
        type: "sine",
        from: 2600,
        to: 1200,
        start: i * 0.14 + 0.09,
        duration: 0.06,
        gain: 0.12 * v,
      });
    }
    kick(ctx, out, ctx.currentTime + 0.34, 0.5 * v);
  },
  splash: (ctx, out, v) => {
    // A cannonball: a bloop dropping in pitch under a wash of noise.
    tone(ctx, out, {
      type: "sine",
      from: 520,
      to: 120,
      start: 0,
      duration: 0.25,
      gain: 0.22 * v,
    });
    noise(ctx, out, {
      start: 0.03,
      duration: 0.5,
      gain: 0.22 * v,
      filter: { type: "lowpass", from: 4000, to: 500 },
    });
  },
  squeal: (ctx, out, v) => {
    // Tyres on a hot wheel: a wavering high sawtooth over hissing noise.
    for (let i = 0; i < 6; i++) {
      tone(ctx, out, {
        type: "sawtooth",
        from: i % 2 ? 1900 : 2300,
        to: i % 2 ? 2300 : 1900,
        start: i * 0.07,
        duration: 0.09,
        gain: 0.05 * v,
      });
    }
    noise(ctx, out, {
      start: 0,
      duration: 0.5,
      gain: 0.1 * v,
      filter: { type: "bandpass", from: 3000, to: 1200 },
    });
  },
  poke: (ctx, out, v) => {
    // A springy "boing": a fast pitch drop with a wobbling tail.
    tone(ctx, out, {
      type: "square",
      from: 900,
      to: 220,
      start: 0,
      duration: 0.12,
      gain: 0.18 * v,
    });
    for (let i = 0; i < 5; i++) {
      tone(ctx, out, {
        type: "triangle",
        from: 300 - i * 25,
        to: 240 - i * 25,
        start: 0.1 + i * 0.08,
        duration: 0.09,
        gain: (0.18 - i * 0.03) * v,
      });
    }
  },
  ticktock: (ctx, out, v) => {
    // Someone is taking too long: a clock ticking under a little waiting
    // tune (original, so nobody's lawyers are on the wavelength).
    const beat = 0.3;
    for (let i = 0; i < 8; i++) {
      const tock = i % 2 === 1;
      noise(ctx, out, {
        start: i * beat,
        duration: 0.035,
        gain: 0.16 * v,
        filter: { type: "bandpass", from: tock ? 1400 : 2600 },
      });
    }
    const C5 = 523.25;
    const E5 = 659.25;
    const G5 = 783.99;
    const A5 = 880;
    const B5 = 987.77;
    const C6 = 1046.5;
    const tune = [C5, E5, G5, E5, A5, G5, B5, C6];
    tune.forEach((f, i) => {
      tone(ctx, out, {
        type: "triangle",
        from: f,
        start: i * beat + 0.02,
        duration: beat * 0.8,
        gain: 0.09 * v,
      });
    });
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
  // A quick rising sweep up a major chord, 8-bit style.
  powerup: (ctx, out, v) => {
    const run = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093];
    run.forEach((f, i) => {
      tone(ctx, out, {
        type: "square",
        from: f,
        start: i * 0.055,
        duration: 0.07,
        gain: 0.05 * v,
      });
    });
  },
  // A square wave sliding down two and a half octaves: down the pipe.
  warp: (ctx, out, v) =>
    tone(ctx, out, {
      type: "square",
      from: 880,
      to: 150,
      start: 0,
      duration: 0.5,
      gain: 0.05 * v,
    }),
  // Two quick square-wave notes a fourth apart: a coin.
  coin: (ctx, out, v) => {
    tone(ctx, out, {
      type: "square",
      from: 1174.66,
      start: 0,
      duration: 0.08,
      gain: 0.05 * v,
    });
    tone(ctx, out, {
      type: "square",
      from: 1567.98,
      start: 0.08,
      duration: 0.3,
      gain: 0.05 * v,
    });
  },
  // Six chirpy notes climbing two octaves, the last one held.
  oneup: (ctx, out, v) => {
    const run = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    run.forEach((f, i) => {
      tone(ctx, out, {
        type: "square",
        from: f,
        start: i * 0.09,
        duration: i === run.length - 1 ? 0.35 : 0.1,
        gain: 0.05 * v,
      });
    });
  },
};
