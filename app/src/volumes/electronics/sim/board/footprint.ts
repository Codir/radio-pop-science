/**
 * How each kind of part stands in the board's sockets (docs/volumes/electronics/VISUAL.md §4, «Відбитки», and §4.7 for
 * the transistors): where its legs go from leg 0, which pin of the catalog every leg carries, how far one leg may be
 * moved on its own, and the letters of its id on the board. A kind the table does not know has no footprint (`null`):
 * the catalog may grow, and this file never lists the kinds exhaustively. Every key of the catalog has its place on the
 * bench — a footprint here, a fixed part (`netlist.ts`) or a reason it is not shown: `shared/__tests__/catalog.test.ts`.
 */
import { PARTS, type PartKind, type PartSpec } from '../core';
import type { BoardLayout, SocketSpec } from './layout';

/** `axial` — a body between two legs far apart (resistor, diode); `radial` — legs side by side under a body (LED,
 * capacitor); `to92` — a transistor's three legs in a row; `pot` — a variable resistor's three; `wire` — a jumper's
 * two ends; `lead` — a thing that stands off the board and reaches it by plug leads (speaker, lamp, player). */
export type Shape = 'axial' | 'radial' | 'to92' | 'pot' | 'wire' | 'lead';

/** Quarter turns in the grid: 0 the legs along +x (from column to column), 1 along +z (toward the reader), 2 the part
 * turned end for end, 3 along −z. */
export type Orientation = 0 | 1 | 2 | 3;

/** Grid steps: `dx` columns, `dz` lines. */
export type Offset = readonly [dx: number, dz: number];

export interface Footprint {
  readonly shape: Shape;
  /** Every leg's place in grid steps from leg 0 at the orientation 0. Empty for a `lead` thing: each of its plugs
   * goes into a socket on its own. */
  readonly offsets: readonly Offset[];
  /** The pin of the catalog (an index into `PARTS[key].pins`) that every leg or plug carries, by leg. */
  readonly pins: readonly number[];
  /** How far a leg moved on its own may stand from every other leg of the part, in pitches as the sockets lie on the
   * board (both ends included); null — the legs move only all together. */
  readonly span: readonly [min: number, max: number] | null;
  /** The letters of a placed part's id: `R` gives R1, R2 …; empty for a thing that is never placed. */
  readonly prefix: string;
}

type Rule = (key: string, spec: PartSpec) => Footprint | null;

const inLine = (...dx: number[]): Offset[] => dx.map((d) => [d, 0] as const);
const twoLegs = (shape: Shape, apart: number, span: Footprint['span'], prefix: string): Footprint => ({
  shape,
  offsets: inLine(0, apart),
  pins: [0, 1],
  span,
  prefix,
});

const RESISTOR = twoLegs('axial', 4, [4, 6], 'R');
const DIODE = twoLegs('axial', 4, [4, 6], 'D'); // leg 1 is the cathode, at the band
const LED = twoLegs('radial', 1, [1, 3], 'LED'); // leg 0 is the anode
const DISC = twoLegs('radial', 2, [1, 3], 'C'); // ceramic and film
const ELECTROLYTIC = twoLegs('radial', 1, [1, 3], 'C'); // leg 0 is plus
const JUMPER = twoLegs('wire', 4, [1, 16], 'J');
const POT: Footprint = { shape: 'pot', offsets: inLine(0, 2, 4), pins: [0, 1, 2], span: null, prefix: 'P' };
const LEAD: Footprint = { shape: 'lead', offsets: [], pins: [0, 1], span: null, prefix: '' };

