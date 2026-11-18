import { describe, expect, it } from 'vitest';
import { NBSP } from '@/content';
import { hex } from '@/style';
import { allNuclides, getNuclide, hasNuclide, nuclideKey } from '@alchemy/sim/core';
import {
  KIND_COLOR, WINDOW, cellAt, cellKind, fullChart, pickedLine, windowCells, windowOrigin, type CellKind, type ChartView,
} from '../parts/chart-model';

const view = (z: number, n: number, extra: Partial<ChartView> = {}): ChartView =>
  ({ center: { z, n }, discovered: new Set([nuclideKey(z, n)]), trail: [{ z, n }], goal: null, ...extra });
const ALLOWED = /^[\p{Script=Cyrillic}A-Za-z0-9 \u00a0=.,:;!?()«»„“"'’\-—−·×→←↔≈½°%+/⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀-₉αβγνλμ]*$/u;

describe('nuclide chart model', () => {
  it('keeps the window on the table', () => {                                        // Review Focus 4
    expect(windowOrigin({ z: 1, n: 0 })).toEqual({ n0: 0, z0: 1 });
    expect(windowOrigin({ z: 118, n: 176 })).toEqual({ n0: 164, z0: 108 });
    expect(windowOrigin({ z: 79, n: 118 })).toEqual({ n0: 111, z0: 74 });
    for (const [z, n] of [[1, 0], [118, 176], [20, 28], [92, 146]] as const) {
      const cells = windowCells(view(z, n));
      expect(cells.every((c) => c.col >= 0 && c.col < 15 && c.row >= 0 && c.row < 11)).toBe(true);
      expect(cells.filter((c) => c.here)).toHaveLength(1);
      expect(cells.every((c) => hasNuclide(c.z, c.n))).toBe(true);
    }
  });

  it('colours by status, then by the main decay', () => {
    const kind = (z: number, n: number) => cellKind(getNuclide(z, n)!);
    expect([kind(79, 118), kind(82, 122), kind(6, 8), kind(80, 117), kind(92, 146), kind(3, 1), kind(2, 3), kind(112, 170)])
      .toEqual(['stable', 'longLived', 'beta-', 'beta+', 'alpha', 'proton', 'neutron', 'fission']);
    expect(new Set(allNuclides().map(cellKind)).size).toBe(9);
  });

  it('marks the goal, the trail and what is still unknown', () => {
    const gold = windowCells(view(80, 116, { goal: { kind: 'nuclide', z: 79, n: 118 } }));
    expect(gold.filter((c) => c.goal).map((c) => [c.z, c.n])).toEqual([[79, 118]]);
    const tc = windowCells(view(42, 56, { goal: { kind: 'element', z: 43 } }));
    expect(tc.filter((c) => c.goal).length).toBeGreaterThan(5);
    expect(tc.filter((c) => c.goal).every((c) => c.z === 43)).toBe(true);
    expect(gold.filter((c) => c.discovered)).toHaveLength(1);
    expect(cellAt(view(1, 0), 0, 0)).toEqual({ z: 1, n: 0 });
    expect(cellAt(view(1, 0), 14, 0)).toBeNull();                 // водню з 14 нейтронами немає
    expect(cellAt(view(1, 0), -1, 3)).toBeNull();
    expect(cellAt(view(1, 0), 2, 99)).toBeNull();
  });

  it('describes a picked cell', () => {
    expect(pickedLine({ z: 6, n: 8 }, true).replaceAll(NBSP, ' ')).toContain('¹⁴C · Карбон (вуглець)-14 · T½ = 5700 р.');
    expect(pickedLine({ z: 6, n: 8 }, false)).toContain('ще не відкрито');
    expect(pickedLine({ z: 6, n: 8 }, false)).not.toContain('5700');
  });

  it('draws the whole table into 179 × 118 pixels', () => {
    const full = fullChart(view(1, 0));
    expect([full.width, full.height, full.rgba.length]).toEqual([179, 118, 179 * 118 * 4]);
    const alpha = (z: number, n: number) => full.rgba[((z - 1) * 179 + n) * 4 + 3];
    expect(alpha(1, 0)).toBe(255);
    expect(alpha(1, 100)).toBe(0);
  });

  // ---- beyond the pinned cases ----

  it('puts N to the right and Z upward, the centre in the middle of the window', () => {
    const v = view(79, 118);
    const here = windowCells(v).find((c) => c.here)!;
    expect([here.col, here.row]).toEqual([7, 5]);
    expect(cellAt(v, 8, 6)).toEqual({ z: 80, n: 119 });
    expect(WINDOW).toEqual({ cols: 15, rows: 11 });
    for (const c of windowCells(v)) expect(cellAt(v, c.col, c.row)).toEqual({ z: c.z, n: c.n });
  });

  it('marks the cells the trail passed and nothing as a goal for a fission fragment', () => {
    const trail = [{ z: 1, n: 0 }, { z: 1, n: 1 }, { z: 1, n: 2 }, { z: 2, n: 1 }];
    const cells = windowCells(view(2, 1, { trail, goal: { kind: 'stableFragment' } }));
    expect(cells.filter((c) => c.onTrail).map((c) => nuclideKey(c.z, c.n)).sort()).toEqual(['1-0', '1-1', '1-2', '2-1']);
    expect(cells.some((c) => c.goal)).toBe(false);
    expect(cells.find((c) => c.here)).toMatchObject({ z: 2, n: 1 });
  });

  it('dims what is not discovered to 0.35 of the colour', () => {
    const full = fullChart(view(1, 0, { discovered: new Set(['1-0']) }));
    const px = (z: number, n: number) => [...full.rgba.slice(((z - 1) * 179 + n) * 4, ((z - 1) * 179 + n) * 4 + 4)];
    const rgb = (token: CellKind) => {
      const h = hex(KIND_COLOR[token]);
      return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    };
    expect(px(1, 0)).toEqual([...rgb('stable'), 255]);
    expect(px(1, 1).slice(0, 3)).toEqual(rgb('stable').map((c) => Math.round(c * 0.35)));
    expect(px(1, 1)[3]).toBe(255);
    expect(px(6, 8).slice(0, 3)).toEqual(rgb('beta-').map((c) => Math.round(c * 0.35)));
  });

  it('reads every nuclide of the table as a line of allowed glyphs', () => {
    for (const x of allNuclides()) {
      for (const discovered of [true, false]) {
        const line = pickedLine(x, discovered);
        expect(line, `${x.z}-${x.n}`).toMatch(ALLOWED);
        expect(line, `${x.z}-${x.n}`).not.toMatch(/undefined|null|NaN|Infinity/);
      }
    }
    expect(pickedLine({ z: 1, n: 1 }, true).replaceAll(NBSP, ' ')).toBe('²H · Гідроген (водень)-2 · стабільне ядро · відкрито 1932 · у природі 0,0145 %');
    expect(pickedLine({ z: 82, n: 122 }, true)).toContain('розпаду не спостерігали');
    expect(pickedLine({ z: 6, n: 8 }, false)).toBe('¹⁴C · ще не відкрито');
  });
});
