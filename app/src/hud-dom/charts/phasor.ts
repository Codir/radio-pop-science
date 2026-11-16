/**
 * DomPhasorScope — the `@/ui3d` `PhasorScope` for the DOM interface: same props and `PhasorApi`. Rotating
 * arrows on the left, each arrow's projection traced as a sine on the strip to the right, dashed ties from the
 * tips to the trace heads — one Canvas2D; the `t` caption and the legend are DOM.
 */
import type { DomWidget } from '@/hud/step-ui-types';
import type { Phasor, PhasorApi, PhasorProps } from '@/ui3d/charts/phasor';
import { UI } from '@/ui3d/theme';
import { h, setStyle } from '../core/dom';
import { cssColor } from './color';
import { legendEl } from './legend';
import { observeCanvas, type CanvasBox } from './surface';

const SAMPLES = 96;

export class DomPhasorScope implements PhasorApi, DomWidget {
  readonly el: HTMLElement;
  private readonly canvas = h('canvas.kd-chart-canvas', { 'aria-hidden': 'true' });
  private readonly t = h('span.kd-tick.kd-phasor-t', null, 't');
  private phasors: Phasor[];
  private angle = 0;
  private readonly d: number;
  private box: CanvasBox | null = null;
  private dirty = true;
  private readonly unobserve: () => void;

  constructor(private readonly cfg: PhasorProps) {
    this.phasors = [...cfg.phasors];
    this.d = cfg.size ?? 170;
    const dial = h('div.kd-chart-frame', null, this.canvas, h('div.kd-chart-text', null, this.t));
    dial.style.setProperty('--h', String(this.d + 16));
    const legend = legendEl(this.phasors.map((f) => ({ label: f.label, color: f.color })));
    this.el = h('figure.kd-chart.kd-phasor', { 'aria-label': `Фазори: ${this.phasors.map((f) => f.label).join(', ')}` }, dial, legend);
    this.unobserve = observeCanvas(this.canvas, (box) => {
      this.box = box;
      this.dirty = true;
      this.update();
    });
  }

  setAngle(angle: number): void {
    if (angle === this.angle) return;
    this.angle = angle;
    this.dirty = true;
  }

  setPhasor(id: string, patch: Partial<Pick<Phasor, 'amplitude' | 'phase'>>): void {
    this.phasors = this.phasors.map((f) => (f.id === id ? { ...f, ...patch } : f));
    this.dirty = true;
  }

  /** Redraw when the angle or a phasor changed. Call every frame. Units, origin at the dial's centre-left. */
  update(): void {
    const b = this.box;
    if (!b || !this.dirty) return;
    this.dirty = false;
    const g = b.g;
    const k = b.u * b.dpr;
    const w = b.width / b.u;
    const r = this.d / 2;
    const cx = r + 8;
    const x0 = cx + r + 26;
    const x1 = w - 8;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(k, 0, 0, k, 0, (b.height / 2) * b.dpr); // y = 0 on the dial's horizontal axis, y down
    g.lineWidth = 1.4;
    g.strokeStyle = cssColor('slate', 0.6);
    g.beginPath();
    g.arc(cx, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = cssColor('slate', 0.4);
    g.beginPath();
    g.moveTo(cx - r, 0);
    g.lineTo(cx + r, 0);
    g.moveTo(cx, -r);
    g.lineTo(cx, r);
    g.stroke();
    g.beginPath();
    g.roundRect(x0 - 6, -(this.d + 8) / 2, x1 - x0 + 12, this.d + 8, UI.radius.inset);
    g.fillStyle = cssColor('bg.void', 0.55);
    g.fill();
    g.strokeStyle = cssColor('slate', 0.6);
    g.stroke();
    g.strokeStyle = cssColor('slate', 0.5);
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x1, 0);
    g.stroke();
    g.lineCap = 'round';
    for (const f of this.phasors) {
      const c = cssColor(f.color, 1, 1.25);
      const a = this.angle + f.phase;
      const x = cx + Math.cos(a) * r * f.amplitude;
      const y = -Math.sin(a) * r * f.amplitude;
      g.save();
      g.shadowColor = cssColor(f.color, 0.3, 1.25);
      g.shadowBlur = 5 * k;
      g.lineWidth = 3.2;
      g.strokeStyle = c;
      g.beginPath();
      g.moveTo(cx, 0);
      g.lineTo(x, y);
      g.stroke();
      g.restore();
      g.lineWidth = 3;
      g.beginPath();
      for (const side of [-1, 1]) {
        g.moveTo(x, y);
        g.lineTo(x - Math.cos(a + side * 0.45) * 11, y + Math.sin(a + side * 0.45) * 11);
      }
      g.stroke();
      g.lineWidth = 1.3;
      g.setLineDash([3.5, 3.5]);
      g.strokeStyle = cssColor(f.color, 0.7, 1.25);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x0, y);
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.arc(x0, y, 4 - 1.2, 0, Math.PI * 2);
      g.fillStyle = cssColor('white');
      g.fill();
      g.lineWidth = 2.4;
      g.strokeStyle = c;
      g.stroke();
    }
    g.beginPath();
    g.arc(cx, 0, 3.5, 0, Math.PI * 2);
    g.fillStyle = cssColor('white');
    g.fill();
    // traces: the strip scrolls so that "now" is at its left edge, next to the dial
    const span = (this.cfg.periods ?? 1.5) * Math.PI * 2;
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    g.lineWidth = 2.8;
    for (const f of this.phasors) {
      g.strokeStyle = cssColor(f.color, 1, 1.2);
      g.beginPath();
      for (let i = 0; i < SAMPLES; i++) {
        const q = i / (SAMPLES - 1);
        const y = -Math.sin(this.angle + f.phase - span * q) * r * f.amplitude;
        if (i === 0) g.moveTo(x0 + (x1 - x0) * q, y);
        else g.lineTo(x0 + (x1 - x0) * q, y);
      }
      g.stroke();
    }
    setStyle(this.t, 'transform', `translate(${((x1 - 12) * b.u).toFixed(1)}px, ${((b.height / b.u / 2 + r - 2) * b.u).toFixed(1)}px)`);
  }

  dispose(): void {
    this.unobserve();
  }
}
