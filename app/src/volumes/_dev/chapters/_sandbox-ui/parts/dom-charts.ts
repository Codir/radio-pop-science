/**
 * The chart pages of the sandbox («readouts», «charts») drawn by the DOM interface (`?hud=dom`, D4): the same
 * charts with the same data as `readouts.ts` / `extras.ts`, in plates on a `hudLayer`, so `?hud=gl` and
 * `?hud=dom` screenshots of one step compare the two renderers. The instruments (gauges, readouts) are not
 * charts and stay out of this page.
 */
import type { ChapterContext } from '@/engine/api';
import { DomChart, DomHeatMap, DomPhasorScope, DomRadarChart } from '@/hud-dom/charts';

export interface DomChartsDemo {
  show(stepId: string): void;
  update(t: number): void;
}

function plate(width: number, ...children: (HTMLElement | string)[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'kd sbx-plate';
  el.style.setProperty('--w', String(width));
  for (const c of children) {
    if (typeof c !== 'string') el.append(c);
    else {
      const t = document.createElement('h3');
      t.className = 'sbx-title';
      t.textContent = c;
      el.append(t);
    }
  }
  return el;
}

function page(...plates: HTMLElement[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'sbx-page';
  el.append(...plates);
  el.hidden = true;
  return el;
}

const STYLE = `
.sbx-page { left: calc(110 * var(--u)); top: calc(150 * var(--u)); display: flex; gap: calc(18 * var(--u)); align-items: flex-start; }
.sbx-plate { position: relative; width: calc(var(--w) * var(--u)); padding: calc(26 * var(--u)); display: flex; flex-direction: column; gap: calc(12 * var(--u)); }
.sbx-title { margin: 0; font-family: var(--display); font-weight: 800; font-size: calc(24 * var(--u)); line-height: 1.2; }`;

export function domChartsDemo(ctx: ChapterContext, layer: HTMLElement): DomChartsDemo {
  const style = document.createElement('style');
  style.textContent = STYLE;
  layer.append(style);
  ctx.onDispose(() => style.remove());

  // readouts page: the I-V curve with its operating point, the live three-phase plot, the stacked day
  const iv = new DomChart({
    height: 210,
    x: { min: 0, max: 45, label: 'U, V' },
    y: { min: 0, max: 15, label: 'I, A' },
    y2: { min: 0, max: 500, label: 'P, W' },
    series: [
      { id: 'iv', label: 'I(U)', color: 'sky' },
      { id: 'pv', label: 'P(U)', color: 'yellow', axis: 'y2', kind: 'area' },
    ],
  });
  const us: number[] = [];
  const is: number[] = [];
  const ps: number[] = [];
  for (let i = 0; i <= 120; i++) {
    const u = (39.4 * i) / 120;
    const cur = Math.max(13.9 * (1 - Math.exp((u - 39.4) / 2.6)), 0);
    us.push(u);
    is.push(cur);
    ps.push(u * cur);
  }
  iv.setData('iv', us, is);
  iv.setData('pv', us, ps);
  const live = new DomChart({
    height: 170,
    window: 0.06,
    x: { min: 0, max: 0.06, label: 't, s', tickCount: 3 },
    y: { min: -340, max: 340, label: 'u, V', ticks: [-325, 0, 325] },
    series: [
      { id: 'l1', label: 'L1', color: 'yellow' },
      { id: 'l2', label: 'L2', color: 'green' },
      { id: 'l3', label: 'L3', color: 'red' },
    ],
  });
  const day = new DomChart({
    height: 190,
    x: { min: 0, max: 24, label: 'год', ticks: [0, 6, 12, 18, 24] },
    y: { min: -4, max: 6, label: 'P, kW' },
    series: [
      { id: 'pv', label: 'PV', color: 'amber', stack: 'a' },
      { id: 'grid', label: 'Мережа', color: 'white', stack: 'a' },
      { id: 'bat', label: 'Батарея ±', color: 'lime', stack: 'a' },
    ],
    onScrub: (x) => day.setMarker('at', { x, y: 0, guides: false, label: `${x.toFixed(1)} год` }),
  });
  const hours = Array.from({ length: 49 }, (_, i) => i / 2);
  day.setData('pv', hours, hours.map((h) => Math.max(0, 5 * Math.sin(((h - 6) / 12) * Math.PI))));
  day.setData('grid', hours, hours.map((h) => (h < 6 || h > 19 ? 1.2 : 0.1)));
  day.setData('bat', hours, hours.map((h) => (h > 9 && h < 15 ? -2.5 : h > 18 && h < 23 ? 1.6 : 0)));
  const readouts = page(plate(470, 'Прилади', live.el), plate(520, 'Графіки', iv.el, day.el));

  // charts page: phasors + scope, log-axis spectrum, heat map with a marker, radar (extras.ts)
  const phasors = new DomPhasorScope({
    phasors: [
      { id: 'u', label: 'u(t)', color: 'yellow', amplitude: 1, phase: 0 },
      { id: 'i', label: 'i(t), cos φ = 0,8', color: 'cyan', amplitude: 0.7, phase: -0.6435 },
    ],
  });
  const radar = new DomRadarChart(
    {
      size: 190,
      axes: ['Енергія', 'Потужність', 'Безпека', 'Ресурс', 'Ціна'],
      series: [
        { id: 'lfp', label: 'LFP', color: 'lime', values: [0.55, 0.7, 0.95, 0.95, 0.8] },
        { id: 'nmc', label: 'NMC', color: 'pink', values: [0.9, 0.8, 0.6, 0.6, 0.55] },
      ],
    },
    { tweens: ctx.tweens, reducedMotion: () => false },
  );
  const yieldAt = (az: number, tilt: number): number =>
    1150 * (0.62 + 0.38 * Math.cos(((tilt - 35) / 90) * Math.PI * 0.9) * Math.cos((az / 180) * Math.PI * 0.75));
  const heat = new DomHeatMap({
    height: 220,
    x: { min: -90, max: 90, label: 'азимут, °', ticks: [-90, -45, 0, 45, 90] },
    y: { min: 0, max: 90, label: 'нахил, °', ticks: [0, 30, 60, 90] },
    value: yieldAt,
    min: 500,
    max: 1150,
    unit: 'kWh/kW',
    marker: { x: 0, y: 35 },
  });
  const spectrum = new DomChart({
    height: 190,
    x: { min: 0, max: 22, label: 'номер гармоніки', ticks: [1, 5, 9, 13, 17, 21] },
    y: { min: 0.1, max: 100, log: true, label: 'амплітуда, %' },
    series: [{ id: 'h', color: 'violet', kind: 'bars' }],
  });
  const ns = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  spectrum.setData('h', ns, ns.map((n) => 100 / n ** 1.6));
  const charts = page(
    plate(500, 'Фазори й осцилограма', phasors.el, 'Спектр (логарифмічна вісь)', spectrum.el),
    plate(480, 'Теплова мапа з маркером', heat.el, 'Радар', radar.el),
  );
  layer.append(readouts, charts);
  ctx.onDispose(() => [iv, live, day, spectrum, phasors, radar, heat].forEach((c) => c.dispose()));

  let last = -1;
  return {
    show(stepId) {
      readouts.hidden = stepId !== 'readouts';
      charts.hidden = stepId !== 'charts';
    },
    update(t) {
      // the operating point slides along the I-V curve; the live plot is a 50 Hz three-phase system slowed ×50
      const k = Math.floor((0.5 + 0.5 * Math.sin(t * 0.6)) * 120);
      iv.setMarker('op', { x: us[k]!, y: is[k]!, color: 'sky', label: `${Math.round(ps[k]!)} W` });
      if (t - last > 1 / 120) {
        last = t;
        const ts = t / 50;
        for (const [id, shift] of [['l1', 0], ['l2', -2.094], ['l3', 2.094]] as const)
          live.push(id, ts, 325 * Math.sin(2 * Math.PI * 50 * ts + shift));
      }
      phasors.setAngle(t * 1.2);
      for (const c of [iv, live, day, spectrum]) c.render();
      phasors.update();
      radar.update();
      heat.update();
    },
  };
}
