/**
 * Table of the dock / board (WebGL twin `ui3d/widgets/table.ts`): a real `<table>`; the first column bold white,
 * the others mist and right-aligned unless `align` says otherwise; caption size from five columns on. A `rows()`
 * function is diffed every frame (one string key) and the body is rewritten only on change — in place when the
 * shape is the same. `highlight()` marks one row (`aria-current`).
 */
import type { TableSpec } from '@/hud/step-ui-types';
import { h, setClass } from '../../core/dom';
import { setRich } from '../../core/rich';
import type { DomControl } from './types';

type Rows = readonly (readonly string[])[];

const keyOf = (rows: Rows): string => rows.map((r) => r.join('\u0001')).join('\u0002');

/** `relayout`: the table changed shape (the column's budget follows in the same engine frame). */
export function domTable(c: TableSpec, relayout: () => void): DomControl {
  const body = h('tbody');
  const head = c.head ? h('thead', null, h('tr', null, ...c.head.map((t, j) => cell('th', t, j)))) : null;
  const table = h('table.dk-table', null, head, body);
  const el = h('div.dk-ctl.dk-table-wrap', { 'data-ui': `ctl-${c.id}`, 'data-tip': c.hint }, table);
  let cells: HTMLTableCellElement[][] = [];
  let last = '';
  let lit = -1;

  function cell(tag: 'th' | 'td', text: string, j: number): HTMLTableCellElement {
    const td = h(tag, { scope: tag === 'th' ? 'col' : null });
    setRich(td, text);
    const align = c.align?.[j] ?? (j === 0 ? 'left' : 'right');
    if (align !== 'left') td.style.textAlign = align;
    return td;
  }
  const setRows = (rows: Rows): void => {
    const key = keyOf(rows);
    if (key === last) return;
    last = key;
    const same = rows.length === cells.length && rows.every((r, i) => r.length === cells[i]!.length);
    if (same) {
      rows.forEach((r, i) => r.forEach((t, j) => setRich(cells[i]![j]!, t)));
      return;
    }
    const cols = Math.max(c.head?.length ?? 0, ...rows.map((r) => r.length));
    setClass(table, 'dense', cols >= 5);
    cells = rows.map((r) => Array.from({ length: Math.max(r.length, 1) }, (_, j) => cell('td', r[j] ?? '', j)));
    body.replaceChildren(...cells.map((row) => h('tr', null, ...row)));
    lit = -1;
    relayout();
  };
  const highlight = (i: number): void => {
    if (i === lit) return;
    body.children[lit]?.removeAttribute('aria-current');
    lit = i;
    body.children[i]?.setAttribute('aria-current', 'true');
  };
  const rows = c.rows;
  const tick = (): void => {
    if (typeof rows === 'function') setRows(rows());
    if (c.highlight) highlight(c.highlight());
  };
  setRows(typeof rows === 'function' ? rows() : rows);
  tick();
  return { el, tick: typeof rows === 'function' || c.highlight ? tick : undefined };
}
