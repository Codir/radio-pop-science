import { beforeEach, describe, expect, it } from 'vitest';
import type { AppState, ChapterContext } from '@/engine/api';
import { createSoundOut, OUTPUT_LEVEL } from '../output';
import { PLAN_LEAD } from '../plan';

const RATE = 24000;
const BLOCK = 2048;
const SECONDS = BLOCK / RATE;

/** An AudioParam that remembers its value and the last target it was sent to. */
class FakeParam {
  value = 0;
  targets: { value: number; at: number; tau: number }[] = [];
  setTargetAtTime(value: number, at: number, tau: number): void {
    this.targets.push({ value, at, tau });
    this.value = value; // the fake reaches its target at once
  }
}

class FakeNode {
  readonly into: FakeNode[] = [];
  disconnected = 0;
  connect<T extends FakeNode>(node: T): T {
    this.into.push(node);
    return node;
  }
  disconnect(): void {
    this.disconnected++;
  }
}

class FakeSource extends FakeNode {
  buffer: { data: Float32Array } | null = null;
  startedAt: number | null = null;
  stopped = 0;
  onended: (() => void) | null = null;
  start(at: number): void {
    this.startedAt = at;
  }
  stop(): void {
    this.stopped++;
  }
}

/** A context whose clock and state the test moves. */
class FakeContext {
  currentTime = 0;
  state: AudioContextState = 'suspended';
  resumed = 0;
  suspended = 0;
  closed = 0;
  readonly outputLatency = 0.02;
  readonly destination = new FakeNode();
  readonly gains: (FakeNode & { gain: FakeParam })[] = [];
  readonly limiters: (FakeNode & Record<string, FakeParam>)[] = [];
  readonly sources: FakeSource[] = [];
  constructor(readonly sampleRate: number) {}
  createGain() {
    const g = Object.assign(new FakeNode(), { gain: new FakeParam() });
    this.gains.push(g);
    return g;
  }
  createDynamicsCompressor() {
    const names = ['threshold', 'knee', 'ratio', 'attack', 'release'];
    const c = Object.assign(new FakeNode(), Object.fromEntries(names.map((n) => [n, new FakeParam()])));
    this.limiters.push(c);
    return c;
  }
  createBuffer(_channels: number, length: number, _rate: number) {
    const data = new Float32Array(length);
    return { data, getChannelData: () => data };
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  resume(): Promise<void> {
    this.resumed++;
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspended++;
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed++;
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** The settings and a store that calls its listeners as the engine's does: only when the selected value changes. */
function fakeStore() {
  let state = { settings: { audio: true, volume: 0.8 } } as unknown as AppState;
  const subs = new Set<{ select: (s: AppState) => unknown; listener: () => void; last: unknown }>();
  return {
    get: () => state,
    subscribe(select: (s: AppState) => unknown, listener: () => void) {
      const sub = { select, listener, last: select(state) };
      subs.add(sub);
      return () => subs.delete(sub);
    },
    settings(patch: Partial<AppState['settings']>) {
      state = { ...state, settings: { ...state.settings, ...patch } };
      for (const s of [...subs]) {
        const next = s.select(state);
        if (!Object.is(next, s.last)) {
          s.last = next;
          s.listener();
        }
      }
    },
    listeners: () => subs.size,
  };
}

let clock: { time: number };
let store: ReturnType<typeof fakeStore>;
let disposers: (() => void)[];
let gesture: () => void;
let ctx: ChapterContext;
let made: FakeContext[];
const makeContext = (rate: number): AudioContext => {
  const c = new FakeContext(rate);
  made.push(c);
  return c as unknown as AudioContext;
};
/** Lets the promise of the gesture call its listeners. */
const settle = () => new Promise((r) => setTimeout(r, 0));
const block = (value = 0.5): Float32Array => new Float32Array(BLOCK).fill(value);

beforeEach(() => {
  clock = { time: 10 };
  store = fakeStore();
  disposers = [];
  made = [];
  const g = new Promise<void>((resolve) => (gesture = resolve));
  ctx = {
    clock,
    store,
    gesture: g,
    onDispose: (fn: () => void) => disposers.push(fn),
  } as unknown as ChapterContext;
});

describe('the sound output', () => {
  it('waits for the gesture; until then it plays silently on the engine clock', async () => {
    const out = createSoundOut(ctx, { rate: RATE, makeContext });
    expect(out.state).toBe('waiting');
    expect(out.clock).toBe('engine');
    expect(out.room).toBe(3);
    expect(out.enqueue(block(), { first: 0 })).toBe(true);
    expect(out.enqueue(block(), { first: BLOCK })).toBe(true);
    expect(out.heard()).toBe(0);
    clock.time += PLAN_LEAD + SECONDS + 0.00102;
    expect(out.played).toBe(1);
    expect(out.queued).toBe(1);
    expect(out.heard()).toBe(BLOCK + 24);
    clock.time += 1; // nothing came for a second: no underrun on a clock nobody hears
    out.enqueue(block(), { first: 2 * BLOCK });
    expect(out.underruns).toBe(0);
    await settle();
    expect(made).toHaveLength(0);
  });

  it('after the gesture: its own context at the blocks’ rate, the gain of the settings, the engine’s limiter', async () => {
    const out = createSoundOut(ctx, { rate: RATE, makeContext });
    gesture();
    await settle();
    expect(made).toHaveLength(1);
    const a = made[0]!;
    expect(a.sampleRate).toBe(RATE);
    expect(a.resumed).toBe(1);
    const [master] = a.gains;
    const [limiter] = a.limiters;
    expect(master!.gain.value).toBeCloseTo(0.8 * 0.8 * OUTPUT_LEVEL, 12);
    expect(OUTPUT_LEVEL).toBe(0.55);
    expect(master!.into).toEqual([limiter]);
    expect(limiter!.into).toEqual([a.destination]);
    expect(
      Object.fromEntries(
        ['threshold', 'knee', 'ratio', 'attack', 'release'].map((k) => [k, limiter![k]!.value]),
      ),
    ).toEqual({ threshold: -12, knee: 6, ratio: 20, attack: 0.003, release: 0.25 });
    expect(out.state).toBe('suspended');
    expect(out.clock).toBe('engine'); // not running yet: still silent
    a.state = 'running';
    a.currentTime = 3;
    expect(out.state).toBe('running');
    expect(out.clock).toBe('audio');
    expect(out.gain).toBeCloseTo(0.352, 12);
    expect(out.gainNow).toBeCloseTo(0.352, 12);
  });

  it('plans blocks back to back on currentTime, at most three, and counts underruns and played blocks', async () => {
    const out = createSoundOut(ctx, { rate: RATE, makeContext });
    gesture();
    await settle();
    const a = made[0]!;
    a.state = 'running';
    a.currentTime = 5;
    let first = 0;
    for (let k = 0; k < 3; k++) {
      expect(out.enqueue(block(0.4), { first, scale: 2 })).toBe(true);
      first += BLOCK;
    }
    expect(out.enqueue(block(), { first })).toBe(false); // full
    expect(a.sources).toHaveLength(3);
    const starts = a.sources.map((s) => s.startedAt!);
    expect(starts[0]).toBeCloseTo(5 + PLAN_LEAD, 12);
    expect(starts[1]).toBeCloseTo(starts[0]! + SECONDS, 12);
    expect(starts[2]).toBeCloseTo(starts[1]! + SECONDS, 12);
    expect(a.sources[0]!.buffer!.data[0]).toBeCloseTo(0.8, 6); // × scale
    expect(a.sources[0]!.into).toEqual([a.gains[0]]);
    expect(out.latency).toBeCloseTo(PLAN_LEAD + 3 * SECONDS + a.outputLatency, 12);

    // the clock runs 30 s; a block comes whenever there is room, 5 ms after the room appears: no gap
    while (a.currentTime < 35) {
      a.currentTime += 0.005;
      if (out.room > 0) {
        expect(out.enqueue(block(), { first })).toBe(true);
        first += BLOCK;
      }
      expect(out.queued).toBeLessThanOrEqual(3);
    }
    expect(out.underruns).toBe(0);
    for (let k = 1; k < a.sources.length; k++)
      expect(a.sources[k]!.startedAt).toBeCloseTo(a.sources[k - 1]!.startedAt! + SECONDS, 9);
    expect(out.played).toBeGreaterThan(30 / SECONDS - 4);

    // the producer stalls for half a second: the sound runs out, the next block is an underrun
    a.currentTime += 0.5;
    expect(out.queued).toBe(0);
    expect(out.enqueue(block(2), { first })).toBe(true);
    expect(out.underruns).toBe(1);
    const last = a.sources.at(-1)!;
    expect(last.startedAt).toBeCloseTo(a.currentTime + PLAN_LEAD, 12);
    expect(last.buffer!.data.every((v) => v === 1)).toBe(true); // clamped to ±1
  });

  it('follows the sound and volume settings', async () => {
    const out = createSoundOut(ctx, { rate: RATE, makeContext });
    gesture();
    await settle();
    const master = made[0]!.gains[0]!;
    store.settings({ audio: false });
    expect(out.gain).toBe(0);
    expect(master.gain.targets.at(-1)).toMatchObject({ value: 0, tau: 0.05 });
    expect(out.gainNow).toBe(0);
    store.settings({ audio: true, volume: 0.5 });
    expect(master.gain.targets.at(-1)!.value).toBeCloseTo(0.25 * OUTPUT_LEVEL, 12);
    expect(out.gain).toBeCloseTo(0.25 * OUTPUT_LEVEL, 12);
  });

  it('with ?noaudio no context is made, and the model plays on silently', async () => {
    const out = createSoundOut(ctx, { rate: RATE, makeContext, noaudio: true });
    expect(out.state).toBe('off');
    gesture();
    await settle();
    expect(made).toHaveLength(0);
    expect(out.state).toBe('off');
    expect(out.clock).toBe('engine');
    expect(out.enqueue(block(), { first: 0 })).toBe(true);
    expect(Number.isNaN(out.gainNow)).toBe(true);
  });

  it('a context that cannot be made leaves the output off', async () => {
    const out = createSoundOut(ctx, {
      rate: RATE,
      makeContext: () => {
        throw new Error('no device');
      },
    });
    gesture();
    await settle();
    expect(out.state).toBe('off');
    expect(out.enqueue(block(), { first: 0 })).toBe(true);
  });

  it('is freed with the chapter: sources stop, the context closes, the settings are no longer heard', async () => {
    const out = createSoundOut(ctx, { rate: RATE, makeContext });
    expect(disposers).toHaveLength(1);
    expect(store.listeners()).toBe(2);
    gesture();
    await settle();
    const a = made[0]!;
    a.state = 'running';
    out.enqueue(block(), { first: 0 });
    out.enqueue(block(), { first: BLOCK });
    disposers[0]!();
    out.dispose();
    expect(a.closed).toBe(1);
    expect(out.state).toBe('closed');
    expect(a.sources.every((s) => s.stopped === 1 && s.disconnected === 1)).toBe(true);
    expect(a.gains[0]!.disconnected).toBe(1);
    expect(store.listeners()).toBe(0);
    expect(out.enqueue(block(), { first: 2 * BLOCK })).toBe(false);
    expect(out.room).toBe(0);
  });

  it('a chapter left before the gesture never makes a context', async () => {
    const out = createSoundOut(ctx, { rate: RATE, makeContext });
    out.dispose();
    gesture();
    await settle();
    expect(made).toHaveLength(0);
    expect(out.state).toBe('off');
  });
});
