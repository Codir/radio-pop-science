/**
 * The bench's model driver (`driver.ts`): the one place the bench calls the circuit model. It reads the board's
 * netlist at every sync, compiles only when the circuit's shape (`key`) changed, writes a changed setting into the
 * compiled parts and solves again, keeps one `ModelState` for the life of the bench, forgets the memory of a part that
 * left the board for good (sim/core/README.md, «The state») or whose id a new part takes (`forget`, a step's preset),
 * and on a failed solve keeps the last good one; it lets the model's time pass frame by frame (`advance`: the heat of
 * every part, a part that burns solved out at once) and tells the state of each part (`part`).
 */
import { describe, expect, it } from 'vitest';
import {
  AMPLIFIER_NODES,
  HEAT_SECONDS,
  WIRE_OHMS,
  amplifierNetlist,
  burnSeconds,
  memoryOf,
  solveDC,
  type Netlist,
} from '@electronics/sim/core';
import {
  createBoardState,
  createLayout,
  footprintOf,
  nextId,
  place,
  put,
  remove,
  seatLead,
  seatLeg,
  setSetting,
  type BoardState,
  type FixedPart,
  type RowId,
  type SocketId,
} from '@electronics/sim/board';
import { createBenchModel } from '../driver';

const layout = createLayout();
const node = (row: string) => layout.node(row);

/** + rail → 1 kΩ → 7ae → 2 kΩ → 11ae → jumper → − rail; the battery's switch `closed`. */
function divider(closed: boolean): BoardState {
  const s = createBoardState();
  expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+3', 'a3'] })).toBe(true);
  expect(place(layout, s, { id: 'R1', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
  expect(place(layout, s, { id: 'R2', spec: 'resistor-2k', anchor: 'c7', o: 0 })).toBe(true);
  expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['e11', '-11'] })).toBe(true);
  setSetting(s, 'SW', closed ? 1 : 0);
  return s;
}

/** The middle of the divider: 9 V over the battery's 1.5 Ω, the switch, two jumpers, 1 kΩ and 2 kΩ. */
const MIDDLE = (9 * (2000 + WIRE_OHMS)) / (1.5 + 3 * WIRE_OHMS + 3000);

