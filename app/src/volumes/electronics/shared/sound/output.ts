/**
 * The volume's own sound output (the design §6.3): the engine plays only its own sounds (`src/audio`), so the volume
 * plays what the circuit model gives the speaker through an `AudioContext` of its own.
 *
 * - It starts only after the first gesture the engine sees (`ctx.gesture`: a press on the scene or a key), and never
 *   with `?noaudio` in the page's address (read here as the engine reads it: `parseFlags` in `engine/app.ts`; a
 *   chapter has no `flags`). Until then, and for good when there is no Web Audio, it plays silently on the engine's
 *   clock, so the model, the scope and the counters run all the same.
 * - It follows the engine's settings (`ctx.store` → `settings.audio`, `settings.volume`) as the engine's own master
 *   bus does: the gain is volume² × 0.55, or 0 with the sound off, eased over 0.05 s; it goes through a limiter of the
 *   engine's own settings, so it is never louder than the engine's own sounds.
 * - Blocks are planned on `AudioContext.currentTime` (`BlockPlan`): back to back while they come in time, at most
 *   three on the plan; a block that comes late is an underrun. Each block is clamped to ±1 after its `scale`.
 * - It pauses with the tab (the context is suspended while the page is hidden) and is freed with the chapter
 *   (`ctx.onDispose`): its sources stop, the context closes.
 */
import type { ChapterContext } from '@/engine/api';
import { BlockPlan, PLAN_CAPACITY } from './plan';

/** The engine's master level (`MASTER_LEVEL`, src/audio/engine.ts): the gain at full volume. */
export const OUTPUT_LEVEL = 0.55;
/** The time constant of a change of the gain (s), as the engine's. */
const SETTLE = 0.05;
/** The engine's limiter (src/audio/engine.ts). */
const LIMITER = { threshold: -12, knee: 6, ratio: 20, attack: 0.003, release: 0.25 } as const;

/**
 * `off` — never plays (`?noaudio`, no Web Audio, or the context could not be made); `waiting` — until the first
 * gesture; then the state of the context (`suspended`, `running`, `closed`, …).
 */
export type SoundState = 'off' | 'waiting' | AudioContextState | 'interrupted';

export interface SoundOutOptions {
  /** Samples per second of the blocks. */
  rate: number;
  /** Blocks on the plan at most (3 when absent). */
  capacity?: number;
  /** Stay silent: `?noaudio` in the page's address when absent. */
  noaudio?: boolean;
  /** The context (tests); `new AudioContext` at the blocks' rate when absent. */
  makeContext?: (rate: number) => AudioContext;
}

export interface SoundOut {
  readonly state: SoundState;
  /** Which clock the blocks are planned on: the engine's (silent) or the context's. */
  readonly clock: 'engine' | 'audio';
  /** Blocks whose end has passed. */
  readonly played: number;
  /** Blocks that came after the sound had run out (counted on the context's clock only). */
  readonly underruns: number;
  /** Blocks on the plan, not yet ended. */
  readonly queued: number;
  /** How many more blocks the output takes now. */
  readonly room: number;
  /** How long until a block asked for now could be heard, s: the sound planned ahead plus the context's latency. */
  readonly latency: number;
  /** The gain the settings ask for (0 with the sound off). */
  readonly gain: number;
  /** The gain the context applies now (NaN without a context). */
  readonly gainNow: number;
  /** The output's clock, s. */
  now(): number;
  /** Plays `samples` × `scale` (clamped to ±1) after the blocks before; false when the plan is full. */
  enqueue(samples: Float32Array, at: { first: number; scale?: number }): boolean;
  /** The stream's sample heard now; null before any block. */
  heard(): number | null;
  dispose(): void;
}

/** `?noaudio` in the page's address, as `parseFlags` (engine/app.ts) reads it. */
export function noaudioFlag(): boolean {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).has('noaudio');
}

/** A promise of the context whose failure changes nothing (a context closed meanwhile refuses to resume). */
const quietly = (p: Promise<void>): void => void p.catch(() => undefined);

/** A context at the blocks' rate (no resampling per block), or at the device's rate when that is refused. */
function newContext(rate: number): AudioContext {
  try {
    return new AudioContext({ latencyHint: 'interactive', sampleRate: rate });
  } catch {
    return new AudioContext({ latencyHint: 'interactive' });
  }
}

