/**
 * The bipolar transistor: the transport form of Ebers–Moll with the Early effect — SPICE's Gummel–Poon model with
 * IS, BF, BR and VAF alone, as ngspice-42 solves it — the four transistors of the catalog with their makers' numbers,
 * the step of Newton's iterations limited on both junctions, and what the plan asks of a transistor on the board: a
 * switch that lights an LED with its base through 10 kΩ from 9 V and lets nothing through with its base on the ground.
 * Against ngspice's samples and a calculation by hand.
 */
import { describe, expect, it } from 'vitest';
import {
  advanceHeat,
  compile,
  createModelState,
  GMIN,
  HEAT_SECONDS,
  pnjlim,
  PARTS,
  solveDC,
  THERMAL_VOLTAGE,
  transistorAt,
  transistorVcrit,
  type Netlist,
  type PartInstance,
  type PartReading,
  type TransistorPoint,
  type TransistorSpec,
} from '../index';

interface Sample {
  netlist: Netlist;
  v: number[];
  parts: Record<string, PartReading>;
}

const files = import.meta.glob<Sample>('../__fixtures__/*.json', { eager: true, import: 'default' });
const sample = (name: string): Sample => files[`../__fixtures__/${name}.json`]!;

const part = (id: string, spec: string, pins: number[]): PartInstance => ({ id, spec, pins });
const net = (nodes: number, ...parts: PartInstance[]): Netlist => ({ nodes, parts });

function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

const KEYS = [
  'transistor-bc547b',
  'transistor-bc557b',
  'transistor-2n3904',
  'transistor-2n3906',
  'transistor-bc337-25',
  'transistor-bc327-25',
] as const;
const transistor = (key: string): TransistorSpec => PARTS[key] as TransistorSpec;
const point = (): TransistorPoint => ({ ic: 0, ib: 0, icVbe: 0, icVbc: 0, ibVbe: 0, ibVbc: 0 });

/** SPICE's junction without GMIN: IS·(e^(v/Vt) − 1), and below −3·Vt the cubic −IS·(1 + (3·Vt / (e·v))³). */
function junction(is: number, v: number): number {
  const vt = THERMAL_VOLTAGE;
  return v >= -3 * vt ? is * Math.expm1(v / vt) : -is * (1 + ((3 * vt) / (v * Math.E)) ** 3);
}

/** The currents into the collector and the base of an NPN by ngspice-42's bjtload.c with IS, BF, BR, VAF alone:
 * the transport current (Ibe − Ibc)·(1 − Vbc/VAF), the base currents Ibe/BF and Ibc/BR, GMIN across both junctions. */
function byHand(t: TransistorSpec, vbe: number, vbc: number): { ic: number; ib: number } {
  const ibe = junction(t.is, vbe);
  const ibc = junction(t.is, vbc);
  return {
    ic: (ibe - ibc) * (1 - vbc / t.vaf) - ibc / t.br - GMIN * vbc,
    ib: ibe / t.bf + GMIN * vbe + ibc / t.br + GMIN * vbc,
  };
}

