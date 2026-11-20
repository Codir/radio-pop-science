/**
 * The operating point of linear circuits against a calculation by hand (series and parallel resistances, Ohm's law,
 * a source with its internal resistance). The numbers of the catalog are written here as literals — the battery's
 * 9 V and 1.5 Ω, the wire's 1 mΩ — so a change of the catalog shows here too.
 */
import { describe, expect, it } from 'vitest';
import { compile, createModelState, solveDC, type Netlist, type PartInstance } from '../index';

const part = (id: string, spec: string, pins: number[], setting?: number): PartInstance =>
  setting === undefined ? { id, spec, pins } : { id, spec, pins, setting };
const net = (nodes: number, ...parts: PartInstance[]): Netlist => ({ nodes, parts });

/** |have − want| ≤ tolerance (absolute, in the unit of the number). */
function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

const WIRE = 1e-3; // a jumper, a closed switch, the end of a pot's track
const parallel = (a: number, b: number): number => (a * b) / (a + b);

describe('the operating point of linear circuits, by hand', () => {
  it('a divider of 9 V by 1 kΩ and 2 kΩ gives 6.000 V', () => {
    const dc = solveDC(
      net(
        3,
        part('V1', 'ideal-9v', [1, 0]),
        part('R1', 'resistor-1k', [1, 2]),
        part('R2', 'resistor-2k', [2, 0]),
      ),
    );
    expect(dc.ok).toBe(true);
    expect(dc.reason).toBeUndefined();
    expect(dc.iterations).toBe(1);
    expect(dc.issues).toEqual([]);
    expect(dc.v).toHaveLength(3);
    expect(dc.v[0]).toBe(0);
    close(dc.v[1], 9, 1e-9, 'top');
    close(dc.v[2], 6, 1e-9, 'middle');
    // 3 mA through both resistors; the source gives it out, so the current into its plus pin is −3 mA
    close(dc.parts.R1!.i, 3e-3, 1e-12, 'R1 current');
    close(dc.parts.R2!.i, 3e-3, 1e-12, 'R2 current');
    close(dc.parts.V1!.i, -3e-3, 1e-12, 'source current');
    close(dc.parts.R1!.u, 3, 1e-9, 'R1 voltage');
    close(dc.parts.R2!.u, 6, 1e-9, 'R2 voltage');
    close(dc.parts.V1!.u, 9, 1e-9, 'source voltage');
    close(dc.parts.R1!.p, 9e-3, 1e-12, 'R1 power');
    close(dc.parts.R2!.p, 18e-3, 1e-12, 'R2 power');
    close(dc.parts.V1!.p, -27e-3, 1e-12, 'the source gives 27 mW');
  });

  it('a battery has its internal resistance: 9 V, 6 V and 1.5 V on 100 Ω', () => {
    for (const [spec, volts, ohms] of [
      ['battery-9v', 9, 1.5],
      ['battery-4aa', 6, 0.6],
      ['battery-aa', 1.5, 0.15],
    ] as const) {
      const dc = solveDC(net(2, part('B', spec, [1, 0]), part('R', 'resistor-100', [1, 0])));
      const current = volts / (ohms + 100);
      const terminal = current * 100;
      expect(dc.ok, spec).toBe(true);
      close(dc.parts.R!.i, current, 1e-12, `${spec}: current`);
      close(dc.v[1], terminal, 1e-9, `${spec}: voltage on the terminals`);
      close(dc.parts.B!.u, terminal, 1e-9, `${spec}: the battery's own voltage`);
      close(dc.parts.B!.i, -current, 1e-12, `${spec}: current into the plus pin`);
      // the battery gives E·I, of which I²·r warms itself; the rest reaches the load
      close(-dc.parts.B!.p, volts * current - current * current * ohms, 1e-12, `${spec}: power given out`);
      close(dc.parts.R!.p, current * current * 100, 1e-12, `${spec}: power in the load`);
    }
    // the 9 V battery on 100 Ω: 88.67 mA, 8.867 V on the terminals
    const crown = solveDC(net(2, part('B', 'battery-9v', [1, 0]), part('R', 'resistor-100', [1, 0])));
    close(crown.parts.R!.i, 0.08866995, 1e-8, '9 V on 100 Ω');
    close(crown.v[1], 8.866995, 1e-6, '9 V on 100 Ω: terminals');
  });

  it('a series-parallel grid of five resistors', () => {
    // 9 V → R1 1 kΩ → node 2; R2 2.2 kΩ from 2 to ground; R3 470 Ω from 2 to 3; R4 1 kΩ and R5 3.3 kΩ from 3 to ground
    const dc = solveDC(
      net(
        4,
        part('V1', 'ideal-9v', [1, 0]),
        part('R1', 'resistor-1k', [1, 2]),
        part('R2', 'resistor-2k2', [2, 0]),
        part('R3', 'resistor-470', [2, 3]),
        part('R4', 'resistor-1k', [3, 0]),
        part('R5', 'resistor-3k3', [3, 0]),
      ),
    );
    const r45 = parallel(1000, 3300); // 767.44 Ω
    const r345 = 470 + r45; // 1237.44 Ω
    const r2345 = parallel(2200, r345); // 791.98 Ω
    const current = 9 / (1000 + r2345); // 5.0224 mA
    const v2 = current * r2345; // 3.9776 V
    const v3 = (v2 * r45) / r345; // 2.4669 V
    expect(dc.ok).toBe(true);
    close(dc.v[2], v2, 1e-9, 'node 2');
    close(dc.v[3], v3, 1e-9, 'node 3');
    close(dc.v[2], 3.9776118276, 1e-9, 'node 2, the number');
    close(dc.v[3], 2.4668519134, 1e-9, 'node 3, the number');
    close(dc.parts.R1!.i, current, 1e-12, 'R1');
    close(dc.parts.R2!.i, v2 / 2200, 1e-12, 'R2');
    close(dc.parts.R3!.i, (v2 - v3) / 470, 1e-12, 'R3');
    close(dc.parts.R4!.i, v3 / 1000, 1e-12, 'R4');
    close(dc.parts.R5!.i, v3 / 3300, 1e-12, 'R5');
    // Kirchhoff: what comes into a node leaves it; the powers add up to zero
    close(dc.parts.R1!.i, dc.parts.R2!.i + dc.parts.R3!.i, 1e-15, 'node 2');
    close(dc.parts.R3!.i, dc.parts.R4!.i + dc.parts.R5!.i, 1e-15, 'node 3');
    const total = Object.values(dc.parts).reduce((sum, reading) => sum + reading.p, 0);
    close(total, 0, 1e-15, 'power balance');
  });

  it('a 10 kΩ pot as a divider at 0, 0.5 and 1', () => {
    // the track from ccw (ground) to cw (9 V); the wiper takes the share `setting` of it from ccw; each part of the
    // track is at least the 1 mΩ of a contact
    const divider = (setting?: number): Netlist =>
      net(3, part('V1', 'ideal-9v', [1, 0]), part('P1', 'pot-10k', [0, 2, 1], setting));
    const wiper = (setting: number): number => {
      const lower = Math.max(setting * 1e4, WIRE);
      const upper = Math.max((1 - setting) * 1e4, WIRE);
      return (9 * lower) / (lower + upper);
    };
    for (const [setting, rough] of [
      [0, 0],
      [0.5, 4.5],
      [1, 9],
    ] as const) {
      const dc = solveDC(divider(setting));
      const track = Math.max(setting * 1e4, WIRE) + Math.max((1 - setting) * 1e4, WIRE);
      expect(dc.ok).toBe(true);
      close(dc.v[2], wiper(setting), 1e-9, `setting ${setting}`);
      close(dc.v[2], rough, 1e-6, `setting ${setting}, roughly`);
      // the current comes in at cw and leaves at ccw: into ccw it is negative
      close(dc.parts.P1!.i, -9 / track, 1e-12, `setting ${setting}: current`);
      close(dc.parts.P1!.p, 81 / track, 1e-12, `setting ${setting}: the whole track takes 8.1 mW`);
    }
    close(solveDC(divider()).v[2], 4.5, 1e-9, 'no setting: the middle');
    close(solveDC(divider(1.7)).v[2], wiper(1), 1e-12, 'beyond 1: at the end');
    close(solveDC(divider(-0.2)).v[2], wiper(0), 1e-12, 'below 0: at the start');

    // a compiled circuit follows the setting of its netlist: turning the knob needs no new compile
    const knob = divider(0.25);
    const circuit = compile(knob);
    close(solveDC(circuit).v[2], 2.25, 1e-9, 'a quarter');
    knob.parts[1]!.setting = 0.75;
    close(solveDC(circuit).v[2], 6.75, 1e-9, 'three quarters');
  });

  it('an open switch stops the current; closed, it is a wire', () => {
    const loop = (setting: number): Netlist =>
      net(
        3,
        part('B', 'battery-9v', [1, 0]),
        part('S', 'switch', [1, 2], setting),
        part('R', 'resistor-1k', [2, 0]),
      );
    const open = solveDC(loop(0));
    expect(open.ok).toBe(true);
    // zero to rounding: the battery's current is (v − 9 V)/1.5 Ω, one unit in the last place of 9 V is 1.8e-15 V
    for (const id of ['B', 'S', 'R']) close(open.parts[id]!.i, 0, 1e-14, `${id}: no current`);
    expect(open.parts.S!.i).toBe(0); // the open switch itself is no path at all
    close(open.v[1], 9, 1e-9, 'the battery without load shows its 9 V');
    close(open.v[2], 0, 1e-12, 'behind the switch');
    close(open.parts.S!.u, 9, 1e-9, 'the whole 9 V across the open switch');
    expect(open.parts.S!.p).toBe(0);
    const closed = solveDC(loop(1));
    close(closed.parts.R!.i, 9 / (1.5 + WIRE + 1000), 1e-12, 'closed');
    close(closed.parts.S!.u, (9 / (1.5 + WIRE + 1000)) * WIRE, 1e-12, 'closed: a few μV across the contact');
    // a switch without a setting is open
    close(
      solveDC(
        net(
          3,
          part('B', 'battery-9v', [1, 0]),
          part('S', 'switch', [1, 2]),
          part('R', 'resistor-1k', [2, 0]),
        ),
      ).parts.R!.i,
      0,
      1e-15,
      'no setting',
    );
  });

  it('the speaker and the earphone are plain resistances', () => {
    const dc = solveDC(
      net(
        2,
        part('B', 'battery-4aa', [1, 0]),
        part('LS', 'speaker-8', [1, 0]),
        part('PH', 'earphone-32', [1, 0]),
      ),
    );
    const load = parallel(8, 32); // 6.4 Ω
    const terminal = (6 * load) / (0.6 + load);
    close(dc.v[1], terminal, 1e-9, 'terminals');
    close(dc.parts.LS!.i, terminal / 8, 1e-12, 'speaker');
    close(dc.parts.PH!.i, terminal / 32, 1e-12, 'earphone');
  });

  it('the worked example of sim/core/README.md, as written there', () => {
    const example = net(
      4,
      part('B1', 'battery-9v', [1, 0]),
      part('R1', 'resistor-1k', [1, 2]),
      part('R2', 'resistor-2k', [2, 0]),
      part('P1', 'pot-10k', [0, 3, 1], 0.3),
      part('RL', 'resistor-4k7', [3, 0]),
    );
    // the pot at 0.3: 3 kΩ from ccw (ground) to the wiper, RL beside them, 7 kΩ from the wiper to the battery
    const expected = (setting: number): { v1: number; v3: number } => {
      const below = parallel(10e3 * setting, 4700);
      const load = parallel(3000, 10e3 * (1 - setting) + below);
      const v1 = (9 * load) / (load + 1.5);
      return { v1, v3: (v1 * below) / (10e3 * (1 - setting) + below) };
    };
    const at = expected(0.3);
    const dc = solveDC(example);
    expect(dc.ok).toBe(true);
    expect(dc.issues).toEqual([]);
    close(dc.v[2], (at.v1 * 2) / 3, 1e-9, 'v[2]');
    expect(dc.v[2]!.toFixed(3)).toBe('5.996');
    close(dc.v[3], at.v3, 1e-9, 'v[3]');
    expect(dc.v[3]!.toFixed(3)).toBe('1.865');
    const r1 = dc.parts.R1!;
    expect([r1.u.toFixed(3), r1.i.toFixed(6), r1.p.toFixed(6)]).toEqual(['2.998', '0.002998', '0.008988']);
    close(r1.p, (at.v1 / 3) * (at.v1 / 3000), 1e-15, 'R1.p');
    // the same netlist compiled once follows the knob
    const circuit = compile(example);
    example.parts[3]!.setting = 0.8;
    close(solveDC(circuit, { state: createModelState() }).v[3], expected(0.8).v3, 1e-9, 'v[3] at 0.8');
  });
});

