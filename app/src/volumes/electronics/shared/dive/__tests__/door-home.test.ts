/**
 * The door on a live bench (`mountBench` with a stub context and the real `CameraDirector`, no WebGL): `home` brings
 * it back to the step's shot with the lens to its holder — gliding, or at once (`instant`, a step entered without
 * motion: the rail on its start, the camera left on the shot the new step has put it on), so the keeper's pose
 * `door.lens(door.rail.position)` is the holder's and the next dive starts from the step's shot; and what the door
 * feeds the inner views from the bench's model — a resistor's film its current, an electrolytic's plates the voltage
 * across its capacitance and its current — and a film box's roll opened.
 */
import { Group, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { CameraDirector } from '@/engine/camera/director';
import { benchShots, mountBench, type Bench } from '../../bench';
import { asFilm, asPlates, asRoll, chargeCount, electronSpeed, filmTurns } from '../../inside';
import { partDoor, type Door } from '../door';

/** A chapter context with only what the bench and the door use: the camera is the engine's own director. */
function stubContext() {
  const root = new Group();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const camera = new CameraDirector();
  camera.setViewport(1920, 1080);
  const ctx = {
    root,
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: (_n: string, _t: Object3D | (() => unknown)) => () => {} },
    input: { register: () => () => {}, on: () => () => {} },
    device: { formFactor: 'desktop', hover: true },
    viewport: { width: 1920, height: 1080, aspect: 1920 / 1080, dpr: 1 },
    quality: { count: (n: number) => n },
    random: { next, range: (a: number, b: number) => a + (b - a) * next() },
    env: {
      base: () => {},
      setScale: () => {},
      setShadow: () => {},
      tune: () => {},
      params: { keyIntensity: 0 },
    },
    post: { base: () => {} },
    camera,
    reducedMotion: false,
    renderer: { info: { render: { calls: 0 } } },
  } as unknown as ChapterContext;
  return { ctx, camera };
}

const DT = 1 / 60;
/** One frame as a chapter runs it: the bench, then the door. */
const frame = (bench: Bench, door: Door, t: { now: number }): void => {
  t.now += DT;
  bench.update(DT, t.now);
  door.update(DT);
};
/** A 4.7 kΩ in a5 … a9, as the sandbox's step `loupe`; the door dived in to the floor `inside` (rail 1). */
function dived() {
  const { ctx, camera } = stubContext();
  const bench = mountBench(ctx);
  bench.preset([{ id: 'R1', spec: 'resistor-4k7', at: 'a5' }]);
  bench.snap();
  camera.go('board', { instant: true });
  const door = partDoor(ctx, bench, 'R1', { lead: 'board' });
  const t = { now: 0 };
  frame(bench, door, t);
  expect(door.ready).toBe(true);
  door.travelTo(1);
  for (let i = 0; i < 600 && door.rail.moving; i++) frame(bench, door, t);
  expect(door.rail.position).toBe(1);
  expect(door.floor).toBe('inside');
  expect(door.flying).toBe(true);
  expect(bench.flying).toBe(true);
  return { ctx, camera, bench, door, t };
}
const expectHolder = (door: Door, bench: Bench): void => {
  const holder = bench.tools.holder;
  const pose = door.lens(door.rail.position);
  expect(pose.position.distanceTo(holder.position)).toBeLessThan(1e-9);
  expect(pose.facing.distanceTo(holder.facing)).toBeLessThan(1e-9);
  expect(pose.handle.distanceTo(holder.handle)).toBeLessThan(1e-9);
  expect(pose.scale ?? 1).toBeCloseTo(holder.scale ?? 1, 9);
  expect(pose.grip ?? 1).toBeCloseTo(holder.grip ?? 1, 9);
};

describe('the door’s way home', () => {
  it('at once (`instant`): the rail on its start, the lens’s pose the holder’s, the new step’s camera left alone', () => {
    const { camera, bench, door, t } = dived();
    // a step entered without motion: the stage has already put the camera on that step's shot
    camera.go('stand', { instant: true });
    const shot = camera.camera.position.clone();
    door.home({ instant: true, then: 'stand' });
    expect(door.rail.engaged).toBe(false);
    expect(door.rail.moving).toBe(false);
    expect(door.rail.position).toBe(door.rail.rail.min);
    expectHolder(door, bench);
    expect(camera.camera.position.distanceTo(shot)).toBeLessThan(1e-9);
    // the next frame: the dive is over — nothing flies, the part is whole, no floor, the camera still the step's
    frame(bench, door, t);
    expect(door.flying).toBe(false);
    expect(bench.flying).toBe(false);
    expect(door.floor).toBeNull();
    expect(door.cutaway?.amount ?? 0).toBe(0);
    expect(camera.camera.position.distanceTo(shot)).toBeLessThan(1e-9);
    expectHolder(door, bench);
  });

  it('at once, then a new dive: it starts from the step’s shot, not from where the last one ended', () => {
    const { camera, bench, door, t } = dived();
    camera.go('board', { instant: true });
    door.home({ instant: true });
    frame(bench, door, t);
    // the slider moved again toward the lens at work: the first frame is a short way from the holder, not past rail 1
    door.travelTo(0);
    frame(bench, door, t);
    expect(door.rail.engaged).toBe(true);
    expect(door.rail.position).toBeGreaterThan(door.rail.rail.min);
    expect(door.rail.position).toBeLessThan(door.rail.rail.min + 0.1);
    // and the camera leaves the board's shot from where it is: a short way, not a cut toward the inside
    const board = new Vector3(...(benchShots(false).board.position as [number, number, number]));
    expect(camera.camera.position.distanceTo(board)).toBeLessThan(0.2);
  });

  it('gliding: the rail flies back to its start, lets the camera go and the lens’s pose is the holder’s', () => {
    const { camera, bench, door, t } = dived();
    door.home({ then: 'stand' });
    expect(door.rail.engaged).toBe(true);
    for (let i = 0; i < 600 && door.rail.engaged; i++) frame(bench, door, t);
    expect(door.rail.engaged).toBe(false);
    expect(door.rail.position).toBe(door.rail.rail.min);
    expectHolder(door, bench);
    expect(door.flying).toBe(false);
    expect(bench.flying).toBe(false);
    // the rail let the camera go toward the next step's shot
    expect(camera.currentShot).toBe(benchShots(false).stand);
  });
});

