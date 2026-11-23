/**
 * The oscilloscope's additions for the chapters on the capacitor (task E4-S, recon E4 §1.1): 0 V beyond the screen, so
 * that the screen holds a narrow band round a steady voltage (`ground` beyond ±4, `capacitor/reservoir`); divisions
 * of the sweep before its edge (`pretrigger`, the single shot of `filter/block`) and a single shot caught (`caught`,
 * which the bench keeps on a held page); the crests of a held page, read from its window (`peak`, `divider/volume`,
 * `filter`); a level on the board's chart and the point where the trace crossed it (`cursor`, `capacitor/time`).
 */
import { describe, expect, it } from 'vitest';
import type { ChartApi, MarkerSpec } from '@/ui3d';
import { PEAK_CHUNK, ScopeModel, scopeRange, scopeSettings, type ScopeSetup, type ScopeWords } from '../scope-model';

const FS = 24000;
/** A sine of `hertz` and amplitude `a` round `mid`, `n` samples from sample `first` (rising through `mid` at 0). */
function sine(n: number, hertz: number, a: number, first = 0, mid = 0): Float32Array {
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = mid + a * Math.sin((2 * Math.PI * hertz * (first + k)) / FS);
  return out;
}
const flat = (n: number, v: number): Float32Array => new Float32Array(n).fill(v);

type Wave = (first: number, n: number) => readonly Float32Array[];
/** `blocks` blocks of `wave` fed from sample `from`, `update` after each at the block's end: how many sweeps drawn. */
function fed(scope: ScopeModel, wave: Wave, blocks: number, from = 0, block = 400): number {
  let sweeps = 0;
  for (let b = 0; b < blocks; b++) {
    const first = from + b * block;
    scope.feed(first, wave(first, block));
    if (scope.update(first + block)) sweeps++;
  }
  return sweeps;
}

/** A chart that keeps the last data of every series and every marker set. */
function fakeChart() {
  const data = new Map<string, { xs: number[]; ys: number[] }>();
  const markers: { id: string; marker: MarkerSpec | null }[] = [];
  const chart: ChartApi = {
    setData: (id, xs, ys) => void data.set(id, { xs: Array.from(xs), ys: Array.from(ys) }),
    push: () => {},
    clearData: () => {},
    setAxis: () => {},
    setMarker: (id, marker) => void markers.push({ id, marker }),
  };
  return { chart, data, markers };
}

const WORDS: ScopeWords = { x: 't, ms', y: 'U, V', ch1: 'ch1', ch2: 'ch2' };

describe('0 V beyond the screen: a band round a steady voltage (`ground` beyond ±4; `capacitor/reservoir`)', () => {
  it('the screen spans the band the step asks for, and the chart’s axis ticks its volts', () => {
    const [lo, hi] = scopeRange(scopeSettings({ voltsPerDiv: 0.1, ground: -83 }));
    expect(lo).toBeCloseTo(7.9, 9);
    expect(hi).toBeCloseTo(8.7, 9);
    const scope = new ScopeModel(FS, { timePerDiv: 0.05, voltsPerDiv: 0.05, ground: -165 });
    expect(scopeRange(scope.settings)[0]).toBeCloseTo(8.05, 9);
    expect(scopeRange(scope.settings)[1]).toBeCloseTo(8.45, 9);
    const { y } = scope.chart('reservoir', WORDS).chart;
    expect(y.min).toBeCloseTo(8.05, 9);
    expect(y.max).toBeCloseTo(8.45, 9);
    // a tick every division, the real volts on it
    const ticks = (a: typeof y): string[] => a.ticks!.map((t) => a.format!(t));
    expect(ticks(y)).toEqual(['8,05', '8,1', '8,15', '8,2', '8,25', '8,3', '8,35', '8,4', '8,45']);
    const wide = new ScopeModel(FS, { voltsPerDiv: 0.1, ground: -83 }).chart('wide', WORDS).chart.y;
    expect(ticks(wide)).toEqual(['7,9', '8', '8,1', '8,2', '8,3', '8,4', '8,5', '8,6', '8,7']);
  });

  it('a trace in the band is inside the screen; beyond it, cut at the edge on the instrument and the chart', () => {
    const scope = new ScopeModel(FS, { timePerDiv: 0.005, voltsPerDiv: 0.05, ground: -165, trigger: { level: null } });
    // channel 1 the supply wobbling 8.25 ± 0.15 V; channel 2 on the − rail, 0 V: 165 divisions under the middle
    fed(scope, (first, n) => [sine(n, 100, 0.15, first, 8.25), flat(n, 0)], 20);
    const st = scope.state();
    // the trigger's level by itself: the middle of the band
    expect(st.trigger.found).toBe(true);
    expect(st.trigger.used).toBeCloseTo(8.25, 4);
    expect(st.screen[0]!.max).toBeCloseTo(0.75, 4);
    expect(st.screen[0]!.min).toBeCloseTo(-0.75, 4);
    expect(st.screen[1]).toEqual({ min: -1, max: -1 });
    const a = fakeChart();
    scope.chart('reservoir', WORDS).init!(a.chart);
    expect(Math.max(...a.data.get('ch1')!.ys)).toBeCloseTo(8.4, 5);
    expect(Math.min(...a.data.get('ch1')!.ys)).toBeCloseTo(8.1, 5);
    // the − rail on the chart: at its bottom edge, not 165 divisions below it
    const rail = a.data.get('ch2')!.ys;
    expect(rail.length).toBeGreaterThan(0);
    for (const v of rail) expect(v).toBeCloseTo(8.05, 6);
    // a wobble bigger than the band: cut at both edges
    fed(scope, (first, n) => [sine(n, 100, 0.4, first, 8.25), flat(n, 0)], 20, 8000);
    const big = scope.state();
    expect(big.max[0]).toBeCloseTo(8.65, 5);
    expect(big.screen[0]).toEqual({ min: -1, max: 1 });
    const b = fakeChart();
    scope.chart('reservoir', WORDS).init!(b.chart);
    expect(Math.max(...b.data.get('ch1')!.ys)).toBeCloseTo(8.45, 6);
    expect(Math.min(...b.data.get('ch1')!.ys)).toBeCloseTo(8.05, 6);
  });

  it('`ground` is any finite number of divisions; one that is not is a RangeError', () => {
    expect(scopeSettings({ ground: -165 }).ground).toBe(-165);
    expect(scopeSettings({ ground: 12.5 }).ground).toBe(12.5);
    for (const g of [Number.NaN, Infinity, -Infinity]) expect(() => scopeSettings({ ground: g })).toThrow(RangeError);
  });
});