describe('the catalog: six transistors with their makers’ numbers', () => {
  it('BC547B and BC557B from Philips’ SPICE library, 2N3904 and 2N3906 from Fairchild’s datasheets', () => {
    // Philips Semiconductors, phil_bjt.lib (1996): QBC547B IS = 2.39E-14 BF = 294.3 BR = 7.946 VAF = 63.2 …;
    // QBC557B IS = 3.834E-14 BF = 344.4 BR = 14.84 VAF = 21.11 …. The limits: Philips' datasheets BC546; BC547 (2004)
    // and BC556; BC557 (1999) — IC 100 mA, Ptot 500 mW
    expect(PARTS['transistor-bc547b']).toEqual({
      kind: 'transistor',
      pins: ['collector', 'base', 'emitter'],
      polarity: 'npn',
      is: 2.39e-14,
      bf: 294.3,
      br: 7.946,
      vaf: 63.2,
      limits: { currentA: 0.1, powerW: 0.5 },
    });
    expect(PARTS['transistor-bc557b']).toEqual({
      kind: 'transistor',
      pins: ['collector', 'base', 'emitter'],
      polarity: 'pnp',
      is: 3.834e-14,
      bf: 344.4,
      br: 14.84,
      vaf: 21.11,
      limits: { currentA: 0.1, powerW: 0.5 },
    });
    // Fairchild «2N3904 / MMBT3904 / PZT3904» and «2N3906 / MMBT3906 / PZT3906» (2001, Rev A), «Spice Model»: Is=6.734f
    // Bf=416.4 Br=.7371 Vaf=74.03 …; Is=1.41f Bf=180.7 Br=4.977 Vaf=18.7 …; IC 200 mA, PD 625 mW
    expect(PARTS['transistor-2n3904']).toEqual({
      kind: 'transistor',
      pins: ['collector', 'base', 'emitter'],
      polarity: 'npn',
      is: 6.734e-15,
      bf: 416.4,
      br: 0.7371,
      vaf: 74.03,
      limits: { currentA: 0.2, powerW: 0.625 },
    });
    expect(PARTS['transistor-2n3906']).toEqual({
      kind: 'transistor',
      pins: ['collector', 'base', 'emitter'],
      polarity: 'pnp',
      is: 1.41e-15,
      bf: 180.7,
      br: 4.977,
      vaf: 18.7,
      limits: { currentA: 0.2, powerW: 0.625 },
    });
    expect(HEAT_SECONDS.transistor).toBe(5);
  });

  it('BC337-25 and BC327-25, the amplifier’s output pair, from Philips’ models', () => {
    // phil_bjt.lib: QBC337-25 IS = 4.13E-14 BF = 292.4 BR = 23.68 VAF = 145.7 …; Philips' BC327-25 as LTspice's
    // standard.bjt carries it: IS=1.08E-13 BF=385.7 BR=20.57 VAF=31.29 …. The limits: 500 mA (Philips «BC337; BC337A;
    // BC338»: high current, max. 500 mA), 625 mW (onsemi «BC327»; Multicomp «BC327, BC337 Series»)
    expect(PARTS['transistor-bc337-25']).toEqual({
      kind: 'transistor',
      pins: ['collector', 'base', 'emitter'],
      polarity: 'npn',
      is: 4.13e-14,
      bf: 292.4,
      br: 23.68,
      vaf: 145.7,
      limits: { currentA: 0.5, powerW: 0.625 },
    });
    expect(PARTS['transistor-bc327-25']).toEqual({
      kind: 'transistor',
      pins: ['collector', 'base', 'emitter'],
      polarity: 'pnp',
      is: 1.08e-13,
      bf: 385.7,
      br: 20.57,
      vaf: 31.29,
      limits: { currentA: 0.5, powerW: 0.625 },
    });
  });
});