describe('the door into a resistor opens its carbon film, fed by the bench’s model', () => {
  it('on `inside` the film is open, its groove cut for the value, its electrons at the speed of the model’s current', () => {
    const { ctx, camera } = stubContext();
    const bench = mountBench(ctx);
    // the LED's loop of `resistor/limit`: + rail → J1 → 330 Ω → the red LED → J2 → − rail, the switch closed
    bench.preset([
      { id: 'J1', spec: 'jumper', at: '+5', to: 'a5' },
      { id: 'R1', spec: 'resistor-330', at: 'b5' },
      { id: 'LED1', spec: 'led-red', at: 'c9' },
      { id: 'J2', spec: 'jumper', at: 'e10', to: '-10' },
    ]);
    bench.closed = 1;
    bench.snap();
    camera.go('board', { instant: true });
    const door = partDoor(ctx, bench, 'R1', { lead: 'board' });
    const t = { now: 0 };
    frame(bench, door, t);
    door.travelTo(1);
    for (let i = 0; i < 600 && door.rail.moving; i++) frame(bench, door, t);
    frame(bench, door, t);
    const film = asFilm(door.cutaway);
    expect(film).not.toBeNull();
    const s = film!.state();
    expect(s.open).toBe(true);
    expect(s.amount).toBe(1);
    expect(s.turns).toBe(filmTurns(330));
    // the model's current through R1 (into its leg 0, b5): 21.2 mA, and the electrons' speed is that current's
    const amps = bench.model.reading('R1')!.i;
    expect(Math.abs(amps)).toBeCloseTo(0.0212351, 6);
    expect(s.amps).toBe(amps);
    expect(s.speed).toBeCloseTo(electronSpeed(amps), 12);
    expect(s.shown).toBeGreaterThan(0);
    expect(s.burnt).toBe(false);
    // the switch opened: no current (the open switch's leak, ~1e-22 A), the electrons stand
    bench.closed = 0;
    for (let i = 0; i < 30; i++) frame(bench, door, t);
    expect(Math.abs(film!.state().amps)).toBeLessThan(1e-12);
    expect(Math.abs(film!.state().speed)).toBeLessThan(1e-11);
    // back home the part is whole again
    door.home({ instant: true });
    frame(bench, door, t);
    expect(film!.state().open).toBe(false);
  });
});