/** The board of `filter/block` (recon E4 §2.4): one sweep, 5 ms and 2 V a division, a division before the edge. */
const BLOCK: ScopeSetup = {
  display: 'sweep',
  timePerDiv: 0.005,
  voltsPerDiv: 2,
  ground: -2,
  pretrigger: 1,
  trigger: { channel: 1, level: 1, slope: 1, auto: false },
};
/** The switch closing at sample `edge`: channel 1 the + rail 0 → 9 V, channel 2 the resistor's jump to 9 V decaying
 * with τ 9.9 ms (10 kΩ ∥ the scope's 1 MΩ, 1 μF). */
const closing =
  (edge: number): Wave =>
  (first, n) => {
    const rail = new Float32Array(n);
    const r = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const i = first + k;
      rail[k] = i < edge ? 0 : 9;
      r[k] = i < edge ? 0 : 9 * Math.exp(-(i - edge) / FS / 0.0099);
    }
    return [rail, r];
  };

describe('divisions before the edge (`pretrigger`; `filter/block`)', () => {
  it('a sweep shows `pretrigger` divisions before its edge: the chart’s time from the edge, the edge at 0', () => {
    const scope = new ScopeModel(FS, BLOCK);
    const edge = 3000;
    expect(fed(scope, closing(edge), 20)).toBe(1);
    const st = scope.state();
    expect(st.pretrigger).toBe(1);
    expect(st.trigger.found).toBe(true);
    expect(st.trigger.at).toBeCloseTo(edge / FS, 9);
    expect(st.t0).toBeCloseTo(edge / FS, 9);
    const [rail, r] = st.points;
    // a division before the edge: −5 ms … 0, both channels at rest
    expect(r!.x[0]).toBeCloseTo(-5, 9);
    expect(r!.x.at(-1)!).toBeCloseTo(45 - 1000 / FS, 6);
    for (const ch of [rail!, r!]) {
      const before = ch.v.filter((_, k) => ch.x[k]! < 0);
      expect(before.length).toBeGreaterThanOrEqual(58);
      for (const v of before) expect(v).toBe(0);
    }
    // from 0 on the step of the rail and the resistor's jump, which decays to 9·e^(−45 ms / 9.9 ms) at the end
    const at0 = r!.x.findIndex((x) => x >= 0);
    expect(r!.x[at0]).toBeCloseTo(0, 9);
    expect(r!.v[at0]).toBeCloseTo(9, 5);
    expect(rail!.v.filter((_, k) => rail!.x[k]! >= 0).every((v) => v === 9)).toBe(true);
    expect(r!.v.at(-1)!).toBeCloseTo(9 * Math.exp(-(1200 - 120 - 1) / FS / 0.0099), 4);
    // the chart's time axis from a division before the edge, a label every other division from the edge
    const { x } = scope.chart('block', WORDS).chart;
    expect(x.min).toBeCloseTo(-5, 9);
    expect(x.max).toBeCloseTo(45, 9);
    expect(x.ticks!.map((t) => x.format!(t))).toEqual(['', '0', '', '10', '', '20', '', '30', '', '40', '']);
  });

  it('with `auto` and no edge for a whole span it runs free, the chart’s 0 `pretrigger` divisions in', () => {
    const scope = new ScopeModel(FS, { ...BLOCK, pretrigger: 2, trigger: { ...BLOCK.trigger, auto: true } });
    // a free run after every span of no edge: at 0.1, 0.2 and 0.3 s of the 0.33 s fed
    expect(fed(scope, (_f, n) => [flat(n, 0.2), flat(n, 0.2)], 20)).toBe(3);
    const st = scope.state();
    expect(st.trigger.found).toBe(false);
    expect(st.points[1]!.x[0]).toBeCloseTo(-10, 9);
    // the last bucket of four samples, a flat one drawn by its first: 40 ms less four samples
    expect(st.points[1]!.x.at(-1)!).toBeCloseTo(40 - (4 * 1000) / FS, 6);
    expect(st.t0).toBeCloseTo(st.trigger.at, 12);
  });

  it('a held page’s window: one span with its edge `pretrigger` divisions in; without an edge, from its start', () => {
    const scope = new ScopeModel(FS, BLOCK);
    const S = scope.spanSamples;
    expect(S).toBe(1200);
    expect(scope.hold(closing(700)(0, 2 * S), 2)).toBe(true);
    const st = scope.state();
    expect(st.trigger.found).toBe(true);
    expect(st.trigger.at).toBeCloseTo(2 + 700 / FS, 9);
    expect(st.t0).toBeCloseTo(2 + 700 / FS, 9);
    expect(st.points[1]!.x[0]).toBeCloseTo(-5, 9);
    expect(st.points[1]!.v.filter((_, k) => st.points[1]!.x[k]! < 0).every((v) => v === 0)).toBe(true);
    expect(Math.max(...st.points[1]!.v)).toBeCloseTo(9, 5);
    // a window with no edge (the board at rest): from its first sample, the chart's 0 a division in
    expect(scope.hold([flat(2 * S, 9), flat(2 * S, 0)], 2)).toBe(true);
    const rest = scope.state();
    expect(rest.trigger.found).toBe(false);
    expect(rest.points[0]!.x[0]).toBeCloseTo(-5, 9);
    expect(rest.t0).toBeCloseTo(2 + 120 / FS, 9);
  });

  it('is a whole number of divisions, 0 … 9; none by default', () => {
    expect(scopeSettings({}).pretrigger).toBe(0);
    expect(scopeSettings({ pretrigger: 9 }).pretrigger).toBe(9);
    for (const p of [-1, 0.5, 10, Number.NaN]) expect(() => scopeSettings({ pretrigger: p })).toThrow(RangeError);
  });
});

