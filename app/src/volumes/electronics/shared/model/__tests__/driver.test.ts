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
  legSockets,
  nextId,
  place,
  put,
  remove,
  seatLead,
  seatLeg,
  setSetting,
  type BoardState,
  type FixedPart,
  type Orientation,
  type RowId,
  type SocketId,
} from '@electronics/sim/board';
import { STILL, createBenchModel } from '../driver';

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

  it('built as on a real board — every part in its footprint’s own shape, six jumpers — has that point within 1e-4', () => {
    const net = amplifierNetlist({ source: 'player' });
    const alone = solveDC(net);
    const board = amplifierBuilt(net);
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(model.ok).toBe(true);
    expect(model.net!.pending).toEqual([]);
    expect(finite(model)).toBe(true);
    // in the circuit: the amplifier's parts (the bench's fixed ones in place of its own) and the six jumpers
    const built = net.parts.map((p) => AMP_IDS[p.id] ?? p.id).filter((id) => id !== 'BAT' && id !== 'SW');
    const jumpers = AMP_JUMPERS.map((_, k) => `J${k + 1}`);
    const ids = model.net!.net.parts.map((p) => p.id).filter((id) => id !== 'BAT' && id !== 'SW');
    expect(ids.sort()).toEqual([...built, ...jumpers].sort());
    // a jumper is a wire of WIRE_OHMS: under its strips' current it moves the point a little — the output pair's
    // 1.9 mA of bias, exponential in its base voltages, by up to 5.1e-5, everything else by at most 2.4e-5 — so the
    // 1e-9 of the build without jumpers (above) cannot hold here
    const near = (a: number, b: number) => Math.abs(a - b) <= 1e-4 * Math.max(Math.abs(a), Math.abs(b));
    for (const [n, rows] of Object.entries(AMP_BUILT_ROWS)) {
      const want = alone.v[Number(n)]!;
      for (const row of rows) {
        const got = model.rowVolts(row)!;
        // the ground's strips stand above the − rail by their jumper's drop: at most 10 mA through 1 mΩ
        if (Number(n) === 0) expect(Math.abs(got), row).toBeLessThanOrEqual(0.01 * WIRE_OHMS);
        else expect(near(got, want), `node ${n} (${row}): ${got} V, sim/core ${want} V`).toBe(true);
      }
    }
    expect(near(model.nodeVolts(layout.rows.length)!, alone.v[AMPLIFIER_NODES.battery]!)).toBe(true);
    for (const p of net.parts) {
      const want = alone.parts[p.id]!;
      const got = model.reading(AMP_IDS[p.id] ?? p.id)!;
      for (const k of ['u', 'i', 'p'] as const)
        expect(near(got[k], want[k]), `${p.id} ${k}: ${got[k]}, sim/core ${want[k]}`).toBe(true);
    }
    expect(model.rowVolts('10fj')).toBeCloseTo(3.771, 3);
    expect(model.reading('BAT')!.i).toBeCloseTo(-0.01331, 5);
  });
});

/** Where the amplifier's parts stand when it is built in the footprints' own shapes: leg 0 in the anchor, the others
 * where the footprint's offsets turned by `o` put them (`place`), by the amplifier's id. */
