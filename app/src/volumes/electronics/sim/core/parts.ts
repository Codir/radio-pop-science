/**
 * The catalog of parts and how each kind of part behaves in the matrix. A part of the catalog is data: its kind, the
 * names of its pins in order, its numbers and its limits. Its behaviour (`behaviour(spec)`) is what the matrix needs:
 * extra unknowns, which pins conduct direct current, its stamp and the currents into its pins. The linear kinds live
 * here; a nonlinear kind (diode, lamp, transistor) brings its own module and one more case in `behaviour`.
 * The numbers and their sources: README.md, «Catalog».
 */
import type { Stamper } from './mna';

/** The resistance of a wire: a jumper, a closed switch, the end of a pot's track (Ω). */
export const WIRE_OHMS = 1e-3;

/** What a part stands before it warms (E1-4 reads them): power in W, current in A. */
export interface Limits {
  readonly powerW?: number;
  readonly currentA?: number;
}

/** A battery: an ideal source of `volts` behind its internal resistance `ohms`; `cells` in series. */
export interface BatterySpec {
  readonly kind: 'battery';
  readonly pins: readonly ['plus', 'minus'];
  readonly volts: number;
  readonly ohms: number;
  readonly cells: number;
  readonly limits: Limits;
}

/** An ideal source of direct voltage, without internal resistance: the reference of hand calculations and of the
 * oracle. The bench never offers it (batteries only, the design §3.4). */
export interface SourceSpec {
  readonly kind: 'source';
  readonly pins: readonly ['plus', 'minus'];
  readonly volts: number;
  readonly limits: Limits;
}

/** A fixed resistor of the series E12 / E24. */
export interface ResistorSpec {
  readonly kind: 'resistor';
  readonly pins: readonly ['a', 'b'];
  readonly ohms: number;
  /** E12 when the value belongs to E12 (it then belongs to E24 too), otherwise E24. */
  readonly series: 'E12' | 'E24';
  /** The tolerance of the value, a share: 0.05 is the gold band. */
  readonly tolerance: number;
  readonly limits: Limits;
}

/** A variable resistor: a track of `ohms` from `ccw` to `cw` and the wiper on it; the setting 0…1 is the share of the
 * track between `ccw` and the wiper (0 — the knob turned fully counter-clockwise). */
export interface PotSpec {
  readonly kind: 'pot';
  readonly pins: readonly ['ccw', 'wiper', 'cw'];
  readonly ohms: number;
  readonly limits: Limits;
}

/** A switch: the setting 0 is open, 1 closed (from 0.5 up counts as closed). */
export interface SwitchSpec {
  readonly kind: 'switch';
  readonly pins: readonly ['a', 'b'];
  readonly limits: Limits;
}

/** A jumper: a wire between two rows of the board. */
export interface JumperSpec {
  readonly kind: 'jumper';
  readonly pins: readonly ['a', 'b'];
  readonly limits: Limits;
}

/** A speaker or an earphone: a resistance whose current the sound output will play. */
export interface SpeakerSpec {
  readonly kind: 'speaker';
  readonly pins: readonly ['plus', 'minus'];
  readonly ohms: number;
  readonly limits: Limits;
}

export type PartSpec =
  BatterySpec | SourceSpec | ResistorSpec | PotSpec | SwitchSpec | JumperSpec | SpeakerSpec;
export type PartKind = PartSpec['kind'];

/** Two pins (indices into the part's pins) joined by a path for direct current. */
export type Link = readonly [number, number];

/** Where a part sits in the matrix: the node of each pin, and its first current unknown (−1 when it has none). */
export interface Placement {
  readonly nodes: Int32Array;
  readonly branch: number;
}

/** How a part of the catalog behaves in the matrix. The setting it gets is already the one from `setting`. */
export interface Behaviour {
  /** Extra unknowns, currents, the part adds to the matrix (an ideal source: one). */
  readonly branches: number;
  /** A source of energy: the topology checks whether its loop is open or shorted. */
  readonly source: boolean;
  /** The setting the part works with, from the instance's own (a default when absent, held to the range). */
  setting(raw: number | undefined): number;
  /** Pairs of pins joined by a path for direct current at this setting. */
  links(setting: number): readonly Link[];
  /** Whether at this setting the part is a wire (a jumper, a closed switch): a source across wires is shorted. */
  wire(setting: number): boolean;
  /** Adds the part to the matrix. */
  stamp(setting: number, at: Placement, s: Stamper): void;
  /** The current into every pin (A) from the node voltages `v` and the unknowns `x` of a solution. */
  currents(setting: number, at: Placement, v: Float64Array, x: Float64Array, out: Float64Array): void;
}

