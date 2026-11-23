/**
 * The bench's speaker in sound (`speaker.ts`, E2-10): the scale of its current (1 W on 8 Ω is half of full scale), the
 * output's steps (the volume knob at 0 is a block of zeros), the pace of the model by the output's queue (a request
 * only while fewer than two blocks are queued — on the engine's clock before the gesture and on a fake audio clock
 * after it) and the chapter's mood while the speaker is in the circuit. The board is the sandbox's step `sound`: the
 * player → a 10 kΩ pot as the volume control → the speaker, on the bench's model and its model in time (`live.ts`).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppState, ChapterContext } from '@/engine/api';
import { createLayout, presetState, setSetting, type BoardPreset } from '@electronics/sim/board';
import { createBenchModel } from '../../model/driver';
import { createLive } from '../../model/live';
import { createHandler } from '../../sound/handler';
import type { FromWorker, ToWorker } from '../../sound/protocol';
import type { WorkerLike } from '../../sound/stream';
import { SPEAKER, createSpeaker, speakerFullScale, speakerSamples } from '../speaker';

const RATE = 24000;
const BLOCK = 1536;
const SECONDS = BLOCK / RATE;
/** One step of the output: a 16-bit converter's, 2⁻¹⁵ of full scale. */
const STEP = 2 ** -15;

/** The sandbox's step `sound`: the player's signal on the pot's `cw` (13ae), its common and the pot's `ccw` on the
 * ground row 17ae (J1 to the − rail), the wiper (15ae) to the speaker's plus, its minus on the ground row. */
const VOLUME: BoardPreset = {
  parts: [
    { id: 'P1', spec: 'pot-10k', at: 'b17', o: 2, setting: 1 },
    { id: 'J1', spec: 'jumper', at: 'e17', to: '-17' },
  ],
  leads: { 'pl+': 'c13', 'pl-': 'c17', 'spk+': 'c15', 'spk-': 'a17' },
};

/** The settings and a store that calls its listeners only when the selected value changes (as the engine's). */
function fakeStore() {
  const state = { settings: { audio: true, volume: 0.8 } } as unknown as AppState;
  return { get: () => state, subscribe: () => () => {} };
}

class FakeParam {
  value = 0;
  setTargetAtTime(value: number): void {
    this.value = value;
  }
}
class FakeNode {
  connect<T>(node: T): T {
    return node;
  }
  disconnect(): void {}
}
/** A context whose clock the test moves; it keeps the blocks it was given. */
class FakeContext {
  currentTime = 0;
  state: AudioContextState = 'suspended';
  readonly outputLatency = 0.01;
  readonly destination = new FakeNode();
  readonly started: number[] = [];
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createDynamicsCompressor() {
    const names = ['threshold', 'knee', 'ratio', 'attack', 'release'];
    return Object.assign(new FakeNode(), Object.fromEntries(names.map((n) => [n, new FakeParam()])));
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    const started = this.started;
    return Object.assign(new FakeNode(), {
      buffer: null,
      onended: null,
      start: (at: number) => void started.push(at),
      stop: () => {},
    });
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** A background thread that answers in the order it was asked, when the test says (`due` s of fake time later). */
class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: FromWorker }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  /** Every block request, with the output's queue at the moment it was sent. */
  readonly asked: { at: number; queued: number }[] = [];
  private readonly handler = createHandler(() => 0);
  private readonly waiting: { at: number; reply: FromWorker }[] = [];
  constructor(
    private readonly now: () => number,
    private readonly queued: () => number,
  ) {}
  postMessage(msg: ToWorker): void {
    const out = this.handler.handle(structuredClone(msg))!;
    if (msg.type === 'block') this.asked.push({ at: this.now(), queued: this.queued() });
    this.waiting.push({ at: this.now(), reply: out.reply });
  }
  terminate(): void {}
  /** Every reply older than `delay` s goes back now, in order. */
  answer(delay: number): void {
    while (this.waiting.length > 0 && this.now() - this.waiting[0]!.at >= delay) {
      const { reply } = this.waiting.shift()!;
      this.onmessage?.({ data: reply });
    }
  }
}