const AMP_PLACES: Readonly<Record<string, readonly [SocketId, Orientation]>> = {
  D1: ['+9', 1], // the protection diode from the + rail down into 9ae
  R5: ['c9', 1], // across the channel: the supply (9ae) to the top of the diodes (9fj)
  Q2: ['f8', 0], // collector · base · emitter: the supply (8fj), the top (9fj), the output (10fj)
  C3: ['j8', 1], // the reservoir from the supply (8fj) onto the − rail
  R1: ['g8', 0], // the supply to the LED's row 12fj
  LED1: ['j12', 1],
  D2: ['h9', 0], // the top (9fj) to the middle (13fj)
  D3: ['g13', 3], // up across the channel: the middle (13fj) to the driver (13ae)
  Q3: ['b12', 0], // collector · base · emitter: the ground (12ae), the driver (13ae), the output (14ae)
  Q1: ['h7', 2], // turned end for end: the driver (7fj), the base (6fj), the ground (5fj)
  R4: ['g6', 1], // the base onto the − rail
  R3: ['i10', 2], // the feedback: the output (10fj) to the base (6fj)
  R2: ['b6', 1], // across the channel: the input (6ae) to the base (6fj)
  C1: ['c6', 2], // plus on the input (6ae), minus on the wiper (5ae)
  VR1: ['a3', 0], // ccw · wiper · cw: the ground (3ae), the volume (5ae), the player (7ae)
  C2: ['j10', 0], // plus on the output (10fj), minus on the speaker's row 11fj
};
/** The plugs of the player and the speaker in that build. */
const AMP_PLUGS: Readonly<Record<string, SocketId>> = {
  'pl+': 'e7',
  'pl-': '-2',
  'spk+': 'h11',
  'spk-': '-11',
};
/** The jumpers of that build, J1 … J6, from leg 0 to leg 1: a node one strip cannot hold, or a ground off the rail. */
const AMP_JUMPERS: readonly (readonly [SocketId, SocketId])[] = [
  ['e9', 'h8'], // the supply: 9ae (the diode, R5) to 8fj (Q2, the reservoir, R1)
  ['i5', '-5'], // Q1's emitter onto the − rail
  ['g7', 'd13'], // the driver: Q1's collector (7fj) to Q3's base and the diodes (13ae)
  ['a12', '-13'], // Q3's collector onto the − rail
  ['e3', '-3'], // the volume control's ccw onto the − rail, a strip of its own: no other current lifts it
  ['e14', 'g10'], // the output: Q3's emitter (14ae) to Q2's and the rest (10fj)
];
/** The rows of every node of the amplifier in that build. */
const AMP_BUILT_ROWS: Readonly<Record<number, readonly RowId[]>> = {
  [AMPLIFIER_NODES.switched]: ['+'],
  [AMPLIFIER_NODES.supply]: ['9ae', '8fj'],
  [AMPLIFIER_NODES.led]: ['12fj'],
  [AMPLIFIER_NODES.player]: ['7ae'],
  [AMPLIFIER_NODES.volume]: ['5ae'],
  [AMPLIFIER_NODES.coupled]: ['6ae'],
  [AMPLIFIER_NODES.base]: ['6fj'],
  [AMPLIFIER_NODES.top]: ['9fj'],
  [AMPLIFIER_NODES.middle]: ['13fj'],
  [AMPLIFIER_NODES.driver]: ['13ae', '7fj'],
  [AMPLIFIER_NODES.output]: ['10fj', '14ae'],
  [AMPLIFIER_NODES.speaker]: ['11fj'],
  0: ['-', '5fj', '12ae', '3ae'],
};

/** How far apart two sockets lie on the board, in pitches. */
function pitchesApart(a: SocketId, b: SocketId): number {
  const p = layout.socket(a)!;
  const q = layout.socket(b)!;
  return Math.hypot(p.x - q.x, p.z - q.z) / layout.spec.pitch;
}

/** The amplifier in that build: every part by `place`, every leg k in a row of the node of its pin `pins[k]` and
 * within the part's reach of the others; every jumper's leg 1 set by `seatLeg`, which keeps it within the jumper's
 * reach, both its ends in rows of one node. */
