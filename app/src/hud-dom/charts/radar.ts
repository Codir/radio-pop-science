/**
 * DomRadarChart — the `@/ui3d` `RadarChart` for the DOM interface: same props and `RadarApi` (`setSeries`,
 * `setValues` with a morph on the engine clock, `highlight`). Web, spokes and polygons on a Canvas2D; axis
 * names and the legend are DOM.
 */
import type { DomHost, DomWidget } from '@/hud/step-ui-types';
import type { RadarApi, RadarProps, RadarSeries } from '@/ui3d/charts/radar';
import { h, setStyle } from '../core/dom';
import { cssColor } from './color';
import { legendEl } from './legend';
import { observeCanvas, type CanvasBox } from './surface';

export class DomRadarChart implements RadarApi, DomWidget {
  readonly el: HTMLElement;
  private readonly web: HTMLElement;
  private readonly canvas = h('canvas.kd-chart-canvas', { 'aria-hidden': 'true' });
  private legend: HTMLElement | null = null;
  private series: RadarSeries[];
  private highlighted: string | null = null;
  private box: CanvasBox | null = null;
  private dirty = true;
  private readonly d: number;
  private readonly unobserve: () => void;

  constructor(
    private readonly cfg: RadarProps,
    private readonly host: DomHost | null = null,
  ) {
    this.series = [...cfg.series];
    this.d = cfg.size ?? 240;
    const n = cfg.axes.length;
    const r = this.d / 2;
    this.web = h('div.kd-radar-web', null, this.canvas);
    this.web.style.setProperty('--w', String(this.d + 190));
    this.web.style.setProperty('--h', String(this.d + 64));
    cfg.axes.forEach((name, i) => {
      const [x, y] = this.dir(i, n);
      const ax = x > 0.3 ? 0 : x < -0.3 ? 1 : 0.5;
      const ay = y < -0.3 ? 1 : y > 0.3 ? 0 : 0.5;
      const label = h('span.kd-axis-label', null, name);
      // position in units from the web's centre, as a fraction of the box: CSS does the px
      setStyle(label, 'left', `calc(50% + ${(x * (r + 12)).toFixed(2)} * var(--u))`);
      setStyle(label, 'top', `calc(50% + ${(y * (r + 12)).toFixed(2)} * var(--u))`);
      setStyle(label, 'transform', `translate(${-ax * 100}%, ${-ay * 100}%)`);
      this.web.append(label);
    });
    this.el = h('figure.kd-radar', { 'aria-label': `Радар: ${cfg.axes.join(', ')}` }, this.web);
    this.syncLegend();
    this.unobserve = observeCanvas(this.canvas, (box) => {
      this.box = box;
      this.dirty = true;
      this.update();
    });
  }

  /** Unit vector of spoke `i` (y down; spoke 0 points up, the rest clockwise as in the WebGL chart). */
  private dir(i: number, n: number): [number, number] {
    const a = (i / n) * Math.PI * 2;
    return [Math.sin(a), -Math.cos(a)];
  }

  setSeries(series: readonly RadarSeries[]): void {
    this.series = [...series];
    this.dirty = true;
    this.syncLegend();
  }

  setValues(id: string, values: readonly number[], opts: { duration?: number } = {}): void {
    const from = this.series.find((s) => s.id === id)?.values ?? values.map(() => 0);
    const set = (v: readonly number[]): void => {
      this.series = this.series.map((s) => (s.id === id ? { ...s, values: v } : s));
      this.dirty = true;
    };
    if (!opts.duration || !this.host || this.host.reducedMotion()) return set(values);
    const morph = { k: 0 };
    this.host.tweens.to(morph, { k: 1 }, {
      duration: opts.duration,
      ease: 'power2.inOut',
      onUpdate: () => set(values.map((to, i) => (from[i] ?? 0) + (to - (from[i] ?? 0)) * morph.k)),
    }); // prettier-ignore
  }

  highlight(id: string | null): void {
    this.highlighted = id;
    this.dirty = true;
  }

  private syncLegend(): void {
    this.legend?.remove();
    this.legend = null;
    if (this.cfg.legend === false) return;
    this.legend = legendEl(this.series.map((s) => ({ label: s.label, color: s.color })), 'center');
    this.el.append(this.legend);
  }

  /** Redraw the web if anything changed (a morph step, new series, a resize). Call every frame. */
  update(): void {
    const b = this.box;
    if (!b || !this.dirty) return;
    this.dirty = false;
    const g = b.g;
    const k = b.u * b.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // origin at the web's centre, in units
    g.setTransform(k, 0, 0, k, (b.width / 2) * b.dpr, (b.height / 2) * b.dpr);
    const n = this.cfg.axes.length;
    const r = this.d / 2;
    const rings = this.cfg.rings ?? 4;
    g.lineWidth = 1.2;
    for (let i = 1; i <= rings; i++) {
      g.beginPath();
      g.arc(0, 0, (r * i) / rings, 0, Math.PI * 2);
      g.strokeStyle = cssColor('slate', i === rings ? 0.8 : 0.4);
      g.stroke();
    }
    g.strokeStyle = cssColor('slate', 0.6);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const [x, y] = this.dir(i, n);
      g.moveTo(0, 0);
      g.lineTo(x * r, y * r);
    }
    g.stroke();
    g.lineJoin = 'round';
    for (const s of this.series) {
      const dim = this.highlighted !== null && this.highlighted !== s.id;
      const a = dim ? 0.35 : 1;
      let reach = 0;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const v = Math.min(Math.max(s.values[i] ?? 0, 0), 1);
        reach = Math.max(reach, v);
        const [x, y] = this.dir(i, n);
        if (i === 0) g.moveTo(x * r * v, y * r * v);
        else g.lineTo(x * r * v, y * r * v);
      }
      g.closePath();
      // the WebGL fill fades from the rim (22 %) to the centre (8 %)
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(r * reach, 1));
      grad.addColorStop(0, cssColor(s.color, a * (dim ? 0.02 : 0.08), 1.2));
      grad.addColorStop(1, cssColor(s.color, a * (dim ? 0.06 : 0.22), 1.2));
      g.fillStyle = grad;
      g.fill();
      g.lineWidth = 2.8;
      g.strokeStyle = cssColor(s.color, a, 1.2);
      g.stroke();
    }
  }

  dispose(): void {
    this.unobserve();
  }
}
