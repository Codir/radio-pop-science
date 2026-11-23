/**
 * `mountBench` with the option `sound` (E2-10), a stub context (no WebGL, no Web Audio: the output plays silently on
 * the engine's clock): the speaker plays what the circuit model gives it on the board of the sandbox's step `sound`
 * (the player → a 10 kΩ pot as the volume control → the speaker), the model in time runs from the mount paced by the
 * output (never more than two blocks queued), the knob at 0 is a block of zeros, the speaker out of the circuit is
 * silence while the player plays on; without the option, no speaker and the model in time only with the scope.
 */
import { Group, PerspectiveCamera, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { AppState, ChapterContext } from '@/engine/api';
import { seatLead } from '@electronics/sim/board';
import { mountBench, setSetting, type Bench, type PresetPart } from '..';
import { SPEAKER } from '../../instruments';

/** A chapter context with what the bench uses at mount and per frame, and the sound output's store and gesture. */
function stubContext() {
  const root = new Group();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const clock = { dt: 0, time: 0 };
  const settings = { audio: true, volume: 0.8 } as AppState['settings'];
  const ctx = {
    root,
    clock,
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: (_n: string, _t: Object3D | (() => unknown)) => () => {} },
    input: { register: () => () => {}, on: () => () => {} },
    device: { formFactor: 'desktop', hover: true },
    viewport: { width: 1920, height: 1080, aspect: 1920 / 1080, dpr: 1 },
    quality: { count: (n: number) => n },
    random: { next, range: (a: number, b: number) => a + (b - a) * next() },
    env: {
      base: () => {},
      setScale: () => {},
      setShadow: () => {},
      tune: () => {},
      params: { keyIntensity: 0 },
    },
    post: { base: () => {} },
    camera: { shots: () => {}, camera: new PerspectiveCamera(27, 1920 / 1080, 0.1, 100) },
    renderer: { info: { render: { calls: 0 } } },
    store: { get: () => ({ settings }) as AppState, subscribe: () => () => {} },
    gesture: new Promise<void>(() => {}),
    manifest: { theme: { accent: 'teal', sky: 'studio', mood: 'studio' } },
  } as unknown as ChapterContext;
  return { ctx, clock };
}

/** The sandbox's step `sound`: the player's signal on the pot's `cw` (13ae), the wiper (15ae) to the speaker's plus,
 * the pot's `ccw`, the player's common and the speaker's minus on the ground row 17ae (J1 to the − rail). */
const VOLUME: readonly PresetPart[] = [
  { id: 'P1', spec: 'pot-10k', at: 'b17', o: 2, setting: 1 },
  { id: 'J1', spec: 'jumper', at: 'e17', to: '-17' },
];
const LEADS = { 'pl+': 'c13', 'pl-': 'c17', 'spk+': 'c15', 'spk-': 'a17' } as const;

/** `seconds` of frames of 1/60 s on the engine's clock. */
function frames(bench: Bench, clock: { time: number }, seconds: number, each?: () => void): void {
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    clock.time += 1 / 60;
    bench.update(1 / 60, clock.time);
    each?.();
  }
}

describe('the bench with the speaker in sound (E2-10)', () => {
  it('plays the model’s speaker current through its output, paced by it, from the mount on', () => {
    const { ctx, clock } = stubContext();
    const bench = mountBench(ctx, { sound: true });
    const speaker = bench.speaker!;
    expect(speaker).not.toBeNull();
    expect(speaker.output.state).toBe('off'); // no Web Audio here: silently, on the engine's clock
    bench.preset(VOLUME, LEADS);
    frames(bench, clock, 2, () => expect(speaker.output.queued).toBeLessThanOrEqual(SPEAKER.queue));
    // no oscilloscope came: the model in time runs for the speaker (the main thread: no Worker in tests)
    expect(bench.scope).toBe(0);
    expect(bench.live.mode).toBe('sync');
    expect(speaker.inCircuit).toBe(true);
    expect(speaker.blocks).toBeGreaterThan(2 / (1536 / 24000) - 4);
    const loud = speaker.levels.slice(-8);
    expect(Math.max(...loud.map((l) => l.peak))).toBeGreaterThan(1e-3);
    // what the scope would show is the sample heard now
    expect(bench.live.now).toBe(speaker.output.heard());
  });

  it('the volume knob at 0: blocks of zeros; the speaker out of the circuit: silence, and the player plays on', () => {
    const { ctx, clock } = stubContext();
    const bench = mountBench(ctx, { sound: true });
    const speaker = bench.speaker!;
    bench.preset(VOLUME, LEADS);
    frames(bench, clock, 1);
    expect(Math.max(...speaker.levels.slice(-4).map((l) => l.peak))).toBeGreaterThan(1e-3);
    setSetting(bench.state, 'P1', 0);
    const turned = speaker.blocks;
    frames(bench, clock, 1);
    // every block asked after the knob turned (those on the output's queue were asked before)
    const after = speaker.levels.slice(turned - speaker.blocks);
    expect(after.length).toBeGreaterThan(10);
    for (const l of after) expect(l, `block at ${l.first}`).toMatchObject({ peak: 0, rms: 0 });
    // the knob back up, then the speaker's plus out of its socket: out of the circuit, silent; the model plays on
    setSetting(bench.state, 'P1', 1);
    frames(bench, clock, 0.5);
    expect(Math.max(...speaker.levels.slice(-4).map((l) => l.peak))).toBeGreaterThan(1e-3);
    const before = bench.live.blocks;
    expect(seatLead(bench.layout, bench.state, 'spk+', null)).toBe(true);
    const out = speaker.blocks;
    frames(bench, clock, 1);
    expect(speaker.inCircuit).toBe(false);
    const silent = speaker.levels.slice(out - speaker.blocks);
    expect(silent.length).toBeGreaterThan(10);
    for (const l of silent) expect(l.peak).toBe(0);
    // the same stream on: no new start (the melody runs on), the blocks keep coming
    expect(bench.live.blocks).toBeGreaterThan(before + 10);
    expect(bench.live.since).toBeCloseTo(silent[0]!.first / 24000, 9);
  });

  it('without the option: no speaker, no sound output, and the model in time only while the scope is there', () => {
    const { ctx, clock } = stubContext();
    const bench = mountBench(ctx);
    expect(bench.speaker).toBeNull();
    bench.preset(VOLUME, LEADS);
    frames(bench, clock, 0.5);
    expect(bench.live.mode).toBe('off');
    bench.scope = 1;
    frames(bench, clock, 0.5);
    expect(bench.live.mode).toBe('sync');
    expect(bench.live.blocks).toBeGreaterThan(3);
  });
});
