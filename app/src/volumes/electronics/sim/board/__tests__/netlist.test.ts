/**
 * The board as the model sees it: rows become nodes, the battery and its switch are fixed to the rails, a part with a
 * leg in the air is left out, and the netlist's key changes only when the circuit does. The numbers of the catalog are
 * written here as in the model's own tests (the battery's 9 V and 1.5 Ω, the wire's 1 mΩ — sim/core/README.md).
 */
import { describe, expect, it } from 'vitest';
import { GROUND, PARTS, WIRE_OHMS, checkNetlist, solveDC, type PartInstance } from '../../core';
import { footprintOf } from '../footprint';
import { createLayout, type SocketId } from '../layout';
import { BENCH_FIXED, netlistOf, type BoardNet, type FixedPart } from '../netlist';
import {
  createBoardState,
  nextId,
  place,
  remove,
  seatLead,
  seatLeg,
  setSetting,
  type BoardState,
} from '../seat';

const layout = createLayout();
const node = (row: string): number => layout.node(row);
const ROWS = layout.rows.length; // 36: the battery's own node is the 37th
const ids = (b: BoardNet) => b.net.parts.map((p) => p.id);
const partOf = (b: BoardNet, id: string) => b.net.parts.find((p) => p.id === id);

/** 9 V → switch → + rail → R1 1 kΩ → strip 5ae → R2 2 kΩ → strip 5fj → J1 → − rail. */
function divider(closed: boolean): BoardState {
  const s = createBoardState();
  expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: '+5', o: 1 })).toBe(true); // +5, d5
  expect(place(layout, s, { id: 'R2', spec: 'resistor-2k', anchor: 'e5', o: 1 })).toBe(true); // e5, i5
  expect(place(layout, s, { id: 'J1', spec: 'jumper', anchor: 'j5', o: 0 })).toBe(true); // j5, j9
  expect(seatLeg(layout, s, 'J1', 1, '-5')).toBe(true);
  if (closed) setSetting(s, 'SW', 1);
  return s;
}

describe('the fixed parts of the bench', () => {
  it('are the battery behind its switch on the rails, and the speaker, the lamp and the player on plug leads', () => {
    expect(BENCH_FIXED.map((f) => [f.id, f.spec])).toEqual([
      ['BAT', 'battery-9v'],
      ['SW', 'switch'],
      ['SPK', 'speaker-8'],
      ['LAMP', 'lamp-6v'],
      ['PLAYER', 'player'],
    ]);
    const [bat, sw, spk, lamp, player] = BENCH_FIXED;
    expect(bat!.pins).toEqual([{ private: 'bat+' }, { row: '-' }]);
    expect(sw!.pins).toEqual([{ private: 'bat+' }, { row: '+' }]);
    expect(spk!.pins).toEqual([{ lead: 'spk+' }, { lead: 'spk-' }]);
    expect(lamp!.pins).toEqual([{ lead: 'lamp1' }, { lead: 'lamp2' }]);
    // the signal (plus) and the common (minus) of the player (VISUAL §4.1), in the catalog's order of its pins
    expect(player!.pins).toEqual([{ lead: 'pl+' }, { lead: 'pl-' }]);
    expect(PARTS.player!.pins).toEqual(['plus', 'minus']);
    for (const f of BENCH_FIXED) {
      expect(PARTS[f.spec]?.pins, f.id).toHaveLength(f.pins.length);
      expect(f.id, 'never an id a part from the tray can get').not.toMatch(/^[A-Z]+[1-9]\d*$/);
    }
  });

  it('on an empty board: the battery and the open switch, the battery’s plus on its own node after the rows', () => {
    const b = netlistOf(layout, createBoardState());
    expect(b.net.nodes).toBe(ROWS + 1);
    expect(b.net.parts).toEqual([
      { id: 'BAT', spec: 'battery-9v', pins: [ROWS, GROUND] },
      { id: 'SW', spec: 'switch', pins: [ROWS, 1] },
    ]);
    expect(b.pending).toEqual([]);
    expect(() => checkNetlist(b.net)).not.toThrow();
  });

  it('takes the fixed parts as given', () => {
    const fixed: FixedPart[] = [{ id: 'B1', spec: 'battery-aa', pins: [{ row: '+' }, { row: '-' }] }];
    const b = netlistOf(layout, createBoardState(), fixed);
    expect(b.net).toEqual({ nodes: ROWS, parts: [{ id: 'B1', spec: 'battery-aa', pins: [1, 0] }] });
    // a table that names a row the board has not is a mistake in the code, not a state of the board
    const wrong: FixedPart[] = [{ id: 'B1', spec: 'battery-aa', pins: [{ row: '+' }, { row: '18ae' }] }];
    expect(() => netlistOf(layout, createBoardState(), wrong)).toThrow(RangeError);
  });
});