describe('the bench’s model driver', () => {
  it('solves the board: the divider’s middle at 5.997 V, read by row and by part', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(model.ok).toBe(true);
    expect(model.failure).toBeNull();
    expect(model.compiles).toBe(1);
    expect(model.version).toBe(1);
    expect(Math.abs(model.rowVolts('7ae')! - MIDDLE)).toBeLessThanOrEqual(1e-9);
    expect(model.rowVolts('7ae')).toBeCloseTo(5.997, 3);
    expect(model.nodeVolts(node('7ae'))).toBe(model.rowVolts('7ae'));
    expect(model.reading('R1')!.i).toBeCloseTo(9 / 3001.503, 12);
    expect(model.reading('nothing')).toBeNull();
    expect(model.rowVolts('18ae')).toBeNull();
    // nothing changed: no solve, the same solution
    const solved = model.solution;
    model.sync();
    expect(model.version).toBe(1);
    expect(model.solution).toBe(solved);
  });

  it('a changed setting only solves again: the same compiled circuit', () => {
    const board = divider(false);
    const model = createBenchModel({ layout, board });
    model.sync();
    const circuit = model.circuit;
    expect(circuit).not.toBeNull();
    expect(Math.abs(model.rowVolts('7ae')!)).toBeLessThan(1e-9);
    // the battery's switch closes: a setting, not a new shape
    setSetting(board, 'SW', 1);
    model.sync();
    expect(model.circuit).toBe(circuit);
    expect(model.compiles).toBe(1);
    expect(model.version).toBe(2);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
    // the compiled part follows the board's setting (sim/core: a compiled circuit reads its parts' settings live)
    expect(circuit!.net.parts.find((p) => p.id === 'SW')!.setting).toBe(1);
    // back open: the same circuit again, no current
    setSetting(board, 'SW', 0);
    model.sync();
    expect(model.circuit).toBe(circuit);
    expect(Math.abs(model.reading('R1')!.i)).toBeLessThan(1e-12);
  });

  it('a new shape compiles again; a leg moved within its row does not', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    const first = model.circuit;
    // R2's far leg from c11 to d11: the same row 11ae — the same shape
    expect(seatLeg(layout, board, 'R2', 1, 'd11')).toBe(true);
    model.sync();
    expect(model.circuit).toBe(first);
    expect(model.compiles).toBe(1);
    // to c12: another row, the divider broken — a new circuit
    expect(seatLeg(layout, board, 'R2', 1, 'c12')).toBe(true);
    model.sync();
    expect(model.circuit).not.toBe(first);
    expect(model.compiles).toBe(2);
    expect(Math.abs(model.reading('R1')!.i)).toBeLessThan(1e-9);
  });

  it('leaves out a part with a leg in the air (pending), and takes it back when the leg is in again', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(seatLeg(layout, board, 'R1', 1, null)).toBe(true);
    model.sync();
    expect(model.net!.pending).toEqual(['R1']);
    expect(model.circuit!.net.parts.map((p) => p.id)).not.toContain('R1');
    expect(model.reading('R1')).toBeNull();
    expect(Math.abs(model.rowVolts('7ae')!)).toBeLessThan(1e-9);
    expect(seatLeg(layout, board, 'R1', 1, 'b7')).toBe(true);
    model.sync();
    expect(model.net!.pending).toEqual([]);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
  });

  it('keeps one ModelState through every new circuit', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    const state = model.state;
    memoryOf(state, 'R2').heat = 0.4;
    expect(seatLeg(layout, board, 'R2', 1, 'c12')).toBe(true);
    model.sync();
    expect(model.compiles).toBe(2);
    expect(model.state).toBe(state);
    expect(state.parts.get('R2')!.heat).toBe(0.4);
  });

  it('forgets the memory of a part that left the board for good, not of one in the hand', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    memoryOf(model.state, 'R1').burnt = true;
    memoryOf(model.state, 'BAT').heat = 0.3;
    model.sync();
    // in the hand: on the bench with every leg in the air (out of the circuit, not pending) — it stays burnt
    expect(put(layout, board, { id: 'R1', spec: 'resistor-1k', legs: [null, null] })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R1')?.burnt).toBe(true);
    // put back: still burnt — a gap
    expect(put(layout, board, { id: 'R1', spec: 'resistor-1k', legs: ['b3', 'b7'] })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R1')?.burnt).toBe(true);
    expect(Math.abs(model.reading('R1')!.i)).toBe(0);
    // into the tray for good: its entry is deleted (sim/core/README.md, «The state»); the fixed parts keep theirs
    remove(board, 'R1');
    model.sync();
    expect(model.state.parts.has('R1')).toBe(false);
    expect(model.state.parts.get('BAT')?.heat).toBe(0.3);
    // a new part in its place has a new id and is whole
    expect(place(layout, board, { id: 'R3', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R3')?.burnt ?? false).toBe(false);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
  });

  it('forgets a part on demand when its id is given to a new one (a step’s preset), and solves again', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    // R1 burns: a gap from the next solve on (the switch flipped twice solves twice)
    memoryOf(model.state, 'R1').burnt = true;
    memoryOf(model.state, 'R1').heat = 1;
    setSetting(board, 'SW', 0);
    model.sync();
    setSetting(board, 'SW', 1);
    model.sync();
    expect(Math.abs(model.rowVolts('7ae')!)).toBeLessThan(1e-9);
    // a new R1 in the old one's place before any sync, as a preset puts it: the board alone cannot tell the two apart
    remove(board, 'R1');
    expect(place(layout, board, { id: 'R1', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
    model.sync();
    expect(model.state.parts.get('R1')?.burnt).toBe(true);
    // the one who put it says so: the entry goes at once, and the same circuit is solved again with the part whole
    const { version, compiles } = model;
    model.forget('R1');
    expect(model.state.parts.has('R1')).toBe(false);
    model.sync();
    expect(model.compiles).toBe(compiles);
    expect(model.version).toBe(version + 1);
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
    expect(model.state.parts.get('R1')?.burnt ?? false).toBe(false);
    // forgetting what the model does not remember changes nothing: no solve
    model.forget('R9');
    model.sync();
    expect(model.version).toBe(version + 1);
  });

  it('takes the parts the bench adds off the board (the meter in the A mode) at every sync', () => {
    const board = divider(true);
    // the meter between 11ae and the − rail instead of the jumper J2
    expect(seatLeg(layout, board, 'J2', 1, null)).toBe(true);
    let meter = false;
    const model = createBenchModel({
      layout,
      board,
      extra: () => (meter ? [{ id: 'METER', spec: 'jumper', pins: [node('11ae'), 0] }] : []),
    });
    model.sync();
    expect(Math.abs(model.reading('R1')!.i)).toBeLessThan(1e-9);
    meter = true;
    model.sync();
    expect(model.compiles).toBe(2);
    expect(model.reading('METER')!.i).toBeCloseTo(9 / (1.5 + 3 * WIRE_OHMS + 3000), 12);
    memoryOf(model.state, 'METER');
    meter = false;
    model.sync();
    expect(model.reading('METER')).toBeNull();
    expect(model.state.parts.has('METER')).toBe(false);
  });

  it('times every solve (dcMs) by its clock', () => {
    let t = 10;
    const board = divider(true);
    const model = createBenchModel({ layout, board, now: () => (t += 0.25) });
    expect(model.dcMs).toBe(0);
    model.sync();
    expect(model.dcMs).toBeCloseTo(0.25, 12);
    // no solve, no new time
    model.sync();
    expect(model.dcMs).toBeCloseTo(0.25, 12);
  });

  it('a failed solve keeps the last good one and says so; never a NaN', () => {
    const board = divider(true);
    // two ideal sources side by side make the matrix singular (the bench never offers them: a test's fixed parts)
    const fixed: FixedPart[] = [
      { id: 'S1', spec: 'ideal-9v', pins: [{ row: '+' }, { row: '-' }] },
      { id: 'S2', spec: 'ideal-5v', pins: [{ lead: 'b+' }, { row: '-' }] },
    ];
    const model = createBenchModel({ layout, board, fixed });
    model.sync();
    expect(model.ok).toBe(true);
    const good = model.solution;
    expect(model.rowVolts('7ae')).toBeCloseTo((9 * (2000 + WIRE_OHMS)) / (3000 + 2 * WIRE_OHMS), 9);
    expect(seatLead(layout, board, 'b+', '+9')).toBe(true);
    model.sync();
    expect(model.ok).toBe(false);
    expect(model.failure).toBe('singular');
    expect(model.solution).toBe(good);
    // the bench shows nothing new: no reading, no voltage of the failed circuit
    expect(model.reading('R1')).toBeNull();
    expect(model.rowVolts('7ae')).toBeNull();
    // the board fixed again: good again
    expect(seatLead(layout, board, 'b+', null)).toBe(true);
    model.sync();
    expect(model.ok).toBe(true);
    expect(Number.isNaN(model.rowVolts('7ae')!)).toBe(false);
  });
});

/** + rail → jumper → 9ae → 100 Ω across the channel → 9fj → jumper → − rail (the sandbox's step `overload`). */
function overload(): BoardState {
  const s = createBoardState();
  expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+9', 'a9'] })).toBe(true);
  expect(place(layout, s, { id: 'R1', spec: 'resistor-100', anchor: 'b9', o: 1 })).toBe(true);
  expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['j9', '-9'] })).toBe(true);
  setSetting(s, 'SW', 1);
  return s;
}

/** 9 V behind the battery's 1.5 Ω, the switch and two jumpers, on 100 Ω: the power in the resistor over its 0.25 W. */
const OVERLOAD = ((9 / (101.5 + 3 * WIRE_OHMS)) ** 2 * 100) / 0.25;
const BURN_SECONDS = burnSeconds(OVERLOAD, HEAT_SECONDS.resistor!);

/** Frames of `dt` until `id` burns (at most `limit` seconds): the time at the end of that frame, and the ids each
 * frame that burnt something gave. */
function runUntilBurnt(model: ReturnType<typeof createBenchModel>, id: string, dt: number, limit = 10) {
  const events: string[][] = [];
  let t = 0;
  while (t < limit) {
    model.sync();
    const burnt = model.advance(dt);
    t += dt;
    if (burnt.length) events.push([...burnt]);
    if (model.part(id)?.condition === 'burnt') return { t, events };
  }
  return { t: Number.POSITIVE_INFINITY, events };
}

describe('heat in the model’s time (advance)', () => {
  it('a 100 Ω across the 9 V battery is hot at once, burns after τ·ln(load / (load − 1)), then takes no current', () => {
    const board = overload();
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(OVERLOAD).toBeCloseTo(0.786 / 0.25, 2);
    const first = model.part('R1')!;
    expect(first.condition).toBe('hot');
    expect(first.load).toBeCloseTo(OVERLOAD, 9);
    expect(first.heat).toBe(0);
    // the heat gathers toward the load: one second of the model's time
    expect(model.advance(1)).toEqual([]);
    expect(model.part('R1')!.heat).toBeCloseTo(OVERLOAD * (1 - Math.exp(-0.1)), 9);
    expect(model.part('R1')!.condition).toBe('hot');
    const rest = runUntilBurnt(model, 'R1', 1 / 60);
    // it burns in the frame where the model's time passes τ·ln(L / (L − 1)) (≈ 3.83 s), told once
    expect(BURN_SECONDS).toBeCloseTo(3.83, 2);
    expect(1 + rest.t).toBeGreaterThanOrEqual(BURN_SECONDS);
    expect(1 + rest.t).toBeLessThan(BURN_SECONDS + 1 / 60 + 1e-9);
    expect(rest.events).toEqual([['R1']]);
    // solved again in that frame: a gap now, no current, in the rest of the loop either
    const version = model.version;
    expect(model.reading('R1')!.i).toBe(0);
    expect(Math.abs(model.reading('J1')!.i)).toBeLessThan(1e-9);
    expect(model.solution!.status.R1!.condition).toBe('burnt');
    // more time: it stays burnt, nothing more burns, nothing is solved again for nothing
    for (let i = 0; i < 60; i++) {
      model.sync();
      expect(model.advance(1 / 60)).toEqual([]);
    }
    expect(model.version).toBe(version);
    expect(model.part('R1')!.condition).toBe('burnt');
  });

  it('a frame with dt 0 lets no time pass; frames of 1/15 s burn it at the same time, within a frame', () => {
    const board = overload();
    const model = createBenchModel({ layout, board });
    model.sync();
    model.advance(0.5);
    const heat = model.part('R1')!.heat;
    for (let i = 0; i < 10; i++) expect(model.advance(0)).toEqual([]);
    expect(model.part('R1')!.heat).toBe(heat);
    // no time that is not a time: a negative or broken dt lets none pass either
    expect(model.advance(-1)).toEqual([]);
    expect(model.advance(Number.NaN)).toEqual([]);
    expect(model.part('R1')!.heat).toBe(heat);
    const coarse = runUntilBurnt(createBenchModel({ layout, board: overload() }), 'R1', 1 / 15);
    expect(coarse.t).toBeGreaterThanOrEqual(BURN_SECONDS);
    expect(coarse.t).toBeLessThan(BURN_SECONDS + 1 / 15 + 1e-9);
    expect(coarse.events).toEqual([['R1']]);
  });

  it('a burnt part stays burnt when it is moved (the same id); a new one from the tray is «ok», then hot again', () => {
    const board = overload();
    const model = createBenchModel({ layout, board });
    runUntilBurnt(model, 'R1', 1 / 60);
    // in the hand (every leg out): out of the circuit, still burnt
    expect(put(layout, board, { id: 'R1', spec: 'resistor-100', legs: [null, null] })).toBe(true);
    model.sync();
    expect(model.part('R1')!.condition).toBe('burnt');
    expect(model.reading('R1')).toBeNull();
    // set down two columns on, across the channel again with the jumpers moved there: burnt, a gap
    expect(put(layout, board, { id: 'J1', spec: 'jumper', legs: ['+11', 'a11'] })).toBe(true);
    expect(put(layout, board, { id: 'J2', spec: 'jumper', legs: ['j11', '-11'] })).toBe(true);
    expect(place(layout, board, { id: 'R1', spec: 'resistor-100', anchor: 'b11', o: 1 })).toBe(true);
    model.sync();
    expect(model.part('R1')!.condition).toBe('burnt');
    expect(model.reading('R1')!.i).toBe(0);
    // into the tray for good, and a new 100 Ω from it: a new id — in the hand «ok», cold, out of the circuit
    remove(board, 'R1');
    const id = nextId(board, 'R');
    expect(id).not.toBe('R1');
    expect(put(layout, board, { id, spec: 'resistor-100', legs: [null, null] })).toBe(true);
    model.sync();
    expect(model.part(id)).toEqual({ condition: 'ok', load: 0, heat: 0 });
    expect(model.reading(id)).toBeNull();
    // leg 0 in b11, leg 1 in the air (pending): still «ok», no time passes for it
    expect(seatLeg(layout, board, id, 0, 'b11')).toBe(true);
    model.sync();
    expect(model.net!.pending).toContain(id);
    model.advance(1);
    expect(model.part(id)).toEqual({ condition: 'ok', load: 0, heat: 0 });
    // both legs in: the circuit closes — hot at once by its load, cold yet
    expect(place(layout, board, { id, spec: 'resistor-100', anchor: 'b11', o: 1 })).toBe(true);
    model.sync();
    expect(model.part(id)).toMatchObject({ condition: 'hot', heat: 0 });
    expect(model.reading(id)!.i).toBeCloseTo(9 / (101.5 + 3 * WIRE_OHMS), 9);
    const again = runUntilBurnt(model, id, 1 / 60);
    expect(again.t).toBeLessThan(BURN_SECONDS + 1 / 60 + 1e-9);
    expect(again.events).toEqual([[id]]);
  });

  it('a failed solve lets no time pass: the heat holds and nothing burns', () => {
    const board = overload();
    // the bench's battery and switch, and two ideal sources a test may put side by side (the bench never offers them)
    const fixed: FixedPart[] = [
      { id: 'BAT', spec: 'battery-9v', pins: [{ private: 'bat+' }, { row: '-' }] },
      { id: 'SW', spec: 'switch', pins: [{ private: 'bat+' }, { row: '+' }] },
      { id: 'S1', spec: 'ideal-9v', pins: [{ lead: 'x+' }, { row: '-' }] },
      { id: 'S2', spec: 'ideal-5v', pins: [{ lead: 'y+' }, { row: '-' }] },
    ];
    const model = createBenchModel({ layout, board, fixed });
    model.sync();
    model.advance(1);
    const heat = model.part('R1')!.heat;
    expect(heat).toBeGreaterThan(0);
    expect(seatLead(layout, board, 'x+', '+17')).toBe(true);
    expect(seatLead(layout, board, 'y+', '+16')).toBe(true);
    model.sync();
    expect(model.ok).toBe(false);
    expect(model.part('R1')).toBeNull();
    expect(model.advance(10)).toEqual([]);
    expect(model.state.parts.get('R1')!.heat).toBe(heat);
  });

  it('tells the state of a part: in the circuit its condition and load; out of it its memory; the lamp its filament', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    expect(model.part('R1')).toBeNull(); // nothing solved yet
    model.sync();
    // 9 / 3001.5 A in 1 kΩ: 27 mW of 0.25 W
    expect(model.part('R1')).toMatchObject({ condition: 'ok', heat: 0 });
    expect(model.part('R1')!.load).toBeCloseTo(((9 / 3001.503) ** 2 * 1000) / 0.25, 6);
    expect(model.part('nothing')).toEqual({ condition: 'ok', load: 0, heat: 0 });
    model.advance(5);
    const warm = model.part('R1')!.heat;
    expect(warm).toBeGreaterThan(0);
    expect(seatLeg(layout, board, 'R1', 1, null)).toBe(true);
    model.sync();
    expect(model.part('R1')).toMatchObject({ condition: 'ok', load: 0, heat: warm });
    // the lamp straight across the rails: its filament's temperature from the solve, and over its limit
    expect(seatLead(layout, board, 'lamp1', '+1')).toBe(true);
    expect(seatLead(layout, board, 'lamp2', '-1')).toBe(true);
    model.sync();
    const lamp = model.part('LAMP')!;
    expect(lamp.kelvin).toBeGreaterThan(2300);
    expect(lamp.condition).toBe('hot');
  });
});