describe('what the model answers besides numbers', () => {
  it('a circuit it cannot solve gives ok: false with the reason, not an exception and not NaN', () => {
    for (const bad of [
      // two ideal sources side by side: no current can satisfy both
      net(
        2,
        part('V1', 'ideal-9v', [1, 0]),
        part('V2', 'ideal-9v', [1, 0]),
        part('R', 'resistor-1k', [1, 0]),
      ),
      // an ideal source with both pins in one row: 0 V cannot be 9 V
      net(2, part('V1', 'ideal-9v', [1, 1]), part('R', 'resistor-1k', [1, 0])),
    ]) {
      const dc = solveDC(bad);
      expect(dc.ok).toBe(false);
      expect(dc.reason).toBe('singular');
      expect(dc.v).toHaveLength(2);
      expect([...dc.v].every(Number.isFinite)).toBe(true);
      for (const reading of Object.values(dc.parts)) expect(reading).toEqual({ u: 0, i: 0, p: 0 });
      expect(Object.keys(dc.parts).sort()).toEqual(bad.parts.map((p) => p.id).sort());
    }
  });

  it('the matrix holds only the nodes in use and is allocated once per circuit', () => {
    // a board of 10 rows with 2 in use: two node voltages and the current of the source
    const board = net(
      10,
      part('V1', 'ideal-9v', [1, 0]),
      part('R1', 'resistor-1k', [1, 7]),
      part('R2', 'resistor-2k', [7, 0]),
    );
    const circuit = compile(board);
    expect(circuit.system.n).toBe(3);
    const matrix = circuit.system.a;
    const first = solveDC(circuit);
    const second = solveDC(circuit);
    expect(circuit.system.a).toBe(matrix);
    expect(second.v).toEqual(first.v);
    expect(second.v).not.toBe(first.v); // every solution owns its numbers
    expect(first.v).toHaveLength(10);
    close(first.v[7], 6, 1e-9, 'row 7');
    for (const node of [2, 3, 4, 5, 6, 8, 9]) expect(first.v[node]).toBe(0);
  });

  it('the state of the model is an object of its own, never shared through the module', () => {
    const a = createModelState();
    const b = createModelState();
    expect(a).not.toBe(b);
    expect(a.v).toHaveLength(0);
    const nine = net(
      3,
      part('V1', 'ideal-9v', [1, 0]),
      part('R1', 'resistor-1k', [1, 2]),
      part('R2', 'resistor-2k', [2, 0]),
    );
    const six = net(2, part('B', 'battery-4aa', [1, 0]), part('R', 'resistor-100', [1, 0]));
    const alone = [solveDC(nine), solveDC(six)];
    // two copies of a chapter at a chapter boundary: their solves interleave, each with its own state
    const first = solveDC(nine, { state: a });
    const second = solveDC(six, { state: b });
    const again = solveDC(nine, { state: a });
    expect(first.v).toEqual(alone[0]!.v);
    expect(second.v).toEqual(alone[1]!.v);
    expect(again.v).toEqual(first.v);
    expect([...a.v]).toEqual([...first.v]); // the last solution: the first guess of the next solve
    expect([...b.v]).toEqual([...second.v]);
    // a failed solve leaves the state as it was
    solveDC(net(2, part('V1', 'ideal-9v', [1, 1]), part('R', 'resistor-1k', [1, 0])), { state: b });
    expect([...b.v]).toEqual([...second.v]);
  });

  it('a malformed netlist is a RangeError that names the fault', () => {
    const ok = (): PartInstance[] => [part('V1', 'ideal-9v', [1, 0]), part('R1', 'resistor-1k', [1, 0])];
    for (const [bad, message] of [
      [net(2, ...ok(), part('X', 'resistor-1234', [1, 0])), /resistor-1234/],
      [net(2, ...ok(), part('X', 'resistor-1k', [1])), /pins/],
      [net(2, ...ok(), part('X', 'resistor-1k', [1, 2])), /node/],
      [net(2, ...ok(), part('X', 'resistor-1k', [1, 0.5])), /node/],
      [net(2, ...ok(), part('R1', 'resistor-1k', [1, 0])), /R1/],
      [net(2, ...ok(), part('', 'resistor-1k', [1, 0])), /id/],
      [net(2, ...ok(), part('X', 'pot-10k', [0, 1, 1], Number.NaN)), /setting/],
      [net(0, ...ok()), /nodes/],
      [net(2.5, ...ok()), /nodes/],
    ] as const) {
      expect(() => solveDC(bad)).toThrow(RangeError);
      expect(() => solveDC(bad)).toThrow(message);
    }
    // a setting that went bad on a compiled circuit is caught at the solve
    const knob = net(3, part('V1', 'ideal-9v', [1, 0]), part('P1', 'pot-10k', [0, 2, 1], 0.5));
    const circuit = compile(knob);
    knob.parts[1]!.setting = Number.POSITIVE_INFINITY;
    expect(() => solveDC(circuit)).toThrow(/setting/);
  });
});