function amplifierBuilt(net: Netlist): BoardState {
  const s = createBoardState();
  const nodeOf = (socket: SocketId): number => {
    const row = layout.socket(socket)!.row;
    const n = Object.entries(AMP_BUILT_ROWS).find(([, rows]) => rows.includes(row));
    expect(n, `${socket}: row ${row} of no node`).toBeDefined();
    return Number(n![0]);
  };
  for (const p of net.parts) {
    const leads = AMP_LEADS[p.id];
    if (leads) {
      leads.forEach((lead, k) => {
        expect(seatLead(layout, s, lead, AMP_PLUGS[lead]!), lead).toBe(true);
        expect(nodeOf(AMP_PLUGS[lead]!), lead).toBe(p.pins[k]);
      });
      continue;
    }
    if (p.id === 'B1' || p.id === 'S1') continue; // the bench's battery and its switch, fixed to the rails
    const id = AMP_IDS[p.id] ?? p.id;
    const [anchor, o] = AMP_PLACES[p.id]!;
    expect(place(layout, s, { id, spec: p.spec, anchor, o }), id).toBe(true);
    const fp = footprintOf(p.spec)!;
    const legs = s.parts.get(id)!.legs;
    expect(legs, id).toEqual(legSockets(layout, fp, layout.socket(anchor)!, o).map((socket) => socket!.id));
    // and within its reach as the sockets lie (a grid step across the channel or to a rail is a little longer)
    if (fp.span)
      for (const [k, a] of legs.entries())
        for (const b of legs.slice(k + 1)) {
          const apart = pitchesApart(a!, b!);
          expect(apart, `${id}: ${a} … ${b}`).toBeGreaterThanOrEqual(fp.span[0]);
          expect(apart, `${id}: ${a} … ${b}`).toBeLessThanOrEqual(fp.span[1]);
        }
    legs.forEach((socket, k) =>
      expect(nodeOf(socket!), `${id} leg ${k} (${socket})`).toBe(p.pins[fp.pins[k]!]),
    );
    if (p.setting !== undefined) setSetting(s, id, p.setting);
  }
  AMP_JUMPERS.forEach(([from, to], k) => {
    const id = `J${k + 1}`;
    expect(put(layout, s, { id, spec: 'jumper', legs: [from, null] }), id).toBe(true);
    expect(seatLeg(layout, s, id, 1, to), `${id} to ${to}`).toBe(true);
    expect(nodeOf(to), id).toBe(nodeOf(from));
  });
  setSetting(s, 'SW', 1);
  return s;
}

describe('a bulged electrolytic (E1-5) on the bench, apart from a burnt part (E2-9)', () => {
  /** + rail → J1 → 3ae → 100 μF / 6.3 V the wrong way round (minus 3ae, plus 4ae) → 4ae → J2 → − rail. */
  function reversed(): BoardState {
    const s = createBoardState();
    expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+3', 'a3'] })).toBe(true);
    expect(place(layout, s, { id: 'C1', spec: 'electrolytic-100u-6v3', anchor: 'c4', o: 2 })).toBe(true);
    expect(s.parts.get('C1')!.legs).toEqual(['c4', 'c3']); // plus in 4ae, minus in 3ae: 9 V the wrong way round
    expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['e4', '-4'] })).toBe(true);
    setSetting(s, 'SW', 1);
    return s;
  }

  it('bulges after ≈ 1.2 s, told once; stays «bulged» in the circuit and out of it; the ohmmeter reads its 1 kΩ', () => {
    const board = reversed();
    const model = createBenchModel({ layout, board });
    model.sync();
    expect(model.part('C1')).toMatchObject({ condition: 'hot' });
    const told: { id: string; t: number }[] = [];
    for (let k = 1; k <= 120; k++) for (const id of model.advance(1 / 60)) told.push({ id, t: k / 60 });
    // load 9 (9 V against its 1 V the wrong way round), τ 10 s: 10 · ln(9 / 8) = 1.18 s
    expect(told.map((x) => x.id)).toEqual(['C1']);
    expect(told[0]!.t).toBeCloseTo(10 * Math.log(9 / 8), 1);
    expect(model.part('C1')).toMatchObject({ condition: 'bulged', load: 0 });
    // its leak of 1 kΩ (BULGED_OHMS) across the battery, not its healthy one: 9 mA
    expect(model.reading('C1')!.i).toBeCloseTo(-9 / 1000, 3);
    expect(model.ohms(node('3ae'), node('4ae'))!).toBeCloseTo(1000, -1);
    // taken out of the circuit by a leg, it stays bulged (not «ok» as a part out of the circuit would be)
    expect(seatLeg(layout, board, 'C1', 1, null)).toBe(true);
    model.sync();
    expect(model.part('C1')!.condition).toBe('bulged');
    // a new part under the id (a step's preset): whole again
    model.forget('C1');
    expect(seatLeg(layout, board, 'C1', 1, 'c3')).toBe(true);
    model.sync();
    expect(model.part('C1')!.condition).toBe('hot');
  });
});