describe('the ohmmeter’s own solve', () => {
  it('measures between two nodes with the sources out: a lone 4.7 kΩ, two 1 kΩ side by side, nothing', () => {
    const board = createBoardState();
    expect(place(layout, board, { id: 'R1', spec: 'resistor-4k7', anchor: 'a3', o: 0 })).toBe(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(Math.abs(model.ohms(node('3ae'), node('7ae'))! / 4700 - 1)).toBeLessThanOrEqual(1e-6);
    // the same row: zero
    expect(model.ohms(node('3ae'), node('3ae'))).toBe(0);
    // two rows with nothing between them: no current, an infinite resistance
    expect(model.ohms(node('9ae'), node('12ae'))).toBe(Infinity);
    // two 1 kΩ side by side
    remove(board, 'R1');
    expect(place(layout, board, { id: 'R2', spec: 'resistor-1k', anchor: 'a3', o: 0 })).toBe(true);
    expect(place(layout, board, { id: 'R3', spec: 'resistor-1k', anchor: 'b3', o: 0 })).toBe(true);
    model.sync();
    expect(Math.abs(model.ohms(node('3ae'), node('7ae'))! / 500 - 1)).toBeLessThanOrEqual(1e-6);
  });

  it('does not see the battery, and sees a burnt part as a gap', () => {
    const board = divider(true);
    const model = createBenchModel({ layout, board });
    model.sync();
    // across 2 kΩ with the battery out: R1's far end goes only to the battery's switch, which now leads nowhere
    expect(Math.abs(model.ohms(node('7ae'), 0)! / (2000 + WIRE_OHMS) - 1)).toBeLessThanOrEqual(1e-6);
    // the bench's own solve is untouched by it
    expect(model.rowVolts('7ae')).toBeCloseTo(MIDDLE, 9);
    memoryOf(model.state, 'R2').burnt = true;
    setSetting(board, 'SW', 0);
    model.sync();
    expect(model.ohms(node('7ae'), 0)).toBe(Infinity);
    expect(model.state.parts.get('R2')!.burnt).toBe(true);
  });
});

/**
 * A transistor switch with capacitors (sim/core/README.md, «Transistors»: BC547B, its base through 10 kΩ from the
 * + rail, the red LED with 330 Ω in its collector), a reservoir of 100 μF across the supply, 100 nF from the base to the
 * − rail and a film capacitor of 1 μF across the rails: + rail → J1 → 3ae → R1 10 kΩ → 7ae, the base; Q1 C · B · E in
 * c6 · c7 · c8; + rail → R2 330 Ω → 5ae → LED1 → 6ae, the collector; J2 from the emitter's 8ae to the − rail.
 */
function ledSwitch(closed: boolean): BoardState {
  const s = createBoardState();
  expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+3', 'a3'] })).toBe(true);
  expect(place(layout, s, { id: 'R1', spec: 'resistor-10k', anchor: 'b3', o: 0 })).toBe(true);
  expect(place(layout, s, { id: 'Q1', spec: 'transistor-bc547b', anchor: 'c6', o: 0 })).toBe(true);
  expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['e8', '-8'] })).toBe(true);
  expect(place(layout, s, { id: 'R2', spec: 'resistor-330', anchor: '+5', o: 1 })).toBe(true);
  expect(place(layout, s, { id: 'LED1', spec: 'led-red', anchor: 'a5', o: 0 })).toBe(true);
  expect(place(layout, s, { id: 'C1', spec: 'electrolytic-100u-16v', anchor: 'd3', o: 0 })).toBe(true);
  expect(put(layout, s, { id: 'J3', spec: 'jumper', legs: ['e4', '-4'] })).toBe(true);
  expect(place(layout, s, { id: 'C2', spec: 'ceramic-100n', anchor: 'd7', o: 0 })).toBe(true);
  expect(put(layout, s, { id: 'J4', spec: 'jumper', legs: ['e9', '-9'] })).toBe(true);
  expect(place(layout, s, { id: 'C3', spec: 'film-1u', anchor: '+14', o: 1 })).toBe(true);
  expect(put(layout, s, { id: 'J5', spec: 'jumper', legs: ['c14', '-14'] })).toBe(true);
  setSetting(s, 'SW', closed ? 1 : 0);
  return s;
}