describe('a circuit on the board for the model', () => {
  it('a divider of 1 kΩ and 2 kΩ from the 9 V battery: the middle strip at 5.997 V', () => {
    const b = netlistOf(layout, divider(true));
    expect(ids(b)).toEqual(['BAT', 'SW', 'R1', 'R2', 'J1']);
    expect(partOf(b, 'R1')!.pins).toEqual([node('+'), node('5ae')]);
    expect(partOf(b, 'R2')!.pins).toEqual([node('5ae'), node('5fj')]);
    expect(partOf(b, 'J1')!.pins).toEqual([node('5fj'), GROUND]);
    expect(partOf(b, 'SW')!.setting).toBe(1);
    const dc = solveDC(b.net);
    expect(dc.ok).toBe(true);
    expect(dc.issues).toEqual([]);
    // 9 V over the battery's 1.5 Ω, the closed switch, 1 kΩ, 2 kΩ and the jumper; the strip sees 2 kΩ and the jumper
    const want = (9 * (2000 + WIRE_OHMS)) / (1.5 + WIRE_OHMS + 1000 + 2000 + WIRE_OHMS);
    const middle = dc.v[node('5ae')]!;
    expect(Math.abs(middle - want)).toBeLessThanOrEqual(1e-9);
    expect(middle).toBeCloseTo(5.997, 3);
  });

  it('the switch open: no current anywhere', () => {
    const dc = solveDC(netlistOf(layout, divider(false)).net);
    expect(dc.ok).toBe(true);
    expect(Math.abs(dc.parts.BAT!.i)).toBeLessThan(1e-12);
    expect(Math.abs(dc.parts.R1!.i)).toBeLessThan(1e-12);
    expect(Math.abs(dc.v[node('5ae')]!)).toBeLessThan(1e-9);
  });

  it('leaves out a part with a leg in the air and names it in pending', () => {
    const s = divider(true);
    seatLeg(layout, s, 'R1', 1, null);
    const b = netlistOf(layout, s);
    expect(ids(b)).toEqual(['BAT', 'SW', 'R2', 'J1']);
    expect(b.pending).toEqual(['R1']);
    expect(() => checkNetlist(b.net)).not.toThrow();
    const dc = solveDC(b.net);
    expect(dc.ok).toBe(true);
    expect(Math.abs(dc.v[node('5ae')]!)).toBeLessThan(1e-12);
  });

  it('takes the speaker in when both plugs are in sockets; one plug in leaves it pending', () => {
    const s = createBoardState();
    seatLead(layout, s, 'spk+', 'a12');
    let b = netlistOf(layout, s);
    expect(ids(b)).not.toContain('SPK');
    expect(b.pending).toEqual(['SPK']);
    seatLead(layout, s, 'spk-', '-12');
    b = netlistOf(layout, s);
    expect(partOf(b, 'SPK')).toEqual({ id: 'SPK', spec: 'speaker-8', pins: [node('12ae'), GROUND] });
    expect(b.pending).toEqual([]);
    seatLead(layout, s, 'spk+', null);
    seatLead(layout, s, 'spk-', null);
    b = netlistOf(layout, s); // both plugs back at the speaker: out of the circuit, nothing in the air
    expect(ids(b)).toEqual(['BAT', 'SW']);
    expect(b.pending).toEqual([]);
  });

  it('takes the player in on its two plugs, its signal on the plus: at the operating point it gives 0 V behind 32 Ω', () => {
    const s = createBoardState();
    seatLead(layout, s, 'pl+', 'c14');
    expect(netlistOf(layout, s).pending).toEqual(['PLAYER']);
    seatLead(layout, s, 'pl-', '-14');
    seatLead(layout, s, 'spk+', 'a14');
    seatLead(layout, s, 'spk-', '-15');
    const b = netlistOf(layout, s);
    expect(partOf(b, 'PLAYER')).toEqual({ id: 'PLAYER', spec: 'player', pins: [node('14ae'), GROUND] });
    expect(b.pending).toEqual([]);
    // the melody is silent at its start (sim/core music.ts): the player is its 32 Ω between the rows
    const dc = solveDC(b.net);
    expect(dc.ok).toBe(true);
    expect(Math.abs(dc.parts.PLAYER!.i)).toBeLessThan(1e-12);
    expect(Math.abs(dc.v[node('14ae')]!)).toBeLessThan(1e-12);
  });

  it('gives each part its setting by id: the pot’s knob, the switch', () => {
    const s = createBoardState();
    place(layout, s, { id: 'P1', spec: 'pot-10k', anchor: 'a3', o: 0 });
    let b = netlistOf(layout, s);
    expect(partOf(b, 'P1')).toEqual({
      id: 'P1',
      spec: 'pot-10k',
      pins: [node('3ae'), node('5ae'), node('7ae')],
    });
    setSetting(s, 'P1', 0.25);
    setSetting(s, 'SW', 1);
    b = netlistOf(layout, s);
    expect(partOf(b, 'P1')!.setting).toBe(0.25);
    expect(partOf(b, 'SW')!.setting).toBe(1);
  });

  it('adds the parts that are not on the board, as the meter in the A mode', () => {
    const s = divider(true);
    const meter: PartInstance = { id: 'METER', spec: 'jumper', pins: [node('5ae'), GROUND] };
    const b = netlistOf(layout, s, BENCH_FIXED, [meter]);
    expect(b.net.parts.at(-1)).toEqual(meter);
    expect(b.net.parts.at(-1)).not.toBe(meter);
    expect(() => checkNetlist(b.net)).not.toThrow();
  });
});

