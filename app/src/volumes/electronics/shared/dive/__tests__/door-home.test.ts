/**
 * The door on a live bench (`mountBench` with a stub context and the real `CameraDirector`, no WebGL): `home` brings
 * it back to the step's shot with the lens to its holder — gliding, or at once (`instant`, a step entered without
 * motion: the rail on its start, the camera left on the shot the new step has put it on), so the keeper's pose
 * `door.lens(door.rail.position)` is the holder's and the next dive starts from the step's shot.
 */
import { Group, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { CameraDirector } from '@/engine/camera/director';
import { benchShots, mountBench, type Bench } from '../../bench';
import { asFilm, electronSpeed, filmTurns } from '../../inside';
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