/** Every number of a solve: no NaN, no infinity. */
function finite(model: ReturnType<typeof createBenchModel>): boolean {
  const dc = model.solution!;
  return (
    [...dc.v].every(Number.isFinite) &&
    Object.values(dc.parts).every((r) => Number.isFinite(r.u) && Number.isFinite(r.i) && Number.isFinite(r.p))
  );
}

describe('capacitors and transistors on the board (E1-5, E1-6)', () => {
  it('compile and have an operating point: the switch opens the LED by its base, the capacitors hold their voltage', () => {
    const board = ledSwitch(false);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(model.ok).toBe(true);
    expect(finite(model)).toBe(true);
    expect(Math.abs(model.reading('LED1')!.i)).toBeLessThan(1e-9);
    setSetting(board, 'SW', 1);
    model.sync();
    expect(model.ok).toBe(true);
    expect(model.failure).toBeNull();
    expect(finite(model)).toBe(true);
    expect(model.net!.net.parts.map((p) => p.id)).toEqual(
      expect.arrayContaining(['Q1', 'C1', 'C2', 'C3', 'LED1', 'R1', 'R2']),
    );
    // saturated: the LED takes the 21.1 mA of the model's own sample (the jumpers' and the leaks' share is far below)
    expect(Math.abs(model.reading('LED1')!.i / 0.02111 - 1)).toBeLessThan(0.01);
    expect(model.reading('Q1')!.i).toBeCloseTo(model.reading('LED1')!.i, 9);
    // the base at a junction's voltage, the collector a few tens of millivolts above the emitter
    expect(model.rowVolts('7ae')).toBeGreaterThan(0.6);
    expect(model.rowVolts('7ae')).toBeLessThan(0.8);
    expect(model.rowVolts('6ae')).toBeLessThan(0.2);
    // the reservoir and the film across the supply at its voltage, the ceramic at the base's
    expect(model.reading('C1')!.u).toBeCloseTo(model.rowVolts('3ae')!, 6);
    expect(model.reading('C3')!.u).toBeCloseTo(model.rowVolts('+')!, 6);
    expect(model.reading('C2')!.u).toBeCloseTo(model.rowVolts('7ae')!, 6);
    for (const id of ['Q1', 'C1', 'C2', 'C3']) expect(model.part(id)!.condition, id).not.toBe('burnt');
    // the ohmmeter across the reservoir: its leak beside the rest of the circuit, a finite number
    expect(Number.isFinite(model.ohms(node('3ae'), 0)!)).toBe(true);
  });
});