describe('the key of the circuit: recompile only when it changes', () => {
  it('stays when a leg moves within its row and changes when it moves to another row', () => {
    const s = createBoardState();
    place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a3', o: 0 }); // a3, a7
    const key = netlistOf(layout, s).key;
    expect(seatLeg(layout, s, 'R1', 1, 'b7')).toBe(true); // the same strip 7ae
    expect(netlistOf(layout, s).key).toBe(key);
    expect(seatLeg(layout, s, 'R1', 1, 'a8')).toBe(true); // strip 8ae
    expect(netlistOf(layout, s).key).not.toBe(key);
    expect(seatLeg(layout, s, 'R1', 1, 'e7')).toBe(true); // back in 7ae
    expect(netlistOf(layout, s).key).toBe(key);
    expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true); // b3, b7: same rows
    expect(netlistOf(layout, s).key).toBe(key);
    expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'b7', o: 2 })).toBe(true); // turned: pins swap
    expect(netlistOf(layout, s).key).not.toBe(key);
  });

  it('ignores the settings and the order the parts came in; sees a part left out and the extra parts', () => {
    const a = divider(true);
    const b = createBoardState();
    place(layout, b, { id: 'J1', spec: 'jumper', anchor: 'j5', o: 0 });
    seatLeg(layout, b, 'J1', 1, '-5');
    place(layout, b, { id: 'R2', spec: 'resistor-2k', anchor: 'e5', o: 1 });
    place(layout, b, { id: 'R1', spec: 'resistor-1k', anchor: '+5', o: 1 });
    const key = netlistOf(layout, a).key;
    expect(netlistOf(layout, b).key).toBe(key);
    setSetting(a, 'SW', 0);
    expect(netlistOf(layout, a).key).toBe(key);
    const meter: PartInstance = { id: 'METER', spec: 'jumper', pins: [node('5ae'), GROUND] };
    expect(netlistOf(layout, a, BENCH_FIXED, [meter]).key).not.toBe(key);
    seatLeg(layout, a, 'J1', 1, null);
    expect(netlistOf(layout, a).key).not.toBe(key);
    remove(a, 'J1');
    expect(netlistOf(layout, a).key).not.toBe(key);
  });
});

