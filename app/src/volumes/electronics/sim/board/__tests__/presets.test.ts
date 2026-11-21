/**
 * The boards of the pilot chapters as data (`presets.ts`): what a step puts on the board with `bench.preset`, seated by
 * the same pure maths the bench uses (`seatPreset`). The LED's loop of the chapters `resistor` and `resistor-pick` gives
 * the numbers their scripts give; the amplifier's parts have the bench's names (`AMPLIFIER_IDS`).
 */
import { describe, expect, it } from 'vitest';
import { AMPLIFIER_NODES, WIRE_OHMS, amplifierNetlist, solveDC, type Netlist } from '../../core';
import { footprintOf } from '../footprint';
import { createLayout } from '../layout';
import { BENCH_FIXED, netlistOf, type BoardNet } from '../netlist';
import {
  AMPLIFIER_IDS,
  AMPLIFIER_PRESET,
  LED_LOOP,
  presetState,
  seatPreset,
  spans,
  type BoardPreset,
  type PresetPart,
} from '../presets';
import { createBoardState, setSetting } from '../seat';

const layout = createLayout();

/** The board of a preset with the battery's switch closed, as a step that closes it. */
function closed(preset: BoardPreset, parts: readonly PresetPart[] = preset.parts): BoardNet {
  const s = presetState(layout, { parts, leads: preset.leads });
  setSetting(s, 'SW', 1);
  return netlistOf(layout, s);
}

describe('a preset on the board', () => {
  it('seats every part where it says — `at` and `o`, or `to` within the part’s reach — and every plug', () => {
    const s = presetState(layout, {
      parts: [
        { id: 'R1', spec: 'resistor-1k', at: 'a3' },
        { id: 'J1', spec: 'jumper', at: '+3', to: 'b3' },
        { id: 'LED1', spec: 'led-red', at: 'e7', o: 1 },
        { id: 'P1', spec: 'pot-10k', at: 'h2', setting: 0.2 },
      ],
      leads: { 'spk+': 'c17' },
    });
    expect(s.parts.get('R1')!.legs).toEqual(['a3', 'a7']);
    expect(s.parts.get('J1')!.legs).toEqual(['+3', 'b3']);
    expect(s.parts.get('LED1')!.legs).toEqual(['e7', 'f7']);
    expect(s.parts.get('P1')!.legs).toEqual(['h2', 'h4', 'h6']);
    expect(s.settings.get('P1')).toBe(0.2);
    expect(s.leads.get('spk+')).toBe('c17');
    // the ids of the preset are taken: the hand's next jumper is J2
    expect(s.serial.get('J')).toBe(1);
  });

  it('refuses what does not stand: a leg off the board, a taken socket, a span out of reach, an unknown plug', () => {
    const fails = (parts: PresetPart[], leads: Record<string, string> = {}) => () =>
      seatPreset(layout, createBoardState(), parts, leads);
    expect(fails([{ id: 'R1', spec: 'resistor-1k', at: 'a15' }])).toThrow(RangeError); // a19 is off the board
    expect(
      fails([
        { id: 'R1', spec: 'resistor-1k', at: 'a3' },
        { id: 'R2', spec: 'resistor-1k', at: 'a7' }, // a7 is R1's leg 1
      ]),
    ).toThrow(RangeError);
    expect(fails([{ id: 'R1', spec: 'resistor-1k', at: 'a3', to: 'a5' }])).toThrow(RangeError); // 2 P: under 4
    expect(fails([{ id: 'J1', spec: 'jumper', at: 'a3', to: 'a3' }])).toThrow(RangeError);
    expect(fails([], { 'spk+': 'z9' })).toThrow(RangeError);
    // the span is measured on the board: across the channel e → f is 0.6, two grid steps
    expect(spans(layout, 'resistor-1k', 'd5', 'f5')).toBe(false); // 3 P
    expect(spans(layout, 'resistor-1k', 'c5', 'f5')).toBe(true); // 4 P
    expect(spans(layout, 'led-red', 'c9', 'c10')).toBe(true);
    expect(spans(layout, 'pot-10k', 'a1', 'a5')).toBe(false); // three legs: no span of its own
  });
});

describe('the amplifier’s ids on the bench (AMPLIFIER_IDS)', () => {
  it('names every part of the amplifier as the bench does: its fixed parts, or the footprint’s letters and a number', () => {
    const fixed = new Set(BENCH_FIXED.map((f) => f.id));
    const board = new Set<string>();
    for (const p of amplifierNetlist({ source: 'player' }).parts) {
      const id = AMPLIFIER_IDS[p.id] ?? p.id;
      expect(board.has(id), id).toBe(false);
      board.add(id);
      if (fixed.has(id)) {
        // the same kind of thing as the bench's own
        expect(BENCH_FIXED.find((f) => f.id === id)!.spec.split('-')[0], p.id).toBe(p.spec.split('-')[0]);
        continue;
      }
      const fp = footprintOf(p.spec);
      expect(fp, p.id).not.toBeNull();
      expect(id, p.id).toMatch(new RegExp(`^${fp!.prefix}\\d+$`));
    }
    // the battery, the switch, the player and the speaker are the bench's; the volume control is a pot on the board
    expect(AMPLIFIER_IDS).toEqual({ B1: 'BAT', S1: 'SW', PL: 'PLAYER', LS1: 'SPK', VR1: 'P1' });
  });
});