/** The amplifier's nodes in the rows of the board: the ground on the − rail, the switched supply on the + rail (the
 * bench's own switch feeds it), every other node a strip of its own; the battery's plus is the bench's own node. */
const AMP_ROWS: Readonly<Record<number, RowId>> = {
  [AMPLIFIER_NODES.switched]: '+',
  [AMPLIFIER_NODES.supply]: '2ae',
  [AMPLIFIER_NODES.led]: '3ae',
  [AMPLIFIER_NODES.player]: '4ae',
  [AMPLIFIER_NODES.volume]: '5ae',
  [AMPLIFIER_NODES.coupled]: '6ae',
  [AMPLIFIER_NODES.base]: '7ae',
  [AMPLIFIER_NODES.top]: '8ae',
  [AMPLIFIER_NODES.middle]: '9ae',
  [AMPLIFIER_NODES.driver]: '10ae',
  [AMPLIFIER_NODES.output]: '11ae',
  [AMPLIFIER_NODES.speaker]: '12ae',
  0: '-',
};
/** The amplifier's parts that are the bench's own fixed parts, and the pot's id on the board (its letter is P). */
const AMP_IDS: Readonly<Record<string, string>> = {
  B1: 'BAT',
  S1: 'SW',
  PL: 'PLAYER',
  LS1: 'SPK',
  VR1: 'P1',
};
/** The plugs of the fixed parts on the board, by the amplifier's id: the lead on each pin, in the catalog's order. */
const AMP_LEADS: Readonly<Record<string, readonly [string, string]>> = {
  PL: ['pl+', 'pl-'],
  LS1: ['spk+', 'spk-'],
};