describe('every state the board can reach', () => {
  /** A whole number from the step and a salt, the same on every run: the walk enumerates, nothing is left to chance. */
  const mix = (step: number, salt: number): number => {
    let h = Math.imul(step + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    return (h ^ (h >>> 13)) >>> 0;
  };
  const KEYS = [
    'resistor-1k',
    'resistor-4k7',
    'pot-10k',
    'jumper',
    'led-red',
    'diode-1n4148',
    'diode-1n4007',
  ];
  const LEADS = ['spk+', 'spk-', 'lamp1', 'lamp2'];
  const SETTINGS = [0, 1, 0.3, 0.5, 1.7, -0.2];

  it('gives the model a netlist it accepts, after every change the reducers make', () => {
    const s = createBoardState();
    const seen = {
      changes: 0,
      refusals: 0,
      reseated: 0,
      mostParts: 0,
      mostInCircuit: 0,
      pending: 0,
      speaker: 0,
      lamp: 0,
    };
    const pickSocket = (step: number, salt: number): SocketId | null =>
      mix(step, salt) % 5 === 0 ? null : layout.sockets[mix(step, salt + 1) % layout.sockets.length]!.id;
    for (let step = 0; step < 3000; step++) {
      const parts = [...s.parts.values()];
      const some = parts.length > 0 ? parts[mix(step, 1) % parts.length]! : undefined;
      const anchor = layout.sockets[mix(step, 2) % layout.sockets.length]!.id;
      const o = (mix(step, 3) % 4) as 0 | 1 | 2 | 3;
      let done: boolean;
      switch (mix(step, 0) % 8) {
        case 0:
        case 1: {
          const spec = KEYS[mix(step, 4) % KEYS.length]!;
          done = place(layout, s, { id: nextId(s, footprintOf(spec)!.prefix), spec, anchor, o });
          break;
        }
        case 2:
          done = some !== undefined && place(layout, s, { id: some.id, spec: some.spec, anchor, o });
          break;
        case 3:
        case 4: {
          if (some === undefined) {
            done = false;
            break;
          }
          // a socket near the part's first leg in a socket, as a hand moves a leg; sometimes anywhere or the air
          const from = layout.socket(some.legs.find((x) => x !== null) ?? anchor)!;
          const near = layout.atGrid(from.gx + (mix(step, 11) % 13) - 6, from.gz + (mix(step, 12) % 7) - 3);
          const to = mix(step, 13) % 3 === 0 ? pickSocket(step, 6) : (near?.id ?? null);
          done = seatLeg(layout, s, some.id, mix(step, 5) % some.legs.length, to);
          if (done && to !== null) seen.reseated++;
          break;
        }
        case 5:
          done = seatLead(layout, s, LEADS[mix(step, 7) % LEADS.length]!, pickSocket(step, 8));
          break;
        case 6:
          done = some !== undefined && parts.length > 6;
          if (done) remove(s, some!.id);
          break;
        default: {
          const target = some !== undefined && mix(step, 9) % 2 === 0 ? some.id : 'SW';
          done = setSetting(s, target, SETTINGS[mix(step, 10) % SETTINGS.length]!);
        }
      }
      if (done) seen.changes++;
      else seen.refusals++;

      const b = netlistOf(layout, s);
      expect(() => checkNetlist(b.net), `step ${step}`).not.toThrow();
      // one socket holds one leg or one plug, and every one of them is a socket of the board
      const used = [...[...s.parts.values()].flatMap((p) => p.legs), ...s.leads.values()].filter(
        (x) => x !== null,
      );
      expect(new Set(used).size, `step ${step}`).toBe(used.length);
      for (const socket of used) expect(layout.socket(socket), `step ${step}`).toBeDefined();
      // a board part is in the circuit with all its legs in, pending with some, out with none
      const inNet = new Set(ids(b));
      for (const p of s.parts.values()) {
        const seated = p.legs.filter((x) => x !== null).length;
        expect(inNet.has(p.id), `step ${step} ${p.id}`).toBe(seated === p.legs.length);
        expect(b.pending.includes(p.id), `step ${step} ${p.id}`).toBe(seated > 0 && seated < p.legs.length);
      }
      seen.mostParts = Math.max(seen.mostParts, s.parts.size);
      seen.mostInCircuit = Math.max(
        seen.mostInCircuit,
        [...s.parts.keys()].filter((id) => inNet.has(id)).length,
      );
      if (b.pending.length > 0) seen.pending++;
      if (inNet.has('SPK')) seen.speaker++;
      if (inNet.has('LAMP')) seen.lamp++;
    }
    // the walk went through crowded boards, legs in the air and plugged leads, not only refusals
    expect(seen.changes).toBeGreaterThan(1500);
    expect(seen.refusals).toBeGreaterThan(100);
    expect(seen.reseated).toBeGreaterThan(100);
    expect(seen.mostParts).toBeGreaterThanOrEqual(10);
    expect(seen.mostInCircuit).toBeGreaterThanOrEqual(10);
    expect(seen.pending).toBeGreaterThan(300);
    expect(seen.speaker).toBeGreaterThan(50);
    expect(seen.lamp).toBeGreaterThan(50);
  });
});