describe('the LED’s loop of the chapters `resistor` and `resistor-pick` (LED_LOOP)', () => {
  it('is + rail → J1 → 5ae → 330 Ω → 9ae → the red LED → 10ae → J2 → − rail, the numbers of the scripts', () => {
    const s = presetState(layout, LED_LOOP);
    expect(Object.fromEntries([...s.parts].map(([id, p]) => [id, p.legs]))).toEqual({
      J1: ['+5', 'a5'],
      R1: ['b5', 'b9'],
      LED1: ['c9', 'c10'],
      J2: ['e10', '-10'],
    });
    const sol = solveDC(closed(LED_LOOP).net);
    expect(sol.ok).toBe(true);
    // docs/volumes/electronics/chapters/resistor.md, `limit` and `share`: 21.2351 mA, 1.96049 V on the LED,
    // 7.00759 V and 0.14881 W on the resistor, 8.96813 V between the rails
    expect(sol.parts.LED1!.i).toBeCloseTo(0.0212351, 7);
    expect(sol.parts.LED1!.u).toBeCloseTo(1.96049, 5);
    expect(sol.parts.R1!.u).toBeCloseTo(7.00759, 5);
    expect(sol.parts.R1!.p).toBeCloseTo(0.14881, 5);
    expect(sol.v[layout.node('+')]! - sol.v[layout.node('-')]!).toBeCloseTo(8.96813, 5);
  });

  it('with a 10 kΩ in the 330 Ω’s sockets gives the 0.7336 mA of `resistor/inside`', () => {
    const parts = LED_LOOP.parts.map((p) => (p.id === 'R1' ? { ...p, spec: 'resistor-10k' } : p));
    const sol = solveDC(closed(LED_LOOP, parts).net);
    expect(sol.parts.LED1!.i).toBeCloseTo(0.0007336, 7);
  });
});