describe('the longest time constant and a held page’s window (E2-9)', () => {
  /** + rail → J1 → 3ae → 10 kΩ → 7ae → 100 μF (plus 7ae, minus 8ae) → J2 → − rail. */
  function rc(closed: boolean): BoardState {
    const s = createBoardState();
    expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+3', 'a3'] })).toBe(true);
    expect(place(layout, s, { id: 'R1', spec: 'resistor-10k', anchor: 'b3', o: 0 })).toBe(true);
    expect(place(layout, s, { id: 'C1', spec: 'electrolytic-100u-16v', anchor: 'c7', o: 0 })).toBe(true);
    expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['e8', '-8'] })).toBe(true);
    setSetting(s, 'SW', closed ? 1 : 0);
    return s;
  }

  it('9 V through 10 kΩ into 100 μF: τ = R·C ≈ 1 s with the switch closed; its own leak alone with it open', () => {
    const closed = createBenchModel({ layout, board: rc(true) });
    closed.sync();
    // C · (ESR + (10 kΩ + 1.5 Ω + the wires) ∥ the leak of 2.581 MΩ)
    const r = 10001.5 + 3 * WIRE_OHMS;
    const leak = 2.581e6;
    expect(closed.tauMax()).toBeCloseTo(100e-6 * (2.653 + (r * leak) / (r + leak)), 3);
    const open = createBenchModel({ layout, board: rc(false) });
    open.sync();
    expect(open.tauMax()).toBeGreaterThan(200);
    // no capacitor: none
    const d = createBenchModel({ layout, board: divider(true) });
    d.sync();
    expect(d.tauMax()).toBe(0);
  });

  it('the warm-up: max(0.2 s, 5 τ) on a whole beat of the melody, at most 2 s', () => {
    expect([0, 0.05, 0.1, 0.15, 0.3, 1, Infinity, Number.NaN].map((t) => STILL.warmup(t))).toEqual([
      0.5, 0.5, 0.5, 1, 1.5, 2, 2, 2,
    ]);
  });

  it('the window: the bench’s damage goes in (a burnt resistor a gap), nothing of the bench’s is written', () => {
    const model = createBenchModel({ layout, board: rc(true) });
    model.sync();
    const taps = [{ node: node('7ae') }];
    const whole = model.still({ fs: 24000, count: 240, taps })!;
    // from the operating point: the capacitor charged to its leak's divider of 9 V (sim/core README, «Capacitors»)
    expect(whole.samples[0]![0]!).toBeCloseTo(8.965, 2);
    expect(whole.samples[0]![239]!).toBeCloseTo(8.965, 2);
    const before = JSON.stringify([...model.state.parts]);
    model.still({ fs: 24000, count: 240, taps });
    expect(JSON.stringify([...model.state.parts])).toBe(before);
    memoryOf(model.state, 'R1').burnt = true;
    const gap = model.still({ fs: 24000, count: 240, taps })!;
    expect(Math.abs(gap.samples[0]![0]!)).toBeLessThan(1e-6);
    // a tap the board has not: no window
    expect(model.still({ fs: 24000, count: 240, taps: [{ part: 'R99' }] })).toBeNull();
  });

  it('the window burns nothing on its own heat: a part the bench shows whole carries its current to the end', () => {
    const model = createBenchModel({ layout, board: overload() });
    model.sync();
    // R1 at 0.999 of its limit under a load of 3.1: on its own heat it would burn in the first millisecond
    memoryOf(model.state, 'R1').heat = 0.999;
    expect(model.part('R1')!.condition).toBe('hot');
    const w = model.still({ fs: 24000, count: 240, taps: [{ part: 'R1' }] })!;
    expect(w.warmup).toBe(0.5);
    const i = 9 / (101.5 + 3 * WIRE_OHMS);
    expect(Math.abs(w.samples[0]![0]!)).toBeCloseTo(i, 6);
    expect(Math.abs(w.samples[0]![239]!)).toBeCloseTo(i, 6);
    expect(model.state.parts.get('R1')!.heat).toBe(0.999);
  });
});