let clock: { time: number };
let gesture: () => void;
let ctx: ChapterContext;
let made: FakeContext[];
const settle = () => new Promise((r) => setTimeout(r, 0));
const makeContext = (): AudioContext => {
  const c = new FakeContext();
  made.push(c);
  return c as unknown as AudioContext;
};

beforeEach(() => {
  clock = { time: 0 };
  made = [];
  const g = new Promise<void>((resolve) => (gesture = resolve));
  ctx = { clock, store: fakeStore(), gesture: g, onDispose: () => {} } as unknown as ChapterContext;
});

/** The step's board on the bench's model, the model in time and the speaker behind it. */
function rig(opts: { worker?: FakeWorker | (() => FakeWorker); setting?: number; noaudio?: boolean } = {}) {
  const layout = createLayout();
  const board = presetState(layout, VOLUME);
  if (opts.setting !== undefined) setSetting(board, 'P1', opts.setting);
  const model = createBenchModel({ layout, board });
  model.sync();
  const moods: boolean[] = [];
  const speaker = createSpeaker(ctx, {
    rate: RATE,
    ohms: 8,
    output: { makeContext, noaudio: opts.noaudio ?? false },
    mood: (on) => moods.push(on),
  });
  const currents: Float32Array[] = [];
  /** The stream's index of each block's first sample, beside `currents`. */
  const firsts: number[] = [];
  const worker = opts.worker;
  const live = createLive(ctx, model, {
    frozen: worker === undefined,
    onBlock: () => {},
    sound: {
      part: speaker.part,
      wants: () => speaker.wants(),
      heard: () => speaker.heard(),
      play: (first, current, steps) => {
        currents.push(current.slice(0, steps));
        firsts.push(first);
        speaker.play(first, current, steps);
      },
    },
    makeWorker: worker === undefined ? undefined : () => (typeof worker === 'function' ? worker() : worker),
  });
  live.taps([{ node: 0 }, { node: 0 }]);
  return { layout, board, model, speaker, live, currents, firsts, moods };
}

describe('the speaker’s scale (E2-10)', () => {
  it('1 W on 8 Ω is half of full scale: a steady current, and a sine of that power by its RMS', () => {
    const full = speakerFullScale(8);
    expect(full).toBeCloseTo(2 * Math.sqrt(1 / 8), 12); // 0.7071 A
    expect(SPEAKER).toMatchObject({ watts: 1, share: 0.5, queue: 2 });
    const out = new Float32Array(BLOCK);
    // a steady current that gives the speaker 1 W
    speakerSamples(new Float32Array(BLOCK).fill(Math.sqrt(1 / 8)), full, out);
    expect(out.every((v) => Math.abs(v - 0.5) <= STEP)).toBe(true);
    // a sine whose mean power on 8 Ω is 1 W: its RMS is half of full scale, its peak 0.7071
    const sine = Float32Array.from(
      { length: BLOCK },
      (_, k) => 0.5 * Math.sin((2 * Math.PI * 1000 * k) / RATE),
    );
    speakerSamples(sine, full, out);
    const rms = Math.sqrt(out.reduce((s, v) => s + v * v, 0) / BLOCK);
    expect(rms).toBeCloseTo(0.5, 3);
    expect(Math.max(...out)).toBeCloseTo(Math.SQRT1_2, 3);
    // the rated 2 W at 0.7071 of full scale; 4 W is full scale, and more is held to it
    speakerSamples(new Float32Array(4).fill(0.5), full, out, 4);
    expect(out[0]).toBeCloseTo(Math.SQRT1_2, 4);
    speakerSamples(Float32Array.of(-0.75, 0.75, -2, 2), full, out, 4);
    expect([...out.subarray(0, 4)]).toEqual([-1, 1, -1, 1]);
  });

  it('every sample on a step of a 16-bit output: below half a step is silence; after the model’s last step, zeros', () => {
    const full = speakerFullScale(8);
    const out = new Float32Array(6);
    const below = 0.49 * STEP * full;
    speakerSamples(Float32Array.of(below, -below, 1e-9, 0.75 * STEP * full, 0.2, 0.2), full, out, 4);
    expect([...out]).toEqual([0, 0, 0, STEP, 0, 0]);
    for (const v of out) expect(Number.isInteger(v / STEP)).toBe(true);
  });

  it('the volume knob at 0: the model’s speaker current is all but none, and the block a block of zeros', () => {
    const { speaker, live, model, currents } = rig({ setting: 0 });
    for (let k = 0; k < 60; k++) {
      clock.time += 1 / 60;
      model.sync();
      live.update(1 / 60, true);
    }
    expect(live.mode).toBe('sync');
    expect(speaker.blocks).toBeGreaterThan(3);
    // the 1 mΩ end of the track across the speaker: a few nanoamperes, far below half a step (10.8 μA)
    const most = Math.max(...currents.flatMap((c) => [...c].map(Math.abs)));
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(1e-7);
    for (const l of speaker.levels) expect(l).toMatchObject({ peak: 0, rms: 0 });
    expect(speaker.last.every((v) => v === 0)).toBe(true);
  });

  it('the knob at its top: the player straight on the speaker, 0.3 V behind 32 Ω into 8 Ω', () => {
    const { speaker, live, model, currents } = rig({ setting: 1 });
    for (let k = 0; k < 120; k++) {
      clock.time += 1 / 60;
      model.sync();
      live.update(1 / 60, true);
    }
    const most = Math.max(...currents.flatMap((c) => [...c].map(Math.abs)));
    // the melody's peak within its 0.3 V: at most 0.3 / (32 + 8 ‖ 10 kΩ) ≈ 7.5 mA
    expect(most).toBeGreaterThan(1e-3);
    expect(most).toBeLessThan(0.3 / 40 + 1e-6);
    const peak = Math.max(...speaker.levels.map((l) => l.peak));
    expect(peak).toBeCloseTo(most / speakerFullScale(8), 4);
  });
});

