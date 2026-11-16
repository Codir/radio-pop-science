/**
 * Accessibility of the DOM charts (docs/HUD_DOM.md §14): the `<figure>`'s `aria-label` summary and, for static
 * series, a visually hidden data table (`.kd-sr`) a screen reader can walk — at most `MAX_ROWS` rows per series
 * (evenly thinned), numbers in Ukrainian format.
 */
import { fmtNumber } from '@/content/format';
import type { Axis } from '@/ui3d/charts/axis';
import type { ChartProps } from '@/ui3d/charts/chart';
import { h } from '../core/dom';
import type { ChartModel } from './paint';

const MAX_ROWS = 24;

/** «Графік: I, A від U, V — I(U), P(U)». */
export function summary(cfg: ChartProps): string {
  const ys = [cfg.y.label, cfg.y2?.label].filter(Boolean).join(' і ');
  const what = ys && cfg.x.label ? `${ys} від ${cfg.x.label}` : ys || cfg.x.label || '';
  const names = cfg.series.map((s) => s.label).filter(Boolean).join(', ');
  return ['Графік', what && `: ${what}`, names && ` — ${names}`].join('');
}

/** A value on an axis as text: the axis' own tick format, except on log axes (their labels round to decades). */
export function valueText(axis: Axis, v: number): string {
  return axis.spec.log ? fmtNumber(v, { maxDigits: 2 }) : axis.label(v);
}

/** Rebuild the hidden table from the model's current data. */
export function dataTable(table: HTMLElement, m: ChartModel): void {
  const rows: HTMLElement[] = [];
  const xTitle = m.axes.x.spec.label ?? 'x';
  for (const s of m.data.values()) {
    const n = Math.min(s.xs.length, s.ys.length);
    if (n === 0) continue;
    const axis = s.spec.axis === 'y2' && m.axes.y2 ? m.axes.y2 : m.axes.y;
    const yTitle = s.spec.label ?? axis.spec.label ?? s.spec.id;
    rows.push(h('tr', null, h('th', { scope: 'col' }, xTitle), h('th', { scope: 'col' }, yTitle)));
    const step = Math.max(1, Math.ceil(n / MAX_ROWS));
    for (let i = 0; i < n; i += step) {
      const y = s.ys[i]!;
      rows.push(
        h(
          'tr',
          null,
          h('td', null, valueText(m.axes.x, s.xs[i]!)),
          h('td', null, Number.isFinite(y) ? fmtNumber(y, { maxDigits: 2 }) : '—'),
        ),
      );
    }
  }
  table.replaceChildren(...rows);
}
