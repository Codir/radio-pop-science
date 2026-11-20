/**
 * The incandescent lamp: a tungsten filament whose resistance grows with its temperature, R(T) = R0·(T / T0)^α with
 * α = 1.21 (tungsten from 300 to 3000 K), and which loses its heat by radiation, K·(T⁴ − T0⁴). The lamp's numbers fix
 * both: at its rated voltage it takes its rated current, so the hot filament has V/I ohms at the temperature T_hot
 * where R(T_hot) is that, and K is the rated power over T_hot⁴ − T0⁴.
 *
 * At the operating point the filament is steady: the power V²/R(T) it takes is what it radiates. For a voltage this
 * gives one temperature (found by Newton's method, held by bisection), and so the lamp's current and its slope —
 * the steady lamp is a nonlinear resistor that Newton's iterations of the circuit linearize like a diode.
 *
 * In time the filament has a heat capacity Cth = τ·4·K·T_hot³ (τ the lamp's `tauS`, so that a small change about the
 * hot filament settles with τ): Cth·dT/dt = V²/R(T) − K·(T⁴ − T0⁴). Over a step h, by backward Euler or the trapezoid
 * like the capacitors, the temperature at the end of the step solves
 *   (a·T − base + K·(T⁴ − T0⁴))·R(T) = V²,   a = Cth/h (Euler) or 2·Cth/h (trapezoid),
 *   base = a·T_last (Euler) or a·T_last + Q_last (trapezoid; Q the heat the filament gained, V²/R − K·(T⁴ − T0⁴)),
 * and the steady filament is the same equation with a = base = 0. So a cold filament switched on draws the current
 * of its cold resistance and warms within milliseconds. Numbers and sources: README.md, «The lamp».
 */
import { ROOM_KELVIN } from './diode';
import type { Behaviour, LampSpec, Link, Operating, Placement } from './parts';

/** R ∝ T^1.21: the resistivity of tungsten from 300 to 3000 K (README.md, «The lamp»). */
export const TUNGSTEN_EXPONENT = 1.21;

/** The filament at a voltage. */
export interface Filament {
  /** Its temperature (K). */
  kelvin: number;
  /** Its resistance (Ω). */
  ohms: number;
  /** The current through it (A), with the sign of the voltage. */
  amps: number;
  /** The power it takes and radiates (W). */
  watts: number;
}

interface FilamentModel {
  readonly cold: number;
  /** The radiation constant: K·(T⁴ − T0⁴) W. */
  readonly k: number;
  /** The temperature at the rated voltage (K). */
  readonly hot: number;
  /** The heat capacity of the filament (J/K): τ·4·K·T_hot³. */
  readonly capacity: number;
}

function filamentModel(spec: LampSpec): FilamentModel {
  const hot = ROOM_KELVIN * (spec.volts / spec.amps / spec.coldOhms) ** (1 / TUNGSTEN_EXPONENT);
  const k = (spec.volts * spec.amps) / (hot ** 4 - ROOM_KELVIN ** 4);
  return { cold: spec.coldOhms, k, hot, capacity: spec.tauS * 4 * k * hot ** 3 };
}

const ohmsAt = (m: FilamentModel, kelvin: number): number =>
  m.cold * (kelvin / ROOM_KELVIN) ** TUNGSTEN_EXPONENT;

const ROOM4 = ROOM_KELVIN ** 4;

/** (a·T − base + K·(T⁴ − T0⁴))·R(T) − V²: below zero the filament at T is too cold for the balance. */
const excessAt = (m: FilamentModel, t: number, a: number, base: number, square: number): number =>
  (a * t - base + m.k * (t ** 4 - ROOM4)) * ohmsAt(m, t) - square;

/** The derivative of `excessAt` in T. */
const slopeAt = (m: FilamentModel, t: number, a: number, base: number, r: number): number =>
  (a + 4 * m.k * t ** 3) * r + ((a * t - base + m.k * (t ** 4 - ROOM4)) * TUNGSTEN_EXPONENT * r) / t;

/** The temperature that balances the filament's heat at V² = `square`, from the temperature `guess`: the steady
 * filament for a = base = 0, the end of a step otherwise. Never below the room: a filament that would cool past it
 * (only a trapezoid step far longer than the filament's time constant could ask that) stays at the room. */