describe('the amplifier of E1-6 on the board (AMPLIFIER_PRESET)', () => {
  const net = amplifierNetlist({ source: 'player' });
  const alone = solveDC(net);
  const idOf = (id: string): string => AMPLIFIER_IDS[id] ?? id;
  /** Within `tol` of each other, relative to the larger. */
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b));

  /** The board's netlist of the preset with every jumper taken as the wire it stands for: the rows a jumper joins
   * are one node (numbered in the order they first come, the − rail's node 0 first). */
  function contracted(board: BoardNet): { net: Netlist; of: (node: number) => number } {
    const up = Array.from({ length: board.net.nodes }, (_, k) => k);
    const find = (k: number): number => (up[k] === k ? k : (up[k] = find(up[k]!)));
    for (const p of board.net.parts) if (p.spec === 'jumper') up[find(p.pins[0]!)] = find(p.pins[1]!);
    // the ground's root first, so it stays node 0
    const number = new Map<number, number>([[find(0), 0]]);
    const of = (node: number): number => {
      const r = find(node);
      if (!number.has(r)) number.set(r, number.size);
      return number.get(r)!;
    };
    const parts = board.net.parts.filter((p) => p.spec !== 'jumper').map((p) => ({ ...p, pins: p.pins.map(of) }));
    return { net: { nodes: number.size, parts }, of };
  }

  it('puts every part of the amplifier on the board under its bench name, ten jumpers and four plugs', () => {
    const s = presetState(layout, AMPLIFIER_PRESET);
    const fixed = new Set(BENCH_FIXED.map((f) => f.id));
    const own = net.parts.map((p) => idOf(p.id)).filter((id) => !fixed.has(id));
    const jumpers = [...s.parts.values()].filter((p) => p.spec === 'jumper').map((p) => p.id);
    expect(jumpers).toEqual(['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9', 'J10']);
    expect([...s.parts.keys()].filter((id) => !jumpers.includes(id)).sort()).toEqual(own.sort());
    for (const p of net.parts) if (!fixed.has(idOf(p.id))) expect(s.parts.get(idOf(p.id))!.spec, p.id).toBe(p.spec);
    expect(s.settings.get('P1')).toBe(net.parts.find((p) => p.id === 'VR1')!.setting);
    expect(Object.fromEntries(s.leads)).toEqual(AMPLIFIER_PRESET.leads);
    // nothing in the air: every part and plug of the board is in the circuit
    const board = closed(AMPLIFIER_PRESET);
    expect(board.pending).toEqual([]);
  });

  it('with its jumpers taken as wires has the very nodes of E1-6 and its operating point within 1e-9', () => {
    expect(alone.ok).toBe(true);
    const board = closed(AMPLIFIER_PRESET);
    const { net: wired, of } = contracted(board);
    // the partition: every pin of every part of the amplifier on a node of the board, one board node for one node of
    // the amplifier and back — the same nodes, whatever their numbers
    const toBoard = new Map<number, number>();
    const toAmp = new Map<number, number>();
    for (const p of net.parts) {
      const q = wired.parts.find((x) => x.id === idOf(p.id));
      expect(q, p.id).toBeDefined();
      expect(q!.spec, p.id).toBe(p.spec);
      p.pins.forEach((n, k) => {
        const b = q!.pins[k]!;
        expect(toBoard.get(n) ?? b, `${p.id} pin ${k}: node ${n}`).toBe(b);
        expect(toAmp.get(b) ?? n, `${p.id} pin ${k}: board node ${b}`).toBe(n);
        toBoard.set(n, b);
        toAmp.set(b, n);
      });
    }
    expect(toBoard.size).toBe(net.nodes);
    // the board's circuit has no other part: only the amplifier's (a lamp with no plug in is out of it)
    expect(wired.parts.map((p) => p.id).sort()).toEqual(net.parts.map((p) => idOf(p.id)).sort());
    // the ground is the − rail, the switched supply the + rail
    expect(toBoard.get(0)).toBe(of(layout.node('-')));
    expect(toBoard.get(AMPLIFIER_NODES.switched)).toBe(of(layout.node('+')));
    const sol = solveDC(wired);
    expect(sol.ok).toBe(true);
    for (let n = 0; n < net.nodes; n++) {
      const got = sol.v[toBoard.get(n)!]!;
      expect(near(got, alone.v[n]!, 1e-9), `node ${n}: ${got} V, sim/core ${alone.v[n]} V`).toBe(true);
    }
    for (const p of net.parts) {
      const want = alone.parts[p.id]!;
      const got = sol.parts[idOf(p.id)]!;
      for (const k of ['u', 'i', 'p'] as const)
        expect(near(got[k], want[k], 1e-9), `${p.id} ${k}: ${got[k]}, sim/core ${want[k]}`).toBe(true);
    }
  });

  it('with its ten jumpers of 1 mΩ has that operating point within 1e-4, the output at rest near 3.77 V', () => {
    const board = closed(AMPLIFIER_PRESET);
    const { net: wired, of } = contracted(board);
    const sol = solveDC(board.net);
    expect(sol.ok).toBe(true);
    const toBoard = new Map<number, number>();
    for (const p of net.parts) {
      const q = wired.parts.find((x) => x.id === idOf(p.id))!;
      p.pins.forEach((n, k) => toBoard.set(n, q.pins[k]!));
    }
    // every row of every node: a jumper is a wire of WIRE_OHMS, and the current through it moves the point a little
    // (sim/board's E2-M build: by up to 5.1e-5); the ground's rows stand above the − rail by their jumpers' drop — no
    // jumper carries more than the battery's whole current, and no ground row is more than two jumpers from the rail
    // (9fj: Q3's collector through J5 and J3, which takes Q1's emitter current too)
    const drop = 2 * Math.abs(sol.parts.BAT!.i) * WIRE_OHMS;
    const rows = [...layout.rows.keys()].flatMap((row) => {
      const n = [...toBoard].find(([, b]) => b === of(row))?.[0];
      return n === undefined ? [] : [{ row, n }]; // a row no part uses is no node of the amplifier
    });
    let lift = 0;
    for (const { row, n } of rows)
      if (n === 0) {
        expect(Math.abs(sol.v[row]!), layout.rows[row]).toBeLessThanOrEqual(drop);
        lift = Math.max(lift, Math.abs(sol.v[row]!));
      }
    expect(lift).toBeGreaterThan(0);
    // every other node within 1e-4 — measured from the − rail, while a part's return may pass a ground row that stands
    // `lift` above it: the speaker's node rests at 34 μV (C2's leak through 8 Ω), and the 1 mΩ of its ground's jumper
    // against those 8 Ω alone is 1.25e-4 of it
    const within = (a: number, b: number, rel: number, abs: number) =>
      Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b)) + abs;
    for (const { row, n } of rows) {
      if (n === 0) continue;
      const got = sol.v[row]!;
      expect(within(got, alone.v[n]!, 1e-4, lift), `node ${n} (${layout.rows[row]}): ${got} V, sim/core ${alone.v[n]} V`).toBe(true);
    }
    // every part: its current within 1e-4; its voltage and power so too, but for the lift of the rows at its two ends
    for (const p of net.parts) {
      const want = alone.parts[p.id]!;
      const got = sol.parts[idOf(p.id)]!;
      const at = (k: 'u' | 'i' | 'p', abs: number) =>
        expect(within(got[k], want[k], 1e-4, abs), `${p.id} ${k}: ${got[k]}, sim/core ${want[k]}`).toBe(true);
      at('i', 0);
      at('u', 2 * lift);
      at('p', 2 * lift * Math.abs(want.i) * 1.0001);
    }
    // sim/core/README.md, «The amplifier»: the output near 3.77 V at rest, 13.3 mA from the battery
    expect(sol.v[layout.node('7fj')]).toBeCloseTo(3.771, 3);
    expect(sol.parts.BAT!.i).toBeCloseTo(-0.01331, 5);
  });
});
