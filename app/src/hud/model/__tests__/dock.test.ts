import { describe, expect, it } from 'vitest';
import type { ControlSpec } from '../../step-ui-types';
import { COLUMN_GAP, TEXT_MIN, columnBudget, type ColumnSizes } from '../column';
import { arrangeControls, slotOf } from '../controls';

const specs: ControlSpec[] = [
  { type: 'readout', id: 'r1', label: 'R1', get: () => 1 },
  { type: 'button', id: 'b1', label: 'B1', onClick: () => undefined },
  { type: 'toggle', id: 't1', label: 'T1' },
  { type: 'slider', id: 's1', label: 'S1', min: 0, max: 1, value: 0 },
  { type: 'table', id: 'tb', rows: [] },
  { type: 'gauge', id: 'g1', label: 'G', min: 0, max: 1, get: () => 0 },
  { type: 'gauge', id: 'g2', kind: 'linear', label: 'G', min: 0, max: 1, get: () => 0 },
  { type: 'slider', id: 's2', label: 'S2', min: 0, max: 1, value: 0 },
  { type: 'toggle', id: 't2', label: 'T2' },
];
const placed = specs.map((c) => ({ slot: slotOf(c), item: c.id }));
const ids = (g: { kind: string; item?: string; items?: string[] }): string =>
  g.kind === 'one' ? g.item! : `${g.kind}(${g.items!.join(',')})`;

describe('arrangeControls', () => {
  it('dock: sliders, toggles row, blocks, readouts row; buttons to the action row', () => {
    const l = arrangeControls(placed, 'dock');
    expect(l.body.map(ids)).toEqual(['s1', 's2', 'toggles(t1,t2)', 'tb', 'g2', 'readouts(r1,g1)']);
    expect(l.actions).toEqual(['b1']);
  });
  it('board: declared order, consecutive readouts / toggles share a row, buttons last', () => {
    const l = arrangeControls(placed, 'board');
    // a button between two readouts ends their row (as the WebGL board always did)
    expect(l.body.map(ids)).toEqual([
      'readouts(r1)',
      'readouts(t1)',
      's1',
      'tb',
      'readouts(g1)',
      'g2',
      's2',
      'readouts(t2)',
    ]);
    expect(l.actions).toEqual(['b1']);
  });
  it('one slider alone stays one entry', () => {
    expect(arrangeControls([placed[3]!], 'dock')).toEqual({
      body: [{ kind: 'one', item: 's1' }],
      actions: [],
    });
  });
});

const base: ColumnSizes = {
  available: 900,
  withText: true,
  withDock: true,
  chrome: 200,
  textWant: 300,
  dockChrome: 80,
  bodyWant: 200,
};
const compact = (): number => 170;

describe('columnBudget', () => {
  it('everything fits: nothing yields', () => {
    expect(columnBudget(base, compact)).toEqual({
      compact: false,
      text: 300,
      body: 900 - 200 - COLUMN_GAP - 80 - 300,
    });
  });
  it('UI_API order: the text yields down to TEXT_MIN before the title compacts', () => {
    const s = { ...base, textWant: 600 };
    const space = 900 - 200 - COLUMN_GAP - 80;
    expect(columnBudget(s, compact)).toEqual({ compact: false, text: space - 200, body: 200 });
  });
  it('then the title compacts, then the dock scrolls', () => {
    const s = { ...base, textWant: 600, bodyWant: 560 };
    const space = 900 - 170 - COLUMN_GAP - 80;
    expect(columnBudget(s, compact)).toEqual({ compact: true, text: TEXT_MIN, body: space - TEXT_MIN });
  });
  it('WebGL order: the title compacts as soon as anything yields', () => {
    const s = { ...base, textWant: 600 };
    const space = 900 - 170 - COLUMN_GAP - 80;
    expect(columnBudget(s, compact, { compactFirst: true })).toEqual({
      compact: true,
      text: space - 200,
      body: 200,
    });
  });
  it('no dock: the text takes the rest; no text: the dock takes it all', () => {
    expect(columnBudget({ ...base, withDock: false }, compact)).toEqual({
      compact: false,
      text: 700,
      body: null,
    });
    expect(columnBudget({ ...base, withText: false }, compact)).toEqual({
      compact: false,
      text: null,
      body: 820,
    });
  });
  it('the scrolling parts never get less than a sliver', () => {
    const s = { ...base, available: 300, textWant: 600, bodyWant: 560 };
    expect(columnBudget(s, compact).body).toBe(60);
  });
});