/** The amplifier of E1-6 (`sim/core` `amplifierNetlist`, playing the bench's player) on the board: every leg of every
 * part — the footprint's leg k carries the pin `pins[k]` — in a free socket of its pin's node's row, the plugs of the
 * player and the speaker likewise; no jumper, so every node is one row and nothing is added to the circuit. */
function amplifierOnBoard(net: Netlist): BoardState {
  const s = createBoardState();
  const free = new Map<RowId, SocketId[]>();
  for (const socket of layout.sockets) free.set(socket.row, [...(free.get(socket.row) ?? []), socket.id]);
  const take = (n: number): SocketId => {
    const row = AMP_ROWS[n];
    const socket = row === undefined ? undefined : free.get(row)?.shift();
    if (socket === undefined) throw new RangeError(`no free socket for node ${n}`);
    return socket;
  };
  for (const p of net.parts) {
    const leads = AMP_LEADS[p.id];
    if (leads) {
      leads.forEach((lead, k) => expect(seatLead(layout, s, lead, take(p.pins[k]!)), lead).toBe(true));
      continue;
    }
    if (p.id === 'B1' || p.id === 'S1') continue; // the bench's battery and its switch, fixed to the rails
    const fp = footprintOf(p.spec)!;
    const id = AMP_IDS[p.id] ?? p.id;
    const legs = fp.pins.map((pin) => take(p.pins[pin]!));
    expect(put(layout, s, { id, spec: p.spec, legs }), id).toBe(true);
    if (p.setting !== undefined) setSetting(s, id, p.setting);
  }
  setSetting(s, 'SW', 1);
  return s;
}

