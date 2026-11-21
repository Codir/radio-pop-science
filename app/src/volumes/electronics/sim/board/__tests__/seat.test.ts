/**
 * What stands in which socket: a part goes in with all its legs or not at all, turned by quarter turns; one socket
 * holds one leg or one plug; one leg moves on its own within its part's reach; ids come from a counter of the board.
 */
import { describe, expect, it } from 'vitest';
import { createLayout } from '../layout';
import {
  canSeat,
  createBoardState,
  nextId,
  occupant,
  place,
  put,
  remove,
  seatLead,
  seatLeg,
  setSetting,
  type BoardState,
} from '../seat';

const layout = createLayout();

const legsOf = (s: BoardState, id: string) => s.parts.get(id)?.legs;
/** Everything the state holds, to show that a refused change left it as it was. */
const snapshot = (s: BoardState) =>
  JSON.stringify({
    parts: [...s.parts.values()],
    leads: [...s.leads],
    settings: [...s.settings],
    serial: [...s.serial],
  });

describe('putting a part on the board', () => {
  it('puts every leg in its socket: a resistor at a3 takes a3 and a7', () => {
    const s = createBoardState();
    expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a3', o: 0 })).toBe(true);
    expect(legsOf(s, 'R1')).toEqual(['a3', 'a7']);
    expect(s.parts.get('R1')).toMatchObject({ id: 'R1', spec: 'resistor-1k' });
    expect(occupant(s, 'a3')).toEqual({ part: 'R1', leg: 0 });
    expect(occupant(s, 'a7')).toEqual({ part: 'R1', leg: 1 });
    expect(occupant(s, 'a5')).toBeNull();
  });

  it('turns the part by quarter turns: o 1 toward the reader, o 2 end for end, o 3 away', () => {
    const at = (anchor: string, o: 0 | 1 | 2 | 3) => {
      const s = createBoardState();
      return place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor, o }) ? legsOf(s, 'R1') : null;
    };
    expect(at('a3', 1)).toEqual(['a3', 'e3']);
    expect(at('c3', 1)).toEqual(['c3', 'g3']); // across the channel: the legs bend
    expect(at('+3', 1)).toEqual(['+3', 'd3']); // from the rail into a strip
    expect(at('a7', 2)).toEqual(['a7', 'a3']);
    expect(at('e3', 3)).toEqual(['e3', 'a3']);
    expect(at('-3', 3)).toEqual(['-3', 'g3']);
    // a leg past the edge: refused
    expect(at('a15', 0)).toBeNull();
    expect(at('a3', 2)).toBeNull();
    expect(at('h3', 1)).toBeNull();
    expect(at('b3', 3)).toBeNull();
  });

  it('puts all the legs or none: an occupied or missing socket refuses the whole part and changes nothing', () => {
    const s = createBoardState();
    place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a5', o: 0 });
    const before = snapshot(s);
    expect(place(layout, s, { id: 'R2', spec: 'resistor-1k', anchor: 'a1', o: 0 })).toBe(false); // a5 is taken
    expect(place(layout, s, { id: 'R2', spec: 'resistor-1k', anchor: 'a14', o: 0 })).toBe(false); // a18 is none
    expect(place(layout, s, { id: 'R2', spec: 'resistor-1k', anchor: 'k1', o: 0 })).toBe(false);
    expect(snapshot(s)).toBe(before);
    expect(occupant(s, 'a1')).toBeNull();
    expect(place(layout, s, { id: 'R2', spec: 'resistor-1k', anchor: 'b1', o: 0 })).toBe(true);
    expect(legsOf(s, 'R2')).toEqual(['b1', 'b5']);
  });

  it('places only what stands in sockets, under an id of its kind', () => {
    const s = createBoardState();
    const before = snapshot(s);
    for (const spec of ['battery-9v', 'switch', 'ideal-9v', 'speaker-8', 'lamp-6v', 'no-such-part'])
      expect(place(layout, s, { id: 'X1', spec, anchor: 'a3', o: 0 }), spec).toBe(false);
    for (const id of ['X1', 'R', 'R0', 'R01', 'r1', 'R1a', 'LED1', 'BAT', ''])
      expect(place(layout, s, { id, spec: 'resistor-1k', anchor: 'a3', o: 0 }), id).toBe(false);
    expect(snapshot(s)).toBe(before);
    expect(place(layout, s, { id: 'LED1', spec: 'led-red', anchor: 'a3', o: 0 })).toBe(true);
    expect(place(layout, s, { id: 'D1', spec: 'diode-1n4148', anchor: 'b3', o: 0 })).toBe(true);
    expect(place(layout, s, { id: 'P1', spec: 'pot-10k', anchor: 'c3', o: 0 })).toBe(true);
    expect(place(layout, s, { id: 'J12', spec: 'jumper', anchor: 'd3', o: 0 })).toBe(true);
    expect(legsOf(s, 'LED1')).toEqual(['a3', 'a4']);
    expect(legsOf(s, 'P1')).toEqual(['c3', 'c5', 'c7']);
  });

  it('carries a part already on the board to a new place; its own sockets count as free', () => {
    const s = createBoardState();
    place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a3', o: 0 });
    setSetting(s, 'R1', 0.25);
    expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a7', o: 2 })).toBe(true); // turned in place
    expect(legsOf(s, 'R1')).toEqual(['a7', 'a3']);
    expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'b9', o: 0 })).toBe(true);
    expect(legsOf(s, 'R1')).toEqual(['b9', 'b13']);
    expect(occupant(s, 'a3')).toBeNull();
    expect(s.parts.size).toBe(1);
    expect(s.settings.get('R1')).toBe(0.25);
    // the same id cannot become another part
    expect(place(layout, s, { id: 'R1', spec: 'resistor-2k', anchor: 'c1', o: 0 })).toBe(false);
    expect(legsOf(s, 'R1')).toEqual(['b9', 'b13']);
  });

  it('frees the sockets of a part taken off the board, with its setting', () => {
    const s = createBoardState();
    place(layout, s, { id: 'P1', spec: 'pot-10k', anchor: 'c3', o: 0 });
    setSetting(s, 'P1', 0.8);
    remove(s, 'P1');
    expect(s.parts.has('P1')).toBe(false);
    expect(s.settings.has('P1')).toBe(false);
    expect(occupant(s, 'c5')).toBeNull();
    remove(s, 'P1'); // nothing there: nothing happens
    expect(s.parts.size).toBe(0);
  });

  it('tells whether a socket can take a leg: on the board and free, or held by the part that moves', () => {
    const s = createBoardState();
    place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a3', o: 0 });
    expect(canSeat(layout, s, 'a4')).toBe(true);
    expect(canSeat(layout, s, 'a3')).toBe(false);
    expect(canSeat(layout, s, 'a3', 'R1')).toBe(true);
    expect(canSeat(layout, s, 'a3', 'R2')).toBe(false);
    expect(canSeat(layout, s, 'z9')).toBe(false);
  });
});

