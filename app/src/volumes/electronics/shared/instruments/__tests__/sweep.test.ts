/**
 * The oscilloscope's sweep (`sweep.ts`, `scope-model.ts`) and a held page's window (`BenchModel.still`): the min/max
 * decimation keeps a sine's extremes in at most 600 points, writing into the instrument's own arrays; the trigger
 * finds a sine's edge at its level, the way its slope says and not before its holdoff, and with `auto` the sweep runs
 * free when there is no edge; the board's chart is filled on `init` and drawn again on `update` only when a new sweep
 * came; and the held page's window is the same, number for number, every time it is computed.
 */
import { describe, expect, it } from 'vitest';
import type { ChartApi } from '@/ui3d';
import { createLayout, presetState, type BoardPreset } from '@electronics/sim/board';
import { createBenchModel } from '../../model';
import { SCOPE_GRID, SCREEN_POINTS, SWEEP_BUCKETS, ScopeModel } from '../scope-model';
import { decimateMinMax, findTrigger } from '../sweep';

const FS = 24000;
/** A sine of `hertz` and amplitude `a`, `n` samples from sample `first` (sin = 0 at sample 0, rising). */
function sine(n: number, hertz: number, a: number, first = 0): Float32Array {
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = a * Math.sin((2 * Math.PI * hertz * (first + k)) / FS);
  return out;
}

