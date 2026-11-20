/**
 * A capacitor: its capacitance C behind its equivalent series resistance (ESR) — from the first pin to a node of its
 * own, and the capacitance from there to the second pin — with a leak across the capacitance that carries its
 * leakage current. At the operating point the capacitance is open: what flows is the leak. In time the capacitance is
 * replaced, for one step h, by its companion: a conductance and a current from its history (the voltage across it and
 * the current through it at the last moment),
 *   backward Euler:  i = (C/h)·(v − v_last)
 *   trapezoid:       i = (2C/h)·(v − v_last) − i_last
 * An electrolytic one over its limits bulges (`limits.ts`): its capacitance is gone, and from its first pin to its
 * second it is a leak of BULGED_OHMS. Numbers and sources: README.md, «Capacitors».
 */
import type { Behaviour, CapacitorSpec, Link } from './parts';

/** What is left of an electrolytic capacitor that bulged: no capacitance, a leak of 1 kΩ (the decision of E1-5). */
export const BULGED_OHMS = 1e3;

const ONE_LINK: readonly Link[] = [[0, 1]];

/** The capacitor in the matrix. Its history: [the voltage across its capacitance, the current through it]. */
export function capacitorBehaviour(spec: CapacitorSpec): Behaviour {
  const esr = 1 / spec.esrOhms;
  const leak = 1 / spec.leakOhms;
  const bulged = 1 / BULGED_OHMS;
  const farads = spec.farads;
  return {
    branches: 0,
    inner: 1,
    memory: 0,
    history: 2,
    nonlinear: false,
    source: false,
    setting: () => 0,
    // the leak is a path for direct current: a charged capacitor never leaves a node in the air
    links: () => ONE_LINK,
    wire: () => false,
    stamp: (_, at, s, op) => {
      const a = at.nodes[0]!;
      const b = at.nodes[1]!;
      const inside = at.inner[0]!;
      s.conductance(a, inside, esr);
      s.conductance(inside, b, leak);
      if (op.dt > 0) {
        const g = ((op.trapezoid ? 2 : 1) * farads) / op.dt;
        s.conductance(inside, b, g);
        // the rest of the companion's current from the inner node to b: −(g·v_last + i_last)
        s.current(inside, b, -(g * at.history[0]! + (op.trapezoid ? at.history[1]! : 0)));
      }
    },
    // what flows through the ESR flows on through the leak and the capacitance: read as their sum, as SPICE reads a
    // capacitor, it keeps its precision where the ESR's drop would be a difference of two nearly equal voltages
    currents: (_, at, v, __, out, op) => {
      const across = v[at.inner[0]!]! - v[at.nodes[1]!]!;
      out[0] = across * leak;
      if (op.dt > 0) {
        const g = ((op.trapezoid ? 2 : 1) * farads) / op.dt;
        out[0] += g * (across - at.history[0]!) - (op.trapezoid ? at.history[1]! : 0);
      }
      out[1] = -out[0];
    },
    settle: (_, at, v) => {
      at.history[0] = v[at.inner[0]!]! - v[at.nodes[1]!]!;
      at.history[1] = 0;
    },
    accept: (_, at, v, op) => {
      const now = v[at.inner[0]!]! - v[at.nodes[1]!]!;
      const g = ((op.trapezoid ? 2 : 1) * farads) / op.dt;
      at.history[1] = g * (now - at.history[0]!) - (op.trapezoid ? at.history[1]! : 0);
      at.history[0] = now;
    },
    failed: spec.polar
      ? {
          stamp: (at, s) => {
            s.conductance(at.nodes[0]!, at.nodes[1]!, bulged);
            s.conductance(at.inner[0]!, at.nodes[0]!, 1); // the inner node follows the first pin and carries nothing
          },
          currents: (at, v, out) => {
            out[0] = (v[at.nodes[0]!]! - v[at.nodes[1]!]!) * bulged;
            out[1] = -out[0];
          },
        }
      : undefined,
  };
}