describe('a single shot caught (`caught`)', () => {
  it('with `auto` off a sweep an edge started stays till the next; a new scale, a held window, a free run: none', () => {
    const scope = new ScopeModel(FS, BLOCK);
    expect(scope.caught).toBe(false);
    fed(scope, closing(3000), 20);
    expect(scope.caught).toBe(true);
    const { version, hash } = scope.state();
    // the jump decays on: no edge rising through 1 V, so nothing new — the shot stays as it was
    expect(fed(scope, closing(3000), 30, 8000)).toBe(0);
    expect(scope.version).toBe(version);
    expect(scope.state().hash).toBe(hash);
    expect(scope.caught).toBe(true);
    // the switch closed again after a while: the next edge is the next shot
    expect(fed(scope, closing(24000), 20, 20000)).toBe(1);
    expect(scope.caught).toBe(true);
    expect(scope.state().trigger.at).toBeCloseTo(1, 9);
    // a step's new scale: nothing caught
    scope.settings = BLOCK;
    expect(scope.caught).toBe(false);
    // a held page's window, even with its edge, is not a shot caught on the samples that came
    fed(scope, closing(30000), 20, 28000);
    expect(scope.caught).toBe(true);
    scope.hold(closing(700)(0, 2400), 2);
    expect(scope.state().trigger.found).toBe(true);
    expect(scope.caught).toBe(false);
    // a sweep that ran free is none either
    const free = new ScopeModel(FS, { ...BLOCK, trigger: { ...BLOCK.trigger, auto: true } });
    fed(free, (_f, n) => [flat(n, 0), flat(n, 0)], 20);
    expect(free.state().sweeps).toBeGreaterThan(0);
    expect(free.caught).toBe(false);
  });
});