function balanceKelvin(m: FilamentModel, square: number, a: number, base: number, guess: number): number {
  if (excessAt(m, ROOM_KELVIN, a, base, square) >= 0) return ROOM_KELVIN;
  // a bracket: the room is too cold; double the hot temperature until it is too hot
  let low = ROOM_KELVIN;
  let high = m.hot;
  while (excessAt(m, high, a, base, square) < 0) {
    low = high;
    high *= 2;
  }
  let t = guess > low && guess < high ? guess : (low + high) / 2;
  for (let k = 0; k < 100; k++) {
    const r = ohmsAt(m, t);
    const f = (a * t - base + m.k * (t ** 4 - ROOM4)) * r - square;
    if (f < 0) low = t;
    else high = t;
    let next = t - f / slopeAt(m, t, a, base, r);
    if (!(next > low && next < high)) next = (low + high) / 2;
    const done = Math.abs(next - t) <= 1e-14 * t;
    t = next;
    if (done) break;
  }
  return t;
}

/** The filament at `volts` and the slope of its current (S) into `out`: steady for a = base = 0, at the end of a
 * step otherwise. */
function balance(
  m: FilamentModel,
  volts: number,
  a: number,
  base: number,
  guess: number,
  out: Filament & { g: number },
): void {
  const kelvin = balanceKelvin(m, volts * volts, a, base, guess);
  const ohms = ohmsAt(m, kelvin);
  // dI/dV = 1/R − V·R′(T)·(dT/dV)/R², where dT/dV = 2V / (d/dT of the balance's left side)
  const dr = (TUNGSTEN_EXPONENT * ohms) / kelvin;
  out.kelvin = kelvin;
  out.ohms = ohms;
  out.amps = volts / ohms;
  out.watts = (volts * volts) / ohms;
  out.g = 1 / ohms - (volts * dr * ((2 * volts) / slopeAt(m, kelvin, a, base, ohms))) / (ohms * ohms);
}

/** The steady filament of the lamp `spec` at the voltage `volts` across it: what a stand needs for its glow. */
export function filament(spec: LampSpec, volts: number): Filament {
  const out = { kelvin: 0, ohms: 0, amps: 0, watts: 0, g: 0 };
  const m = filamentModel(spec);
  balance(m, volts, 0, 0, m.hot, out);
  return { kelvin: out.kelvin, ohms: out.ohms, amps: out.amps, watts: out.watts };
}

/** The heat capacity of the lamp's filament (J/K): τ·4·K·T_hot³. */
export function filamentCapacity(spec: LampSpec): number {
  return filamentModel(spec).capacity;
}

const ONE_LINK: readonly Link[] = [[0, 1]];

/**
 * The lamp in the matrix: the filament linearized around the guess — steady at the operating point, at the end of the
 * step in time. Its memory is the last temperature it found (the guess of the next); its history is the temperature
 * at the last moment and the heat it was gaining then (W).
 */
export function lampBehaviour(spec: LampSpec): Behaviour {
  const m = filamentModel(spec);
  const out = { kelvin: 0, ohms: 0, amps: 0, watts: 0, g: 0 };
  /** The filament at `volts` for the moment of `op`. */
  const at = (place: Placement, volts: number, op: Operating): void => {
    const a = op.dt > 0 ? ((op.trapezoid ? 2 : 1) * m.capacity) / op.dt : 0;
    const base = op.dt > 0 ? a * place.history[0]! + (op.trapezoid ? place.history[1]! : 0) : 0;
    balance(m, volts, a, base, place.memory[0]!, out);
  };
  const across = (place: Placement, v: Float64Array): number => v[place.nodes[0]!]! - v[place.nodes[1]!]!;
  return {
    branches: 0,
    inner: 0,
    memory: 1,
    history: 2,
    nonlinear: true,
    source: false,
    setting: () => 0,
    links: () => ONE_LINK,
    wire: () => false,
    start: (place) => {
      place.memory[0] = m.hot;
    },
    stamp: (_, place, s, op) => {
      const a = place.nodes[0]!;
      const b = place.nodes[1]!;
      const u = op.v[a]! - op.v[b]!;
      at(place, u, op);
      place.memory[0] = out.kelvin;
      s.conductance(a, b, out.g);
      s.current(a, b, out.amps - out.g * u);
    },
    currents: (_, place, v, __, pins, op) => {
      at(place, across(place, v), op);
      pins[0] = out.amps;
      pins[1] = -pins[0];
    },
    settle: (_, place, v, op) => {
      at(place, across(place, v), op);
      place.history[0] = out.kelvin;
      place.history[1] = 0;
    },
    accept: (_, place, v, op) => {
      at(place, across(place, v), op);
      place.memory[0] = out.kelvin;
      place.history[0] = out.kelvin;
      place.history[1] = out.watts - m.k * (out.kelvin ** 4 - ROOM4);
    },
  };
}
