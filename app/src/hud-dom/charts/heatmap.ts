/**
 * DomHeatMap — the `@/ui3d` `HeatMap` for the DOM interface: same props and `HeatMapApi`. The field is an
 * `ImageData` of nx × ny cells (the WebGL data texture), drawn bilinearly scaled into the plot; ticks, titles
 * and the value read-out are DOM. The marker is a focusable DOM handle: drag anywhere on the plot, or arrow
 * keys on the handle (1 % of an axis, Shift 10 %), both call `onPick`.
 */
import { fmtUnit } from '@/content/format';
import type { DomWidget } from '@/hud/step-ui-types';
import { col } from '@/style';
import { Axis } from '@/ui3d/charts/axis';
import type { HeatMapApi, HeatMapProps } from '@/ui3d/charts/heatmap';
import { UI } from '@/ui3d/theme';
import { h, setStyle, setText } from '../core/dom';
import { cssColor } from './color';
import { labelLeft, scrubStep, type Rect } from './geometry';
import { observeCanvas, type CanvasBox } from './surface';
import { textWidth } from './text';

const PAD = { left: 52, right: 12, top: 26, bottom: 40 };

export class DomHeatMap implements HeatMapApi, DomWidget {
  readonly el: HTMLElement;
  private readonly axes: { x: Axis; y: Axis };
  private mark: { x: number; y: number } | null;
  private readonly canvas = h('canvas.kd-chart-canvas', { 'aria-hidden': 'true' });
  private readonly field: HTMLCanvasElement;
  private readonly text = h('div.kd-chart-text');
  private readonly handle: HTMLButtonElement | null;
  private readonly value = h('span.kd-mark-label');
  private box: CanvasBox | null = null;
  private dirty = true;
  private readonly unobserve: () => void;

  constructor(private readonly cfg: HeatMapProps) {
    this.axes = { x: new Axis({ ...cfg.x }), y: new Axis({ ...cfg.y }) };
    this.mark = cfg.marker ? { ...cfg.marker } : null;
    this.field = this.buildField();
    const height = typeof cfg.height === 'number' ? cfg.height : 240;
    this.handle = this.mark
      ? h('button.kd-heat-handle', { type: 'button', 'data-keys': 'arrows', 'aria-label': 'Маркер' })
      : null;
    const frame = h('div.kd-chart-frame.kd-heat', null, this.canvas, this.text, this.handle);
    frame.style.setProperty('--h', String(height));
    this.el = h('figure.kd-chart', { 'aria-label': `Теплова мапа: ${cfg.y.label ?? ''} від ${cfg.x.label ?? ''}` }, frame);
    if (this.handle) this.interactive(frame, this.handle);
    this.unobserve = observeCanvas(this.canvas, (box) => {
      this.box = box;
      this.dirty = true;
      this.layoutText();
      this.update();
    });
  }

  get marker(): { x: number; y: number } | null {
    return this.mark;
  }

  setMarker(x: number, y: number, notify = false): void {
    if (this.mark && this.mark.x === x && this.mark.y === y && !notify) return;
    this.mark = { x, y };
    this.dirty = true;
    if (notify) this.cfg.onPick?.(x, y, this.cfg.value(x, y));
  }

  /** The colour field, one pixel per cell, rows flipped (the WebGL texture's row 0 is the bottom). */
  private buildField(): HTMLCanvasElement {
    const { cfg } = this;
    const nx = cfg.nx ?? 48;
    const ny = cfg.ny ?? 32;
    const stops = (cfg.ramp ?? ['bg.indigo', 'blue', 'teal', 'lime', 'yellow']).map((c) => col(c).convertLinearToSRGB());
    const img = new ImageData(nx, ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v = cfg.value(this.axes.x.value((i + 0.5) / nx), this.axes.y.value((j + 0.5) / ny));
        const t = Math.min(Math.max((v - cfg.min) / (cfg.max - cfg.min || 1), 0), 1) * (stops.length - 1);
        const k = Math.min(Math.floor(t), stops.length - 2);
        const c = stops[k]!.clone().lerp(stops[k + 1]!, t - k);
        img.data.set([c.r * 255, c.g * 255, c.b * 255, 255], ((ny - 1 - j) * nx + i) * 4);
      }
    const field = document.createElement('canvas');
    field.width = nx;
    field.height = ny;
    field.getContext('2d')?.putImageData(img, 0, 0);
    return field;
  }

  private rect(): Rect | null {
    const b = this.box;
    if (!b) return null;
    const w = b.width / b.u;
    const hh = b.height / b.u;
    const rh = Math.max(hh - PAD.top - PAD.bottom, 10);
    return { x: PAD.left, y: hh - PAD.bottom - rh, w: Math.max(w - PAD.left - PAD.right, 10), h: rh };
  }