describe('the transport form of Ebers–Moll', () => {
  it('forward, saturated, cut off and the wrong way round: the currents of ngspice’s equations', () => {
    for (const key of KEYS) {
      const t = transistor(key);
      const out = point();
      for (const [vbe, vbc] of [
        [0.65, -4], // forward active
        [0.7, 0.6], // saturated: both junctions forward
        [0, -8], // cut off
        [-0.3, -9], // both the wrong way round, in SPICE's cubic
        [-5, 0.62], // the wrong way round: the collector acts as the emitter
        [0.05, 0.01], // around zero, where GMIN tells
      ] as const) {
        transistorAt(t, vbe, vbc, out);
        const want = byHand(t, vbe, vbc);
        close(out.ic, want.ic, 1e-12 * Math.abs(want.ic) + 1e-30, `${key}: Ic at ${vbe}, ${vbc} V`);
        close(out.ib, want.ib, 1e-12 * Math.abs(want.ib) + 1e-30, `${key}: Ib at ${vbe}, ${vbc} V`);
      }
    }
  });

  it('forward active: Ic = BF·Ib·(1 + Vcb/VAF) — the Early effect — and Ib = Ic/BF at Vcb = 0', () => {
    for (const key of KEYS) {
      const t = transistor(key);
      const out = point();
      transistorAt(t, 0.7, 0, out);
      close(out.ic / out.ib, t.bf, 1e-5 * t.bf, `${key}: β at Vcb = 0`);
      for (const vcb of [1, 5, 9]) {
        transistorAt(t, 0.7, -vcb, out);
        close(out.ic / out.ib, t.bf * (1 + vcb / t.vaf), 1e-5 * t.bf, `${key}: β at Vcb = ${vcb} V`);
      }
    }
  });

  it('the slopes are the derivatives of the currents: Newton’s matrix is their Jacobian', () => {
    const out = point();
    const at = point();
    for (const key of KEYS) {
      const t = transistor(key);
      for (const [vbe, vbc] of [
        [0.65, -4],
        [0.7, 0.6],
        [-0.3, -9],
        [-5, 0.62],
        [-0.05, -0.1],
      ] as const) {
        transistorAt(t, vbe, vbc, out);
        const h = 1e-7;
        const slope = (dvbe: number, dvbc: number, f: (p: TransistorPoint) => number): number => {
          transistorAt(t, vbe + dvbe, vbc + dvbc, at);
          const up = f(at);
          transistorAt(t, vbe - dvbe, vbc - dvbc, at);
          return (up - f(at)) / (2 * h);
        };
        const what = `${key} at ${vbe}, ${vbc} V`;
        // a central difference rounds the currents themselves: a slope as small as GMIN beside a current of
        // milliamperes is known to their rounding over the step only
        const rounding = (8 * Number.EPSILON * Math.max(Math.abs(out.ic), Math.abs(out.ib))) / h;
        const near = (have: number, want: number, name: string): void =>
          close(have, want, 1e-5 * Math.abs(want) + rounding, `${what}: ${name}`);
        near(
          out.icVbe,
          slope(h, 0, (p) => p.ic),
          '∂Ic/∂Vbe',
        );
        near(
          out.icVbc,
          slope(0, h, (p) => p.ic),
          '∂Ic/∂Vbc',
        );
        near(
          out.ibVbe,
          slope(h, 0, (p) => p.ib),
          '∂Ib/∂Vbe',
        );
        near(
          out.ibVbc,
          slope(0, h, (p) => p.ib),
          '∂Ib/∂Vbc',
        );
      }
    }
  });

  it('every transistor of the samples carries the currents of these equations at ngspice’s node voltages', () => {
    // transistor-bias: each one of the catalog in its active region and 2N3904 the wrong way round; the switch, on and
    // off; the amplifier at rest. Its collector current from ngspice's probe, its base current from the base resistor's
    for (const name of ['transistor-bias', 'transistor-switch', 'amplifier-op']) {
      const s = sample(name);
      const out = point();
      for (const p of s.netlist.parts) {
        if (!p.spec.startsWith('transistor-')) continue;
        const t = transistor(p.spec);
        const sign = t.polarity === 'npn' ? 1 : -1;
        const [c, b, e] = p.pins.map((node) => s.v[node]!);
        transistorAt(t, sign * (b! - e!), sign * (b! - c!), out);
        const ic = s.parts[p.id]!.i;
        // ngspice settles its node voltages to its own tolerance (VNTOL 1 μV, RELTOL 1e-3): the current at them may
        // differ by that over Vt — 2.6e-5 for the 2N3904 the wrong way round, whose base ngspice leaves 0.66 μV off
        close(sign * out.ic, ic, 1e-4 * Math.abs(ic), `${name} ${p.id}: Ic`);
      }
    }
    const bias = sample('transistor-bias');
    const out = point();
    for (const [q, rb] of [
      ['Q1', 'RB1'],
      ['Q2', 'RB2'],
      ['Q3', 'RB3'],
      ['Q4', 'RB4'],
      ['Q5', 'RB5'],
      ['Q6', 'RB6'],
      ['Q7', 'RB7'],
    ] as const) {
      const p = bias.netlist.parts.find((x) => x.id === q)!;
      const t = transistor(p.spec);
      const sign = t.polarity === 'npn' ? 1 : -1;
      const [c, b, e] = p.pins.map((node) => bias.v[node]!);
      transistorAt(t, sign * (b! - e!), sign * (b! - c!), out);
      // the base resistor carries the base current: from the plus to an NPN's base, from a PNP's base to the ground
      close(Math.abs(out.ib), Math.abs(bias.parts[rb]!.i), 1e-4 * Math.abs(bias.parts[rb]!.i), `${q}: Ib`);
    }
    // 2N3904 the wrong way round: its emitter takes BR times the base current, the gain of the reverse direction
    close(bias.parts.RC5!.i / bias.parts.RB5!.i, transistor('transistor-2n3904').br, 0.01, 'Q5: BR');
  });
});