describe('the crests of a held page: its window’s (`peak`; E4-S c)', () => {
  it('while the window is shown its crests, not those of the samples before; a frame with time: the stream’s', () => {
    const scope = new ScopeModel(FS, { timePerDiv: 0.002 }, 4 * 1536);
    let at = 0;
    const block = (): void => {
      scope.feed(at, [sine(1536, 100, 0.3, at), flat(1536, -0.7)]);
      at += 1536;
      scope.update(at);
    };
    while (at < FS) block();
    expect(scope.peak(0, 0.5)).toBeCloseTo(0.3, 3);
    // the held page's window, computed at once: a bigger wave and a smaller level than the stream gave
    const S = scope.spanSamples;
    const wave = sine(2 * S, 100, 0.9, 37);
    const crest = Math.max(...Array.from(wave, Math.abs));
    expect(scope.hold([wave, flat(2 * S, 0.05)], 1)).toBe(true);
    expect(scope.peak(0, 0.5)).toBe(crest);
    expect(scope.peak(1, 0.5)).toBeCloseTo(0.05, 7);
    // a held frame: the same sample shown, the same crests
    scope.update(at);
    expect(scope.peak(0, 0.5)).toBe(crest);
    // a frame with time: the stream's samples again
    block();
    expect(scope.peak(0, 0.5)).toBeCloseTo(0.3, 3);
    expect(scope.peak(1, 0.5)).toBeCloseTo(0.7, 6);
  });

  it('a window longer than the readout’s seconds: its last seconds, a chunk of PEAK_CHUNK at the end', () => {
    // 50 ms a division: a span of 0.5 s, the window two of them
    const scope = new ScopeModel(FS, { timePerDiv: 0.05 });
    const n = 2 * scope.spanSamples;
    expect(n).toBe(FS);
    const w = new Float32Array(n).map((_, k) => (k < n / 2 ? 0.9 : -0.2));
    expect(scope.hold([w, w], 1)).toBe(true);
    expect(scope.peak(0, 0.5)).toBeCloseTo(0.2, 6);
    // a little more reaches the chunk before the second half: the loud one
    expect(scope.peak(0, 0.5 + PEAK_CHUNK / 2 / FS)).toBeCloseTo(0.9, 6);
    // longer than the window: all of it
    expect(scope.peak(1, 5)).toBeCloseTo(0.9, 6);
  });

  it('none for a channel that is off; a new scale shows the stream’s again; a new board none at all', () => {
    const scope = new ScopeModel(FS, { timePerDiv: 0.002 });
    scope.feed(0, [flat(4800, 0.3), flat(4800, 0.3)]);
    scope.update(4800);
    const S = scope.spanSamples;
    scope.hold([flat(2 * S, 0.9), flat(2 * S, 0.9)], 1);
    expect(scope.peak(0, 0.5)).toBeCloseTo(0.9, 6);
    scope.setOn(0, false);
    expect(scope.peak(0, 0.5)).toBeNull();
    expect(scope.peak(1, 0.5)).toBeCloseTo(0.9, 6);
    scope.setOn(0, true);
    scope.settings = { timePerDiv: 0.002 };
    expect(scope.peak(0, 0.5)).toBeCloseTo(0.3, 6);
    scope.hold([flat(2 * S, 0.9), flat(2 * S, 0.9)], 1);
    scope.reset();
    expect(scope.peak(0, 0.5)).toBeNull();
  });
});