const NO_LINKS: readonly Link[] = [];
const ONE_LINK: readonly Link[] = [[0, 1]];
const POT_LINKS: readonly Link[] = [
  [0, 1],
  [1, 2],
];
const fixed = (): number => 0;

/** A resistance of `ohms` between pins 0 and 1. */
function resistive(ohms: number, wire: boolean): Behaviour {
  const g = 1 / ohms;
  return {
    branches: 0,
    source: false,
    setting: fixed,
    links: () => ONE_LINK,
    wire: () => wire,
    stamp: (_, at, s) => s.conductance(at.nodes[0]!, at.nodes[1]!, g),
    currents: (_, at, v, __, out) => {
      out[0] = (v[at.nodes[0]!]! - v[at.nodes[1]!]!) * g;
      out[1] = -out[0];
    },
  };
}

/** The Norton form of a battery: the conductance 1/r and the current E/r that flows inside from minus to plus. */
function battery(volts: number, ohms: number): Behaviour {
  const g = 1 / ohms;
  return {
    branches: 0,
    source: true,
    setting: fixed,
    links: () => ONE_LINK,
    wire: () => false,
    stamp: (_, at, s) => {
      s.conductance(at.nodes[0]!, at.nodes[1]!, g);
      s.current(at.nodes[1]!, at.nodes[0]!, volts * g);
    },
    currents: (_, at, v, __, out) => {
      out[0] = (v[at.nodes[0]!]! - v[at.nodes[1]!]! - volts) * g;
      out[1] = -out[0];
    },
  };
}

/** An ideal source: its current is an unknown of its own, and its row says v(plus) − v(minus) = volts. */
function source(volts: number): Behaviour {
  return {
    branches: 1,
    source: true,
    setting: fixed,
    links: () => ONE_LINK,
    wire: () => false,
    stamp: (_, at, s) => s.voltage(at.nodes[0]!, at.nodes[1]!, at.branch, volts),
    currents: (_, at, __, x, out) => {
      out[0] = x[at.branch]!;
      out[1] = -out[0];
    },
  };
}

/** The two parts of a pot's track, each at least a wire. */
function sections(ohms: number, setting: number): readonly [number, number] {
  return [Math.max(setting * ohms, WIRE_OHMS), Math.max((1 - setting) * ohms, WIRE_OHMS)];
}

function pot(ohms: number): Behaviour {
  return {
    branches: 0,
    source: false,
    setting: (raw) => Math.min(Math.max(raw ?? 0.5, 0), 1),
    links: () => POT_LINKS,
    wire: () => false,
    stamp: (setting, at, s) => {
      const [lower, upper] = sections(ohms, setting);
      s.conductance(at.nodes[0]!, at.nodes[1]!, 1 / lower);
      s.conductance(at.nodes[1]!, at.nodes[2]!, 1 / upper);
    },
    currents: (setting, at, v, _, out) => {
      const [lower, upper] = sections(ohms, setting);
      const wiper = v[at.nodes[1]!]!;
      out[0] = (v[at.nodes[0]!]! - wiper) / lower;
      out[2] = (v[at.nodes[2]!]! - wiper) / upper;
      out[1] = -(out[0] + out[2]);
    },
  };
}

function toggle(): Behaviour {
  const g = 1 / WIRE_OHMS;
  return {
    branches: 0,
    source: false,
    setting: (raw) => ((raw ?? 0) >= 0.5 ? 1 : 0),
    links: (setting) => (setting === 1 ? ONE_LINK : NO_LINKS),
    wire: (setting) => setting === 1,
    stamp: (setting, at, s) => {
      if (setting === 1) s.conductance(at.nodes[0]!, at.nodes[1]!, g);
    },
    currents: (setting, at, v, _, out) => {
      out[0] = setting === 1 ? (v[at.nodes[0]!]! - v[at.nodes[1]!]!) * g : 0;
      out[1] = -out[0];
    },
  };
}

/** How a part of the catalog behaves. A new kind adds its case here. */
export function behaviour(spec: PartSpec): Behaviour {
  switch (spec.kind) {
    case 'battery':
      return battery(spec.volts, spec.ohms);
    case 'source':
      return source(spec.volts);
    case 'resistor':
    case 'speaker':
      return resistive(spec.ohms, false);
    case 'pot':
      return pot(spec.ohms);
    case 'switch':
      return toggle();
    case 'jumper':
      return resistive(WIRE_OHMS, true);
  }
}

