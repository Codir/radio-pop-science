/**
 * The model against its independent reference: every sample of tools/ref-models/electronics/spice.py is a netlist
 * that ngspice solved. At the operating point (here) the model solves the very same netlist, and its node voltages
 * and part readings must agree; the samples in time and for a sine are compared in transient.test.ts. The samples
 * are written by the script (ngspice runs on the developer's machine only); `spice.py --check` tells whether they
 * are fresh.
 */
import { describe, expect, it } from 'vitest';
import { solveDC, type Netlist, type PartReading } from '../index';

interface OperatingPoint {
  analysis: 'op' | 'tran' | 'ac';
  case: string;
  netlist: Netlist;
  spice: string[];
  v: number[];
  parts: Record<string, PartReading>;
}

const files = import.meta.glob<OperatingPoint>('../__fixtures__/*.json', { eager: true, import: 'default' });
const samples = new Map(
  Object.entries(files).map(([path, sample]) => [path.replace(/^.*\/(.*)\.json$/, '$1'), sample]),
);

/** The linear circuits of E1-3: one solve of the matrix on both sides, so they agree to rounding. */
const LINEAR = ['battery-load', 'divider', 'grid', 'pot-ccw', 'pot-cw', 'pot-mid', 'speaker-switch'];
/** The circuits with diodes and LEDs of E1-4 and with transistors of E1-6: Newton's iterations on both sides, each
 * to its own tolerance. */
const NONLINEAR = [
  'diode-forward',
  'diode-reverse',
  'led-blue',
  'led-green',
  'led-red',
  'led-white',
  'led-yellow',
  'transistor-bias',
  'transistor-switch',
  'amplifier-op',
];
/** The circuits of E1-5 in time (`tran`) and for a sine (`ac`): transient.test.ts compares them. */
const IN_TIME = {
  'rc-charge': 'tran',
  'rc-discharge': 'tran',
  'led-discharge': 'tran',
  rectifier: 'tran',
  filters: 'ac',
};
/** The amplifier of E1-6 playing its tone (`tran`) and with its battery the wrong way round, where every node behind
 * the protection diode is a rounding of next to nothing: amplifier.test.ts compares them. */
const AMPLIFIER = {
  'amplifier-off': 'tran',
  'amplifier-reversed': 'op',
  'amplifier-v10': 'tran',
  'amplifier-v50': 'tran',
  'amplifier-v80': 'tran',
  'amplifier-v90': 'tran',
  'amplifier-v95': 'tran',
  'amplifier-v100': 'tran',
};
/** The plan: 1e-6 of the size for the linear circuits, 1e-3 for the nonlinear ones. */
const RELATIVE = { linear: 1e-6, nonlinear: 1e-3 };
/** Newton's iterations of the model on any sample, at most (the plan). */
const ITERATIONS = 50;

/**
 * Relative alone, with no absolute allowance: the smallest numbers of the samples (the load at the end of a pot's
 * track takes 1.7e-16 W, a reversed LED lets 9 pA through) are held to their share of themselves like the rest. An
 * exact zero of ngspice (the ground, a part behind an open switch) therefore demands an exact zero of the model:
 * nothing drives that row on either side.
 */
function agrees(model: number | undefined, spice: number, relative: number, what: string): void {
  expect(model, what).toBeTypeOf('number');
  expect(Math.abs(model! - spice), `${what}: the model ${model}, ngspice ${spice}`).toBeLessThanOrEqual(
    relative * Math.abs(spice),
  );
}

function compare(name: string, relative: number): void {
  const sample = samples.get(name)!;
  const dc = solveDC(structuredClone(sample.netlist));
  expect(dc.ok).toBe(true);
  expect(dc.issues).toEqual([]);
  expect(dc.iterations).toBeLessThanOrEqual(ITERATIONS);
  expect(dc.sourceSteps).toBe(0);
  expect(dc.v).toHaveLength(sample.v.length);
  sample.v.forEach((spice, node) => agrees(dc.v[node], spice, relative, `v(${node})`));
  expect(Object.keys(dc.parts).sort()).toEqual(Object.keys(sample.parts).sort());
  for (const [id, spice] of Object.entries(sample.parts)) {
    agrees(dc.parts[id]!.u, spice.u, relative, `${id}.u`);
    agrees(dc.parts[id]!.i, spice.i, relative, `${id}.i`);
    agrees(dc.parts[id]!.p, spice.p, relative, `${id}.p`);
  }
}

describe('oracle: the model against ngspice', () => {
  it('every sample on disk is one this test, transient.test.ts or amplifier.test.ts compares', () => {
    expect([...samples.keys()].sort()).toEqual(
      [...LINEAR, ...NONLINEAR, ...Object.keys(IN_TIME), ...Object.keys(AMPLIFIER)].sort(),
    );
    for (const [name, sample] of samples) {
      expect(sample.case).toBe(name);
      expect(sample.analysis).toBe(
        IN_TIME[name as keyof typeof IN_TIME] ?? AMPLIFIER[name as keyof typeof AMPLIFIER] ?? 'op',
      );
    }
  });

  it.each(LINEAR)('%s: node voltages and part readings within 1e-6', (name) => {
    compare(name, RELATIVE.linear);
    expect(solveDC(structuredClone(samples.get(name)!.netlist)).iterations).toBe(1);
  });

  it.each(NONLINEAR)('%s: node voltages and part readings within 1e-3, in at most 50 iterations', (name) => {
    compare(name, RELATIVE.nonlinear);
  });
});
