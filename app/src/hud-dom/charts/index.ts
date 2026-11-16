/**
 * Area `charts` of the DOM interface (docs/HUD_DOM.md §8, §16): the DOM twins of the `@/ui3d` charts —
 * `DomChart` (`ChartApi`), `DomPhasorScope`, `DomRadarChart`, `DomHeatMap` — Canvas2D marks, DOM text. The
 * area mounts no region of its own: the dock and the board (D3) build a `chart` control with `chartWidget`,
 * `custom` controls with kit nodes get their twins through `@/hud-dom/custom`.
 */
import type { ChartSpec, DomWidget } from '@/hud/step-ui-types';
import type { DomHud } from '../core/context';
import { DomChart } from './chart';
import './charts.css';

export { DomChart, createChart } from './chart';
export { DomHeatMap } from './heatmap';
export { DomPhasorScope } from './phasor';
export { DomRadarChart } from './radar';
export { legendEl } from './legend';

export function mount(_dom: DomHud): void {}

/** A `chart` control of the step UI as a DOM widget: built, `init` called once, `update` + redraw per frame. */
export function chartWidget(spec: ChartSpec): DomWidget & { readonly chart: DomChart } {
  const chart = new DomChart(spec.chart);
  spec.init?.(chart);
  return {
    chart,
    el: chart.el,
    update(t) {
      spec.update?.(chart, t);
      chart.render();
    },
    dispose: () => chart.dispose(),
  };
}
