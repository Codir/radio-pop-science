import { describe, expect, it } from 'vitest';
import { Axis } from '@/ui3d/charts/axis';
import {
  PAD,
  barWidth,
  baseValue,
  finiteRuns,
  labelLeft,
  mapper,
  plotRect,
  px,
  py,
  scrubStep,
  scrubValue,
  stackLevels,
} from '../geometry';

describe('axis ticks (ui3d/charts/axis.ts, shared by both renderers)', () => {
  it('linear: nice, ascending, evenly spaced, inside the range', () => {
    const t = new Axis({ min: 0, max: 45 }).ticks();
    expect(t[0]).toBe(0);
    expect(t.every((v) => v >= 0 && v <= 45)).toBe(true);
    const step = t[1]! - t[0]!;
    expect(t.every((v, i) => i === 0 || Math.abs(v - t[i - 1]! - step) < 1e-9)).toBe(true);
    expect(t.length).toBeGreaterThanOrEqual(3);
  });
  it('explicit ticks are filtered to the range', () => {
    expect(new Axis({ min: -340, max: 340, ticks: [-400, -325, 0, 325, 400] }).ticks()).toEqual([-325, 0, 325]);
  });
  it('log: decades, small ones as numbers, large ones as 10ⁿ', () => {
    const a = new Axis({ min: 0.1, max: 100, log: true });
    expect(a.ticks()).toEqual([0.1, 1, 10, 100]);
    expect(a.ticks().map((v) => a.label(v))).toEqual(['0,1', '1', '10', '100']);
    const wide = new Axis({ min: 1e-3, max: 1e6, log: true });
    expect(wide.label(1e6)).toBe('10⁶');
    expect(wide.label(1e-3)).toBe('10⁻³');
    expect(a.t(1)).toBeCloseTo(1 / 3, 9);
    expect(a.value(2 / 3)).toBeCloseTo(10, 9);
  });
  it('years: no thousands grouping, detected or forced', () => {
    expect(new Axis({ min: 2000, max: 2050 }).label(2010)).toBe('2010');
    expect(new Axis({ min: 2000, max: 2050, years: true, ticks: [2000, 2025.5] }).label(2025.5)).toBe('2026');
    expect(new Axis({ min: 0, max: 50000 }).label(20000)).not.toBe('20000');
  });
});

describe('plot geometry (hud-dom/charts/geometry.ts)', () => {
  it('plot rectangle: WebGL margins, a second axis takes a left-sized margin, the X title 16 more', () => {
    expect(plotRect(500, 220, false, false)).toEqual({ x: PAD.left, y: PAD.top, w: 500 - 56 - 14, h: 220 - 26 - 28 });
    const r = plotRect(500, 220, true, true);
    expect(r.w).toBe(500 - 56 - 56);
    expect(r.y + r.h).toBe(220 - 28 - 16);
    expect(plotRect(20, 20, false, false).w).toBe(10);
  });
  it('maps values with y down and clamps outside the range', () => {
    const r = { x: 10, y: 20, w: 100, h: 50 };
    const ax = new Axis({ min: 0, max: 10 });
    expect(px(r, ax, 5)).toBe(60);
    expect(px(r, ax, 99)).toBe(110);
    expect(py(r, ax, 0)).toBe(70);
    expect(py(r, ax, 10)).toBe(20);
    expect(py(r, ax, -5)).toBe(70);
  });
  it('the precomputed mapper agrees with px / py (linear and log, clamped, NaN through)', () => {
    const r = { x: 10, y: 20, w: 100, h: 50 };
    const lin = new Axis({ min: -4, max: 6 });
    const log = new Axis({ min: 0.1, max: 100, log: true });
    for (const v of [-9, -4, 0, 1.5, 6, 30]) {
      expect(mapper(r, lin, 'x')(v)).toBeCloseTo(px(r, lin, v), 9);
      expect(mapper(r, lin, 'y')(v)).toBeCloseTo(py(r, lin, v), 9);
    }
    for (const v of [0.01, 0.1, 3, 100, 1e4]) expect(mapper(r, log, 'y')(v)).toBeCloseTo(py(r, log, v), 9);
    expect(mapper(r, lin, 'x')(NaN)).toBeNaN();
  });
  it('NaN and Infinity break a series into finite runs; single points are dropped', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7];
    const ys = [1, 2, NaN, 3, Infinity, 4, 5, 6];
    expect(finiteRuns(xs, ys, 8)).toEqual([
      [0, 2],
      [5, 8],
    ]);
    expect(finiteRuns([0, NaN, 2], [1, 1, 1], 3)).toEqual([]);
  });
  it('stacks: positive values pile up, negative ones pile down, index by index', () => {
    const lv = stackLevels([[1, 2, 0], [1, -1, 3], [-2, -1, 1]], [3, 3, 3]);
    expect(lv[0]).toEqual({ from: [0, 0, 0], to: [1, 2, 0] });
    expect(lv[1]).toEqual({ from: [1, 0, 0], to: [2, -1, 3] });
    expect(lv[2]).toEqual({ from: [0, -1, 3], to: [-2, -2, 4] });
  });
  it('bars: 68 % of a slot within 2…26 units, grown from zero or the log floor', () => {
    expect(barWidth(100, 10)).toBeCloseTo(6.8);
    expect(barWidth(1000, 2)).toBe(26);
    expect(barWidth(10, 100)).toBe(2);
    expect(baseValue(new Axis({ min: 0.1, max: 100, log: true }))).toBe(0.1);
    expect(baseValue(new Axis({ min: -4, max: 6 }))).toBe(0);
  });
  it('scrub: pointer x → axis value (clamped, log-aware); arrow keys step 1 % / 10 %', () => {
    const r = { x: 56, y: 26, w: 400, h: 100 };
    const lin = new Axis({ min: 0, max: 24 });
    expect(scrubValue(r, lin, 56 + 200)).toBe(12);
    expect(scrubValue(r, lin, 0)).toBe(0);
    expect(scrubValue(r, lin, 999)).toBe(24);
    const log = new Axis({ min: 1, max: 1000, log: true });
    expect(scrubValue(r, log, 56 + 400 / 3)).toBeCloseTo(10, 9);
    expect(scrubStep(lin, 12, 1, false)).toBeCloseTo(12.24, 9);
    expect(scrubStep(lin, 12, -1, true)).toBeCloseTo(9.6, 9);
    expect(scrubStep(lin, 24, 1, true)).toBe(24);
  });
  it('marker label sits right of the point unless it would leave the plot', () => {
    const r = { x: 0, y: 0, w: 100, h: 50 };
    expect(labelLeft(r, 20, 30)).toBe(32);
    expect(labelLeft(r, 80, 30)).toBe(38);
  });
});