describe('the amplifier of E1-6 on the board', () => {
  it('has the very operating point of sim/core without the board, node by node and part by part (within 1e-9)', () => {
    const net = amplifierNetlist({ source: 'player' });
    const alone = solveDC(net);
    expect(alone.ok).toBe(true);
    const board = amplifierOnBoard(net);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(model.ok).toBe(true);
    expect(model.net!.pending).toEqual([]);
    expect(finite(model)).toBe(true);
    // every part of the amplifier is in the circuit, the bench's fixed ones in place of the amplifier's own
    const ids = new Set(model.net!.net.parts.map((p) => p.id));
    for (const p of net.parts) expect(ids.has(AMP_IDS[p.id] ?? p.id), p.id).toBe(true);
    const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
    for (const [n, row] of Object.entries(AMP_ROWS)) {
      const want = alone.v[Number(n)]!;
      const got = model.rowVolts(row)!;
      expect(near(got, want), `node ${n} (${row}): ${got} V, sim/core ${want} V`).toBe(true);
    }
    expect(near(model.nodeVolts(layout.rows.length)!, alone.v[AMPLIFIER_NODES.battery]!)).toBe(true);
    for (const p of net.parts) {
      const want = alone.parts[p.id]!;
      const got = model.reading(AMP_IDS[p.id] ?? p.id)!;
      for (const k of ['u', 'i', 'p'] as const)
        expect(near(got[k], want[k]), `${p.id} ${k}: ${got[k]}, sim/core ${want[k]}`).toBe(true);
    }
    // the amplifier at rest (sim/core/README.md, «The amplifier»): the output near half the supply, 13.3 mA
    expect(model.rowVolts('11ae')).toBeCloseTo(3.771, 3);
    expect(model.reading('BAT')!.i).toBeCloseTo(-0.01331, 5);
  });
});
