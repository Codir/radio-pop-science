/**
 * DomChart — the `@/ui3d` `Chart` for the DOM interface (docs/HUD_DOM.md §8): same props, same `ChartApi`
 * (`setData`, live `push` with `window`, `setMarker`, `setAxis`, `clearData`), same look. Marks on one Canvas2D
 * sized to device pixels (`ResizeObserver` on the device-pixel box, so DPR changes re-size it too); all text is
 * DOM (`text.ts`). A `<figure>` with an `aria-label` summary; static series also get a visually hidden table.
 * The owner calls `render()` every frame (the dock / board tick); it draws only when something changed.
 */
import { Axis, type AxisSpec } from '@/ui3d/charts/axis';
import type { ChartApi, ChartProps, MarkerSpec } from '@/ui3d/charts/chart';
import { h } from '../core/dom';
import { dataTable, summary, valueText } from './a11y';
import { legendEl } from './legend';
import { paintBars, paintCurves, paintFrame, paintMarkers, type ChartModel, type SeriesData } from './paint';
import { plotRect, scrubStep, scrubValue, type Rect } from './geometry';
import { ChartText, sameMarker } from './text';
import { observeCanvas, type CanvasBox } from './surface';

export class DomChart implements ChartApi, ChartModel {
  readonly el: HTMLElement;
  readonly axes: { x: Axis; y: Axis; y2: Axis | null };
  readonly data = new Map<string, SeriesData>();
  readonly markers = new Map<string, MarkerSpec>();
  accent = '#00e5ff';
  private readonly frame: HTMLElement;
  /**
   * Three canvases, each repainted only for its own reason: the well and grid (Y axes, size), the data (curves,
   * bars), the markers (an operating point moving every frame never repaints 8 000 points).
   */
  private readonly grid = h('canvas.kd-chart-canvas', { 'aria-hidden': 'true' });
  private readonly canvas = h('canvas.kd-chart-canvas', { 'aria-hidden': 'true' });
  private readonly overlay = h('canvas.kd-chart-canvas', { 'aria-hidden': 'true' });
  private readonly gg = this.grid.getContext('2d');
  private readonly og = this.overlay.getContext('2d');
  private gridDirty = true;
  private readonly text = new ChartText();
  private readonly table: HTMLElement | null;
  private box: CanvasBox | null = null;
  private dirty = true;
  private axesDirty = true;
  private marksDirty = true;
  private tableDirty = true;
  private tableAt = -Infinity;
  private scrubX = Number.NaN;
  private readonly unobserve: () => void;

  constructor(readonly cfg: ChartProps) {
    this.axes = {
      x: new Axis({ ...cfg.x }),
      y: new Axis({ ...cfg.y }),
      y2: cfg.y2 ? new Axis({ ...cfg.y2 }) : null,
    };
    for (const spec of cfg.series) this.data.set(spec.id, { spec, xs: [], ys: [] });
    const height = typeof cfg.height === 'number' ? cfg.height : 220;
    this.frame = h('div.kd-chart-frame', null, this.grid, this.canvas, this.overlay, this.text.el);
    this.frame.style.setProperty('--h', String(height));
    const keys = cfg.series.filter((s) => s.label);
    const legend =
      (cfg.legend ?? keys.length > 1) && keys.length > 0
        ? legendEl(keys.map((s) => ({ label: s.label!, color: s.color, swatch: s.kind === 'bars' ? 'box' : 'line' })), 'chart')
        : null;
    this.table = cfg.window ? null : h('table.kd-sr');
    this.el = h('figure.kd-chart', { 'aria-label': summary(cfg) }, this.frame, legend, this.table);
    if (cfg.name) this.el.dataset.ui = cfg.name;
    if (cfg.onScrub) this.scrubbable(cfg.onScrub);
    this.unobserve = observeCanvas(this.canvas, (box) => {
      this.box = box;
      this.accent = box.accent;
      for (const c of [this.grid, this.overlay]) {
        c.width = this.canvas.width;
        c.height = this.canvas.height;
      }
      this.dirty = this.axesDirty = this.marksDirty = this.gridDirty = true;
      this.render();
    });
  }

  /* ------------------------------------------------------------------------------------------ ChartApi */

  setData(id: string, xs: ArrayLike<number>, ys: ArrayLike<number>): void {
    const s = this.data.get(id);
    if (!s) return;
    s.xs = Array.from(xs);
    s.ys = Array.from(ys);
    this.dirty = this.tableDirty = true;
  }