describe('the pace of the model by the output’s queue (E2-10)', () => {
  it('a block is asked only while fewer than two are queued: on the engine’s clock, then on a fake audio clock', async () => {
    let w: FakeWorker | null = null;
    const now = (): number => (made[0]?.state === 'running' ? made[0].currentTime : clock.time);
    const { speaker, live, model } = rig({
      worker: () => (w = new FakeWorker(now, () => speaker.output.queued)),
    });
    /** `seconds` of frames of 1/60 s, the replies coming back 20 ms after the request (the model's time a block). */
    const run = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.004) {
        clock.time += 0.004;
        if (made[0]?.state === 'running') made[0].currentTime += 0.004;
        w?.answer(0.02);
        if (Math.round(t / 0.004) % 4 === 0) {
          model.sync();
          live.update(1 / 60, true);
        }
        expect(speaker.output.queued).toBeLessThanOrEqual(SPEAKER.queue);
      }
    };
    run(1); // before the gesture: silently, on the engine's clock
    expect(speaker.output.clock).toBe('engine');
    expect(live.mode).toBe('worker');
    const silent = w!.asked.length;
    expect(silent).toBeGreaterThan(1 / SECONDS - 3);
    gesture();
    await settle();
    made[0]!.state = 'running';
    made[0]!.currentTime = 2;
    run(10);
    expect(speaker.output.clock).toBe('audio');
    const asked = w!.asked;
    for (const a of asked) expect(a.queued, `a request at ${a.at.toFixed(3)} s`).toBeLessThan(SPEAKER.queue);
    // the sound runs on without a gap: ten seconds of blocks, none late
    expect(speaker.output.underruns).toBe(0);
    expect(asked.length - silent).toBeGreaterThan(10 / SECONDS - 3);
    expect(speaker.output.played).toBeGreaterThan(10 / SECONDS - 4);
    for (let k = 1; k < made[0]!.started.length; k++)
      expect(made[0]!.started[k]).toBeCloseTo(made[0]!.started[k - 1]! + SECONDS, 9);
    // what the scope shows is the sample heard now
    expect(live.now).toBe(speaker.heard());
  });

  it('wants a block while fewer than two are queued', () => {
    const { speaker } = rig();
    const block = new Float32Array(BLOCK);
    expect(speaker.wants()).toBe(true);
    speaker.play(0, block, BLOCK);
    expect(speaker.wants()).toBe(true);
    speaker.play(BLOCK, block, BLOCK);
    expect(speaker.output.queued).toBe(2);
    expect(speaker.wants()).toBe(false);
    clock.time += 0.05 + SECONDS + 1e-6; // the first has played
    expect(speaker.wants()).toBe(true);
  });
});

