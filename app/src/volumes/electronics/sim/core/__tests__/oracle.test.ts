/**
 * The model against its independent reference: every sample of tools/ref-models/electronics/spice.py is a netlist
 * that ngspice solved. The model solves the very same netlist, and its node voltages and part readings must agree.
 * The samples are written by the script (ngspice runs on the developer's machine only); `spice.py --check` tells
 * whether they are fresh.
 */
import { describe, expect, it } from 'vitest';
import { solveDC, type Netlist, type PartReading } from '../index';

interface OperatingPoint {
  analysis: 'op';
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
const RELATIVE = 1e-6;
// …and near zero: a current through 1 mΩ is a difference of two voltages over 1 mΩ, and one unit in the last place
// of 9 V there is 1.8e-12 A (both ngspice and the model compute it so)
const FLOOR = 1e-11;

function agrees(model: number | undefined, spice: number, what: string): void {
  expect(model, what).toBeTypeOf('number');
  expect(Math.abs(model! - spice), `${what}: the model ${model}, ngspice ${spice}`).toBeLessThanOrEqual(
    RELATIVE * Math.abs(spice) + FLOOR,
  );
}

describe('oracle: the model against ngspice', () => {
  it('every sample on disk is one this test compares', () => {
    expect([...samples.keys()].sort()).toEqual(LINEAR);
    for (const [name, sample] of samples) {
      expect(sample.case).toBe(name);
      expect(sample.analysis).toBe('op');
    }
  });

  it.each(LINEAR)('%s: node voltages and part readings within 1e-6', (name) => {
    const sample = samples.get(name)!;
    const dc = solveDC(structuredClone(sample.netlist));
    expect(dc.ok).toBe(true);
    expect(dc.issues).toEqual([]);
    expect(dc.v).toHaveLength(sample.v.length);
    sample.v.forEach((spice, node) => agrees(dc.v[node], spice, `v(${node})`));
    expect(Object.keys(dc.parts).sort()).toEqual(Object.keys(sample.parts).sort());
    for (const [id, spice] of Object.entries(sample.parts)) {
      agrees(dc.parts[id]!.u, spice.u, `${id}.u`);
      agrees(dc.parts[id]!.i, spice.i, `${id}.i`);
      agrees(dc.parts[id]!.p, spice.p, `${id}.p`);
    }
  });
});