  push(id: string, x: number, y: number): void {
    const s = this.data.get(id);
    if (!s) return;
    s.xs.push(x);
    s.ys.push(y);
    const win = this.cfg.window;
    if (win) {
      // drop the samples that left the window, keeping one beyond its edge (the curve enters from the side)
      let k = 0;
      while (s.xs.length - k > 2 && s.xs[k + 1]! < x - win) k += 1;
      if (k > 0) {
        s.xs.splice(0, k);
        s.ys.splice(0, k);
      }
      const ax = this.axes.x.spec;
      if (x > ax.max) {
        ax.max = x;
        ax.min = x - win;
        this.axesDirty = this.marksDirty = true;
      }
    }
    this.dirty = this.tableDirty = true;
  }

  clearData(id?: string): void {
    for (const s of this.data.values()) if (!id || s.spec.id === id) s.xs.length = s.ys.length = 0;
    this.dirty = this.axesDirty = this.marksDirty = this.tableDirty = true;
  }

  setAxis(which: 'x' | 'y' | 'y2', spec: Partial<AxisSpec>): void {
    const axis = this.axes[which];
    if (axis) Object.assign(axis.spec, spec);
    this.dirty = this.axesDirty = this.marksDirty = this.gridDirty = true;
  }

  setMarker(id: string, marker: MarkerSpec | null): void {
    if (marker && sameMarker(this.markers.get(id), marker)) return;
    if (marker) this.markers.set(id, marker);
    else this.markers.delete(id);
    this.marksDirty = true;
  }

  /* --------------------------------------------------------------------------------------------- frame */

  /** Plot rectangle in units (null before the first size is known). */
  private rect(): Rect | null {
    const b = this.box;
    return b ? plotRect(b.width / b.u, b.height / b.u, !!this.axes.y2, !!this.axes.x.spec.label) : null;
  }

  /** Draw what changed since the last call (cheap when nothing did). Call every frame while on screen. */
  render(): void {
    const b = this.box;
    const r = this.rect();
    if (!b || !r) return;
    // a cleared context in units (y down, origin at the frame's top-left)
    const fresh = (g: CanvasRenderingContext2D): CanvasRenderingContext2D => {
      const k = b.u * b.dpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, g.canvas.width, g.canvas.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      return g;
    };
    if (this.gridDirty && this.gg) {
      this.gridDirty = false;
      paintFrame(fresh(this.gg), this, r);
    }
    if (this.dirty) {
      this.dirty = false;
      const g = fresh(b.g);
      paintBars(g, this, r);
      paintCurves(g, this, r);
    }
    if (this.axesDirty) {
      this.axesDirty = false;
      this.text.layoutAxes(this, r, b.u);
    }
    if (this.marksDirty && this.og) {
      this.marksDirty = false;
      paintMarkers(fresh(this.og), this, r);
      this.text.layoutMarkers(this, r, b.u);
    }
    // the hidden data table: rebuilt at most twice a second (some chapters re-set static data every frame)
    const now = performance.now();
    if (this.table && this.tableDirty && now - this.tableAt > 500) {
      this.tableDirty = false;
      this.tableAt = now;
      dataTable(this.table, this);
    }
  }

  /** Drag along X (pointer) or arrow keys (1 %, Shift 10 %) → `onScrub(x)`. */
  private scrubbable(onScrub: (x: number) => void): void {
    const f = this.frame;
    f.classList.add('scrub');
    f.tabIndex = 0;
    f.dataset.keys = 'arrows';
    f.setAttribute('role', 'slider');
    f.setAttribute('aria-label', `Перетягніть уздовж осі${this.axes.x.spec.label ? ` ${this.axes.x.spec.label}` : ''}`);
    const set = (x: number): void => {
      this.scrubX = x;
      f.setAttribute('aria-valuetext', valueText(this.axes.x, x));
      onScrub(x);
    };
    let left = 0;
    const at = (e: PointerEvent): void => {
      const r = this.rect();
      if (r && this.box) set(scrubValue(r, this.axes.x, (e.clientX - left) / this.box.u));
    };
    f.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      left = f.getBoundingClientRect().left; // once per drag, on input — never per frame
      f.setPointerCapture(e.pointerId);
      at(e);
    });
    f.addEventListener('pointermove', (e) => {
      if (f.hasPointerCapture(e.pointerId)) at(e);
    });
    f.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const ax = this.axes.x;
      const from = Number.isFinite(this.scrubX) ? this.scrubX : ax.value(0.5);
      set(scrubStep(ax, from, dir, e.shiftKey));
    });
  }

  dispose(): void {
    this.unobserve();
  }
}

/** Element factory for the dock / board `chart` control (D3): the DOM chart of a `ChartSpec`'s props. */
export function createChart(props: ChartProps): DomChart {
  return new DomChart(props);
}