/**
 * The pin in every leg of a transistor in TO-92, seen from its flat side with the legs down, leg 0 the leftmost
 * (VISUAL.md §4.7), by catalog key. From the makers' package drawings, where pin 1 is the leftmost seen so:
 * - BC547B, BC557B: Philips «BC546; BC547» (2004) and «BC556; BC557» (1999), SOT54 (TO-92): 1 collector, 2 base,
 *   3 emitter. BC337-25: Philips «BC337; BC337A; BC338» (1999), SOT54, the same. BC327-25: onsemi «BC327» (2024),
 *   TO-92: 1 collector, 2 base, 3 emitter.
 * - 2N3904, 2N3906: Fairchild «2N3904 / MMBT3904 / PZT3904» and «2N3906 / MMBT3906 / PZT3906» (2001), TO-92: 1 emitter,
 *   2 base, 3 collector.
 * The catalog lists every transistor's pins as collector, base, emitter; the footprint takes them by name, so the
 * order of the catalog does not matter. The part's model (`shared/parts/transistor.ts`) reads the same table.
 */
export const TO92_LEGS: Readonly<Record<string, readonly string[]>> = {
  'transistor-bc547b': ['collector', 'base', 'emitter'],
  'transistor-bc557b': ['collector', 'base', 'emitter'],
  'transistor-bc337-25': ['collector', 'base', 'emitter'],
  'transistor-bc327-25': ['collector', 'base', 'emitter'],
  'transistor-2n3904': ['emitter', 'base', 'collector'],
  'transistor-2n3906': ['emitter', 'base', 'collector'],
};

function to92(key: string, spec: PartSpec): Footprint | null {
  const legs = Object.hasOwn(TO92_LEGS, key) ? TO92_LEGS[key]! : undefined;
  if (legs === undefined) return null;
  const pins = legs.map((name) => (spec.pins as readonly string[]).indexOf(name));
  if (pins.includes(-1)) return null;
  return { shape: 'to92', offsets: inLine(0, 1, 2), pins, span: null, prefix: 'Q' };
}

/** A capacitor's dielectric: an electrolytic one stands on legs 1 P apart, the others 2 P (VISUAL.md §4.7). */
function capacitor(_: string, spec: PartSpec): Footprint | null {
  if (spec.kind !== 'capacitor') return null;
  return spec.dielectric === 'electrolytic' ? ELECTROLYTIC : DISC;
}

/** A battery and its switch have none: they are fixed to the rails (`netlist.ts`); nor have the ideal sources of the
 * model's references, which the bench never offers. */
const RULES: Partial<Record<PartKind, Rule>> = {
  resistor: () => RESISTOR,
  diode: () => DIODE,
  led: () => LED,
  capacitor,
  pot: () => POT,
  transistor: to92,
  jumper: () => JUMPER,
  speaker: () => LEAD,
  lamp: () => LEAD,
  player: () => LEAD,
};

/** How the part `key` of the catalog stands in the sockets; null when it does not, or the catalog has no such key. */
export function footprintOf(key: string): Footprint | null {
  const spec = Object.hasOwn(PARTS, key) ? PARTS[key] : undefined;
  if (spec === undefined) return null;
  const fp = RULES[spec.kind]?.(key, spec) ?? null;
  return fp !== null && fp.pins.length === spec.pins.length ? fp : null;
}

/** [a, b, c, d]: the turned offset is (a·dx + b·dz, c·dx + d·dz). */
const TURNS: Readonly<Record<Orientation, readonly [number, number, number, number]>> = {
  0: [1, 0, 0, 1],
  1: [0, -1, 1, 0],
  2: [-1, 0, 0, -1],
  3: [0, 1, -1, 0],
};

/** The socket under every leg when leg 0 stands in `anchor` and the part is turned by `o`; null where a leg would
 * fall off the board. */
export function legSockets(
  layout: BoardLayout,
  fp: Footprint,
  anchor: SocketSpec,
  o: Orientation,
): (SocketSpec | null)[] {
  const [a, b, c, d] = TURNS[o];
  return fp.offsets.map(
    ([dx, dz]) => layout.atGrid(anchor.gx + a * dx + b * dz, anchor.gz + c * dx + d * dz) ?? null,
  );
}