describe('a part with the sockets of its legs given (the hand: a part in the hand, carried, turned)', () => {
  it('puts the legs in exactly these sockets, a leg in the air as null, all or nothing', () => {
    const s = createBoardState();
    // in the hand: the part is on the bench, out of every socket (the netlist leaves it out without pending)
    expect(put(layout, s, { id: 'R1', spec: 'resistor-1k', legs: [null, null] })).toBe(true);
    expect(legsOf(s, 'R1')).toEqual([null, null]);
    expect(s.serial.get('R')).toBe(1);
    // down on the board in a shape the footprint does not give: 5 P apart, the legs as the hand left them
    expect(put(layout, s, { id: 'R1', spec: 'resistor-1k', legs: ['a3', 'a8'] })).toBe(true);
    expect(legsOf(s, 'R1')).toEqual(['a3', 'a8']);
    // turned end for end over the same sockets: its own sockets count as free
    expect(put(layout, s, { id: 'R1', spec: 'resistor-1k', legs: ['a8', 'a3'] })).toBe(true);
    expect(occupant(s, 'a8')).toEqual({ part: 'R1', leg: 0 });
    // a pot's three legs go all together, so the hand puts them so too
    expect(put(layout, s, { id: 'P1', spec: 'pot-10k', legs: ['c5', 'c7', 'c9'] })).toBe(true);
  });

  it('refuses, changing nothing: a taken or missing socket, two legs in one, a wrong count, a foreign id or key', () => {
    const s = createBoardState();
    put(layout, s, { id: 'R1', spec: 'resistor-1k', legs: ['a3', 'a7'] });
    seatLead(layout, s, 'spk+', 'b9');
    const before = snapshot(s);
    const no = (id: string, spec: string, legs: (string | null)[]) =>
      expect(put(layout, s, { id, spec, legs }), `${id} ${spec} ${legs.join(',')}`).toBe(false);
    no('R2', 'resistor-1k', ['a7', 'a11']); // R1's leg
    no('R2', 'resistor-1k', ['b9', 'b13']); // a plug
    no('R2', 'resistor-1k', ['a20', 'a24']); // off the board
    no('R2', 'resistor-1k', ['c4', 'c4']); // two legs in one socket
    no('R2', 'resistor-1k', ['c4']); // one leg of two
    no('X2', 'resistor-1k', ['c4', 'c8']); // not the resistor's letters
    no('R1', 'resistor-4k7', ['c4', 'c8']); // R1 is another part
    no('SPK1', 'speaker-8', ['c4', 'c8']); // a thing off the board has plugs, not legs
    no('R2', 'no-such-part', ['c4', 'c8']);
    expect(snapshot(s)).toBe(before);
  });
});

