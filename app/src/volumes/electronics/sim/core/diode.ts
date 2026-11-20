/**
 * Diodes and LEDs: the DC part of SPICE's diode (level 1) at 27 °C, written after ngspice-42 (`dioload.c`,
 * `diotemp.c`, `devsup.c`) so that the model and its oracle solve the same equations.
 *
 * The part is a series resistance RS from the anode to a node of its own, the junction, and the junction from there
 * to the cathode; a maker's model may add a resistance across the whole part for the leakage the wrong way round
 * (`leakOhms`). The junction takes
 *   forward and slightly reverse (v ≥ −3·N·Vt):  IS·(e^(v/(N·Vt)) − 1)
 *   reverse (down to the knee):                   −IS·(1 + (3·N·Vt / (e·v))³)
 *   breakdown (v < −knee):                        −IS·e^(−(knee + v)/(N·Vt))
 * and, as in every SPICE, a conductance GMIN in parallel. The knee is BV moved a little, so that the current at −BV
 * is IBV. Newton's iterations limit the step of the junction voltage (`pnjlim`): an exponential overshoots badly
 * from a poor guess. Numbers and sources: README.md, «Diodes and LEDs».
 */
import type { Behaviour, DiodeSpec, JunctionParams, LedSpec, Link } from './parts';

/** The room of the model: 27 °C, the temperature at which SPICE takes the parameters of a model (TNOM). */
export const ROOM_KELVIN = 300.15;
/** kT/q at the room's temperature, from the constants ngspice-42 uses (`const.h`): about 25.865 mV. */
export const THERMAL_VOLTAGE = (1.38064852e-23 / 1.6021766208e-19) * ROOM_KELVIN;
/** The conductance SPICE puts across every junction (S): the default `gmin` of ngspice. */
export const GMIN = 1e-12;
/** ngspice fits the knee of the breakdown to this share of IBV (its `reltol`). */
const KNEE_TOLERANCE = 1e-3;
const KNEE_ITERATIONS = 25;

/** A junction ready to compute: its parameters with what follows from them at the room's temperature. */
export interface Junction {
  readonly is: number;
  /** N·Vt (V). */
  readonly vte: number;
  /** The voltage above which a step is limited: N·Vt·ln(N·Vt / (√2·IS)) (V). */
  readonly vcrit: number;
  /** The breakdown starts at −knee (V): BV moved so that the junction takes IBV at −BV. */
  readonly knee: number;
}

export function junctionOf(p: JunctionParams): Junction {
  const vt = THERMAL_VOLTAGE;
  const vte = p.n * vt;
  const vcrit = vte * Math.log(vte / (Math.SQRT2 * p.is));
  // diotemp.c: the knee solves IS·(e^((BV − knee)/(N·Vt)) − 1 + knee/Vt) = IBV, to 1e-3 of IBV
  let knee = p.bv;
  if (p.ibv >= (p.is * p.bv) / vt) {
    knee = p.bv - vte * Math.log(1 + p.ibv / p.is);
    for (let k = 0; k < KNEE_ITERATIONS; k++) {
      knee = p.bv - vte * Math.log(p.ibv / p.is + 1 - knee / vt);
      const current = p.is * (Math.exp((p.bv - knee) / vte) - 1 + knee / vt);
      if (Math.abs(current - p.ibv) <= KNEE_TOLERANCE * p.ibv) break;
    }
  }
  return { is: p.is, vte, vcrit, knee };
}

/** The current `i` (A) the junction takes at `v` and its slope `g` (S), GMIN included, into `out`. */
export function junctionCurrent(j: Junction, v: number, out: { i: number; g: number }): void {
  const { is, vte, knee } = j;
  if (v >= -3 * vte) {
    const e = Math.exp(v / vte);
    out.i = is * Math.expm1(v / vte);
    out.g = (is * e) / vte;
  } else if (v >= -knee) {
    const cubic = ((3 * vte) / (v * Math.E)) ** 3;
    out.i = -is * (1 + cubic);
    out.g = (is * 3 * cubic) / v;
  } else {
    const e = Math.exp(-(knee + v) / vte);
    out.i = -is * e;
    out.g = (is * e) / vte;
  }
  out.i += GMIN * v;
  out.g += GMIN;
}

/**
 * The step of a junction's voltage from `vold` to `vnew`, limited as by `DEVpnjlim` of ngspice-42: above `vcrit` a
 * rise of more than 2·`vt` becomes logarithmic; a fall below zero goes at most to −vold − 1 (from a forward voltage)
 * or to 2·vold − 1 (from a reverse one).
 */