describe('decimateMinMax', () => {
  // 50 Hz: 480 samples a period, a sample on every crest and trough (k = 120, 360 … of each period)
  const A = 0.7;
  const src = sine(4800, 50, A);

  it('keeps the extremes of a sine (± 1e-6), every bucket’s own smallest and largest, in time order', () => {
    const t = new Float64Array(2 * SWEEP_BUCKETS);
    const v = new Float32Array(2 * SWEEP_BUCKETS);
    const n = decimateMinMax(src, 0, src.length, SWEEP_BUCKETS, t, v, 0, 1 / FS);
    expect(n).toBe(2 * SWEEP_BUCKETS);
    expect(n).toBeLessThanOrEqual(600);
    expect(Math.max(...v)).toBeCloseTo(A, 6);
    expect(Math.min(...v)).toBeCloseTo(-A, 6);
    for (let b = 0; b < SWEEP_BUCKETS; b++) {
      const bucket = src.subarray((b * 4800) / SWEEP_BUCKETS, ((b + 1) * 4800) / SWEEP_BUCKETS);
      expect([v[2 * b], v[2 * b + 1]].sort((x, y) => x! - y!)).toEqual([Math.min(...bucket), Math.max(...bucket)]);
      expect(t[2 * b]!).toBeLessThanOrEqual(t[2 * b + 1]!);
      if (b > 0) expect(t[2 * b]!).toBeGreaterThan(t[2 * b - 1]!);
    }
    // the points' times are the samples' own
    const k = Math.round(t[1]! * FS);
    expect(v[1]).toBe(src[k]);
  });

  it('writes into the arrays it is given — the same ones, call after call — and allocates none of its own', () => {
    const t = new Float32Array(600);
    const v = new Float32Array(600);
    const before = [t.buffer, v.buffer];
    const n1 = decimateMinMax(src, 0, 4800, 300, t, v, 0, 1);
    const first = v.slice(0, n1);
    const n2 = decimateMinMax(src, 480, 4800 - 480, 300, t, v, 0, 1);
    expect([t.buffer, v.buffer]).toEqual(before);
    expect(n2).toBe(600);
    // a whole period later the same sine: the same extremes
    expect(Math.max(...v.subarray(0, n2))).toBe(Math.max(...first));
  });

  it('reads a ring by the samples’ index; fewer samples than buckets give each sample twice', () => {
    const ring = new Float32Array(1000);
    for (let i = 2500; i < 3500; i++) ring[i % 1000] = i;
    const t = new Float64Array(20);
    const v = new Float32Array(20);
    expect(decimateMinMax(ring, 2995, 10, 5, t, v, 0, 1)).toBe(10);
    expect(Array.from(v)).toEqual([2995, 2996, 2997, 2998, 2999, 3000, 3001, 3002, 3003, 3004, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(decimateMinMax(ring, 3000, 3, 5, t, v, 0, 1)).toBe(6);
    expect(Array.from(v.subarray(0, 6))).toEqual([3000, 3000, 3001, 3001, 3002, 3002]);
    expect(() => decimateMinMax(ring, 0, 100, 50, new Float32Array(10), v, 0, 1)).toThrow(RangeError);
  });
});

describe('findTrigger', () => {
  // 100 Hz: 240 samples a period, rising through 0 at samples 0, 240, 480 …, falling at 120, 360 …
  const ring = sine(2400, 100, 1);

  it('finds the rising edge of a sine at its level', () => {
    const i = findTrigger(ring, 2400, 2400, 0.3, 1, 1, 2399);
    // sin crosses 0.3 rising at asin(0.3) / 2π = 0.0485 of a period: between samples 11 and 12
    expect(i).toBe(12);
    expect(ring[i - 1]!).toBeLessThan(0.3);
    expect(ring[i]!).toBeGreaterThanOrEqual(0.3);
  });

  it('honours the slope: falling through the same level', () => {
    // falling through 0.3 at half a period less 0.0485: between samples 108 and 109
    const i = findTrigger(ring, 2400, 2400, 0.3, -1, 1, 2399);
    expect(i).toBe(109);
    expect(ring[i - 1]!).toBeGreaterThan(0.3);
    expect(ring[i]!).toBeLessThanOrEqual(0.3);
  });

  it('honours the holdoff: not before `earliest`; nothing between two edges; a level never reached', () => {
    expect(findTrigger(ring, 2400, 2400, 0.3, 1, 13, 2399)).toBe(252);
    expect(findTrigger(ring, 2400, 2400, 0.3, 1, 13, 251)).toBe(-1);
    expect(findTrigger(ring, 2400, 2400, 1.5, 1, 1, 2399)).toBe(-1);
  });

  it('searches only what the ring holds', () => {
    const small = new Float32Array(300);
    for (let i = 0; i < 2400; i++) small[i % 300] = ring[i]!;
    // the ring holds 2100 … 2399: the edge at 2172, never one before the oldest sample
    expect(findTrigger(small, 2400, 300, 0.3, 1, 0, 2399)).toBe(2172);
  });
});

/** A scope fed `seconds` of a sine on both channels in blocks, `update` after each with `now` the end of the block. */
function fed(scope: ScopeModel, wave: (first: number, n: number) => Float32Array, blocks: number, block = 400) {
  let sweeps = 0;
  for (let b = 0; b < blocks; b++) {
    const s = wave(b * block, block);
    scope.feed(b * block, [s, s]);
    if (scope.update((b + 1) * block)) sweeps++;
  }
  return sweeps;
}

describe('the sweep', () => {
  it('starts on the trigger’s edge, one span long, the next not before its holdoff', () => {
    const scope = new ScopeModel(FS, { timePerDiv: 0.001, voltsPerDiv: 0.25, trigger: { level: 0.3, slope: 1 }, holdoff: 0.005 });
    const starts: number[] = [];
    for (let b = 0; b < 40; b++) {
      const s = sine(400, 100, 1, b * 400);
      scope.feed(b * 400, [s, s]);
      if (scope.update((b + 1) * 400)) starts.push(scope.state().trigger.at * FS);
    }
    expect(starts.length).toBeGreaterThan(10);
    // every sweep on a rising edge through 0.3 (sample 12 of a period of 240), whole spans apart with the holdoff
    for (const s of starts) expect(Math.round(s) % 240).toBe(12);
    for (let k = 1; k < starts.length; k++) expect(starts[k]! - starts[k - 1]!).toBeGreaterThanOrEqual(240 + 120);
    const st = scope.state();
    expect(st.trigger.found).toBe(true);
    expect(st.n[0]).toBeLessThanOrEqual(2 * SWEEP_BUCKETS);
    expect(st.max[0]).toBeCloseTo(1, 6);
    expect(st.min[0]).toBeCloseTo(-1, 6);
    // the screen: 160 points of the same samples, −1 … 1 of its half height (4 divisions of 0.25 V: ±1 V)
    const screen = scope.screen(0)!;
    expect(screen).toHaveLength(SCREEN_POINTS);
    expect(Math.max(...screen)).toBeCloseTo(1, 6);
    expect(Math.min(...screen)).toBeCloseTo(-1, 6);
  });

  it('`auto` runs by itself without an edge; without `auto` it waits', () => {
    const flat = (_first: number, n: number) => new Float32Array(n).fill(0.2);
    const auto = new ScopeModel(FS, { timePerDiv: 0.001, trigger: { level: 1, auto: true } });
    expect(fed(auto, flat, 20)).toBeGreaterThan(5);
    expect(auto.state().trigger.found).toBe(false);
    expect(auto.state().max[0]).toBeCloseTo(0.2, 6);
    const normal = new ScopeModel(FS, { timePerDiv: 0.001, trigger: { level: 1, auto: false } });
    expect(fed(normal, flat, 20)).toBe(0);
    expect(normal.version).toBe(0);
  });

  it('a held page: one span after the first edge of the window', () => {
    const scope = new ScopeModel(FS, { timePerDiv: 0.001, trigger: { level: 0.3, slope: 1 } });
    const window = sine(960, 100, 1, 100); // the window starts 100 samples in: its first edge through 0.3 at 152
    expect(scope.hold([window, window], 2)).toBe(true);
    const st = scope.state();
    expect(st.trigger.found).toBe(true);
    expect(st.trigger.at).toBeCloseTo(2 + 152 / FS, 9);
    expect(st.points[0]!.x[0]).toBe(0);
    expect(st.points[0]!.x.at(-1)!).toBeCloseTo((10 * 0.001 * 1000 * (240 - 1)) / 240, 6);
  });
});

/** A chart that counts what is drawn on it. */
function fakeChart() {
  const calls: { id: string; n: number }[] = [];
  const axes: string[] = [];
  const chart: ChartApi = {
    setData: (id, xs) => void calls.push({ id, n: xs.length }),
    push: () => {},
    clearData: () => {},
    setAxis: (which) => void axes.push(which),
    setMarker: () => {},
  };
  return { chart, calls, axes };
}

describe('the board’s chart', () => {
  const words = { x: 't, ms', y: 'U, V', ch1: 'ch1', ch2: 'ch2' };

  it('`init` fills it with the last sweep; `update` draws again only when a new sweep came', () => {
    const scope = new ScopeModel(FS, { timePerDiv: 0.001, trigger: { level: 0.3 } });
    const wave = (first: number, n: number) => sine(n, 100, 1, first);
    fed(scope, wave, 4);
    const spec = scope.chart('scope', words);
    expect(spec.chart.x).toMatchObject({ min: 0, max: SCOPE_GRID.x * 1 });
    expect(spec.chart.y).toMatchObject({ min: -4, max: 4 });
    const a = fakeChart();
    spec.init!(a.chart);
    expect(a.calls.map((c) => c.id)).toEqual(['ch1', 'ch2']);
    expect(a.calls[0]!.n).toBe(scope.trace(0).n);
    expect(a.calls[0]!.n).toBeGreaterThan(0);
    for (let k = 0; k < 5; k++) spec.update!(a.chart, k);
    expect(a.calls).toHaveLength(2);
    // a new sweep: drawn once on the next update
    let more = 0;
    for (let b = 4; b < 40 && more === 0; b++) {
      const s = wave(b * 400, 400);
      scope.feed(b * 400, [s, s]);
      if (scope.update((b + 1) * 400)) more++;
    }
    expect(more).toBe(1);
    spec.update!(a.chart, 1);
    spec.update!(a.chart, 2);
    expect(a.calls).toHaveLength(4);
    // a chart made again (a step entered again): filled at once with the same sweep
    const b = fakeChart();
    spec.init!(b.chart);
    expect(b.calls).toEqual(a.calls.slice(2));
    // a channel whose probe is out: drawn empty, never with NaN
    scope.setOn(1, false);
    spec.update!(b.chart, 3);
    expect(b.calls.at(-1)).toEqual({ id: 'ch2', n: 0 });
  });
});

describe('a held page’s window (BenchModel.still)', () => {
  /** + rail → J1 → 3ae → 10 kΩ → 7ae → 100 μF (plus 7ae, minus 8ae) → J2 → − rail: τ = R·C = 1 s. */
  const RC: BoardPreset = {
    parts: [
      { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
      { id: 'R1', spec: 'resistor-10k', at: 'b3' },
      { id: 'C1', spec: 'electrolytic-100u-16v', at: 'c7' },
      { id: 'J2', spec: 'jumper', at: 'e8', to: '-8' },
    ],
    leads: {},
  };

  it('is the same, number for number, every time it is computed', () => {
    const layout = createLayout();
    const board = presetState(layout, RC);
    const model = createBenchModel({ layout, board });
    model.sync();
    const taps = [{ node: layout.node('3ae') }, { node: layout.node('7ae') }];
    const first = model.still({ fs: FS, count: 960, taps })!;
    const again = model.still({ fs: FS, count: 960, taps })!;
    expect(first).not.toBeNull();
    expect(again.samples).toEqual(first.samples);
    expect(again.warmup).toBe(first.warmup);
    // an open switch: the capacitor's own leak, a time constant of minutes — the warm-up held at its most
    expect(first.tau).toBeGreaterThan(100);
    expect(first.warmup).toBe(2);
    // the same window on two scopes: the same hash
    const a = new ScopeModel(FS, { timePerDiv: 0.002 });
    const b = new ScopeModel(FS, { timePerDiv: 0.002 });
    a.hold(first.samples);
    b.hold(again.samples);
    expect(a.state().hash).toBe(b.state().hash);
  });
});
