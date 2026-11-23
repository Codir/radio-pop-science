/**
 * A held page of the bench (`?freeze`, plan decision 16) with the oscilloscope, a stub context (no WebGL; the model in
 * time on the main thread, as a held page has it): a single shot caught on the samples that came stays on the screen
 * — the window computed at once from the board's operating point could never show the edge, which is the whole of
 * `filter/block` (task E4-S, recon E4 §1.1 b) —, and the crests the steps read are the held window's, not those of the
 * samples the stream gave before the page held (E4-S c: `divider/volume`, `filter`).
 */
import { Group, PerspectiveCamera, type Object3D } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { LIVE } from '../../model';
import { mountBench, type Bench, type PresetPart } from '..';

/** A chapter context with only what the bench uses at mount and per frame. */
function stubContext() {
  const root = new Group();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const clock = { dt: 0, time: 0 };
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
  } as unknown as ChapterContext;
  return { ctx, clock };
}

/** `seconds` of frames of 1/60 s; then one held frame (no time), as a held page draws between the checks' steps. */
function frames(bench: Bench, clock: { time: number }, seconds: number): void {
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    clock.time += 1 / 60;
    bench.update(1 / 60, clock.time);
  }
}
const heldFrame = (bench: Bench, clock: { time: number }): void => bench.update(0, clock.time);

/**
 * `filter/block` (its script, «Бачимо»): J1 from the + rail to 13ae, the film 1 μF from 13ae to 15ae, 10 kΩ across the
 * channel from 15ae to 15fj, J2 to the − rail. The probes: channel 1 on 13ae, channel 2 on 15ae (R1's leg).
 */
const BLOCK: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+13', to: 'a13' },
  { id: 'C1', spec: 'film-1u', at: 'c13' },
  { id: 'R1', spec: 'resistor-10k', at: 'e15', o: 1 },
  { id: 'J2', spec: 'jumper', at: 'j15', to: '-15' },
];
const SHOT = {
  display: 'sweep',
  timePerDiv: 0.005,
  voltsPerDiv: 2,
  ground: -2,
  pretrigger: 1,
  trigger: { channel: 1, level: 1, slope: 1, auto: false },
} as const;

/** The sandbox's step `rc`: + rail → J1 → 3ae → 10 kΩ → 7ae → 100 μF → J2 → − rail. */
const RC: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
  { id: 'R1', spec: 'resistor-10k', at: 'b3' },
  { id: 'C1', spec: 'electrolytic-100u-16v', at: 'c7' },
  { id: 'J2', spec: 'jumper', at: 'e8', to: '-8' },
];

describe('a held page with the oscilloscope (`?freeze`; E4-S)', () => {
  beforeEach(() => void vi.stubGlobal('location', { search: '?freeze' }));
  afterEach(() => void vi.unstubAllGlobals());

  it('keeps a single shot caught on the samples that came, instead of the window from the operating point', () => {
    const { ctx, clock } = stubContext();
    const bench = mountBench(ctx);
    bench.preset(BLOCK);
    bench.closed = 0;
    bench.scope = 1;
    bench.oscilloscope.configure(SHOT);
    bench.oscilloscope.put({ ch1: 'e13', ch2: 'e15' });
    const scope = bench.oscilloscope.model;
    // the entry, held: nothing caught yet, so the window at once — the circuit at rest, two flat lines at 0 V
    frames(bench, clock, 0.25);
    heldFrame(bench, clock);
    expect(bench.live.mode).toBe('sync');
    const entry = scope.state();
    expect(entry.holds).toBe(1);
    expect(entry.trigger.found).toBe(false);
    expect(scope.caught).toBe(false);
    expect(Math.max(...entry.points[1]!.v.map(Math.abs))).toBeLessThan(1e-3);
    // the switch closed, time on: the jump of the resistor caught, a division of rest before it
    bench.closed = 1;
    frames(bench, clock, 0.25);
    const shot = scope.state();
    expect(shot.sweeps).toBe(1);
    expect(shot.trigger.found).toBe(true);
    expect(scope.caught).toBe(true);
    expect(shot.max[1]!).toBeGreaterThan(8.5);
    expect(shot.points[1]!.v.at(-1)!).toBeLessThan(0.5);
    expect(shot.points[1]!.x[0]).toBeCloseTo(-5, 6);
    expect(shot.points[1]!.v.filter((_, k) => shot.points[1]!.x[k]! < 0).every((v) => Math.abs(v) < 1e-3)).toBe(true);
    // held frames: the shot stays — no window from the operating point in its place
    heldFrame(bench, clock);
    heldFrame(bench, clock);
    const held = scope.state();
    expect(held.holds).toBe(entry.holds);
    expect(held.hash).toBe(shot.hash);
    expect(held.trigger.found).toBe(true);
    // the switch opened again on the held page: no new edge, the shot still stays
    bench.closed = 0;
    heldFrame(bench, clock);
    expect(scope.state().hash).toBe(shot.hash);
    // a step's new scale: nothing caught, and the held page shows its window again
    bench.oscilloscope.configure({ ...SHOT, timePerDiv: 0.002 });
    heldFrame(bench, clock);
    expect(scope.caught).toBe(false);
    expect(scope.state().holds).toBe(entry.holds + 1);
  });

  it('reads its crests from the held window, not from the samples the stream gave before it', () => {
    const { ctx, clock } = stubContext();
    const bench = mountBench(ctx);
    bench.preset(RC);
    bench.closed = 0;
    bench.scope = 1;
    bench.oscilloscope.configure({ display: 'sweep', timePerDiv: 0.005, voltsPerDiv: 2, ground: -3 });
    bench.oscilloscope.put({ ch1: 'e3', ch2: 'e7' });
    frames(bench, clock, 0.2);
    // the switch closed and 0.6 s on: the stream's capacitor half charged
    bench.closed = 1;
    frames(bench, clock, 0.6);
    const scope = bench.oscilloscope.model;
    const charging = scope.peak(1, 0.5)!;
    expect(charging).toBeGreaterThan(3);
    expect(charging).toBeLessThan(6);
    // held: the window of the board now from its operating point — the capacitor full, 9 V less the scope's input
    heldFrame(bench, clock);
    const window = bench.model.still({ fs: LIVE.rate, count: 2 * scope.spanSamples, taps: bench.oscilloscope.taps() })!;
    const crest = (k: number): number => Math.max(...Array.from(window.samples[k]!, Math.abs));
    expect(crest(1)).toBeGreaterThan(8.8);
    expect(scope.peak(1, 0.5)).toBe(crest(1));
    expect(scope.peak(0, 0.5)).toBe(crest(0));
    // time on: the stream's crests again
    frames(bench, clock, 0.1);
    expect(scope.peak(1, 0.5)!).toBeLessThan(crest(1) - 0.5);
  });
});
