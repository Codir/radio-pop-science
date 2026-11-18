/**
 * What the nuclide chart shows, without drawing it (no three.js, no DOM): the colour kind of a nuclide, the
 * 15 × 11 window of the N × Z table around the current nuclide (N to the right, Z upward), the cells in it with
 * their marks (you are here, the goal, the trail, not discovered yet), the whole table as a 179 × 118 RGBA image
 * and the line a picked cell shows. `nuclide-chart.ts` draws it, in both interfaces.
 */
import { fmtUnit } from '@/content';
import { hex, type ColorLike } from '@/style';
import { MAX_N, MAX_Z, getNuclide, nuclideKey, nuclideName, nuclideSymbol } from '@alchemy/sim/core';
import type { DecayCode, Nuclide, NuclideRef } from '@alchemy/sim/core';
import type { Goal } from '@alchemy/sim/lab';
import { L } from '../labels';
import { codeName, halfLifeText } from './text';

export type CellKind = 'stable' | 'longLived' | 'beta-' | 'beta+' | 'alpha' | 'proton' | 'neutron' | 'fission' | 'unknown';

/**
 * Colour of each kind (plan decision 16): stable white; the three main decays carry the saturated colours — β⁻
 * blue, β⁺ / capture coral (coral = positive charge, as the protons of the atom), α amber; the rare kinds are
 * neutrals, except fission in the nuclear violet of STYLE_GUIDE §2.2.2 (the hue family of the background).
 */
export const KIND_COLOR: Readonly<Record<CellKind, ColorLike>> = {
  stable: 'white',
  longLived: 'mist',
  'beta-': 'blue',
  'beta+': 'coral',
  alpha: 'amber',
  proton: 'steel.light',
  neutron: 'steel',
  fission: 'violet',
  unknown: 'slate',
};

/** The window around the current nuclide: N to the right, Z upward. */
export const WINDOW = { cols: 15, rows: 11 } as const;

/** The whole table as an image: one pixel per (N, Z − 1). */
export const FULL = { width: MAX_N + 1, height: MAX_Z } as const;

/** Brightness of a nuclide that is not discovered yet. */
export const UNDISCOVERED = 0.35;

const KIND_OF_CODE: Readonly<Record<DecayCode, CellKind>> = {
  'b-': 'beta-', 'b-n': 'beta-', 'b-2n': 'beta-', 'b-3n': 'beta-', 'b-4n': 'beta-', 'b-p': 'beta-', 'b-a': 'beta-',
  '2b-': 'beta-',
  'b+': 'beta+', ec: 'beta+', 'ec/b+': 'beta+', 'b+p': 'beta+', 'b+2p': 'beta+', 'b+a': 'beta+', '2b+': 'beta+',
  a: 'alpha', p: 'proton', '2p': 'proton', n: 'neutron', '2n': 'neutron', sf: 'fission',
};