export function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > vt + vt) {
    if (vold > 0) {
      const arg = (vnew - vold) / vt;
      return arg > 0 ? vold + vt * (2 + Math.log(arg - 2)) : vold - vt * (2 + Math.log(2 - arg));
    }
    return vt * Math.log(vnew / vt);
  }
  if (vnew < 0) {
    const floor = vold > 0 ? -vold - 1 : 2 * vold - 1;
    if (vnew < floor) return floor;
  }
  return vnew;
}

/** The step of the junction voltage the way ngspice limits it: around the knee in breakdown, else as `pnjlim`. */
export function limitJunction(j: Junction, vnew: number, vold: number): number {
  if (vnew < Math.min(0, -j.knee + 10 * j.vte)) {
    const beyond = pnjlim(-(vnew + j.knee), -(vold + j.knee), j.vte, j.vcrit);
    return -(beyond + j.knee);
  }
  return pnjlim(vnew, vold, j.vte, j.vcrit);
}

/** The voltage across a diode (junction, RS and the leak) that carries the forward current `amps` (> 0): what a meter
 * shows. */
export function forwardVoltage(p: JunctionParams, amps: number): number {
  if (!(amps > 0)) throw new RangeError(`a forward current must be positive: ${amps}`);
  const j = junctionOf(p);
  const leak = p.leakOhms ? 1 / p.leakOhms : 0;
  const out = { i: 0, g: 0 };
  // Newton on the junction's voltage v: the part takes i(v) through RS and (v + RS·i(v))·leak beside it
  let v = j.vte * Math.log1p(amps / p.is); // without GMIN and the leak; Newton adds them
  for (let k = 0; k < 50; k++) {
    junctionCurrent(j, v, out);
    const total = out.i + (v + p.rs * out.i) * leak;
    const step = (total - amps) / (out.g + (1 + p.rs * out.g) * leak);
    v -= step;
    if (Math.abs(step) <= 1e-15 * Math.abs(v)) break;
  }
  junctionCurrent(j, v, out);
  return v + out.i * p.rs;
}

/** The light of an LED (lm) at the current `amps` through it: in proportion to the forward current, none backwards. */
export function ledLumens(spec: LedSpec, amps: number): number {
  return amps > 0 ? amps * spec.lumensPerAmp : 0;
}

const ONE_LINK: readonly Link[] = [[0, 1]];

/**
 * A diode or an LED in the matrix. With RS it has a node of its own, the junction: RS from the anode to it, the
 * junction's linearization (its slope and the current that makes up the rest) from it to the cathode; the leak, when
 * the part has one, from the anode to the cathode. Its memory is the junction voltage it linearized at last.
 */
export function diodeBehaviour(spec: DiodeSpec | LedSpec): Behaviour {
  const j = junctionOf(spec);
  const inner = spec.rs > 0 ? 1 : 0;
  const gs = inner ? 1 / spec.rs : 0;
  const leak = spec.leakOhms ? 1 / spec.leakOhms : 0;
  const out = { i: 0, g: 0 };
  return {
    branches: 0,
    inner,
    memory: 1,
    nonlinear: true,
    source: false,
    setting: () => 0,
    links: () => ONE_LINK,
    wire: () => false,
    start: (at) => {
      at.memory[0] = j.vcrit; // SPICE starts every junction at its knee of conduction
    },
    stamp: (_, at, s, op) => {
      const anode = at.nodes[0]!;
      const cathode = at.nodes[1]!;
      const junction = inner ? at.inner[0]! : anode;
      let v = at.memory[0]!;
      if (!op.initial) {
        const guess = op.v[junction]! - op.v[cathode]!;
        v = limitJunction(j, guess, v);
        if (v !== guess) op.limited = true;
      }
      at.memory[0] = v;
      junctionCurrent(j, v, out);
      s.conductance(junction, cathode, out.g);
      s.current(junction, cathode, out.i - out.g * v);
      if (inner) s.conductance(anode, junction, gs);
      if (leak) s.conductance(anode, cathode, leak);
    },
    currents: (_, at, v, __, pins) => {
      const anode = at.nodes[0]!;
      const cathode = at.nodes[1]!;
      if (inner) pins[0] = (v[anode]! - v[at.inner[0]!]!) * gs;
      else {
        junctionCurrent(j, v[anode]! - v[cathode]!, out);
        pins[0] = out.i;
      }
      pins[0] += (v[anode]! - v[cathode]!) * leak;
      pins[1] = -pins[0];
    },
  };
}
