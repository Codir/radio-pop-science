/**
 * The bipolar transistor: the transport form of Ebers–Moll with the Early effect — the DC part of SPICE's Gummel–Poon
 * model with IS, BF, BR and VAF alone (NF = NR = 1; no series resistances, no high injection, no recombination
 * currents, no capacitances), at 27 °C, written after ngspice-42 (`bjtload.c`, `bjttemp.c`, `devsup.c`) so that the
 * model and its oracle solve the same equations.
 *
 * In the frame of an NPN, with Vbe and Vbc the voltages of its two junctions, each junction takes
 *   Ibe = IS·(e^(Vbe/Vt) − 1),  Ibc = IS·(e^(Vbc/Vt) − 1)   (SPICE's cubic below −3·Vt, as a diode's)
 * and the transistor
 *   Ic = (Ibe − Ibc)·(1 − Vbc/VAF) − Ibc/BR − GMIN·Vbc
 *   Ib = Ibe/BF + Ibc/BR + GMIN·(Vbe + Vbc)
 * — the transport current from the collector to the emitter, which the Early effect makes grow with Vcb, and the base
 * currents of both junctions, with SPICE's GMIN across each. A PNP is the same with every voltage and current
 * reversed. Newton's iterations limit the step of both junction voltages as ngspice does (`pnjlim` with Vt and
 * Vcrit = Vt·ln(Vt / (√2·IS))). Numbers and sources: README.md, «Transistors».
 */
import { GMIN, pnjlim, THERMAL_VOLTAGE } from './diode';
import type { Behaviour, Link, TransistorParams, TransistorSpec } from './parts';

// Every iteration of every moment reads these: read here once, since under the test runner (vitest) each read of an
// import is a lookup that the speed of the transient would carry (README.md, «Speed»).
const VT = THERMAL_VOLTAGE;
const G = GMIN;
const limit = pnjlim;

/** A transistor at its junction voltages, in the frame of an NPN: its currents and their slopes. */
export interface TransistorPoint {
  /** The current into the collector (A). */
  ic: number;
  /** The current into the base (A). */
  ib: number;
  /** ∂Ic/∂Vbe (S). */
  icVbe: number;
  /** ∂Ic/∂Vbc (S). */
  icVbc: number;
  /** ∂Ib/∂Vbe (S). */
  ibVbe: number;
  /** ∂Ib/∂Vbc (S). */
  ibVbc: number;
}

/** The voltage above which a step of a junction is limited: Vt·ln(Vt / (√2·IS)) (V), as ngspice's `BJTtVcrit`. */
export function transistorVcrit(p: TransistorParams): number {
  return VT * Math.log(VT / (Math.SQRT2 * p.is));
}

/** One junction without GMIN at `v`: SPICE's exponential IS·(e^(v/Vt) − 1), and its cubic below −3·Vt. */
function junctionCurrent(is: number, v: number): number {
  const vt = VT;
  return v >= -3 * vt ? is * Math.expm1(v / vt) : -is * (1 + ((3 * vt) / (v * Math.E)) ** 3);
}

/** The slope of `junctionCurrent` at `v` (S). */
function junctionSlope(is: number, v: number): number {
  const vt = VT;
  if (v >= -3 * vt) return (is * Math.exp(v / vt)) / vt;
  const cubic = ((3 * vt) / (v * Math.E)) ** 3;
  return (is * 3 * cubic) / v;
}

/** The currents of the transistor `p` and their slopes at the junction voltages `vbe`, `vbc` (the frame of an NPN)
 * into `out`. */
export function transistorAt(p: TransistorParams, vbe: number, vbc: number, out: TransistorPoint): void {
  const early = p.vaf > 0 && Number.isFinite(p.vaf) ? 1 / p.vaf : 0;
  const ibe = junctionCurrent(p.is, vbe);
  const gbe = junctionSlope(p.is, vbe);
  const ibc = junctionCurrent(p.is, vbc);
  const gbc = junctionSlope(p.is, vbc);
  const share = 1 - vbc * early; // 1/qb of SPICE: the Early effect on the transport current
  out.ic = (ibe - ibc) * share - ibc / p.br - G * vbc;
  out.ib = ibe / p.bf + ibc / p.br + G * (vbe + vbc);
  out.icVbe = gbe * share;
  out.icVbc = -gbc * share - (ibe - ibc) * early - gbc / p.br - G;
  out.ibVbe = gbe / p.bf + G;
  out.ibVbc = gbc / p.br + G;
}

/** Pins 0 (collector) and 2 (emitter) each meet pin 1 (the base) in a junction: both are paths for direct current. */
const JUNCTIONS: readonly Link[] = [
  [0, 1],
  [1, 2],
];

/**
 * A transistor in the matrix. It adds no unknowns of its own; its memory is the two junction voltages it linearized
 * at last (the frame of an NPN). Its stamp is the linearization of the currents into its collector and its base
 * around the guess: from the collector to the emitter, the collector current; from the base to the emitter, the base
 * current — each its slopes as transconductances controlled by Vbe and Vbc and a current that makes up the rest.
 */
export function transistorBehaviour(spec: TransistorSpec): Behaviour {
  const sign = spec.polarity === 'npn' ? 1 : -1;
  const vcrit = transistorVcrit(spec);
  const vt = VT;
  const at: TransistorPoint = { ic: 0, ib: 0, icVbe: 0, icVbc: 0, ibVbe: 0, ibVbc: 0 };
  return {
    branches: 0,
    inner: 0,
    memory: 2,
    history: 0,
    nonlinear: true,
    source: false,
    setting: () => 0,
    links: () => JUNCTIONS,
    wire: () => false,
    start: (place) => {
      // SPICE starts the base–emitter junction at its knee of conduction and the base–collector one at 0 V
      place.memory[0] = vcrit;
      place.memory[1] = 0;
    },
    stamp: (_, place, s, op) => {
      const c = place.nodes[0]!;
      const b = place.nodes[1]!;
      const e = place.nodes[2]!;
      let vbe = place.memory[0]!;
      let vbc = place.memory[1]!;
      if (!op.initial) {
        const guessBe = sign * (op.v[b]! - op.v[e]!);
        const guessBc = sign * (op.v[b]! - op.v[c]!);
        vbe = limit(guessBe, vbe, vt, vcrit);
        vbc = limit(guessBc, vbc, vt, vcrit);
        if (vbe !== guessBe || vbc !== guessBc) op.limited = true;
      }
      place.memory[0] = vbe;
      place.memory[1] = vbc;
      transistorAt(spec, vbe, vbc, at);
      // in node voltages: i_c = sign·Ic(vbe, vbc) with vbe = sign·(v_b − v_e), vbc = sign·(v_b − v_c); the slopes
      // come out without the sign (sign² = 1), the constant parts with it
      s.transconductance(c, e, b, e, at.icVbe);
      s.transconductance(c, e, b, c, at.icVbc);
      s.current(c, e, sign * (at.ic - at.icVbe * vbe - at.icVbc * vbc));
      s.transconductance(b, e, b, e, at.ibVbe);
      s.transconductance(b, e, b, c, at.ibVbc);
      s.current(b, e, sign * (at.ib - at.ibVbe * vbe - at.ibVbc * vbc));
    },
    currents: (_, place, v, __, pins) => {
      const vb = v[place.nodes[1]!]!;
      transistorAt(spec, sign * (vb - v[place.nodes[2]!]!), sign * (vb - v[place.nodes[0]!]!), at);
      pins[0] = sign * at.ic;
      pins[1] = sign * at.ib;
      pins[2] = -(pins[0] + pins[1]);
    },
  };
}