describe('the door into an electrolytic opens its plates, fed by the bench’s model', () => {
  it('on `inside` the charges follow the model’s voltage across the capacitance, the legs its current', () => {
    const { ctx, camera } = stubContext();
    const bench = mountBench(ctx);
    // the board of `capacitor/store`: the LED's loop, the 470 μF across the rails behind J3 and J4, the switch closed
    bench.preset([
      { id: 'J1', spec: 'jumper', at: '+5', to: 'a5' },
      { id: 'R1', spec: 'resistor-330', at: 'b5' },
      { id: 'LED1', spec: 'led-red', at: 'c9' },
      { id: 'J2', spec: 'jumper', at: 'e10', to: '-10' },
      { id: 'J3', spec: 'jumper', at: '+12', to: 'a12' },
      { id: 'J4', spec: 'jumper', at: 'e13', to: '-13' },
      { id: 'C1', spec: 'electrolytic-470u-16v', at: 'c12' },
    ]);
    bench.closed = 1;
    bench.snap();
    camera.go('board', { instant: true });
    const door = partDoor(ctx, bench, 'C1', { lead: 'board' });
    const t = { now: 0 };
    frame(bench, door, t);
    expect(door.ready).toBe(true);
    door.travelTo(1);
    for (let i = 0; i < 600 && door.rail.moving; i++) frame(bench, door, t);
    frame(bench, door, t);
    expect(door.floor).toBe('inside');
    const plates = asPlates(door.cutaway);
    expect(plates).not.toBeNull();
    const s = plates!.state();
    expect(s.open).toBe(true);
    // the voltage across the capacitance the model keeps (its operating point: 8.968 V, the script's model run), not
    // the voltage between the legs; as many charges as that says, the «+» on the plate over leg 0
    const memory = bench.model.state.parts.get('C1')!;
    expect(memory.volts).toBeCloseTo(8.968, 3);
    expect(s.volts).toBe(memory.volts);
    expect(s.charges).toBe(chargeCount(memory.volts!));
    expect(s.charges).toBe(60);
    expect(s.positive).toBe('plus');
    // the current into leg 0 (its leak at the operating point) and the legs' electrons at its speed
    const amps = bench.model.reading('C1')!.i;
    expect(s.amps).toBe(amps);
    expect(s.speed).toBeCloseTo(electronSpeed(amps), 12);
    expect(s.bulged).toBe(false);
    // the switch opened: whatever the model keeps now (the operating point until the bench counts in time), the
    // charges say it
    bench.closed = 0;
    for (let i = 0; i < 10; i++) frame(bench, door, t);
    const after = bench.model.state.parts.get('C1')!.volts ?? 0;
    expect(plates!.state().volts).toBe(after);
    expect(plates!.state().charges).toBe(chargeCount(after));
    door.home({ instant: true });
    frame(bench, door, t);
    expect(plates!.state().open).toBe(false);
  });

  it('while the bench counts in time, the plates, the LED’s light and the meter show one moment of the can’s discharge', () => {
    const { ctx, camera } = stubContext();
    const bench = mountBench(ctx);
    bench.timed = true;
    bench.preset([
      { id: 'J1', spec: 'jumper', at: '+5', to: 'a5' },
      { id: 'R1', spec: 'resistor-330', at: 'b5' },
      { id: 'LED1', spec: 'led-red', at: 'c9' },
      { id: 'J2', spec: 'jumper', at: 'e10', to: '-10' },
      { id: 'J3', spec: 'jumper', at: '+12', to: 'a12' },
      { id: 'J4', spec: 'jumper', at: 'e13', to: '-13' },
      { id: 'C1', spec: 'electrolytic-470u-16v', at: 'c12' },
    ]);
    bench.closed = 1;
    // the multimeter on V across the can's rows
    bench.meter = 1;
    bench.multimeter.put({ red: 'd12', black: 'd13' });
    bench.snap();
    camera.go('board', { instant: true });
    const door = partDoor(ctx, bench, 'C1', { lead: 'board' });
    const t = { now: 0 };
    frame(bench, door, t);
    door.travelTo(1);
    for (let i = 0; i < 600 && door.rail.moving; i++) frame(bench, door, t);
    frame(bench, door, t);
    expect(door.floor).toBe('inside');
    expect(bench.model.timeline.running).toBe(true);
    const plates = asPlates(door.cutaway)!;
    expect(plates.state().volts).toBeCloseTo(8.968, 3);
    expect(plates.state().charges).toBe(60);
    // the switch opened inside: half a second of frames, and every view says the same moment of the board in time
    bench.closed = 0;
    for (let i = 0; i < 30; i++) frame(bench, door, t);
    const volts = bench.model.volts('C1')!;
    expect(volts).toBeCloseTo(2.02, 2);
    expect(plates.state().volts).toBe(volts);
    expect(plates.state().charges).toBe(chargeCount(volts));
    expect(plates.state().amps).toBe(bench.model.reading('C1')!.i);
    // the LED still takes 1.03 mA from the can and lights the board (at the operating point it would be dark)
    expect(bench.model.reading('LED1')!.i).toBeCloseTo(0.001032, 5);
    expect(bench.leds.lit).toContain('LED1');
    // the meter across the can's legs: its capacitance's volts and the ESR's drop of the same moment
    expect(bench.multimeter.live).toBe(bench.model.rowVolts('12ae')! - bench.model.rowVolts('13ae')!);
    expect(bench.multimeter.live).toBeCloseTo(bench.model.reading('C1')!.u, 9);
    // a held frame moves none of it
    bench.update(0, t.now);
    door.update(0);
    expect(bench.model.volts('C1')).toBe(volts);
    expect(plates.state().volts).toBe(volts);
    door.home({ instant: true });
    frame(bench, door, t);
  });

  it('a film box opens its roll', () => {
    const { ctx, camera } = stubContext();
    const bench = mountBench(ctx);
    bench.preset([{ id: 'C1', spec: 'film-1u', at: 'e8' }]);
    bench.snap();
    camera.go('board', { instant: true });
    const door = partDoor(ctx, bench, 'C1', { lead: 'board' });
    const t = { now: 0 };
    frame(bench, door, t);
    door.travelTo(1);
    for (let i = 0; i < 600 && door.rail.moving; i++) frame(bench, door, t);
    frame(bench, door, t);
    const roll = asRoll(door.cutaway);
    expect(roll).not.toBeNull();
    expect(roll!.state().open).toBe(true);
    // the upright section and the face of the corner kept across the winding
    expect(roll!.state().insideCalls).toBe(2);
  });
});
