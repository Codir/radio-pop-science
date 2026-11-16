/**
 * Step «widgets» under `?hud=dom` (D4 harness, development only): the step-UI factories the dock / board use —
 * `chartWidget` for a `chart` control and `customWidget` for `custom` controls (a `dom` widget, kit twins of a
 * `HeatMap` and a `RadarChart`, and a node-only control that falls back with one warning) — on a `hudLayer`.
 * The live chart is the cost case of the brief: 4 series × 2 000 points at 120 Hz; its script time per frame is
 * published as `window.__d4cost` ({ avg, max } ms over the last 120 frames).
 */
import type { ChapterContext } from '@/engine/api';
import { domKit, type ChartSpec, type CustomSpec, type DomHost } from '@/hud';
import { chartWidget } from '@/hud-dom/charts';
import { customWidget } from '@/hud-dom/custom';
import { HeatMap, Label, RadarChart } from '@/ui3d';

export interface DomWidgetsDemo {
  show(stepId: string): void;
  update(t: number): void;
}

const HZ = 120;
const POINTS = 2000;
const SERIES = ['l1', 'l2', 'l3', 'n'] as const;

export function domWidgetsDemo(ctx: ChapterContext, layer: HTMLElement): DomWidgetsDemo {
  const { h } = domKit;
  const host: DomHost = { tweens: ctx.tweens, reducedMotion: () => false };
  const wave = (id: (typeof SERIES)[number], t: number): number =>
    id === 'n' ? 40 * Math.sin(2 * Math.PI * 3 * t) : 325 * Math.sin(2 * Math.PI * 0.5 * t + SERIES.indexOf(id) * 2.094);
  let next = 0;
  const live: ChartSpec = {
    type: 'chart',
    id: 'live',
    chart: {
      height: 190,
      window: POINTS / HZ,
      x: { min: -POINTS / HZ, max: 0, label: 't, s' },
      y: { min: -340, max: 340, label: 'u, V', ticks: [-325, 0, 325] },
      series: SERIES.map((id, i) => ({ id, label: id.toUpperCase(), color: (['yellow', 'green', 'red', 'sky'] as const)[i]! })),
    },
    init(c) {
      for (let k = POINTS; k > 0; k--) for (const id of SERIES) c.push(id, -k / HZ, wave(id, -k / HZ));
    },
    update(c, t) {
      for (; next <= t; next += 1 / HZ) for (const id of SERIES) c.push(id, next, wave(id, next));
    },
  };
  const yieldAt = (az: number, tilt: number): number =>
    1150 * (0.62 + 0.38 * Math.cos(((tilt - 35) / 90) * Math.PI * 0.9) * Math.cos((az / 180) * Math.PI * 0.75));
  const heat = new HeatMap({
    height: 200,
    x: { min: -180, max: 180, label: 'азимут, °' },
    y: { min: 0, max: 90, label: 'нахил, °' },
    value: yieldAt,
    min: 300,
    max: 1150,
    unit: 'kWh/kW',
    marker: { x: 0, y: 35 },
  });
  const radar = new RadarChart({
    size: 170,
    axes: ['Енергія', 'Потужність', 'Безпека', 'Ресурс', 'Ціна'],
    series: [{ id: 'lfp', label: 'LFP', color: 'lime', values: [0.55, 0.7, 0.95, 0.95, 0.8] }],
  });
  let count = 7;
  const counter = h('output.value', null, String(count));
  const customs: CustomSpec[] = [
    {
      type: 'custom',
      id: 'count',
      node: new Label('лічильник (WebGL)'),
      dom: () => {
        const b = (d: number, s: string): HTMLButtonElement => {
          const el = h('button.btn', { type: 'button', 'data-ui': `ctl-count:${d > 0 ? 'plus' : 'minus'}` }, s);
          el.addEventListener('click', () => (counter.textContent = String((count += d))));
          return el;
        };
        return { el: h('div.kd-stepper', null, h('span.label', null, 'custom.dom'), b(-1, '−'), counter, b(1, '+')) };
      },
    },
    { type: 'custom', id: 'heat', node: heat },
    { type: 'custom', id: 'radar', node: radar },
    { type: 'custom', id: 'legacy', node: new Label('лише WebGL') },
  ];
  const chart = chartWidget(live);
  (window as unknown as { __d4chart: unknown }).__d4chart = chart.chart;
  const widgets = customs.map((c) => customWidget(c, host));
  const plate = (w: number, title: string, ...els: (HTMLElement | null | undefined)[]): HTMLElement => {
    const el = h('div.kd.sbx-plate', null, h('h3.sbx-title', null, title), ...els.filter((e): e is HTMLElement => !!e));
    el.style.setProperty('--w', String(w));
    return el;
  };
  const page = h(
    'div.sbx-page',
    null,
    plate(520, 'Графік кроку · 4 × 2000 точок', chart.el, widgets[0]?.el),
    plate(460, 'Двійники HeatMap і RadarChart', widgets[1]?.el, widgets[2]?.el),
  );
  page.hidden = true;
  layer.append(page);
  ctx.onDispose(() => [chart, ...widgets].forEach((w) => w?.dispose?.()));

  const costs: number[] = [];
  let flip = 0;
  return {
    show(stepId) {
      page.hidden = stepId !== 'widgets';
    },
    update(t) {
      if (page.hidden) return;
      // wall-clock script cost of one chart frame — what the brief's budget measures, not animation time
      // eslint-disable-next-line no-restricted-properties
      const t0 = performance.now();
      chart.update?.(t);
      // eslint-disable-next-line no-restricted-properties
      const dt = performance.now() - t0;
      costs.push(dt);
      if (costs.length > 120) costs.shift();
      (window as unknown as { __d4cost: unknown }).__d4cost = {
        avg: costs.reduce((a, b) => a + b, 0) / costs.length,
        max: Math.max(...costs),
        points: POINTS,
      };
      heat.setMarker(120 * Math.sin(t * 0.4), 35 + 20 * Math.sin(t * 0.3)); // forwarded to the twin
      if (Math.floor(t / 2) !== flip) {
        flip = Math.floor(t / 2);
        radar.setValues('lfp', flip % 2 ? [0.9, 0.4, 0.6, 0.5, 0.95] : [0.55, 0.7, 0.95, 0.95, 0.8], { duration: 0.6 });
      }
      for (const w of widgets) w?.update?.(t);
    },
  };
}
