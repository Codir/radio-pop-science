/**
 * Canvas2D marks of the DOM chart (docs/HUD_DOM.md §8): the well, the grid, X tick marks, bars, curves,
 * filled / stacked areas and marker points with their guides — the WebGL chart's look (`chart-paint.ts`,
 * `plot.ts`) on one 2D canvas. Every word and number is DOM (`text.ts`). Coordinates are units, y down; the
 * caller has scaled the context by px-per-unit × device pixel ratio.
 */
import type { MarkerSpec, SeriesSpec } from '@/ui3d/charts/chart';
import type { Axis } from '@/ui3d/charts/axis';
import { UI } from '@/ui3d/theme';
import { cssColor } from './color';
import { barWidth, baseValue, finiteRuns, mapper, px, py, stackLevels, type Rect } from './geometry';

export interface SeriesData {
  spec: SeriesSpec;
  xs: number[];
  ys: number[];
}

export interface ChartModel {
  readonly axes: { readonly x: Axis; readonly y: Axis; readonly y2: Axis | null };
  readonly data: ReadonlyMap<string, SeriesData>;
  readonly markers: ReadonlyMap<string, MarkerSpec>;
  /** Default marker colour: the chapter accent (CSS colour). */
  readonly accent: string;
}

type G = CanvasRenderingContext2D;

const DASH: readonly [number, number] = [8, 6];

const axisOf = (m: ChartModel, spec: { axis?: 'y' | 'y2' }): Axis =>
  spec.axis === 'y2' && m.axes.y2 ? m.axes.y2 : m.axes.y;