describe('the speaker’s crest (E3-9): the largest voltage on it over the last seconds heard', () => {
  /** `seconds` of frames of 1/60 s on the main thread. */
  const run = (r: ReturnType<typeof rig>, seconds: number): void => {
    for (let k = 0; k < Math.round(seconds * 60); k++) {
      clock.time += 1 / 60;
      r.model.sync();
      r.live.update(1 / 60, true);
    }
  };
  /** |I| × 8 Ω of every sample given, by the stream's index. */
  const volts = (r: ReturnType<typeof rig>): Map<number, number> => {
    const v = new Map<number, number>();
    r.currents.forEach((c, b) => c.forEach((x, k) => v.set(r.firsts[b]! + k, Math.abs(x) * 8)));
    return v;
  };
  const most = (v: Map<number, number>, from: number, to: number): number => {
    let m = 0;
    for (let i = Math.max(0, Math.floor(from)); i < to; i++) m = Math.max(m, v.get(i) ?? 0);
    return m;
  };

  it('|I| × R of the samples heard, within a chunk of 10 ms at either end of the window; null before any block', () => {
    const r = rig({ setting: 1 });
    expect(r.speaker.peak(0.5)).toBeNull();
    run(r, 2);
    const heard = r.speaker.heard()!;
    expect(heard).toBeGreaterThan(0.5 * RATE);
    const v = volts(r);
    const crest = r.speaker.peak(0.5)!;
    // the player straight on the speaker: 0.3 V behind 32 Ω into 8 Ω ‖ 10 kΩ, at most ≈ 0.06 V
    expect(crest).toBeGreaterThan(0.03);
    expect(crest).toBeLessThan(0.3 * (8 / 40) + 1e-6);
    // the window: the chunks of 240 samples wholly heard whose end lies within the last 0.5 s
    expect(crest).toBeGreaterThanOrEqual(most(v, heard - 0.5 * RATE + 240, heard - 240) - 1e-9);
    expect(crest).toBeLessThanOrEqual(most(v, heard - 0.5 * RATE - 240, heard) + 1e-9);
    // a shorter window is never larger; a window of nothing is null
    expect(r.speaker.peak(0.1)!).toBeLessThanOrEqual(crest);
    expect(r.speaker.peak(0)).toBeNull();
  });

  it('the speaker out of the circuit: silence, 0 V once its window has passed; the knob at 0 next to nothing', () => {
    const r = rig({ setting: 1 });
    run(r, 1);
    expect(r.speaker.peak(0.5)!).toBeGreaterThan(0.03);
    r.board.leads.delete('spk+');
    run(r, 1);
    expect(r.speaker.peak(0.5)).toBe(0);
    const q = rig({ setting: 0 });
    run(q, 1);
    // the 1 mΩ end of the track across the speaker: a few nanoamperes, some 10 nV on 8 Ω
    expect(q.speaker.peak(0.5)!).toBeLessThan(1e-6);
  });
});

describe('the chapter’s mood while the speaker is in the circuit (VISUAL §1, principle 3)', () => {
  it('silent while the speaker is in the circuit, back once it leaves; told only on a change', () => {
    const { speaker, moods } = rig();
    speaker.circuit(false);
    expect(moods).toEqual([]);
    speaker.circuit(true);
    speaker.circuit(true);
    expect(moods).toEqual([true]);
    expect(speaker.inCircuit).toBe(true);
    speaker.circuit(false);
    expect(moods).toEqual([true, false]);
  });
});