describe('one leg on its own', () => {
  it('lifts a leg out of its socket and puts it back within the reach of the part (VISUAL.md §4)', () => {
    const s = createBoardState();
    place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a3', o: 0 });
    expect(seatLeg(layout, s, 'R1', 1, null)).toBe(true);
    expect(legsOf(s, 'R1')).toEqual(['a3', null]);
    expect(occupant(s, 'a7')).toBeNull();
    // an axial part: 4 … 6 P from its other leg
    expect(seatLeg(layout, s, 'R1', 1, 'a6')).toBe(false); // 3 P
    expect(seatLeg(layout, s, 'R1', 1, 'a10')).toBe(false); // 7 P
    expect(seatLeg(layout, s, 'R1', 1, 'a3')).toBe(false); // its other leg's socket
    expect(seatLeg(layout, s, 'R1', 1, 'k3')).toBe(false);
    expect(legsOf(s, 'R1')).toEqual(['a3', null]);
    expect(seatLeg(layout, s, 'R1', 1, 'a9')).toBe(true); // 6 P
    expect(seatLeg(layout, s, 'R1', 1, 'c7')).toBe(true); // √(16 + 4) P ≈ 4.5 P
    expect(seatLeg(layout, s, 'R1', 1, 'c7')).toBe(true); // where it is: nothing changes
    expect(legsOf(s, 'R1')).toEqual(['a3', 'c7']);
    expect(occupant(s, 'c7')).toEqual({ part: 'R1', leg: 1 });
    expect(occupant(s, 'a9')).toBeNull();
  });

  it('keeps the reach of each kind: an LED 1 … 3 P, a jumper 1 … 16 P', () => {
    const s = createBoardState();
    place(layout, s, { id: 'LED1', spec: 'led-green', anchor: 'a3', o: 0 });
    expect(seatLeg(layout, s, 'LED1', 1, 'a6')).toBe(true); // 3 P
    expect(seatLeg(layout, s, 'LED1', 1, 'a7')).toBe(false); // 4 P
    place(layout, s, { id: 'J1', spec: 'jumper', anchor: 'j1', o: 0 });
    expect(seatLeg(layout, s, 'J1', 1, 'j17')).toBe(true); // 16 P
    expect(seatLeg(layout, s, 'J1', 1, '-17')).toBe(false); // farther
    expect(seatLeg(layout, s, 'J1', 1, 'j2')).toBe(true); // 1 P
    expect(seatLeg(layout, s, 'J1', 0, 'i2')).toBe(true); // across a strip: one row, the same node
  });

  it('measures the reach across the channel as it lies on the board, not in grid steps', () => {
    const s = createBoardState();
    place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'c3', o: 1 }); // c3, g3: 1.5 apart, 5 P
    expect(seatLeg(layout, s, 'R1', 1, 'h3')).toBe(true); // 1.8: 6 P
    expect(seatLeg(layout, s, 'R1', 1, 'i3')).toBe(false); // 2.1: 7 P, though 6 grid steps
  });

  it('never moves one leg of a pot: its legs go all together (a transistor too: footprint.test.ts)', () => {
    const s = createBoardState();
    place(layout, s, { id: 'P1', spec: 'pot-10k', anchor: 'c3', o: 0 });
    expect(seatLeg(layout, s, 'P1', 1, null)).toBe(false);
    expect(seatLeg(layout, s, 'P1', 2, 'c8')).toBe(false);
    expect(legsOf(s, 'P1')).toEqual(['c3', 'c5', 'c7']);
    expect(seatLeg(layout, s, 'R9', 0, null)).toBe(false); // no such part
    expect(seatLeg(layout, s, 'P1', 3, null)).toBe(false); // no such leg
  });
});