function roundRect(g: G, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/**
 * Well and horizontal grid (zero line solid and brighter) — they depend on the Y axis and the size only, so a
 * live strip scrolling along X never repaints them (the X tick marks are drawn with their DOM labels).
 */
export function paintFrame(g: G, m: ChartModel, r: Rect): void {
  roundRect(g, r.x - 4, r.y - 4, r.w + 8, r.h + 8, UI.radius.inset);
  g.fillStyle = cssColor('bg.void', 0.62);
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = cssColor('slate', 0.55);
  g.stroke();
  const ay = m.axes.y;
  for (const v of ay.ticks()) {
    const y = py(r, ay, v);
    const zero = v === 0 && ay.spec.min < 0;
    g.beginPath();
    g.setLineDash(zero ? [] : [3.5, 3.5]);
    g.lineWidth = zero ? 1.6 : 1;
    g.strokeStyle = zero ? cssColor('mist', 0.7) : cssColor('slate', 0.4);
    g.moveTo(r.x, y);
    g.lineTo(r.x + r.w, y);
    g.stroke();
  }
  g.setLineDash([]);
}

/** Trace `xs/ys[from…to)` into the current path (a staircase for `step`). */
function trace(g: G, xs: number[], ys: number[], from: number, to: number, X: (v: number) => number, Y: (v: number) => number, step: boolean): void {
  let lastY = 0;
  for (let i = from; i < to; i++) {
    const x = X(xs[i]!);
    const y = Y(ys[i]!);
    if (i === from) g.moveTo(x, y);
    else {
      if (step) g.lineTo(x, lastY);
      g.lineTo(x, y);
    }
    lastY = y;
  }
}

/**
 * Trace a dense run (more points than device pixels across): per pixel column only its first and last point
 * and, when they stick out, its lowest and highest — the drawn envelope is the same, the path several times
 * shorter (a live strip of 2 000 points per series in a 400-pixel plot).
 */
function traceDense(g: G, xs: number[], ys: number[], from: number, to: number, X: (v: number) => number, Y: (v: number) => number): void {
  const k = g.getTransform().a; // device pixels per unit
  let col = Number.NaN;
  let fx = 0, fy = 0, lx = 0, ly = 0, lo = 0, hi = 0; // prettier-ignore
  let started = false;
  const emit = (): void => {
    if (!started) g.moveTo(fx, fy);
    else if ((hi - lo) * k < 1) {
      g.lineTo(lx, ly); // the column spans less than a device pixel vertically: its last point is enough
      return;
    } else g.lineTo(fx, fy);
    started = true;
    if (lo < Math.min(fy, ly)) g.lineTo(fx, lo);
    if (hi > Math.max(fy, ly)) g.lineTo(fx, hi);
    if (lx !== fx || ly !== fy) g.lineTo(lx, ly);
  };
  for (let i = from; i < to; i++) {
    const x = X(xs[i]!);
    const y = Y(ys[i]!);
    const c = Math.round(x * k);
    if (c !== col) {
      if (col === col) emit(); // not NaN: a column is pending
      col = c;
      fx = lx = x;
      fy = ly = lo = hi = y;
    } else {
      lx = x;
      ly = y;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
  }
  if (col === col) emit();
}

/** Does a run hold more points than the plot has device pixels across? */
const dense = (g: G, r: Rect, n: number): boolean => n > r.w * g.getTransform().a;

/** Above this many points an area is filled with one gradient instead of one per column. */
const STRIP_LIMIT = 400;

/**
 * Fill under a run down to the base line. The WebGL mesh fades every column from 42 % at the curve to 4 % at
 * the base, so a low stretch of the curve is as bright at its top as a high one: one gradient quad per segment
 * reproduces that; long runs (live data) take one gradient from the highest point.
 */
function fillToBase(g: G, s: SeriesData, from: number, to: number, X: (v: number) => number, Y: (v: number) => number, base: number, a: number): void {
  const top = cssColor(s.spec.color, a * 0.42, 1.2);
  const bottom = cssColor(s.spec.color, a * 0.04, 1.2);
  if (to - from > STRIP_LIMIT) {
    let high = base;
    for (let i = from; i < to; i++) high = Math.min(high, Y(s.ys[i]!));
    const grad = g.createLinearGradient(0, high, 0, base);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.beginPath();
    trace(g, s.xs, s.ys, from, to, X, Y, false);
    g.lineTo(X(s.xs[to - 1]!), base);
    g.lineTo(X(s.xs[from]!), base);
    g.fillStyle = grad;
    g.fill();
    return;
  }
  // quad edges snapped to device pixels: neighbours share an exact edge, so no antialiased seam shows
  const k = g.getTransform().a;
  const snap = (x: number): number => Math.round(x * k) / k;
  for (let i = from; i < to - 1; i++) {
    const x0 = snap(X(s.xs[i]!));
    const x1 = snap(X(s.xs[i + 1]!));
    if (x1 === x0) continue;
    const y0 = Y(s.ys[i]!);
    const y1 = Y(s.ys[i + 1]!);
    const grad = g.createLinearGradient(0, Math.min(y0, y1), 0, base);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineTo(x1, base);
    g.lineTo(x0, base);
    g.fillStyle = grad;
    g.fill();
  }
}

/** Curves, filled areas (to zero) and stacked bands — the WebGL `PlotMesh` picture. */
export function paintCurves(g: G, m: ChartModel, r: Rect): void {
  const ax = m.axes.x;
  const X = mapper(r, ax, 'x');
  const stacks = new Map<string, SeriesData[]>();
  for (const s of m.data.values())
    if (s.spec.stack && s.spec.kind !== 'bars') stacks.set(s.spec.stack, [...(stacks.get(s.spec.stack) ?? []), s]);
  const levels = new Map<SeriesData, { from: number[]; to: number[] }>();
  for (const list of stacks.values()) {
    const lv = stackLevels(list.map((s) => s.ys), list.map((s) => Math.min(s.xs.length, s.ys.length)));
    list.forEach((s, k) => levels.set(s, lv[k]!));
  }
  // mitred joins limited to 2× like the WebGL ribbons (and cheaper to stroke than round ones)
  g.lineJoin = 'miter';
  g.miterLimit = 2;
  g.lineCap = 'butt';
  for (const s of m.data.values()) {
    const kind = s.spec.kind ?? 'line';
    const n = Math.min(s.xs.length, s.ys.length);
    if (kind === 'bars' || n < 2) continue;
    const axis = axisOf(m, s.spec);
    const Y = mapper(r, axis, 'y');
    const a = s.spec.opacity ?? 1;
    const lv = levels.get(s);
    if (lv) {
      // band between the running totals, then its top edge
      g.beginPath();
      trace(g, s.xs, lv.to, 0, n, X, Y, false);
      for (let i = n - 1; i >= 0; i--) g.lineTo(X(s.xs[i]!), Y(lv.from[i]!));
      g.closePath();
      g.fillStyle = cssColor(s.spec.color, a * 0.7, 1.2);
      g.fill();
      g.beginPath();
      trace(g, s.xs, lv.to, 0, n, X, Y, false);
      g.lineWidth = 1.8;
      g.strokeStyle = cssColor(s.spec.color, a, 1.2);
      g.stroke();
      continue;
    }
    const dash = s.spec.dash === true ? DASH : s.spec.dash || null;
    const base = Y(baseValue(axis));
    for (const [from, to] of finiteRuns(s.xs, s.ys, n)) {
      if (kind === 'area') fillToBase(g, s, from, to, X, Y, base, a);
      g.beginPath();
      if (kind !== 'step' && !dash && dense(g, r, to - from)) traceDense(g, s.xs, s.ys, from, to, X, Y);
      else trace(g, s.xs, s.ys, from, to, X, Y, kind === 'step');
      g.setLineDash(dash ? [dash[0], dash[1]] : []);
      g.lineWidth = (s.spec.width ?? 2.6) + 0.4;
      g.strokeStyle = cssColor(s.spec.color, a, 1.2);
      g.stroke();
    }
  }
  g.setLineDash([]);
}

/** Marker points with their guide lines to the axes (labels are DOM). */
export function paintMarkers(g: G, m: ChartModel, r: Rect): void {
  for (const mk of m.markers.values()) {
    const axis = axisOf(m, mk);
    const tx = m.axes.x.t(mk.x);
    const ty = axis.t(mk.y);
    if (tx < -0.001 || tx > 1.001 || ty < -0.001 || ty > 1.001) continue;
    const x = r.x + r.w * tx;
    const y = r.y + r.h * (1 - ty);
    const c = mk.color ?? m.accent;
    if (mk.guides ?? true) {
      g.lineWidth = 1.4;
      g.beginPath();
      g.setLineDash([4, 4]);
      g.strokeStyle = cssColor(c, 0.75);
      g.moveTo(r.x, y);
      g.lineTo(x, y);
      g.stroke();
      g.beginPath();
      g.setLineDash([]);
      g.strokeStyle = cssColor(c, 0.5);
      g.moveTo(x, r.y + r.h);
      g.lineTo(x, y);
      g.stroke();
    }
    g.save();
    g.shadowColor = cssColor(c, 0.45, 1.3);
    g.shadowBlur = 9 * g.getTransform().a;
    g.beginPath();
    g.arc(x, y, 7.5 - 1.75, 0, Math.PI * 2);
    g.fillStyle = cssColor('white');
    g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = cssColor(c, 1, 1.3);
    g.stroke();
    g.restore();
  }
}

/** Bars (drawn under the curves, like the WebGL frame layer). */
export function paintBars(g: G, m: ChartModel, r: Rect): void {
  for (const s of m.data.values()) {
    if (s.spec.kind !== 'bars' || s.xs.length === 0) continue;
    const axis = axisOf(m, s.spec);
    const base = py(r, axis, baseValue(axis));
    const bw = barWidth(r.w, s.xs.length);
    const a = s.spec.opacity ?? 1;
    for (let i = 0; i < s.xs.length; i++) {
      const xv = s.xs[i]!;
      const yv = s.ys[i]!;
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue; // a gap, not a bar
      const x = px(r, m.axes.x, xv);
      const y = py(r, axis, yv);
      const h = Math.abs(y - base);
      if (h < 0.5) continue;
      const top = Math.min(y, base);
      const grad = g.createLinearGradient(0, top, 0, top + h);
      grad.addColorStop(0, cssColor(s.spec.color, a, 1.15));
      grad.addColorStop(1, cssColor(s.spec.color, a, 0.7));
      g.fillStyle = grad;
      roundRect(g, x - bw / 2, top, bw, h, Math.min(bw / 2, 3));
      g.fill();
    }
  }
}