export function createSoundOut(ctx: ChapterContext, options: SoundOutOptions): SoundOut {
  const rate = options.rate;
  const plan = new BlockPlan({ rate, capacity: options.capacity ?? PLAN_CAPACITY }, false);
  const noaudio = options.noaudio ?? noaudioFlag();
  const make =
    options.makeContext ?? (typeof AudioContext === 'undefined' ? null : (r: number) => newContext(r));
  let state: SoundState = noaudio || make === null ? 'off' : 'waiting';
  let clock: 'engine' | 'audio' = 'engine';
  let audio: AudioContext | null = null;
  let master: GainNode | null = null;
  let limiter: DynamicsCompressorNode | null = null;
  const sources = new Set<AudioBufferSourceNode>();
  let disposed = false;

  const target = (): number => {
    const s = ctx.store.get().settings;
    const v = Math.max(0, Math.min(1, s.volume));
    return s.audio ? v * v * OUTPUT_LEVEL : 0;
  };
  const applyGain = (): void => {
    if (audio === null || master === null || disposed) return;
    master.gain.setTargetAtTime(target(), audio.currentTime, SETTLE);
  };
  const offAudio = ctx.store.subscribe((s) => s.settings.audio, applyGain);
  const offVolume = ctx.store.subscribe((s) => s.settings.volume, applyGain);

  const hidden = (): void => {
    if (audio === null || disposed) return;
    if (document.hidden) quietly(audio.suspend());
    else quietly(audio.resume());
  };
  const watchTab = typeof document !== 'undefined';
  if (watchTab) document.addEventListener('visibilitychange', hidden);

  /** The plan moves to the context's clock once it runs: the silent blocks before are dropped. */
  const now = (): number => {
    if (clock === 'engine' && audio !== null && audio.state === 'running') {
      clock = 'audio';
      plan.reset(true);
    }
    return clock === 'audio' ? audio!.currentTime : ctx.clock.time;
  };

  const start = (): void => {
    if (disposed || state !== 'waiting' || make === null) return;
    try {
      audio = make(rate);
    } catch {
      state = 'off';
      return;
    }
    limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = LIMITER.threshold;
    limiter.knee.value = LIMITER.knee;
    limiter.ratio.value = LIMITER.ratio;
    limiter.attack.value = LIMITER.attack;
    limiter.release.value = LIMITER.release;
    master = audio.createGain();
    master.gain.value = target();
    master.connect(limiter).connect(audio.destination);
    if (!(watchTab && document.hidden)) quietly(audio.resume());
  };
  void ctx.gesture.then(start);

  const out: SoundOut = {
    get state() {
      return audio === null ? state : (audio.state as SoundState);
    },
    get clock() {
      now();
      return clock;
    },
    get played() {
      plan.advance(now());
      return plan.played;
    },
    get underruns() {
      return plan.underruns;
    },
    get queued() {
      return plan.queued(now());
    },
    get room() {
      return disposed ? 0 : plan.room(now());
    },
    get latency() {
      const t = now();
      const device = clock === 'audio' ? (audio!.outputLatency ?? 0) || (audio!.baseLatency ?? 0) : 0;
      return plan.ahead(t) + device;
    },
    get gain() {
      return target();
    },
    get gainNow() {
      return master === null ? Number.NaN : master.gain.value;
    },
    now,

    enqueue(samples, at) {
      if (disposed) return false;
      const t = now();
      const begin = plan.add(t, samples.length, at.first);
      if (begin === null) return false;
      if (clock !== 'audio') return true;
      const a = audio!;
      const scale = at.scale ?? 1;
      const buffer = a.createBuffer(1, samples.length, rate);
      const data = buffer.getChannelData(0);
      for (let k = 0; k < samples.length; k++) data[k] = Math.max(-1, Math.min(1, samples[k]! * scale));
      const source = a.createBufferSource();
      source.buffer = buffer;
      source.connect(master!);
      source.onended = () => {
        source.disconnect();
        sources.delete(source);
      };
      sources.add(source);
      source.start(begin);
      return true;
    },

    heard() {
      return plan.at(now());
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      offAudio();
      offVolume();
      if (watchTab) document.removeEventListener('visibilitychange', hidden);
      for (const s of sources) {
        s.onended = null;
        try {
          s.stop();
        } catch {
          // a source that has not started, or has ended, may refuse to stop
        }
        s.disconnect();
      }
      sources.clear();
      master?.disconnect();
      limiter?.disconnect();
      if (audio !== null) quietly(audio.close());
      else state = 'off';
    },
  };

  ctx.onDispose(() => out.dispose());
  return out;
}