describe('Newton’s iterations limit the step on both junctions', () => {
  /** A BC547B alone between three rows, compiled, with its behaviour and the stamper of its circuit. */
  function lone() {
    const c = compile(net(4, part('Q', 'transistor-bc547b', [1, 2, 3])));
    const e = c.elements[0]!;
    return { c, e, op: c.operating };
  }

  it('starts as SPICE does: the base–emitter junction at its knee of conduction, the base–collector at 0 V', () => {
    const { e } = lone();
    e.behaviour.start!(e);
    const t = transistor('transistor-bc547b');
    const vt = THERMAL_VOLTAGE;
    close(transistorVcrit(t), vt * Math.log(vt / (Math.SQRT2 * t.is)), 1e-15, 'Vcrit = Vt·ln(Vt / (√2·IS))');
    expect([...e.memory]).toEqual([transistorVcrit(t), 0]);
  });

  it('a junction that would leap is held back by pnjlim, the base–emitter one and the base–collector one alike', () => {
    const { c, e, op } = lone();
    const t = transistor('transistor-bc547b');
    const vcrit = transistorVcrit(t);
    const vt = THERMAL_VOLTAGE;
    e.behaviour.start!(e);
    // a guess with 3 V on the base–emitter junction and 2.5 V on the base–collector one: both far past their knees
    op.v.fill(0);
    op.v[2] = 3;
    op.v[1] = 0.5;
    op.initial = false;
    op.limited = false;
    e.behaviour.stamp(0, e, c.stamper, op);
    expect(op.limited).toBe(true);
    close(e.memory[0], pnjlim(3, vcrit, vt, vcrit), 1e-15, 'Vbe limited');
    close(e.memory[1], pnjlim(2.5, 0, vt, vcrit), 1e-15, 'Vbc limited');
    expect(e.memory[0]).toBeLessThan(vcrit + 0.2);
    expect(e.memory[1]).toBeLessThan(vcrit);
    // a PNP limits its junctions the same way, in its own direction
    const p = compile(net(4, part('Q', 'transistor-2n3906', [1, 2, 3])));
    const pe = p.elements[0]!;
    pe.behaviour.start!(pe);
    p.operating.v.fill(0);
    p.operating.v[3] = 3; // the emitter 3 V above the base
    p.operating.initial = false;
    p.operating.limited = false;
    pe.behaviour.stamp(0, pe, p.stamper, p.operating);
    expect(p.operating.limited).toBe(true);
    const pcrit = transistorVcrit(transistor('transistor-2n3906'));
    close(pe.memory[0], pnjlim(3, pcrit, vt, pcrit), 1e-15, 'Veb of the PNP limited');
    // a guess within reach is taken as it is
    op.v.fill(0);
    op.v[2] = e.memory[0]!;
    op.v[1] = op.v[2]! - e.memory[1]!;
    op.limited = false;
    e.behaviour.stamp(0, e, c.stamper, op);
    expect(op.limited).toBe(false);
  });

  it('a transistor driven hard from cold settles: its base through 100 Ω and its collector straight on the battery', () => {
    const dc = solveDC(
      net(
        3,
        part('B', 'battery-9v', [1, 0]),
        part('R', 'resistor-100', [1, 2]),
        part('Q', 'transistor-2n3904', [1, 2, 0]),
      ),
    );
    expect(dc.ok).toBe(true);
    expect(dc.sourceSteps).toBe(0);
    expect(dc.iterations).toBeLessThanOrEqual(50);
    // the battery's 1.5 Ω and 100 Ω share the 9 V: the transistor takes amperes and is far over its limits
    expect(dc.parts.Q!.i).toBeGreaterThan(1);
    expect(dc.status.Q!.condition).toBe('hot');
  });

  it('random boards with transistors settle, nearly all within 50 iterations', () => {
    // up to six rows and seven parts thrown on at random (a deterministic generator): transistors with their legs
    // anywhere — two in one row, one in the air, the wrong way round — among batteries, LEDs, diodes and resistors
    const kinds = [
      'transistor-bc547b',
      'transistor-bc557b',
      'transistor-2n3904',
      'transistor-2n3906',
      'battery-9v',
      'battery-aa',
      'led-red',
      'led-blue',
      'diode-1n4148',
      'resistor-10',
      'resistor-1k',
      'resistor-100k',
      'jumper',
    ];
    let seed = 2026;
    const next = (below: number): number => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) % below;
    };
    let slow = 0;
    let stepped = 0;
    for (let board = 0; board < 2000; board++) {
      const nodes = 2 + next(5);
      const parts = Array.from({ length: 2 + next(6) }, (_, k) => {
        const spec = kinds[next(kinds.length)]!;
        const legs = PARTS[spec]!.pins.length;
        return part(
          `P${k}`,
          spec,
          Array.from({ length: legs }, () => next(nodes)),
        );
      });
      const dc = solveDC(net(nodes, ...parts));
      const what = JSON.stringify(parts.map((p) => [p.spec, p.pins]));
      expect(dc.ok, what).toBe(true);
      expect([...dc.v].every(Number.isFinite), what).toBe(true);
      if (dc.iterations > 50) slow++;
      if (dc.sourceSteps > 0) stepped++;
    }
    // a group that only junctions' leakage and GMIN hold to the ground while amperes flow inside it ends one go of
    // 100 iterations by the noise rule (dc.ts): 7 boards of the 2000; one board without a transistor needs its sources
    // stepped up
    expect(slow).toBeLessThanOrEqual(10);
    expect(stepped).toBeLessThanOrEqual(2);
  });
});