  /** Ticks and axis titles (on resize only: the axes of a heat map never change). */
  private layoutText(): void {
    const r = this.rect();
    const u = this.box?.u ?? 1;
    if (!r) return;
    const put = (text: string, x: number, y: number, ax: number, cls: string): void => {
      const s = h(`span.${cls}` as 'span', null, text);
      s.style.transform = `translate(${(x * u).toFixed(1)}px, ${(y * u).toFixed(1)}px) translate(${-ax * 100}%, -50%)`;
      this.text.append(s);
    };
    this.text.replaceChildren();
    const { x: ax, y: ay } = this.axes;
    for (const v of ax.ticks()) put(ax.label(v), r.x + r.w * ax.t(v), r.y + r.h + 14, 0.5, 'kd-tick');
    for (const v of ay.ticks()) put(ay.label(v), r.x - 8, r.y + r.h * (1 - ay.t(v)), 1, 'kd-tick');
    if (this.cfg.x.label) put(this.cfg.x.label, r.x + r.w, r.y + r.h + 31, 1, 'kd-axis-title');
    if (this.cfg.y.label) put(this.cfg.y.label, r.x - 2, r.y - 15, 0, 'kd-axis-title');
    if (this.mark) this.text.append(this.value);
  }

  /** Redraw field, frame and marker when something changed; move the handle and the read-out. */
  update(): void {
    const b = this.box;
    const r = this.rect();
    if (!b || !r || !this.dirty) return;
    this.dirty = false;
    const g = b.g;
    const k = b.u * b.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'low'; // bilinear, like the texture's LinearFilter
    g.drawImage(this.field, r.x, r.y, r.w, r.h);
    g.beginPath();
    g.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, UI.radius.inset);
    g.lineWidth = 1.2;
    g.strokeStyle = cssColor('slate', 0.7);
    g.stroke();
    if (!this.mark) return;
    const x = r.x + r.w * this.axes.x.t(this.mark.x);
    const y = r.y + r.h * (1 - this.axes.y.t(this.mark.y));
    g.fillStyle = cssColor('white', 0.55, 1, 'raw');
    g.fillRect(x - 0.7, r.y, 1.4, r.h);
    g.fillRect(r.x, y - 0.7, r.w, 1.4);
    g.save();
    g.shadowColor = cssColor('white', 0.5);
    g.shadowBlur = 8 * k;
    g.beginPath();
    g.arc(x, y, 10 - 1.5, 0, Math.PI * 2);
    g.fillStyle = cssColor('bg.void', 0.35, 1, 'light');
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = cssColor('white');
    g.stroke();
    g.restore();
    const text = fmtUnit(this.cfg.value(this.mark.x, this.mark.y), this.cfg.unit ?? '', { maxDigits: 1 });
    setText(this.value, text);
    const left = labelLeft(r, x, textWidth(text, 15), 16);
    setStyle(this.value, 'transform', `translate(${((left - 6) * b.u).toFixed(1)}px, ${((y - 20) * b.u).toFixed(1)}px) translate(0, -50%)`);
    if (this.handle) {
      setStyle(this.handle, 'transform', `translate(${(x * b.u).toFixed(1)}px, ${(y * b.u).toFixed(1)}px) translate(-50%, -50%)`);
      this.handle.setAttribute('aria-valuetext', text);
      this.handle.setAttribute('aria-label', `Маркер: ${this.axes.x.label(this.mark.x)} · ${this.axes.y.label(this.mark.y)} — ${text}`);
    }
  }

  /** Pointer on the plot moves the marker; arrow keys on the handle nudge it. */
  private interactive(frame: HTMLElement, handle: HTMLButtonElement): void {
    frame.classList.add('pick');
    let origin = { left: 0, top: 0 };
    const pick = (e: PointerEvent): void => {
      const r = this.rect();
      const u = this.box?.u ?? 1;
      if (!r) return;
      const tx = Math.min(Math.max(((e.clientX - origin.left) / u - r.x) / r.w, 0), 1);
      const ty = Math.min(Math.max(1 - ((e.clientY - origin.top) / u - r.y) / r.h, 0), 1);
      this.setMarker(this.axes.x.value(tx), this.axes.y.value(ty), true);
    };
    frame.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      origin = frame.getBoundingClientRect(); // once per drag, on input
      frame.setPointerCapture(e.pointerId);
      pick(e);
    });
    frame.addEventListener('pointermove', (e) => {
      if (frame.hasPointerCapture(e.pointerId)) pick(e);
    });
    handle.addEventListener('keydown', (e) => {
      const m = this.mark;
      if (!m) return;
      const big = e.shiftKey;
      const { x: ax, y: ay } = this.axes;
      if (e.key === 'ArrowLeft') this.setMarker(scrubStep(ax, m.x, -1, big), m.y, true);
      else if (e.key === 'ArrowRight') this.setMarker(scrubStep(ax, m.x, 1, big), m.y, true);
      else if (e.key === 'ArrowUp') this.setMarker(m.x, scrubStep(ay, m.y, 1, big), true);
      else if (e.key === 'ArrowDown') this.setMarker(m.x, scrubStep(ay, m.y, -1, big), true);
      else return;
      e.preventDefault();
    });
  }

  dispose(): void {
    this.unobserve();
  }
}