/** By status first (stable, long-lived, too little data), otherwise by the main decay branch. */
export function cellKind(x: Nuclide): CellKind {
  if (x.status === 'stable') return 'stable';
  if (x.status === 'longLived') return 'longLived';
  const main = x.branches[0];
  if (x.status === 'incomplete' || !main) return 'unknown';
  return KIND_OF_CODE[main.code];
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

/** Lower-left corner of the window: the centre in the middle, the window never leaves the table. */
export function windowOrigin(center: NuclideRef): { readonly n0: number; readonly z0: number } {
  return {
    n0: clamp(center.n - (WINDOW.cols >> 1), 0, MAX_N - (WINDOW.cols - 1)),
    z0: clamp(center.z - (WINDOW.rows >> 1), 1, MAX_Z - (WINDOW.rows - 1)),
  };
}

export interface ChartView {
  readonly center: NuclideRef;
  /** `nuclideKey` of every discovered nuclide. */
  readonly discovered: ReadonlySet<string>;
  /** The nuclides of this run, the start first, the current one last. */
  readonly trail: readonly NuclideRef[];
  /** The quest's goal; null in the free lab. */
  readonly goal: Goal | null;
}

export interface Cell extends NuclideRef {
  /** Column (N − n0) and row (Z − z0, row 0 at the bottom) in the window. */
  readonly col: number;
  readonly row: number;
  readonly kind: CellKind;
  readonly discovered: boolean;
  readonly here: boolean;
  readonly goal: boolean;
  readonly onTrail: boolean;
}

/** The goal covers this nuclide: the nuclide itself, or any isotope of the goal element. */
export function isGoal(goal: Goal | null, z: number, n: number): boolean {
  if (!goal) return false;
  if (goal.kind === 'nuclide') return goal.z === z && goal.n === n;
  if (goal.kind === 'element') return goal.z === z;
  return false;
}

/** The nuclides of the window that exist in the table, with their marks. */
export function windowCells(view: ChartView): Cell[] {
  const { n0, z0 } = windowOrigin(view.center);
  const trail = new Set(view.trail.map((r) => nuclideKey(r.z, r.n)));
  const cells: Cell[] = [];
  for (let row = 0; row < WINDOW.rows; row++) {
    for (let col = 0; col < WINDOW.cols; col++) {
      const z = z0 + row;
      const n = n0 + col;
      const x = getNuclide(z, n);
      if (!x) continue;
      const key = nuclideKey(z, n);
      cells.push({
        z, n, col, row,
        kind: cellKind(x),
        discovered: view.discovered.has(key),
        here: z === view.center.z && n === view.center.n,
        goal: isGoal(view.goal, z, n),
        onTrail: trail.has(key),
      });
    }
  }
  return cells;
}

/** The nuclide under a window cell, or null outside the window or where the table has none. */
export function cellAt(view: ChartView, col: number, row: number): NuclideRef | null {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
  if (col < 0 || col >= WINDOW.cols || row < 0 || row >= WINDOW.rows) return null;
  const { n0, z0 } = windowOrigin(view.center);
  const x = getNuclide(z0 + row, n0 + col);
  return x ? { z: x.z, n: x.n } : null;
}

/** sRGB bytes of a kind's colour (tokens resolve once). */
const rgbCache = new Map<CellKind, readonly [number, number, number]>();
function kindRgb(kind: CellKind): readonly [number, number, number] {
  let rgb = rgbCache.get(kind);
  if (!rgb) {
    const h = hex(KIND_COLOR[kind]);
    rgb = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    rgbCache.set(kind, rgb);
  }
  return rgb;
}

/**
 * The whole table, one pixel per nuclide at (N, Z − 1), row 0 = Z 1 (the bottom of the chart): the kind's colour,
 * at `UNDISCOVERED` brightness until it is discovered; transparent where the table has no nuclide.
 */
export function fullChart(view: ChartView): { readonly width: number; readonly height: number; readonly rgba: Uint8Array } {
  const { width, height } = FULL;
  const rgba = new Uint8Array(width * height * 4);
  for (const x of allInTable()) {
    const [r, g, b] = kindRgb(x.kind);
    const k = view.discovered.has(x.key) ? 1 : UNDISCOVERED;
    rgba.set([Math.round(r * k), Math.round(g * k), Math.round(b * k), 255], ((x.z - 1) * width + x.n) * 4);
  }
  return { width, height, rgba };
}

/** Every nuclide with its kind and key, computed once. */
let table: readonly { readonly z: number; readonly n: number; readonly key: string; readonly kind: CellKind }[] | null = null;
function allInTable(): NonNullable<typeof table> {
  if (!table) {
    const rows: { z: number; n: number; key: string; kind: CellKind }[] = [];
    for (let z = 1; z <= MAX_Z; z++) {
      for (let n = 0; n <= MAX_N; n++) {
        const x = getNuclide(z, n);
        if (x) rows.push({ z, n, key: nuclideKey(z, n), kind: cellKind(x) });
      }
    }
    table = rows;
  }
  return table;
}

/** Percent in nature: two decimals from 1 % up, three significant digits below (0,0145 %). */
function abundanceText(percent: number): string {
  const decimals = percent >= 1 || percent <= 0 ? 2 : Math.max(2, 2 - Math.floor(Math.log10(percent)));
  return fmtUnit(percent, '%', { maxDigits: decimals });
}

/**
 * The line of a picked cell. Discovered: «¹⁴C · Карбон (вуглець)-14 · T½ = 5700 р. · β⁻-розпад · відкрито 1936»
 * (+ «· у природі 1,06 %» for a natural one); not yet: «¹⁴C · ще не відкрито».
 */
export function pickedLine(ref: NuclideRef, discovered: boolean): string {
  const symbol = nuclideSymbol(ref.z, ref.n);
  const C = L.chart;
  if (!discovered) return `${symbol} · ${C.notYet}`;
  const parts = [symbol, nuclideName(ref.z, ref.n)];
  const x = getNuclide(ref.z, ref.n);
  if (x) {
    const main = x.branches[0];
    if (x.status === 'stable') parts.push(C.stable);
    else if (x.status === 'longLived' && !main) parts.push(L.status.notObserved);
    else parts.push(typeof x.halfLife === 'number' ? `${L.status.halfLife} = ${halfLifeText(x.halfLife)}` : L.status.halfLifeUnknown);
    if (main) parts.push(codeName(main.code));
    if (x.discovered !== null) parts.push(`${C.foundIn} ${x.discovered}`);
    if (x.abundance !== null) parts.push(`${C.inNature} ${abundanceText(x.abundance)}`);
  }
  return parts.join(' · ');
}