describe('the plugs of the things off the board', () => {
  it('puts one plug in one free socket; a part cannot take that socket, nor another plug', () => {
    const s = createBoardState();
    expect(seatLead(layout, s, 'spk+', 'a12')).toBe(true);
    expect(s.leads.get('spk+')).toBe('a12');
    expect(occupant(s, 'a12')).toEqual({ lead: 'spk+' });
    expect(seatLead(layout, s, 'spk-', 'a12')).toBe(false);
    expect(seatLead(layout, s, 'spk-', 'q1')).toBe(false);
    expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a8', o: 0 })).toBe(false);
    expect(seatLead(layout, s, 'spk+', 'a12')).toBe(true); // where it is
    expect(seatLead(layout, s, 'spk+', '-12')).toBe(true); // moved: a12 is free again
    expect(occupant(s, 'a12')).toBeNull();
    place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'a8', o: 0 });
    expect(seatLead(layout, s, 'spk-', 'a8')).toBe(false); // a leg is there
    expect(seatLead(layout, s, 'spk+', null)).toBe(true);
    expect(s.leads.has('spk+')).toBe(false);
    expect(occupant(s, '-12')).toBeNull();
    expect(seatLead(layout, s, '', 'a1')).toBe(false);
  });
});

describe('settings and ids', () => {
  it('keeps a finite setting by id and refuses any other', () => {
    const s = createBoardState();
    expect(setSetting(s, 'SW', 1)).toBe(true);
    expect(setSetting(s, 'P1', 0.3)).toBe(true);
    for (const bad of [Number.NaN, Infinity, -Infinity]) expect(setSetting(s, 'SW', bad)).toBe(false);
    expect(s.settings.get('SW')).toBe(1);
    expect(setSetting(s, '', 1)).toBe(false);
  });

  it('counts ids per prefix and never gives one twice, even after a removal or an id placed by hand', () => {
    const s = createBoardState();
    expect([nextId(s, 'R'), nextId(s, 'R'), nextId(s, 'LED'), nextId(s, 'R')]).toEqual([
      'R1',
      'R2',
      'LED1',
      'R3',
    ]);
    place(layout, s, { id: 'R2', spec: 'resistor-1k', anchor: 'a3', o: 0 });
    remove(s, 'R2');
    expect(nextId(s, 'R')).toBe('R4');
    place(layout, s, { id: 'R7', spec: 'resistor-1k', anchor: 'a3', o: 0 }); // a step's preset, say
    expect(nextId(s, 'R')).toBe('R8');
    place(layout, s, { id: 'R5', spec: 'resistor-1k', anchor: 'b3', o: 0 }); // below the counter: it stays
    expect(nextId(s, 'R')).toBe('R9');
    expect(nextId(s, 'Q')).toBe('Q1');
    // two boards keep two counters
    expect(nextId(createBoardState(), 'R')).toBe('R1');
  });
});