// ── The catalog ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The two significant digits of the series E12 and E24 (IEC 60063). */
export const E12: readonly number[] = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
export const E24: readonly number[] = [
  10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91,
];

/** Resistors of the catalog: every value of E24 from 1 Ω to 9.1 MΩ, and 10 MΩ. */
const DECADES = 7;
const RESISTOR_POWER_W = 0.25;
const RESISTOR_TOLERANCE = 0.05;

/** The value as the letter code of IEC 60062 (the letter stands for the decimal point): 4R7, 47, 470, 4k7, 47k, 4M7. */
function letterCode(digits: number, decade: number): string {
  // the value is digits·10^(decade − 1) Ω, digits 10…99
  const prefix = decade < 3 ? '' : decade < 6 ? 'k' : 'M';
  const shift = decade < 3 ? decade : decade < 6 ? decade - 3 : decade - 6; // digits·10^(shift − 1) of the unit
  const whole = shift === 0 ? Math.floor(digits / 10) : digits * 10 ** (shift - 1);
  const tenth = shift === 0 ? digits % 10 : 0;
  if (tenth === 0) return `${whole}${prefix}`;
  return `${whole}${prefix || 'R'}${tenth}`;
}

/** The value in Ω of `digits`·10^(decade − 1), exact for whole ohms and the nearest double below 10 Ω. */
const valueOf = (digits: number, decade: number): number =>
  decade === 0 ? digits / 10 : digits * 10 ** (decade - 1);

function resistors(): [string, ResistorSpec][] {
  const out: [string, ResistorSpec][] = [];
  const make = (digits: number, decade: number): [string, ResistorSpec] => [
    `resistor-${letterCode(digits, decade)}`,
    {
      kind: 'resistor',
      pins: ['a', 'b'],
      ohms: valueOf(digits, decade),
      series: E12.includes(digits) ? 'E12' : 'E24',
      tolerance: RESISTOR_TOLERANCE,
      limits: { powerW: RESISTOR_POWER_W },
    },
  ];
  for (let decade = 0; decade < DECADES; decade++) for (const digits of E24) out.push(make(digits, decade));
  out.push(make(10, DECADES)); // 10 MΩ
  return out;
}

/** Every part the model knows, by key. */
export const PARTS: Readonly<Record<string, PartSpec>> = Object.freeze({
  'battery-9v': { kind: 'battery', pins: ['plus', 'minus'], volts: 9, ohms: 1.5, cells: 6, limits: {} },
  'battery-4aa': { kind: 'battery', pins: ['plus', 'minus'], volts: 6, ohms: 0.6, cells: 4, limits: {} },
  'battery-aa': { kind: 'battery', pins: ['plus', 'minus'], volts: 1.5, ohms: 0.15, cells: 1, limits: {} },
  'ideal-9v': { kind: 'source', pins: ['plus', 'minus'], volts: 9, limits: {} },
  ...Object.fromEntries(resistors()),
  'pot-10k': { kind: 'pot', pins: ['ccw', 'wiper', 'cw'], ohms: 10e3, limits: { powerW: 0.2 } },
  switch: { kind: 'switch', pins: ['a', 'b'], limits: {} },
  jumper: { kind: 'jumper', pins: ['a', 'b'], limits: {} },
  'speaker-8': { kind: 'speaker', pins: ['plus', 'minus'], ohms: 8, limits: { powerW: 2 } },
  'earphone-32': { kind: 'speaker', pins: ['plus', 'minus'], ohms: 32, limits: { powerW: 0.1 } },
} satisfies Record<string, PartSpec>);

/** The catalog key of a resistor of `ohms` (a value of E24 from 1 Ω to 10 MΩ): `resistorKey(4700)` is
 * `'resistor-4k7'`. A value the catalog does not have is a RangeError. */
export function resistorKey(ohms: number): string {
  if (Number.isFinite(ohms) && ohms > 0) {
    // the value is digits·10^(decade − 1) with digits 10…99; the neighbours cover a logarithm rounded across a decade
    const decade = Math.floor(Math.log10(ohms));
    for (const d of [decade - 1, decade, decade + 1]) {
      const digits = Math.round(ohms / 10 ** (d - 1));
      if (digits < 10 || digits > 99 || d < 0 || d > DECADES) continue;
      const key = `resistor-${letterCode(digits, d)}`;
      const spec = PARTS[key];
      if (spec?.kind === 'resistor' && Math.abs(spec.ohms - ohms) <= 1e-9 * ohms) return key;
    }
  }
  throw new RangeError(`no resistor of ${ohms} Ω in the catalog (E24, 1 Ω … 10 MΩ)`);
}
