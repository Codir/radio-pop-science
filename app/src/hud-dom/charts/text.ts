/**
 * The words and numbers of a DOM chart (docs/HUD_DOM.md §8): tick labels, axis titles («U, V») and marker
 * labels as absolutely positioned DOM text over the canvas — selectable, crisp at any zoom. Ticks and titles are
 * re-laid only when a range, a title or the frame size changes; marker labels only when a marker changes.
 * Positions come from the pure geometry (units) × px-per-unit — never from reading the layout.
 */
import type { MarkerSpec } from '@/ui3d/charts/chart';
import type { Axis } from '@/ui3d/charts/axis';
import { h, setStyle, setText } from '../core/dom';
import { cssColor } from './color';
import { labelLeft, px, py, type Rect } from './geometry';
import type { ChartModel } from './paint';

/** Width of a text in units, measured on a shared 2D context (no DOM layout read). */
const measureCtx = ((): CanvasRenderingContext2D | null => {
  try {
    return document.createElement('canvas').getContext('2d');
  } catch {
    return null;
  }
})();
export function textWidth(text: string, size: number, weight = 600, family = "'K Body', sans-serif"): number {
  if (!measureCtx) return text.length * size * 0.55;
  measureCtx.font = `${weight} ${size * 10}px ${family}`;
  return measureCtx.measureText(text).width / 10;
}

/**
 * Tick text of an axis, memoised: a live strip moves its X range every frame, but the tick values repeat and
 * the label of a value depends only on the axis' span (digits), scale and format — not on where it sits.
 */
const labelCache = new WeakMap<Axis, Map<string, string>>();
function tickLabel(axis: Axis, v: number): string {
  const s = axis.spec;
  let m = labelCache.get(axis);
  if (!m) labelCache.set(axis, (m = new Map()));
  const key = `${v}|${s.max - s.min}|${s.log ? 1 : 0}|${s.years ?? ''}|${s.min >= 1000 && s.max <= 2999 ? 1 : 0}`;
  let text = m.get(key);
  if (text === undefined) {
    if (m.size > 300) m.clear();
    m.set(key, (text = axis.label(v)));
  }
  return text;
}

/** A pool of positioned spans (reused by index, surplus hidden). */
class Spans {
  private readonly list: HTMLSpanElement[] = [];
  private used = 0;
  constructor(
    private readonly host: HTMLElement,
    private readonly cls: string,
  ) {}
  begin(): void {
    this.used = 0;
  }
  /** Place a text: `ax`, `ay` = which point of the span sits at (x, y) px (0 left/top … 1 right/bottom). */
  put(text: string, x: number, y: number, ax: number, ay: number, color = ''): HTMLSpanElement {
    let s = this.list[this.used];
    if (!s) this.host.append((s = this.list[this.used] = h('span', { class: this.cls })));
    this.used += 1;
    s.hidden = false;
    setText(s, text);
    setStyle(s, 'transform', `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${-ax * 100}%, ${-ay * 100}%)`);
    setStyle(s, 'color', color);
    return s;
  }
  end(): void {
    for (let i = this.used; i < this.list.length; i++) this.list[i]!.hidden = true;
  }
}

export class ChartText {
  readonly el = h('div.kd-chart-text');
  private readonly ticks = new Spans(this.el, 'kd-tick');
  private readonly xticks = new Spans(this.el, 'kd-tick x');
  private readonly titles = new Spans(this.el, 'kd-axis-title');
  private readonly marks = new Spans(this.el, 'kd-mark-label');

  /** Ticks and axis titles. `u` = CSS px per unit. */
  layoutAxes(m: ChartModel, r: Rect, u: number): void {
    const { x: ax, y: ay, y2 } = m.axes;
    this.ticks.begin();
    if (!ay.spec.bare) for (const v of ay.ticks()) this.ticks.put(tickLabel(ay, v), (r.x - 9) * u, py(r, ay, v) * u, 1, 0.5);
    if (y2 && !y2.spec.bare)
      for (const v of y2.ticks()) this.ticks.put(tickLabel(y2, v), (r.x + r.w + 9) * u, py(r, y2, v) * u, 0, 0.5);
    this.ticks.end();
    // X ticks carry their tick mark (::before, 6 units tall just under the plot) even when the labels are bare
    this.xticks.begin();
    for (const v of ax.ticks()) this.xticks.put(ax.spec.bare ? '' : tickLabel(ax, v), px(r, ax, v) * u, (r.y + r.h + 9) * u, 0.5, 0);
    this.xticks.end();
    // titles: X under the ticks on the right; Y / Y2 in the margin above the plot's top corners
    const tone = (axis: 'y' | 'y2'): string => {
      const s = [...m.data.values()].find((d) => (d.spec.axis ?? 'y') === axis);
      return s && y2 ? cssColor(s.spec.color, 1, 1.1) : '';
    };
    this.titles.begin();
    if (ax.spec.label) this.titles.put(ax.spec.label, (r.x + r.w) * u, (r.y + r.h + 26) * u, 1, 0);
    if (ay.spec.label) this.titles.put(ay.spec.label, (r.x - 2) * u, (r.y - 25) * u, 0, 0, tone('y'));
    if (y2?.spec.label) this.titles.put(y2.spec.label, (r.x + r.w + 2) * u, (r.y - 25) * u, 1, 0, tone('y2'));
    this.titles.end();
  }

  /** Marker labels on dark pills, right of the point unless that leaves the plot. */
  layoutMarkers(m: ChartModel, r: Rect, u: number): void {
    this.marks.begin();
    for (const mk of m.markers.values()) {
      if (!mk.label) continue;
      const axis: Axis = mk.axis === 'y2' && m.axes.y2 ? m.axes.y2 : m.axes.y;
      const tx = m.axes.x.t(mk.x);
      const ty = axis.t(mk.y);
      if (tx < -0.001 || tx > 1.001 || ty < -0.001 || ty > 1.001) continue;
      const x = r.x + r.w * tx;
      const y = r.y + r.h * (1 - ty);
      const left = labelLeft(r, x, textWidth(mk.label, 15));
      // the pill is 5 units wider on each side than the text; its centre sits 18 units above the point
      this.marks.put(mk.label, (left - 5) * u, (y - 18) * u, 0, 0.5);
    }
    this.marks.end();
  }
}

/** Is a marker unchanged (same point and label) — the WebGL chart's early-out. */
export function sameMarker(a: MarkerSpec | undefined, b: MarkerSpec): boolean {
  return !!a && a.x === b.x && a.y === b.y && a.label === b.label;
}
