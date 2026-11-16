/**
 * Pure geometry of the DOM chart (no DOM, no canvas — unit-tested): the plot rectangle inside the frame, value
 * → position mapping, finite runs (NaN / ±Infinity gaps), stacking (negative values pile downward), bar
 * rectangles, scrub mapping and marker-label placement. Everything is in HUD units with y pointing **down**
 * (DOM convention); the numbers are those of the WebGL chart (`ui3d/charts/chart.ts`, `chart-paint.ts`).
 */
import type { Axis } from '@/ui3d/charts/axis';

/** Plot margins inside the frame, units (WebGL `PAD`). */
export const PAD = { left: 56, right: 14, top: 26, bottom: 28 } as const;

export interface Rect {
  /** Left, top, width, height. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);

/** The plot rectangle of a frame `width` × `height`: a second Y axis takes a left-sized margin on the right. */
export function plotRect(width: number, height: number, y2: boolean, xTitle: boolean): Rect {
  const right = y2 ? PAD.left : PAD.right;
  const bottom = PAD.bottom + (xTitle ? 16 : 0);
  const w = Math.max(width - PAD.left - right, 10);
  const h = Math.max(height - PAD.top - bottom, 10);
  return { x: PAD.left, y: height - bottom - h, w, h };
}

/** X position of a value (clamped to the plot, like the WebGL chart). */
export function px(r: Rect, axis: Axis, v: number): number {
  return r.x + r.w * clamp01(axis.t(v));
}

/** Y position of a value (clamped; y down). */
export function py(r: Rect, axis: Axis, v: number): number {
  return r.y + r.h * (1 - clamp01(axis.t(v)));
}

/**
 * `px` / `py` as one precomputed function of an axis (the hot loop of a live strip: no spec lookups, no log
 * unless the axis is logarithmic). Same clamping and the same NaN pass-through.
 */
export function mapper(r: Rect, axis: Axis, dir: 'x' | 'y'): (v: number) => number {
  const { min, max, log } = axis.spec;
  const from = dir === 'x' ? r.x : r.y + r.h;
  const span = dir === 'x' ? r.w : -r.h;
  if (log) {
    const lo = Math.log10(Math.max(min, 1e-300));
    const inv = 1 / (Math.log10(Math.max(max, 1e-300)) - lo || 1);
    return (v) => {
      const t = (Math.log10(Math.max(v, 1e-300)) - lo) * inv;
      return from + span * (t < 0 ? 0 : t > 1 ? 1 : t);
    };
  }
  const inv = 1 / (max - min || 1);
  return (v) => {
    const t = (v - min) * inv;
    return from + span * (t < 0 ? 0 : t > 1 ? 1 : t);
  };
}

/**
 * Index ranges `[start, end)` of the finite stretches of a series — a NaN / ±Infinity in x or y breaks the
 * curve there. Stretches of one point are dropped (nothing to draw), as in the WebGL chart.
 */
export function finiteRuns(xs: ArrayLike<number>, ys: ArrayLike<number>, n: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const ok = i < n && Number.isFinite(xs[i]!) && Number.isFinite(ys[i]!);
    if (ok && start < 0) start = i;
    else if (!ok && start >= 0) {
      if (i - start >= 2) out.push([start, i]);
      start = -1;
    }
  }
  return out;
}

/**
 * Stack levels of the series sharing one stack id, in declaration order: positive values pile up from zero,
 * negative values pile down from zero, sample by sample (index-aligned, as the WebGL chart does).
 */
export function stackLevels(series: readonly ArrayLike<number>[], lengths: readonly number[]): { from: number[]; to: number[] }[] {
  const pos: number[] = [];
  const neg: number[] = [];
  return series.map((ys, k) => {
    const n = lengths[k] ?? ys.length;
    const from: number[] = new Array<number>(n);
    const to: number[] = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const v = ys[i]!;
      const base = v >= 0 ? (pos[i] ?? 0) : (neg[i] ?? 0);
      from[i] = base;
      to[i] = base + v;
      if (v >= 0) pos[i] = to[i]!;
      else neg[i] = to[i]!;
    }
    return { from, to };
  });
}

/** Width of the bars of a series of `n` samples in a plot `w` wide (68 % of a slot, 2…26 units). */
export function barWidth(w: number, n: number): number {
  return Math.max(Math.min((w / Math.max(n, 1)) * 0.68, 26), 2);
}

/** The value a bar or an area grows from: zero, or the bottom of a log axis. */
export function baseValue(axis: Axis): number {
  return axis.spec.log ? axis.spec.min : 0;
}

/** Scrub: pointer x (units, frame-local) → value on the X axis. */
export function scrubValue(r: Rect, axis: Axis, x: number): number {
  return axis.value(clamp01((x - r.x) / r.w));
}

/** Keyboard scrub: one arrow press moves 1 % of the axis (10 % with Shift), along the axis' own scale. */
export function scrubStep(axis: Axis, value: number, dir: 1 | -1, big: boolean): number {
  return axis.value(clamp01(axis.t(value) + dir * (big ? 0.1 : 0.01)));
}

/** Marker label: right of the point unless it would leave the plot, then left of it (WebGL rule). */
export function labelLeft(r: Rect, x: number, width: number, gap = 12): number {
  return x + gap + width > r.x + r.w ? x - gap - width : x + gap;
}
