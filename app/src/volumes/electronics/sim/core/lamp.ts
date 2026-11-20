/**
 * The incandescent lamp: a tungsten filament whose resistance grows with its temperature, R(T) = R0·(T / T0)^α with
 * α = 1.21 (tungsten from 300 to 3000 K), and which loses its heat by radiation, K·(T⁴ − T0⁴). The lamp's numbers fix
 * both: at its rated voltage it takes its rated current, so the hot filament has V/I ohms at the temperature T_hot
 * where R(T_hot) is that, and K is the rated power over T_hot⁴ − T0⁴.
 *
 * At the operating point the filament is steady: the power V²/R(T) it takes is what it radiates. For a voltage this
 * gives one temperature (found by Newton's method, held by bisection), and so the lamp's current and its slope —
 * the steady lamp is a nonlinear resistor that Newton's iterations of the circuit linearize like a diode. In time
 * (E1-5) the filament warms with its thermal time constant instead. Numbers and sources: README.md, «The lamp».
 */
import { ROOM_KELVIN } from './diode';
import type { Behaviour, LampSpec, Link } from './parts';

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
}

function filamentModel(spec: LampSpec): FilamentModel {
  const hot = ROOM_KELVIN * (spec.volts / spec.amps / spec.coldOhms) ** (1 / TUNGSTEN_EXPONENT);
  return { cold: spec.coldOhms, k: (spec.volts * spec.amps) / (hot ** 4 - ROOM_KELVIN ** 4), hot };
}

const ohmsAt = (m: FilamentModel, kelvin: number): number =>
  m.cold * (kelvin / ROOM_KELVIN) ** TUNGSTEN_EXPONENT;

/** The steady temperature at the voltage `volts`, from the temperature `guess`: K·(T⁴ − T0⁴)·R(T) = V². */
function steadyKelvin(m: FilamentModel, volts: number, guess: number): number {
  const square = volts * volts;
  if (square === 0) return ROOM_KELVIN;
  const t0 = ROOM_KELVIN ** 4;
  const excess = (t: number): number => m.k * (t ** 4 - t0) * ohmsAt(m, t) - square;
  // a bracket: the room is too cold for any voltage; double the hot temperature until it is too hot
  let low = ROOM_KELVIN;
  let high = m.hot;
  while (excess(high) < 0) {
    low = high;
    high *= 2;
  }
  let t = guess > low && guess < high ? guess : (low + high) / 2;
  for (let k = 0; k < 100; k++) {
    const r = ohmsAt(m, t);
    const f = m.k * (t ** 4 - t0) * r - square;
    if (f < 0) low = t;
    else high = t;
    const slope = 4 * m.k * t ** 3 * r + (m.k * (t ** 4 - t0) * TUNGSTEN_EXPONENT * r) / t;
    let next = t - f / slope;
    if (!(next > low && next < high)) next = (low + high) / 2;
    const done = Math.abs(next - t) <= 1e-14 * t;
    t = next;
    if (done) break;
  }
  return t;
}

/** The steady filament at `volts` and the slope of its current (S) into `out`. */
function steady(m: FilamentModel, volts: number, guess: number, out: Filament & { g: number }): void {
  const kelvin = steadyKelvin(m, Math.abs(volts), guess);
  const ohms = ohmsAt(m, kelvin);
  // dI/dV = 1/R − V·R′(T)·(dT/dV)/R², where dT/dV = 2V / (d/dT of K·(T⁴ − T0⁴)·R(T))
  const dr = (TUNGSTEN_EXPONENT * ohms) / kelvin;
  const slope = 4 * m.k * kelvin ** 3 * ohms + m.k * (kelvin ** 4 - ROOM_KELVIN ** 4) * dr;
  out.kelvin = kelvin;
  out.ohms = ohms;
  out.amps = volts / ohms;
  out.watts = (volts * volts) / ohms;
  out.g = 1 / ohms - (volts * dr * ((2 * volts) / slope)) / (ohms * ohms);
}

/** The steady filament of the lamp `spec` at the voltage `volts` across it: what a stand needs for its glow. */
export function filament(spec: LampSpec, volts: number): Filament {
  const out = { kelvin: 0, ohms: 0, amps: 0, watts: 0, g: 0 };
  const m = filamentModel(spec);
  steady(m, volts, m.hot, out);
  return { kelvin: out.kelvin, ohms: out.ohms, amps: out.amps, watts: out.watts };
}

const ONE_LINK: readonly Link[] = [[0, 1]];

/** The lamp in the matrix: the steady filament linearized around the guess; its memory is the last temperature. */
export function lampBehaviour(spec: LampSpec): Behaviour {
  const m = filamentModel(spec);
  const out = { kelvin: 0, ohms: 0, amps: 0, watts: 0, g: 0 };
  return {
    branches: 0,
    inner: 0,
    memory: 1,
    nonlinear: true,
    source: false,
    setting: () => 0,
    links: () => ONE_LINK,
    wire: () => false,
    start: (at) => {
      at.memory[0] = m.hot;
    },
    stamp: (_, at, s, op) => {
      const a = at.nodes[0]!;
      const b = at.nodes[1]!;
      const u = op.v[a]! - op.v[b]!;
      steady(m, u, at.memory[0]!, out);
      at.memory[0] = out.kelvin;
      s.conductance(a, b, out.g);
      s.current(a, b, out.amps - out.g * u);
    },
    currents: (_, at, v, __, pins) => {
      steady(m, v[at.nodes[0]!]! - v[at.nodes[1]!]!, at.memory[0]!, out);
      pins[0] = out.amps;
      pins[1] = -pins[0];
    },
  };
}
