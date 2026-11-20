/**
 * The catalog of parts and how each kind of part behaves in the matrix. A part of the catalog is data: its kind, the
 * names of its pins in order, its numbers and its limits. Its behaviour (`behaviour(spec)`) is what the matrix needs:
 * extra unknowns, which pins conduct direct current, its stamp and the currents into its pins. The linear kinds live
 * here; a kind with a module of its own (diode, lamp, capacitor, transistor) brings it and one more case in
 * `behaviour`. The numbers and their sources: README.md, «Catalog».
 */
import { capacitorBehaviour } from './capacitor';
import { diodeBehaviour } from './diode';
import { lampBehaviour } from './lamp';
import type { Stamper } from './mna';
import { transistorBehaviour } from './transistor';

/** The resistance of a wire: a jumper, a closed switch, the end of a pot's track (Ω). */
export const WIRE_OHMS = 1e-3;

/** What a part stands for good (`limits.ts` reads them): power in W, current in A either way, voltage in V either
 * way, voltage in V the wrong way round (from the second pin to the first). */
export interface Limits {
  readonly powerW?: number;
  readonly currentA?: number;
  readonly voltageV?: number;
  readonly reverseV?: number;
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

/** A source of a sine, `amplitude`·sin(2π·f·t), behind its internal resistance `ohms` (none when absent: an ideal
 * source): f is the setting (Hz), `hz` when absent. The ideal one is the reference of the oracle in time, which the
 * bench never offers; one with the player's level and internal resistance is the test tone of the amplifier. */
export interface SineSpec {
  readonly kind: 'sine';
  readonly pins: readonly ['plus', 'minus'];
  readonly amplitude: number;
  readonly hz: number;
  readonly ohms?: number;
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

/** The DC parameters of SPICE's diode: the junction takes `is`·(e^(v/(`n`·Vt)) − 1) and breaks down at `bv` with
 * `ibv`; `rs` stands in front of it, and `leakOhms`, when given, across the whole part (`diode.ts`). */
export interface JunctionParams {
  /** Saturation current IS (A). */
  readonly is: number;
  /** Emission coefficient N. */
  readonly n: number;
  /** Series resistance RS (Ω). */
  readonly rs: number;
  /** Reverse breakdown voltage BV (V). */
  readonly bv: number;
  /** The current at the breakdown voltage IBV (A). */
  readonly ibv: number;
  /** A resistance across the whole part (Ω), when the maker's model has one for its leakage the wrong way round. */
  readonly leakOhms?: number;
}

/** A rectifier or signal diode. */
export interface DiodeSpec extends JunctionParams {
  readonly kind: 'diode';
  readonly pins: readonly ['anode', 'cathode'];
  readonly limits: Limits;
}

export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white';

/** A 5 mm indicator LED: a diode whose junction shines in proportion to its forward current. */
export interface LedSpec extends JunctionParams {
  readonly kind: 'led';
  readonly pins: readonly ['anode', 'cathode'];
  readonly color: LedColor;
  /** The current it is made for (A). */
  readonly ratedA: number;
  /** Its light: luminous flux per ampere of forward current (lm/A), an estimate from a maker's datasheet. */
  readonly lumensPerAmp: number;
  readonly limits: Limits;
}

/** An incandescent lamp: a tungsten filament made for `volts` and `amps` (`lamp.ts`). */
export interface LampSpec {
  readonly kind: 'lamp';
  readonly pins: readonly ['a', 'b'];
  readonly volts: number;
  readonly amps: number;
  /** The filament's resistance at room temperature (Ω). */
  readonly coldOhms: number;
  /** The thermal time constant of the filament at its rated voltage (s): a small change about the hot filament
   * settles with it in time (`lamp.ts`). */
  readonly tauS: number;
  readonly limits: Limits;
}

export type Dielectric = 'ceramic' | 'film' | 'electrolytic';

/** A capacitor: its capacitance behind its equivalent series resistance, a leak across the capacitance
 * (`capacitor.ts`). An electrolytic one is polar: its pins are plus and minus. */
export interface CapacitorSpec {
  readonly kind: 'capacitor';
  readonly pins: readonly ['a', 'b'] | readonly ['plus', 'minus'];
  readonly dielectric: Dielectric;
  /** Whether it must not take a voltage the wrong way round (an electrolytic): over its limits it bulges. */
  readonly polar: boolean;
  /** Capacitance (F). */
  readonly farads: number;
  /** Equivalent series resistance (Ω). */
  readonly esrOhms: number;
  /** The resistance across the capacitance that carries its leakage current (Ω). */
  readonly leakOhms: number;
  /** The rated voltage (V). */
  readonly ratedV: number;
  readonly limits: Limits;
}

/** The DC parameters of SPICE's bipolar transistor that the model takes: the transport form of Ebers–Moll with the
 * Early effect (`transistor.ts`). */
export interface TransistorParams {
  /** Saturation current IS (A). */
  readonly is: number;
  /** Forward current gain BF: the collector current over the base current, the junctions as in an amplifier. */
  readonly bf: number;
  /** Reverse current gain BR: the same with the collector and the emitter swapped. */
  readonly br: number;
  /** Forward Early voltage VAF (V): the collector current grows as 1 + Vcb/VAF. */
  readonly vaf: number;
}

export type Polarity = 'npn' | 'pnp';

/** A bipolar transistor: a small current into its base lets a large one through from the collector to the emitter
 * (an NPN; a PNP the other way round, every voltage and current with the opposite sign). */
export interface TransistorSpec extends TransistorParams {
  readonly kind: 'transistor';
  readonly pins: readonly ['collector', 'base', 'emitter'];
  readonly polarity: Polarity;
  readonly limits: Limits;
}

export type PartSpec =
  | BatterySpec
  | SourceSpec
  | SineSpec
  | ResistorSpec
  | PotSpec
  | SwitchSpec
  | JumperSpec
  | SpeakerSpec
  | DiodeSpec
  | LedSpec
  | LampSpec
  | CapacitorSpec
  | TransistorSpec;
export type PartKind = PartSpec['kind'];

/** Two pins (indices into the part's pins) joined by a path for direct current. */
export type Link = readonly [number, number];

/** Where a part sits in the matrix: the node of each pin, its first current unknown (−1 when it has none), its own
 * nodes (a diode's junction behind its series resistance), its memory between Newton's iterations and its history
 * between the moments of the transient. */
export interface Placement {
  readonly nodes: Int32Array;
  readonly branch: number;
  /** The numbers of the part's own nodes, after the board's nodes. */
  readonly inner: Int32Array;
  /** What a nonlinear part keeps from one iteration to the next (a junction's voltage, a filament's temperature). */
  readonly memory: Float64Array;
  /** What a part with a state in time keeps from the last moment of the transient to the next. Its first number is
   * the part's level, which the model's state keeps: a capacitor's voltage across its capacitance, a filament's
   * temperature. */
  readonly history: Float64Array;
}

/** The guess the parts stamp around, one iteration of Newton's method, and the moment it is for. */
export interface Operating {
  /** The node voltages of the guess by node number: the board's nodes, then the parts' own. */
  readonly v: Float64Array;
  /** The share of their voltage the sources give: 1, or less while the sources are stepped up from zero. */
  sources: number;
  /** The first iteration from nothing: a junction linearizes at the voltage in its memory, not at the guess. */
  initial: boolean;
  /** Set by a part that had to limit the step of its voltage: the iterations have not settled yet. */
  limited: boolean;
  /** The moment the solution is for (s): a sine reads it. 0 at the operating point unless the solve says otherwise. */
  time: number;
  /** The step from the history to this moment (s); 0 at the operating point, where a capacitor is open and a
   * filament steady. */
  dt: number;
  /** The step integrates by the trapezoid; otherwise by backward Euler (the first steps, and those after a change on
   * the board). */
  trapezoid: boolean;
}

/** The form a part takes once it failed, when that is not a plain gap: an electrolytic capacitor that bulged. */
export interface FailedForm {
  stamp(at: Placement, s: Stamper): void;
  currents(at: Placement, v: Float64Array, out: Float64Array): void;
}

/** How a part of the catalog behaves in the matrix. The setting it gets is already the one from `setting`. */
export interface Behaviour {
  /** Extra unknowns, currents, the part adds to the matrix (an ideal source: one). */
  readonly branches: number;
  /** Nodes of its own the part adds (a diode with a series resistance: its junction). */
  readonly inner: number;
  /** Numbers the part keeps between Newton's iterations. */
  readonly memory: number;
  /** Numbers the part keeps between the moments of the transient (a capacitor's voltage and current, a filament's
   * temperature and the heat it gains); 0 for a part without a state in time. */
  readonly history: number;
  /** A nonlinear part: the operating point takes Newton's iterations. */
  readonly nonlinear: boolean;
  /** A source of energy: the topology checks whether its loop is open or shorted. */
  readonly source: boolean;
  /** The setting the part works with, from the instance's own (a default when absent, held to the range). */
  setting(raw: number | undefined): number;
  /** Pairs of pins joined by a path for direct current at this setting. */
  links(setting: number): readonly Link[];
  /** Whether at this setting the part is a wire (a jumper, a closed switch): a source across wires is shorted. */
  wire(setting: number): boolean;
  /** Sets the memory before the first iteration of a solve. */
  start?(at: Placement): void;
  /** Adds the part to the matrix: a nonlinear part, its linearization around the guess `op`; a part with a state in
   * time, at `op.dt` > 0, its companion of the step from its history. */
  stamp(setting: number, at: Placement, s: Stamper, op: Operating): void;
  /** The current into every pin (A) from the node voltages `v` (the parts' own nodes too) and the unknowns `x` of
   * a solution for the moment of `op`. */
  currents(
    setting: number,
    at: Placement,
    v: Float64Array,
    x: Float64Array,
    out: Float64Array,
    op: Operating,
  ): void;
  /** A part with a state in time: its history at an operating point solved into `v` (charged, steady). */
  settle?(setting: number, at: Placement, v: Float64Array, op: Operating): void;
  /** A part with a state in time: its history moves on to the moment `op` solved into `v`. */
  accept?(setting: number, at: Placement, v: Float64Array, op: Operating): void;
  /** What the part becomes once it failed, when not a gap (`limits.ts`: an electrolytic capacitor bulges). */
  readonly failed?: FailedForm;
}

const NO_LINKS: readonly Link[] = [];
const ONE_LINK: readonly Link[] = [[0, 1]];
const POT_LINKS: readonly Link[] = [
  [0, 1],
  [1, 2],
];
const fixed = (): number => 0;

/** What every linear part without a state in time shares: no own nodes, no memory, no history. */
const LINEAR = { inner: 0, memory: 0, history: 0, nonlinear: false } as const;

/** A resistance of `ohms` between pins 0 and 1. */
function resistive(ohms: number, wire: boolean): Behaviour {
  const g = 1 / ohms;
  return {
    ...LINEAR,
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
    ...LINEAR,
    branches: 0,
    source: true,
    setting: fixed,
    links: () => ONE_LINK,
    wire: () => false,
    stamp: (_, at, s, op) => {
      s.conductance(at.nodes[0]!, at.nodes[1]!, g);
      s.current(at.nodes[1]!, at.nodes[0]!, volts * op.sources * g);
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
    ...LINEAR,
    branches: 1,
    source: true,
    setting: fixed,
    links: () => ONE_LINK,
    wire: () => false,
    stamp: (_, at, s, op) => s.voltage(at.nodes[0]!, at.nodes[1]!, at.branch, volts * op.sources),
    currents: (_, at, __, x, out) => {
      out[0] = x[at.branch]!;
      out[1] = -out[0];
    },
  };
}

/** A sine behind its internal resistance, in the Norton form as a battery: the conductance 1/r and the current
 * e(t)/r, e(t) = amplitude·sin(2π·f·t) at the moment of the solve; the setting is f (Hz), never below 0. */
function sineBehind(amplitude: number, hz: number, ohms: number): Behaviour {
  const g = 1 / ohms;
  const e = (hertz: number, op: Operating): number =>
    amplitude * Math.sin(2 * Math.PI * hertz * op.time) * op.sources;
  return {
    ...LINEAR,
    branches: 0,
    source: true,
    setting: (raw) => Math.max(raw ?? hz, 0),
    links: () => ONE_LINK,
    wire: () => false,
    stamp: (hertz, at, s, op) => {
      s.conductance(at.nodes[0]!, at.nodes[1]!, g);
      s.current(at.nodes[1]!, at.nodes[0]!, e(hertz, op) * g);
    },
    currents: (hertz, at, v, _, out, op) => {
      out[0] = (v[at.nodes[0]!]! - v[at.nodes[1]!]! - e(hertz, op)) * g;
      out[1] = -out[0];
    },
  };
}

/** An ideal sine: its current is an unknown of its own, and its row says v(plus) − v(minus) = amplitude·sin(2π·f·t)
 * at the moment of the solve; the setting is f (Hz), never below 0. At the operating point (t = 0) it gives 0 V. */
function sine(amplitude: number, hz: number): Behaviour {
  return {
    ...LINEAR,
    branches: 1,
    source: true,
    setting: (raw) => Math.max(raw ?? hz, 0),
    links: () => ONE_LINK,
    wire: () => false,
    stamp: (hertz, at, s, op) =>
      s.voltage(
        at.nodes[0]!,
        at.nodes[1]!,
        at.branch,
        amplitude * Math.sin(2 * Math.PI * hertz * op.time) * op.sources,
      ),
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
    ...LINEAR,
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
    ...LINEAR,
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
    case 'sine':
      return spec.ohms ? sineBehind(spec.amplitude, spec.hz, spec.ohms) : sine(spec.amplitude, spec.hz);
    case 'resistor':
    case 'speaker':
      return resistive(spec.ohms, false);
    case 'pot':
      return pot(spec.ohms);
    case 'switch':
      return toggle();
    case 'jumper':
      return resistive(WIRE_OHMS, true);
    case 'diode':
    case 'led':
      return diodeBehaviour(spec);
    case 'lamp':
      return lampBehaviour(spec);
    case 'capacitor':
      return capacitorBehaviour(spec);
    case 'transistor':
      return transistorBehaviour(spec);
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

/** A 5 mm indicator LED: the plan's 20 mA rated and 30 mA at most, a breakdown far above any battery of the bench. */
function led(color: LedColor, is: number, n: number, rs: number, lumensPerAmp: number): LedSpec {
  return {
    kind: 'led',
    pins: ['anode', 'cathode'],
    color,
    is,
    n,
    rs,
    bv: 20,
    ibv: 10e-6,
    ratedA: 0.02,
    lumensPerAmp,
    limits: { currentA: 0.03 },
  };
}

/** A ceramic capacitor of 50 V (C0G up to 1 nF, X7R above): ESR 0.03 Ω, insulation 10 GΩ (README.md). */
function ceramic(farads: number): CapacitorSpec {
  return {
    kind: 'capacitor',
    pins: ['a', 'b'],
    dielectric: 'ceramic',
    polar: false,
    farads,
    esrOhms: 0.03,
    leakOhms: 10e9,
    ratedV: 50,
    limits: { voltageV: 50 },
  };
}

/** A polyester film capacitor of 63 V (WIMA MKS 2): ESR 0.03 Ω, its insulation from the maker (README.md). */
function film(farads: number, leakOhms: number): CapacitorSpec {
  return {
    kind: 'capacitor',
    pins: ['a', 'b'],
    dielectric: 'film',
    polar: false,
    farads,
    esrOhms: 0.03,
    leakOhms,
    ratedV: 63,
    limits: { voltageV: 63 },
  };
}

/** An aluminium electrolytic capacitor: ESR from tan δ at 120 Hz, the leak from the leakage current after five
 * minutes at the rated voltage, at most 1 V the wrong way round (README.md). */
function electrolytic(farads: number, ratedV: number, esrOhms: number, leakOhms: number): CapacitorSpec {
  return {
    kind: 'capacitor',
    pins: ['plus', 'minus'],
    dielectric: 'electrolytic',
    polar: true,
    farads,
    esrOhms,
    leakOhms,
    ratedV,
    limits: { voltageV: ratedV, reverseV: 1 },
  };
}

/** A small-signal transistor in TO-92: the Ebers–Moll part of its maker's SPICE model, its collector current and its
 * power at most (README.md). */
function transistor(
  polarity: Polarity,
  is: number,
  bf: number,
  br: number,
  vaf: number,
  currentA: number,
  powerW: number,
): TransistorSpec {
  return {
    kind: 'transistor',
    pins: ['collector', 'base', 'emitter'],
    polarity,
    is,
    bf,
    br,
    vaf,
    limits: { currentA, powerW },
  };
}

/** Every part the model knows, by key. */
export const PARTS: Readonly<Record<string, PartSpec>> = Object.freeze({
  'battery-9v': {
    kind: 'battery',
    pins: ['plus', 'minus'],
    volts: 9,
    ohms: 1.5,
    cells: 6,
    limits: { currentA: 1 },
  },
  'battery-4aa': {
    kind: 'battery',
    pins: ['plus', 'minus'],
    volts: 6,
    ohms: 0.6,
    cells: 4,
    limits: { currentA: 3 },
  },
  'battery-aa': {
    kind: 'battery',
    pins: ['plus', 'minus'],
    volts: 1.5,
    ohms: 0.15,
    cells: 1,
    limits: { currentA: 3 },
  },
  'ideal-9v': { kind: 'source', pins: ['plus', 'minus'], volts: 9, limits: {} },
  'ideal-5v': { kind: 'source', pins: ['plus', 'minus'], volts: 5, limits: {} },
  'ideal-ac-6v': { kind: 'sine', pins: ['plus', 'minus'], amplitude: 6, hz: 50, limits: {} },
  'player-tone': { kind: 'sine', pins: ['plus', 'minus'], amplitude: 0.3, hz: 1000, ohms: 32, limits: {} },
  ...Object.fromEntries(resistors()),
  'pot-10k': { kind: 'pot', pins: ['ccw', 'wiper', 'cw'], ohms: 10e3, limits: { powerW: 0.2 } },
  switch: { kind: 'switch', pins: ['a', 'b'], limits: {} },
  jumper: { kind: 'jumper', pins: ['a', 'b'], limits: {} },
  'speaker-8': { kind: 'speaker', pins: ['plus', 'minus'], ohms: 8, limits: { powerW: 2 } },
  'earphone-32': { kind: 'speaker', pins: ['plus', 'minus'], ohms: 32, limits: { powerW: 0.1 } },
  'diode-1n4148': {
    kind: 'diode',
    pins: ['anode', 'cathode'],
    is: 4.352e-9,
    n: 1.906,
    rs: 0.6458,
    bv: 110,
    ibv: 1e-4,
    leakOhms: 5.827e9,
    limits: { currentA: 0.2, reverseV: 100 },
  },
  'diode-1n4007': {
    kind: 'diode',
    pins: ['anode', 'cathode'],
    is: 1.43733e-8,
    n: 1.80829,
    rs: 0.0414712,
    bv: 1100,
    ibv: 10,
    limits: { currentA: 1, reverseV: 1000 },
  },
  'led-red': led('red', 8.66e-18, 2, 6, 0.86),
  'led-yellow': led('yellow', 1.25e-18, 2, 6, 0.54),
  'led-green': led('green', 1.81e-19, 2, 6, 0.64),
  'led-blue': led('blue', 2.45e-16, 3.5, 10, 21),
  'led-white': led('white', 2.45e-16, 3.5, 10, 17),
  'lamp-6v': {
    kind: 'lamp',
    pins: ['a', 'b'],
    volts: 6,
    amps: 0.1,
    coldOhms: 5.5,
    tauS: 0.05,
    limits: { powerW: 0.7 },
  },
  'ceramic-100p': ceramic(100e-12),
  'ceramic-1n': ceramic(1e-9),
  'ceramic-10n': ceramic(10e-9),
  'ceramic-100n': ceramic(100e-9),
  'film-100n': film(100e-9, 10e9),
  'film-1u': film(1e-6, 1.25e9),
  'electrolytic-1u-16v': electrolytic(1e-6, 16, 265.3, 5.277e6),
  'electrolytic-10u-16v': electrolytic(10e-6, 16, 26.53, 4.819e6),
  'electrolytic-100u-16v': electrolytic(100e-6, 16, 2.653, 2.581e6),
  'electrolytic-470u-16v': electrolytic(470e-6, 16, 0.5644, 886.9e3),
  'electrolytic-1000u-16v': electrolytic(1000e-6, 16, 0.2653, 457.1e3),
  'electrolytic-100u-6v3': electrolytic(100e-6, 6.3, 3.714, 1.479e6),
  'transistor-bc547b': transistor('npn', 2.39e-14, 294.3, 7.946, 63.2, 0.1, 0.5),
  'transistor-bc557b': transistor('pnp', 3.834e-14, 344.4, 14.84, 21.11, 0.1, 0.5),
  'transistor-2n3904': transistor('npn', 6.734e-15, 416.4, 0.7371, 74.03, 0.2, 0.625),
  'transistor-2n3906': transistor('pnp', 1.41e-15, 180.7, 4.977, 18.7, 0.2, 0.625),
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
