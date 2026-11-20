/**
 * The matrix part of the model: the dense LU with partial pivoting, its verdict on singular matrices, and the stamps
 * the parts leave in a compiled circuit (which unknown is which, the signs of a source).
 */
import { describe, expect, it } from 'vitest';
import {
  assemble,
  compile,
  createSystem,
  factor,
  PIVOT_MIN,
  readSettings,
  solveFactored,
  type LinearSystem,
} from '../mna';
import type { Netlist } from '../netlist';

/** Fills the system with the rows of `rows` and the right side `b`. */
function fill(system: LinearSystem, rows: readonly (readonly number[])[], b: readonly number[]): void {
  rows.forEach((row, r) => row.forEach((value, c) => (system.a[r * system.n + c] = value)));
  system.b.set(b);
}

/** A small deterministic generator for the tests (a linear congruential one), numbers in [−1, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

/** The largest |A·x − b| of a system before factoring, from copies of A and b. */
function residual(a: Float64Array, b: Float64Array, x: Float64Array, n: number): number {
  let worst = 0;
  for (let r = 0; r < n; r++) {
    let sum = -b[r]!;
    for (let c = 0; c < n; c++) sum += a[r * n + c]! * x[c]!;
    worst = Math.max(worst, Math.abs(sum));
  }
  return worst;
}

describe('dense LU with partial pivoting', () => {
  it('solves a system that needs its rows exchanged', () => {
    // a zero on the diagonal: without pivoting the first step divides by 0
    const system = createSystem(3);
    fill(
      system,
      [
        [0, 2, 1],
        [1, 1, 1],
        [2, 1, 0],
      ],
      [7, 6, 4], // x = (1, 2, 3)
    );
    expect(factor(system)).toBe(true);
    solveFactored(system);
    for (const [k, want] of [1, 2, 3].entries()) expect(Math.abs(system.x[k]! - want)).toBeLessThan(1e-14);
  });

  it('solves deterministic random systems of 1 to 40 unknowns to rounding', () => {
    const random = lcg(2026);
    for (let n = 1; n <= 40; n++) {
      for (const dominant of [true, false]) {
        const system = createSystem(n);
        for (let k = 0; k < n * n; k++) system.a[k] = random() + (dominant && k % (n + 1) === 0 ? n : 0);
        for (let k = 0; k < n; k++) system.b[k] = random();
        const a = system.a.slice();
        const b = system.b.slice();
        expect(factor(system), `n ${n}`).toBe(true);
        solveFactored(system);
        expect(residual(a, b, system.x, n), `n ${n}, dominant ${dominant}`).toBeLessThan(1e-11);
      }
    }
  });

  it('calls a singular matrix singular instead of dividing by nothing', () => {
    const cases: readonly (readonly (readonly number[])[])[] = [
      [
        [1, 0],
        [0, 0],
      ], // a node nothing reaches
      [
        [1, 1],
        [1, 1],
      ], // two equal rows: two ideal sources side by side
      [
        [0, 0],
        [0, 0],
      ],
      [
        [1, 2],
        [Number.NaN, 1],
      ], // a broken number never passes for a pivot
    ];
    for (const rows of cases) {
      const system = createSystem(2);
      fill(system, rows, [1, 1]);
      expect(factor(system), JSON.stringify(rows)).toBe(false);
    }
  });

  it('takes a pivot down to the 1e-13 of SPICE and no smaller', () => {
    expect(PIVOT_MIN).toBe(1e-13);
    const small = createSystem(1);
    fill(small, [[1e-12]], [1e-12]); // a 1 TΩ resistor to ground: still a part of the circuit
    expect(factor(small)).toBe(true);
    solveFactored(small);
    expect(small.x[0]).toBeCloseTo(1, 12);
    const tiny = createSystem(1);
    fill(tiny, [[1e-14]], [1]);
    expect(factor(tiny)).toBe(false);
  });

  it('an empty system is solved at once; a refilled one is solved again in the same arrays', () => {
    const empty = createSystem(0);
    expect(factor(empty)).toBe(true);
    solveFactored(empty);
    const system = createSystem(2);
    const arrays = [system.a, system.b, system.x, system.perm];
    for (const scale of [1, 3]) {
      system.a.fill(0);
      fill(
        system,
        [
          [2 * scale, 1],
          [1, 3],
        ],
        [1, 2],
      );
      expect(factor(system)).toBe(true);
      solveFactored(system);
      const det = 6 * scale - 1;
      expect(system.x[0]).toBeCloseTo((3 - 2) / det, 14);
      expect(system.x[1]).toBeCloseTo((4 * scale - 1) / det, 14);
    }
    arrays.forEach((array, k) => expect([system.a, system.b, system.x, system.perm][k]).toBe(array));
  });
});

describe('stamps of a compiled circuit', () => {
  it('numbers the nodes in use, then the currents of the sources, and leaves the stamps of SPICE', () => {
    // 9 V on node 1, 1 kΩ from 1 to 2, 2 kΩ from 2 to ground; nodes 3 and 4 are rows nobody uses
    const net: Netlist = {
      nodes: 5,
      parts: [
        { id: 'R1', spec: 'resistor-1k', pins: [1, 2] },
        { id: 'V1', spec: 'ideal-9v', pins: [1, 0] },
        { id: 'R2', spec: 'resistor-2k', pins: [2, 0] },
      ],
    };
    const circuit = compile(net);
    expect([...circuit.index]).toEqual([-1, 0, 1, -1, -1]);
    expect(circuit.elements.map((e) => e.branch)).toEqual([-1, 2, -1]);
    expect(circuit.system.n).toBe(3);
    assemble(circuit, readSettings(circuit), []);
    const { a, b } = circuit.system;
    // node rows: the sum of the currents that leave the node through the parts; the source's row: v1 − v0 = 9
    expect([...a]).toEqual([1e-3, -1e-3, 1, -1e-3, 1e-3 + 5e-4, 0, 1, 0, 0]);
    expect([...b]).toEqual([0, 0, 9]);
  });

  it('a battery is a conductance with a current source; a tie holds a node to ground', () => {
    const circuit = compile({ nodes: 3, parts: [{ id: 'B', spec: 'battery-9v', pins: [2, 1] }] });
    expect([...circuit.index]).toEqual([-1, 0, 1]);
    assemble(circuit, readSettings(circuit), [1]);
    const g = 1 / 1.5;
    // plus is node 2, minus node 1: inside the battery the current flows from minus to plus
    expect([...circuit.system.a]).toEqual([g + 1e-9, -g, -g, g]);
    expect([...circuit.system.b]).toEqual([-9 / 1.5, 9 / 1.5]);
  });
});
