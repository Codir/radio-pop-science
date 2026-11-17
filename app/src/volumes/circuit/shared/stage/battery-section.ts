/**
 * The lengthwise section of the stand battery (VISUAL.md §5.2): what the cut shows, drawn as a shallow relief
 * lying in the cut plane — each layer a flat face at its own small height, so the steps between the layers
 * catch the light like a real cut, and the soft zinc gel sits a little lower with its grains bulging out of it.
 *
 * Section frame (the group's local space): X = the battery's axis (+ toward «+»), Y = across the cut (in the
 * plane), Z = out of the cut toward the viewer. `battery-inside.ts` turns it into the battery's frame.
 * Layers from outside toward the axis, as in a real alkaline AA: printed jacket · steel can (the plus, pressed
 * into the nub) · manganese oxide (three stacked rings) · separator soaked in paste · zinc powder in gel ·
 * brass pin from the minus cap · white seal under the minus cap.
 */
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { BATTERY } from './layout';

export type BatteryLayer = 'can' | 'cathode' | 'separator' | 'zinc' | 'pin' | 'seal' | 'minusCap';

/** The layers in plain Ukrainian (labels on hover; DECISIONS §54). */
export const BATTERY_LAYERS: Readonly<Record<BatteryLayer, string>> = {
  can: 'сталевий корпус',
  cathode: 'оксид мангану',
  separator: 'перегородка з пастою',
  zinc: 'цинк у гелі',
  pin: 'латунний стрижень',
  seal: 'ущільнювач',
  minusCap: 'кришка мінуса',
};

/** What a cell of the relief is made of (decides its colour and how `life` changes it). */
export type Stuff =
  'film' | 'band' | 'steel' | 'cathode' | 'seam' | 'separator' | 'paste' | 'pin' | 'seal' | 'cap' | 'air';

const R = BATTERY.radius;
/** Radii and lengths of the section (battery units; 1 ≈ 26 mm — the walls are drawn thicker than real). */
export const SEC = {
  film: R - 0.007,
  canIn: R - 0.026,
  cathodeIn: 0.176,
  sepIn: 0.16,
  pin: 0.021,
  pinTip: 0.4,
  /** Axial extent of the active part (x): seal side → plus end. */
  coreFrom: -0.835,
  coreTo: 0.905,
  canEnd: 0.93,
  nub: 0.105,
  nubTop: BATTERY.length / 2 + 0.095,
  capX: -BATTERY.length / 2 - 0.02,
  capR: R * 0.8,
  /** The three pressed rings of manganese oxide (x ranges). */
  pellets: [
    [-0.835, -0.252],
    [-0.244, 0.338],
    [0.346, 0.93],
  ] as const,
} as const;

/** Height of each stuff's face above the cut plane (negative = lower): the relief. */
const TOP: Record<Stuff, number> = {
  film: 0.004,
  band: 0.004,
  steel: 0.01,
  cathode: 0,
  seam: -0.008,
  separator: 0.006,
  paste: -0.022,
  pin: 0.008,
  seal: 0.006,
  cap: 0.01,
  air: -0.04,
};
const LAYER_OF: Record<Stuff, BatteryLayer> = {
  film: 'can',
  band: 'can',
  steel: 'can',
  cathode: 'cathode',
  seam: 'cathode',
  separator: 'separator',
  paste: 'zinc',
  pin: 'pin',
  seal: 'seal',
  cap: 'minusCap',
  air: 'zinc',
};
/** Metal stuff goes to the `K.metal` mesh, the rest to the toon one. */
export const METAL: ReadonlySet<Stuff> = new Set<Stuff>(['steel', 'pin', 'cap']);
const BOTTOM = -0.05;

export interface Cell {
  stuff: Stuff;
  layer: BatteryLayer;
  /** Where the cell lies across its layer, 0 … 1 (zinc: 0 axis … 1 separator; oxide: 0 separator … 1 can). */
  s: number;
  first: number;
  count: number;
}

/** A growing relief: boxes from z = BOTTOM up to the stuff's TOP, without bottoms. */
export class Relief {
  readonly cells: Cell[] = [];
  private pos: number[] = [];
  private nor: number[] = [];

  /** x0…x1 along the axis, y0…y1 across, `s` as in `Cell`. */
  box(stuff: Stuff, x0: number, x1: number, y0: number, y1: number, s = 0): void {
    const z1 = TOP[stuff];
    const z0 = BOTTOM;
    const first = this.pos.length / 3;
    const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => {
      for (const p of [a, b, c, a, c, d]) this.pos.push(p[0]!, p[1]!, p[2]!);
      for (let i = 0; i < 6; i++) this.nor.push(n[0]!, n[1]!, n[2]!);
    };
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [0, 1, 0]);
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0]);
    quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
    this.cells.push({ stuff, layer: LAYER_OF[stuff], s, first, count: this.pos.length / 3 - first });
  }

  /** The same box on both sides of the axis (y0…y1 and −y1…−y0). */
  pair(stuff: Stuff, x0: number, x1: number, y0: number, y1: number, s = 0): void {
    this.box(stuff, x0, x1, y0, y1, s);
    this.box(stuff, x0, x1, -y1, -y0, s);
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.pos.length), 3));
    return g;
  }
}

/** Paint every vertex of `cells` in `geometry` with `colorOf(cell)`. */
export function paint(
  geometry: BufferGeometry,
  cells: readonly Cell[],
  colorOf: (c: Cell, out: Color) => Color,
): void {
  const attr = geometry.getAttribute('color') as BufferAttribute;
  const a = attr.array as Float32Array;
  const c = new Color();
  for (const cell of cells) {
    colorOf(cell, c);
    for (let i = cell.first; i < cell.first + cell.count; i++) {
      a[i * 3] = c.r;
      a[i * 3 + 1] = c.g;
      a[i * 3 + 2] = c.b;
    }
  }
  attr.needsUpdate = true;
}
