/**
 * What the model says about the shape of a circuit besides its numbers: an open loop, a source shorted by a wire, a
 * part with a pin in the air, and nodes without a path to the ground — which the model ties itself and goes on.
 */
import { describe, expect, it } from 'vitest';
import { solveDC, TIE_OHMS, type Netlist, type PartInstance } from '../index';

const part = (id: string, spec: string, pins: number[], setting?: number): PartInstance =>
  setting === undefined ? { id, spec, pins } : { id, spec, pins, setting };
const net = (nodes: number, ...parts: PartInstance[]): Netlist => ({ nodes, parts });

function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

describe('the topology of a circuit', () => {
  it('a broken loop: no current, the problem «open»', () => {
    // 9 V → R1 → row 2 … a gap … row 3 → R2 → ground: the ends of the gap are pins nothing else touches
    const gap = solveDC(
      net(
        4,
        part('B', 'battery-9v', [1, 0]),
        part('R1', 'resistor-1k', [1, 2]),
        part('R2', 'resistor-1k', [3, 0]),
      ),
    );
    expect(gap.ok).toBe(true);
    expect(gap.issues).toEqual([
      { kind: 'open', part: 'B' },
      { kind: 'floating', part: 'R1', pins: ['b'] },
      { kind: 'floating', part: 'R2', pins: ['a'] },
    ]);
    // zero to rounding: the battery's current is (v − 9 V)/1.5 Ω, and one unit in the last place of 9 V is 1.8e-15 V
    for (const id of ['B', 'R1', 'R2']) close(gap.parts[id]!.i, 0, 1e-14, id);
    close(gap.v[2], 9, 1e-9, 'the free end of R1 shows the battery');

    // the same loop broken by an open switch: nothing in the air, only the open loop
    const loop = (setting: number): Netlist =>
      net(
        3,
        part('B', 'battery-9v', [1, 0]),
        part('S', 'switch', [1, 2], setting),
        part('R', 'resistor-1k', [2, 0]),
      );
    const open = solveDC(loop(0));
    expect(open.issues).toEqual([{ kind: 'open', part: 'B' }]);
    close(open.parts.R!.i, 0, 1e-14, 'open');
    expect(solveDC(loop(1)).issues).toEqual([]);
  });

  it('a jumper across the battery: the current E / r, the problem «short»', () => {
    const shorted = solveDC(net(2, part('B', 'battery-9v', [1, 0]), part('J', 'jumper', [1, 0])));
    expect(shorted.ok).toBe(true);
    expect(shorted.issues).toEqual([{ kind: 'short', part: 'B' }]);
    // only the battery's own 1.5 Ω (and the jumper's 1 mΩ) hold the current: E / r within 0.07 %
    close(shorted.parts.J!.i, 9 / (1.5 + 1e-3), 1e-12, 'with the jumper');
    close(shorted.parts.J!.i, 9 / 1.5, 0.0007 * 6, 'E / r');
    close(shorted.parts.B!.i, -shorted.parts.J!.i, 1e-12, 'the battery gives it');
    close(shorted.v[1], (9 * 1e-3) / (1.5 + 1e-3), 1e-12, 'a few mV on the terminals');
    // the same through a closed switch, and with a lamp of a resistor beside the wire: still a short
    expect(
      solveDC(
        net(
          2,
          part('B', 'battery-9v', [1, 0]),
          part('S', 'switch', [1, 0], 1),
          part('R', 'resistor-100', [1, 0]),
        ),
      ).issues,
    ).toEqual([{ kind: 'short', part: 'B' }]);
    // a chain of wires counts as one wire
    expect(
      solveDC(
        net(3, part('B', 'battery-aa', [1, 0]), part('J1', 'jumper', [1, 2]), part('J2', 'jumper', [2, 0])),
      ).issues,
    ).toEqual([{ kind: 'short', part: 'B' }]);
    // an open switch across the battery is no short, and a resistor is a load, not a short
    expect(
      solveDC(
        net(
          2,
          part('B', 'battery-9v', [1, 0]),
          part('S', 'switch', [1, 0], 0),
          part('R', 'resistor-1', [1, 0]),
        ),
      ).issues,
    ).toEqual([]);
    // a battery with both legs in one row is shorted by the row itself: exactly E / r
    const row = solveDC(net(2, part('B', 'battery-9v', [1, 1]), part('R', 'resistor-1k', [1, 0])));
    expect(row.issues).toEqual([{ kind: 'short', part: 'B' }]);
    close(row.parts.B!.i, -6, 1e-12, 'E / r');
  });

  it('a part with a pin in a row nothing else touches: «floating»', () => {
    // a working loop, and R2 with one leg in it and the other in row 3, alone
    const dc = solveDC(
      net(
        4,
        part('B', 'battery-9v', [1, 0]),
        part('R1', 'resistor-1k', [1, 0]),
        part('R2', 'resistor-4k7', [1, 3]),
      ),
    );
    expect(dc.ok).toBe(true);
    expect(dc.issues).toEqual([{ kind: 'floating', part: 'R2', pins: ['b'] }]);
    close(dc.parts.R2!.i, 0, 1e-15, 'no current through it');
    close(dc.parts.R1!.i, 9 / 1001.5, 1e-12, 'the loop works as without it');
    // a part entirely in the air: both pins, and its rows have no path to the ground
    const air = solveDC(
      net(
        6,
        part('B', 'battery-9v', [1, 0]),
        part('R1', 'resistor-1k', [1, 0]),
        part('R2', 'resistor-1k', [4, 5]),
      ),
    );
    expect(air.ok).toBe(true);
    expect(air.issues).toEqual([
      { kind: 'floating', part: 'R2', pins: ['a', 'b'] },
      { kind: 'ungrounded', nodes: [4, 5] },
    ]);
    close(air.parts.R1!.i, 9 / 1001.5, 1e-12, 'the loop beside it');
    // a pot across the battery with its wiper alone in row 2: the wiper is in the air, the track still conducts
    const wiper = solveDC(net(3, part('B', 'battery-9v', [1, 0]), part('P1', 'pot-10k', [0, 2, 1], 0.3)));
    expect(wiper.ok).toBe(true);
    expect(wiper.issues).toEqual([{ kind: 'floating', part: 'P1', pins: ['wiper'] }]);
    close(wiper.parts.P1!.i, -9 / 10001.5, 1e-15, 'the track from cw to ccw');
    close(wiper.v[2], (0.3 * 9 * 10e3) / 10001.5, 1e-9, 'the wiper reads its share of the track');
  });

  it('nodes without a path to the ground: the model ties them by a large resistance, says so and goes on', () => {
    expect(TIE_OHMS).toBe(1e9);
    // a battery and a resistor that touch nothing else: a loop of its own, away from the ground
    const island = solveDC(net(4, part('B', 'battery-9v', [2, 3]), part('R', 'resistor-100', [2, 3])));
    expect(island.ok).toBe(true);
    expect(island.issues).toEqual([{ kind: 'ungrounded', nodes: [2, 3] }]);
    expect([...island.v].every(Number.isFinite)).toBe(true);
    // the current in the loop does not need the ground
    close(island.parts.R!.i, 9 / 101.5, 1e-12, 'the loop current');
    close(island.v[2]! - island.v[3]!, (9 * 100) / 101.5, 1e-9, 'its voltage');
    // the tie holds the lowest node of the island; no current flows through the tie
    close(island.v[2], 0, 1e-6, 'the tied node');

    // an island of wires (a large conductance) is tied just as well, beside a grounded loop
    const wires = solveDC(
      net(
        6,
        part('B', 'battery-9v', [1, 0]),
        part('R', 'resistor-1k', [1, 0]),
        part('B2', 'battery-aa', [3, 4]),
        part('J', 'jumper', [3, 5]),
        part('R2', 'resistor-10', [5, 4]),
      ),
    );
    expect(wires.ok).toBe(true);
    expect(wires.issues).toEqual([{ kind: 'ungrounded', nodes: [3, 4, 5] }]);
    close(wires.parts.R2!.i, 1.5 / (0.15 + 1e-3 + 10), 1e-12, 'the island works');
    close(wires.parts.R!.i, 9e-3 / 1.0015, 1e-12, 'and so does the grounded loop');

    // a row behind an open switch hangs in the air: reported, tied, and 0 V
    const behind = solveDC(net(3, part('B', 'battery-9v', [1, 0]), part('S', 'switch', [1, 2], 0)));
    expect(behind.ok).toBe(true);
    expect(behind.issues).toEqual([
      { kind: 'open', part: 'B' },
      { kind: 'floating', part: 'S', pins: ['b'] },
      { kind: 'ungrounded', nodes: [2] },
    ]);
    close(behind.v[2], 0, 1e-12, 'behind the switch');
    close(behind.v[1], 9, 1e-9, 'the battery');
  });

  it('a board with nothing on it, or parts on the ground alone, is fine', () => {
    const empty = solveDC(net(5));
    expect(empty).toMatchObject({ ok: true, issues: [], parts: {} });
    expect([...empty.v]).toEqual([0, 0, 0, 0, 0]);
    const grounded = solveDC(net(2, part('R', 'resistor-1k', [0, 0])));
    expect(grounded).toMatchObject({ ok: true, issues: [] });
    expect(grounded.parts.R).toEqual({ u: 0, i: 0, p: 0 });
  });
});