describe('the transistor as a switch, against ngspice', () => {
  it('base through 10 kΩ from 9 V: saturated, the red LED with 330 Ω in its collector lights — ± 3 % of ngspice', () => {
    const s = sample('transistor-switch');
    const dc = solveDC(structuredClone(s.netlist));
    expect(dc.ok).toBe(true);
    // ngspice: 21.11 mA through the LED, the base takes 0.825 mA, the transistor is saturated (Vce 41 mV)
    close(s.parts.D1!.i, 0.02111, 0.00001, 'ngspice: 21.11 mA');
    close(dc.parts.D1!.i, s.parts.D1!.i, 0.03 * s.parts.D1!.i, 'the LED’s current');
    close(dc.parts.Q1!.i, s.parts.Q1!.i, 0.03 * s.parts.Q1!.i, 'the collector current');
    expect(dc.v[4]).toBeLessThan(0.1); // collector to emitter: saturated
    expect(dc.status.Q1!.condition).toBe('ok');
  });

  it('base on the ground: the collector lets less than 1 μA through, and the LED stays dark', () => {
    const s = sample('transistor-switch');
    const dc = solveDC(structuredClone(s.netlist));
    expect(Math.abs(dc.parts.Q2!.i)).toBeLessThan(1e-6);
    expect(Math.abs(s.parts.Q2!.i)).toBeLessThan(1e-6);
    // pikoamperes: GMIN across the base–collector junction with 8.3 V on it, as in ngspice
    close(dc.parts.Q2!.i, s.parts.Q2!.i, 1e-3 * Math.abs(s.parts.Q2!.i), 'what leaks');
    expect(Math.abs(dc.parts.D2!.i)).toBeLessThan(1e-9);
  });
});

describe('the limits of a transistor', () => {
  it('over its collector current it gets hot, burns after a time and is a gap from then on', () => {
    // BC547B with its base through 10 kΩ from 9 V and its collector on the battery through 10 Ω: BF times 0.83 mA, a
    // quarter of an ampere — two and a half times its 100 mA — and 1.5 W in it, three times its 0.5 W
    const board = net(
      4,
      part('B', 'battery-9v', [1, 0]),
      part('RB', 'resistor-10k', [1, 2]),
      part('RC', 'resistor-10', [1, 3]),
      part('Q', 'transistor-bc547b', [3, 2, 0]),
    );
    const state = createModelState();
    let dc = solveDC(board, { state });
    expect(dc.status.Q!.condition).toBe('hot');
    const load = dc.status.Q!.load;
    expect(load).toBeGreaterThan(2);
    let seconds = 0;
    while (advanceHeat(state, board, dc, 0.01).length === 0 && seconds < 10) seconds += 0.01;
    close(
      seconds,
      HEAT_SECONDS.transistor! * Math.log(load / (load - 1)),
      0.011,
      'it burns when its heat reaches 1',
    );
    dc = solveDC(board, { state });
    expect(dc.status.Q!.condition).toBe('burnt');
    expect(dc.parts.Q!.i).toBe(0);
    expect(Math.abs(dc.parts.RB!.i)).toBeLessThan(1e-9);
  });
});