describe('a level on the chart and where the trace crossed it (`cursor`; `capacitor/time`)', () => {
  /** `capacitor/time`'s scope: a roll of 1 s and 2 V a division, 0 V a division over the bottom; 63 % of 9 V. */
  const ROLL: ScopeSetup = { display: 'roll', timePerDiv: 1, voltsPerDiv: 2, ground: -3, cursor: { volts: 5.688 } };
  const words: ScopeWords = { x: 't, s', y: 'U, V', ch1: 'ch1', ch2: '', cursor: '63 %' };
  /** The switch closing at 1 s: the capacitor charging to 9 V with R·C = 1 s on channel 1. */
  const charge: Wave = (first, n) => {
    const out = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const t = (first + k) / FS - 1;
      out[k] = t < 0 ? 0 : 9 * (1 - Math.exp(-t));
    }
    return [out, flat(n, 0)];
  };
  /** When the curve crosses 5.688 V: 1 s + R·C·ln(9 / (9 − 5.688)). */
  const CROSS = 1 + Math.log(9 / (9 - 5.688));

  it('is a dashed line at its volts across the chart, `mist`, named by the step’s word; none without the word', () => {
    const scope = new ScopeModel(FS, ROLL);
    expect(scope.settings.cursor).toEqual({ volts: 5.688, channel: 0 });
    const spec = scope.chart('time', words);
    expect(spec.chart.series).toHaveLength(3);
    expect(spec.chart.series[2]).toMatchObject({ id: 'cursor', label: '63 %', color: 'mist', dash: true });
    expect(scope.chart('plain', { ...words, cursor: undefined }).chart.series).toHaveLength(2);
    const a = fakeChart();
    spec.init!(a.chart);
    expect(a.data.get('cursor')).toEqual({ xs: [-10, 0], ys: [5.688, 5.688] });
    // a level above the screen (−2 … 14 V) has no line; nor has a scope with no cursor
    scope.settings = { ...ROLL, cursor: { volts: 20 } };
    spec.update!(a.chart, 1);
    expect(a.data.get('cursor')).toEqual({ xs: [], ys: [] });
    scope.settings = { ...ROLL, cursor: null };
    spec.update!(a.chart, 2);
    expect(a.data.get('cursor')).toEqual({ xs: [], ys: [] });
    expect(scope.state().cursor).toBeNull();
  });

  it('marks where the trace last crossed it, moving left with the roll; no mark before it crossed', () => {
    const scope = new ScopeModel(FS, ROLL, 4 * 1536);
    const spec = scope.chart('time', words);
    const a = fakeChart();
    spec.init!(a.chart);
    const block = 1536;
    let at = 0;
    const until = (seconds: number): void => {
      for (; at < seconds * FS; at += block) {
        scope.feed(at, charge(at, block));
        scope.update(at + block);
        spec.update!(a.chart, at);
      }
    };
    until(1.5);
    expect(scope.crossing()).toBeNull();
    expect(scope.state().crossing).toBeNull();
    expect(a.markers.at(-1)).toEqual({ id: 'crossing', marker: null });
    until(4);
    const c = scope.crossing()!;
    expect(c.t).toBeCloseTo(CROSS, 3);
    expect(c.x).toBeCloseTo(CROSS - at / FS, 3);
    expect(scope.state().crossing).toEqual(c);
    expect(a.markers.at(-1)).toEqual({
      id: 'crossing',
      marker: { x: c.x, y: 5.688, color: 'lime', guides: false },
    });
    // a second later the same moment, a division further left
    const was = at;
    until(5);
    const later = scope.crossing()!;
    expect(later.t).toBeCloseTo(c.t, 4);
    expect(later.x).toBeCloseTo(c.x - (at - was) / FS, 4);
    expect(at - was).toBeGreaterThan(0.9 * FS);
    // the other channel never reaches it
    scope.settings = { ...ROLL, cursor: { volts: 5.688, channel: 1 } };
    until(6);
    expect(scope.crossing()).toBeNull();
  });

  it('a level of channel 1 at its own scale (`y2`): the line at its height on the left axis, the marker on the right', () => {
    // channel 1 at 0,02 V a division on the right axis, channel 2 at 0,25 V on the left: 0,05 V of channel 1 stands
    // where 0,625 V of channel 2 would
    const scope = new ScopeModel(FS, {
      timePerDiv: 0.001,
      voltsPerDiv: 0.25,
      channelVolts: [0.02, null],
      cursor: { volts: 0.05 },
    });
    fed(scope, (first, n) => [sine(n, 100, 0.07, first), flat(n, 0)], 10);
    const spec = scope.chart('twice', { ...WORDS, y2: 'U, V', cursor: 'level' });
    const a = fakeChart();
    spec.init!(a.chart);
    expect(a.data.get('cursor')!.ys).toEqual([0.625, 0.625]);
    const mark = a.markers.at(-1)!.marker!;
    expect(mark).toMatchObject({ y: 0.05, axis: 'y2', color: 'lime' });
    expect(mark.x).toBeCloseTo(scope.crossing()!.x, 12);
  });

  it('its volts are a finite number, its channel 0 or 1', () => {
    expect(scopeSettings({}).cursor).toBeNull();
    expect(scopeSettings({ cursor: { volts: 1, channel: 1 } }).cursor).toEqual({ volts: 1, channel: 1 });
    expect(() => scopeSettings({ cursor: { volts: Number.NaN } })).toThrow(RangeError);
    expect(() => scopeSettings({ cursor: { volts: 1, channel: 2 as 0 } })).toThrow(RangeError);
  });
});
