/**
 * The reader's hand on the bench (docs/volumes/electronics/VISUAL.md §6), driven with fake pointer events through a
 * stub `ctx.input` on a real bench (no WebGL): gesture 1 carries a whole part (from the tray, from the board, back to
 * the tray) with its legs previewed over the sockets they would take; gesture 2 moves one end (a leg, a jumper's end, a
 * plug) and clicks it into the nearest free socket within `SNAP` while the hand moves — never between sockets, never
 * back into the socket it just left until the hand has gone `AWAY`, never past the part's reach. The board's state
 * changes when a leg has arrived (`seated`), not when the hand lets go; events that come after the hand let go are
 * ignored. The grips' spheres and the share of the screen each target keeps follow VISUAL §6 and §8.
 */
import {
  Box3,
  Group,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext, DragInfo, InteractionHandlers, PointerInfo } from '@/engine/api';
import { netlistOf } from '@electronics/sim/board';
import { createElectrolytic, createLed, buildPart, type PartModel } from '../../parts';
import { STAGE_SHOTS, mountBench, type Bench } from '../../bench';
import {
  AWAY,
  HOVER,
  NEAR,
  RING_Y,
  SEAT_SECONDS,
  SNAP,
  TAB_AHEAD,
  TAB_R,
  TAB_SIDE,
  gripSpots,
  type HandKey,
} from '../hands';

/* ------------------------------------------------------------------------------------------- the stub */

/** A chapter context with what the bench uses; `ctx.input` keeps every registration so a test can press things. */
function stubContext() {
  const handlers = new Map<Object3D, InteractionHandlers>();
  const readers = new Map<string, () => unknown>();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const camera = new PerspectiveCamera(27, 1920 / 1080, 0.1, 100);
  camera.position.set(...STAGE_SHOTS.stand.position);
  camera.lookAt(...STAGE_SHOTS.stand.target);
  camera.updateMatrixWorld();
  const ctx = {
    root: new Group(),
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: {
      expose: (name: string, fn: () => unknown) => (readers.set(name, fn), () => {}),
      probe: () => () => {},
    },
    input: {
      register: (o: Object3D, h: InteractionHandlers) => {
        handlers.set(o, h);
        return () => void handlers.delete(o);
      },
      on: () => () => {},
    },
    device: { formFactor: 'desktop', hover: true, pointer: 'fine' },
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
    camera: { shots: () => {}, camera },
    renderer: { info: { render: { calls: 0 } } },
  } as unknown as ChapterContext;
  return { ctx, handlers, camera, read: (name: string) => readers.get(name)!() };
}

/** A bench with a tray, and a hand that presses, drags and lets go of what is registered. */
function setup(tray: readonly string[] = ['resistor-1k', 'jumper', 'led-red']) {
  const { ctx, handlers, camera, read } = stubContext();
  const bench = mountBench(ctx);
  bench.tray.set(tray);
  let t = 0;
  const frames = (seconds: number, dt = 1 / 60) => {
    for (let k = 0; k < Math.round(seconds / dt); k++) bench.update(dt, (t += dt));
  };
  frames(1 / 60);
  /** A board point (board frame, on the face) as a pointer event: the pick ray from the camera through it. */
  const event = (x: number, z: number, object: Object3D, pointerType = 'mouse'): DragInfo => {
    const world = bench.board.group.localToWorld(new Vector3(x, 0, z));
    const ray = new Ray(camera.position.clone(), world.clone().sub(camera.position).normalize());
    const ndc = world.clone().project(camera);
    return {
      pointerId: 1,
      pointerType,
      x: ((ndc.x + 1) / 2) * 1920,
      y: ((1 - ndc.y) / 2) * 1080,
      ndc: new Vector2(ndc.x, ndc.y),
      ray,
      point: world,
      object,
      layer: 'world',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      // the hand is where the press was: the drag starts at once
      dx: 0,
      dy: 0,
      totalX: 0,
      totalY: 0,
      startPoint: world,
      planePoint(normal: Vector3, through: Vector3, out = new Vector3()) {
        const d = normal.dot(ray.direction);
        if (Math.abs(d) < 1e-9) return null;
        const k = normal.dot(through.clone().sub(ray.origin)) / d;
        return out.copy(ray.origin).addScaledVector(ray.direction, k);
      },
    } as unknown as DragInfo;
  };
  const h = (o: Object3D | undefined): InteractionHandlers => {
    expect(o, 'a registered object').toBeDefined();
    const it = handlers.get(o!);
    expect(it, `${o!.name} is registered`).toBeDefined();
    return it!;
  };
  const sock = (id: string) => bench.layout.socket(id)!;
  /** Where the hand is: a board point, or a socket with an offset. */
  type At = readonly [x: number, z: number] | string;
  const xz = (a: At): [number, number] => (typeof a === 'string' ? [sock(a).x, sock(a).z] : [a[0], a[1]]);
  /** Press `o` at `from`, drag through `path` (a frame after every move); the release function. */
  const drag = (o: Object3D, from: At, path: readonly At[], pointerType = 'mouse') => {
    const hd = h(o);
    expect(hd.enabled?.() ?? true, `${o.name} enabled`).toBe(true);
    hd.press?.(event(...xz(from), o, pointerType));
    hd.dragStart?.(event(...xz(from), o, pointerType));
    frames(1 / 60);
    for (const p of path) {
      hd.drag?.(event(...xz(p), o, pointerType));
      frames(1 / 60);
    }
    return {
      move(p: At) {
        hd.drag?.(event(...xz(p), o, pointerType));
        frames(1 / 60);
      },
      up(at: At = path.at(-1) ?? from) {
        hd.dragEnd?.(event(...xz(at), o, pointerType));
        frames(1 / 60);
      },
    };
  };
  const click = (o: Object3D) => {
    const hd = h(o);
    expect(hd.enabled?.() ?? true, `${o.name} enabled`).toBe(true);
    hd.click?.(event(0, 0, o));
  };
  const legs = (id: string) => bench.state.parts.get(id)?.legs;
  const key = () => netlistOf(bench.layout, bench.state).key;
  const grip = (k: HandKey) => bench.hands.grip(k)!.hit;
  const slot = (spec: string) => bench.tray.slot(spec)!.hit;
  const part = (id: string) => bench.parts.models.get(id)!.hit;
  return { bench, ctx, read, frames, drag, click, legs, key, grip, slot, part, sock, handlers, camera };
}

/** A point `d` from socket `id` along +x (board frame). */
const beside = (b: Bench, id: string, dx: number, dz = 0): [number, number] => {
  const s = b.layout.socket(id)!;
  return [s.x + dx, s.z + dz];
};

/* ----------------------------------------------------------------------------------------- the numbers */

describe('the numbers of the hand (VISUAL §6)', () => {
  it('are the table’s', () => {
    expect(SNAP).toBe(0.135);
    expect(AWAY).toBe(0.15);
    expect(NEAR).toBeCloseTo(0.243, 9);
    expect(SEAT_SECONDS).toBe(0.18);
    expect(HOVER).toBe(0.35);
    expect(RING_Y).toBe(0.14);
    expect(TAB_AHEAD).toBe(0.17);
    expect(TAB_R).toBe(0.15);
    expect(TAB_SIDE).toBe(0.15);
  });
});

/* ------------------------------------------------------------------------------------------ gesture 2 */

describe('gesture 2: one leg at a time', () => {
  it('takes the leg out at once (pending), clicks into a free socket within SNAP, the state changing on arrival', () => {
    const { bench, drag, frames, legs, key, grip } = setup();
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'a3' }]);
    frames(1 / 60);
    const before = key();
    const g = drag(grip('leg:R1:1'), 'a7', []);
    expect(bench.hands.held).toBe('leg:R1:1');
    expect(legs('R1')).toEqual(['a3', null]);
    expect(netlistOf(bench.layout, bench.state).pending).toEqual(['R1']);
    // halfway between a8 and a9: farther than SNAP from both — no click, but a8 or a9 is near (the cue ring)
    const mid = beside(bench, 'a8', bench.layout.spec.pitch / 2);
    g.move(mid);
    expect(bench.hands.held).toBe('leg:R1:1');
    expect(['a8', 'a9']).toContain(bench.hands.near);
    expect(bench.hands.rows.length).toBe(1);
    // within SNAP of a8: it clicks in while the hand still moves; the hand is free at once
    g.move(beside(bench, 'a8', 0.09, 0.05));
    expect(bench.hands.held).toBeNull();
    expect(bench.hands.near).toBeNull();
    // the state changes when the leg has arrived (SEAT_SECONDS), not before
    expect(legs('R1')).toEqual(['a3', null]);
    frames(SEAT_SECONDS - 2 / 60);
    expect(legs('R1')).toEqual(['a3', null]);
    frames(3 / 60);
    expect(legs('R1')).toEqual(['a3', 'a8']);
    expect(key()).not.toBe(before);
    // the events that come after the click are the gesture's rest: ignored
    g.move(beside(bench, 'a10', 0.02));
    g.up(beside(bench, 'a10', 0.02));
    frames(0.3);
    expect(legs('R1')).toEqual(['a3', 'a8']);
    expect(bench.hands.held).toBeNull();
  });

  it('does not click back into the socket it just left until the hand has gone AWAY from it', () => {
    const { bench, drag, frames, legs, grip } = setup();
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'a3' }]);
    frames(1 / 60);
    const g = drag(grip('leg:R1:1'), 'a7', [beside(bench, 'a7', 0.06), beside(bench, 'a7', 0.1)]);
    // within SNAP of a7 all along: still held, a7 not taken back
    expect(bench.hands.held).toBe('leg:R1:1');
    expect(legs('R1')).toEqual(['a3', null]);
    // beyond AWAY (but farther than SNAP from every socket: between a7 and a8, off the line), then back to a7
    g.move(beside(bench, 'a7', 0.15, 0.06));
    expect(bench.hands.held).toBe('leg:R1:1');
    g.move(beside(bench, 'a7', 0.02));
    expect(bench.hands.held).toBeNull();
    frames(SEAT_SECONDS + 2 / 60);
    expect(legs('R1')).toEqual(['a3', 'a7']);
  });

  it('keeps the leg within the part’s reach from its other legs (a resistor 4 … 6 P) and clicks only there', () => {
    const { bench, drag, frames, legs, grip } = setup();
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'a3' }]);
    frames(1 / 60);
    const a3 = bench.board.socketLocal('a3');
    const P = bench.layout.spec.pitch;
    const leg = () => bench.parts.legs.get('R1')![1]!;
    // off the line, between a7 and b7: farther than SNAP from both
    const g = drag(grip('leg:R1:1'), 'a7', [beside(bench, 'a7', 0.02, 0.15)]);
    expect(bench.hands.held).toBe('leg:R1:1');
    /** A board point at `r` from a3 at `deg` toward the reader. */
    const from = (r: number, deg: number): [number, number] => [
      a3.x + r * Math.cos((deg * Math.PI) / 180),
      a3.z + r * Math.sin((deg * Math.PI) / 180),
    ];
    // far out at 24°: held at 6 P from a3, in plan, where no socket is within SNAP — still in the hand
    g.move(from(3, 24));
    frames(0.1); // the end comes to the hand in 0.08 s after the press, then follows it at once
    const far = Math.hypot(leg().pos.x - a3.x, leg().pos.z - a3.z);
    expect(far).toBeLessThanOrEqual(6 * P + 1e-9);
    expect(far).toBeGreaterThan(6 * P - 1e-6);
    expect(bench.hands.held).toBe('leg:R1:1');
    // close to a3 at 22°: held at 4 P — the sockets nearer than 4 P (a4 … a6, b4 …) are out of its reach
    g.move(from(0.5, 22));
    const close = Math.hypot(leg().pos.x - a3.x, leg().pos.z - a3.z);
    expect(close).toBeGreaterThanOrEqual(4 * P - 1e-9);
    expect(close).toBeLessThan(4 * P + 1e-6);
    expect(bench.hands.held).toBe('leg:R1:1');
    // let go with no socket: the leg goes back to where it was (a part's leg never stays in the air on its own)
    g.up();
    expect(legs('R1')).toEqual(['a3', null]);
    frames(0.4);
    expect(legs('R1')).toEqual(['a3', 'a7']);
  });

  it('a wire’s end clicks in where it is let go within SNAP, and lies there otherwise; a plug the same way', () => {
    const { bench, drag, frames, legs, grip, key } = setup();
    bench.preset([{ id: 'J1', spec: 'jumper', at: 'a5' }]);
    frames(1 / 60);
    // the jumper's end from a5 to +5, one line up across the gap to the rail: carried over a4 and a3 within SNAP of
    // them, it does not click in on its way (it would never reach its row)
    const g = drag(grip('leg:J1:0'), 'a5', [beside(bench, 'a5', 0, -0.2), 'a4', 'a3', beside(bench, '+5', 0.02, 0.03)]);
    expect(bench.hands.held).toBe('leg:J1:0');
    expect(bench.hands.near).toBe('+5');
    expect(legs('J1')).toEqual([null, 'a9']);
    // let go within SNAP of +5: it clicks in; the board changes when it has arrived
    g.up();
    expect(bench.hands.held).toBeNull();
    expect(legs('J1')).toEqual([null, 'a9']);
    frames(SEAT_SECONDS + 2 / 60);
    expect(legs('J1')).toEqual(['+5', 'a9']);
    // the gesture's late events are ignored
    g.move('a7');
    g.up('a7');
    frames(0.3);
    expect(legs('J1')).toEqual(['+5', 'a9']);
    // the other end let go between sockets: it lies there, out of every socket, and the jumper is pending
    const h2 = drag(grip('leg:J1:1'), 'a9', [beside(bench, 'a9', 0.15, 0.4)]);
    h2.up();
    frames(0.3);
    expect(legs('J1')).toEqual(['+5', null]);
    expect(netlistOf(bench.layout, bench.state).pending).toEqual(['J1']);
    const lying = bench.parts.legs.get('J1')![1]!;
    expect(lying.place.kind).toBe('lie');
    // a speaker's plug, lying by the speaker, into a socket of the right end: the speaker is in the circuit then
    const before = key();
    const end = bench.fixed.leads.get('spk+')!;
    const from: [number, number] = [end.leg.pos.x, end.leg.pos.z];
    const target = bench.layout.socket('c17')!;
    drag(grip('lead:spk+'), from, [
      [(from[0] + target.x) / 2 + 0.4, (from[1] + target.z) / 2],
      [target.x + 0.05, target.z],
    ]).up();
    frames(SEAT_SECONDS + 2 / 60);
    expect(bench.state.leads.get('spk+')).toBe('c17');
    // pending until both plugs are in: the speaker's other plug is still out
    expect(netlistOf(bench.layout, bench.state).pending).toContain('SPK');
    expect(key()).toBe(before);
  });

  it('is inert while the camera flies, and for what the step does not let the reader take', () => {
    const { bench, frames, handlers, grip } = setup();
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'a3' }]);
    frames(1 / 60);
    const hd = handlers.get(grip('leg:R1:1'))!;
    expect(hd.enabled!()).toBe(true);
    bench.flying = true;
    expect(hd.enabled!()).toBe(false);
    bench.flying = false;
    bench.hands.policy = { take: (k) => k !== 'leg:R1:1' };
    expect(hd.enabled!()).toBe(false);
    expect(handlers.get(bench.parts.models.get('R1')!.hit)!.enabled!()).toBe(true);
  });

  it('shows no grip and lights no body while the camera flies (a touch screen shows them otherwise)', () => {
    const { bench, ctx, frames, handlers, grip } = setup();
    (ctx.device as { hover: boolean }).hover = false;
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'a3' }], { 'spk+': 'c17' });
    frames(1 / 60);
    const r1 = bench.parts.models.get('R1')!;
    handlers.get(r1.hit)!.hover?.(true, {} as PointerInfo);
    frames(0.3);
    const shown = (k: HandKey) => bench.hands.grip(k)!.shown.value;
    expect(shown('leg:R1:0')).toBe(1);
    expect(shown('lead:spk+')).toBe(1);
    expect(r1.body[0]!.emissiveIntensity).toBeCloseTo(0.3, 9);
    bench.flying = true;
    frames(0.3);
    expect(shown('leg:R1:0')).toBe(0);
    expect(shown('lead:spk+')).toBe(0);
    expect(r1.body[0]!.emissiveIntensity).toBe(0);
    bench.flying = false;
    frames(0.3);
    expect(shown('leg:R1:0')).toBe(1);
    expect(handlers.get(grip('leg:R1:0'))!.enabled!()).toBe(true);
  });
});

/* ------------------------------------------------------------------------------------------ gesture 1 */

describe('gesture 1: a whole part', () => {
  it('from the tray: R1 in the hand at once, its legs previewed over the sockets, down in them on arrival', () => {
    const { bench, drag, frames, legs, slot, read } = setup();
    const slotAt = bench.board.group.worldToLocal(bench.tray.slot('resistor-1k')!.at.clone());
    const g = drag(slot('resistor-1k'), [slotAt.x, slotAt.z], [[0, 2.6], [0, 1.2]]);
    expect(bench.hands.held).toBe('part:R1');
    // the part is on the bench and out of every socket while it is carried: the netlist leaves it out, not pending
    expect(legs('R1')).toEqual([null, null]);
    expect(netlistOf(bench.layout, bench.state).pending).toEqual([]);
    // leg 0 over a3 (within SNAP): the preview is a3 and a7, both rows lit, the part hovering over them
    g.move(beside(bench, 'a3', 0.05, 0.05));
    expect(bench.hands.preview).toEqual(['a3', 'a7']);
    expect([...bench.hands.rows].sort()).toEqual(['3ae', '7ae']);
    frames(0.3);
    const tips = bench.parts.legs.get('R1')!.map((l) => l.pos);
    expect(tips[0]!.distanceTo(bench.board.socketLocal('a3').setY(HOVER))).toBeLessThan(1e-6);
    expect(tips[1]!.distanceTo(bench.board.socketLocal('a7').setY(HOVER))).toBeLessThan(1e-6);
    // between sockets: no preview, the part just follows the hand
    g.move(beside(bench, 'a3', 0.15, 0.15));
    expect(bench.hands.preview).toEqual([]);
    // a leg would fall off the board: no preview
    g.move('a16');
    expect(bench.hands.preview).toEqual([]);
    // over a3 again and let go: the legs go down; the state changes when they have arrived
    g.move('a3');
    g.up('a3');
    expect(bench.hands.held).toBeNull();
    expect(legs('R1')).toEqual([null, null]);
    frames(SEAT_SECONDS + 2 / 60);
    expect(legs('R1')).toEqual(['a3', 'a7']);
    expect(read('electronics-board')).toMatchObject({ parts: { R1: { legs: ['a3', 'a7'] } } });
    // the next from the tray is R2, and a7 being taken, it finds no place at a3
    const h2 = drag(slot('resistor-1k'), [slotAt.x, slotAt.z], [[0, 1.2], beside(bench, 'a7', 0.02)]);
    expect(bench.hands.held).toBe('part:R2');
    expect(bench.hands.preview).toEqual([]);
    h2.move('b7');
    expect(bench.hands.preview).toEqual(['b7', 'b11']);
    h2.up('b7');
    frames(SEAT_SECONDS + 2 / 60);
    expect(legs('R2')).toEqual(['b7', 'b11']);
  });

  it('from the board: the part leaves its sockets at the press; let go with no place it goes back, off the board to the tray', () => {
    const { bench, drag, frames, legs, part, key } = setup();
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'c3' }]);
    frames(1 / 60);
    const before = key();
    const g = drag(part('R1'), 'c5', [beside(bench, 'c5', 0.15, 0.15)]);
    expect(bench.hands.held).toBe('part:R1');
    expect(legs('R1')).toEqual([null, null]);
    expect(key()).not.toBe(before);
    // over the board, between sockets: back to c3 … c7
    g.up();
    frames(SEAT_SECONDS + 0.2);
    expect(legs('R1')).toEqual(['c3', 'c7']);
    expect(key()).toBe(before);
    // carried with the hand's grip: the hand at c5 holds leg 0 at c3; moved by two columns, leg 0 is over c5
    const h2 = drag(part('R1'), 'c5', ['c6', 'c7']);
    expect(bench.hands.preview).toEqual(['c5', 'c9']);
    // off the board (over the tray): no preview; let go there, it flies to the tray and is gone
    h2.move([0, 2.9]);
    expect(bench.hands.preview).toEqual([]);
    h2.up([0, 2.9]);
    frames(0.2);
    expect(bench.state.parts.has('R1')).toBe(true);
    frames(0.3);
    expect(bench.state.parts.has('R1')).toBe(false);
    expect(bench.parts.models.has('R1')).toBe(false);
  });

  it('a part from the tray takes the board’s tilt on its way and lays it down again on its way back: never a turn in one frame', () => {
    const { bench, drag, frames, legs, slot, part } = setup();
    const slotAt = bench.board.group.worldToLocal(bench.tray.slot('resistor-1k')!.at.clone());
    /** The body's turn against the table (the world is level with it), and against the board (tilted 15°). */
    const table = new Quaternion();
    const board = bench.board.group.getWorldQuaternion(new Quaternion());
    const turn = () => bench.parts.models.get('R1')!.group.getWorldQuaternion(new Quaternion());
    const tilt = (board.angleTo(table) * 180) / Math.PI;
    expect(tilt).toBeCloseTo(15, 6);
    const deg = (a: Quaternion, b: Quaternion) => (a.angleTo(b) * 180) / Math.PI;
    /** Frame by frame while `step` runs: the largest turn of the body from one frame to the next, and the last pose. */
    const watch = (n: number, step: (k: number) => void) => {
      let prev = turn();
      let most = 0;
      for (let k = 0; k < n && bench.parts.models.has('R1'); k++) {
        step(k);
        if (!bench.parts.models.has('R1')) break;
        const q = turn();
        most = Math.max(most, deg(q, prev));
        prev = q;
      }
      return { most, last: prev };
    };

    // pressed in the tray: the new part stands as the sample stood, level with the table
    const g = drag(slot('resistor-1k'), [slotAt.x, slotAt.z], []);
    expect(bench.hands.held).toBe('part:R1');
    expect(deg(turn(), table)).toBeLessThan(1);
    // on its way to a3 it takes the board's tilt in 0.25 s, a little every frame
    const a3 = bench.layout.socket('a3')!;
    const up = watch(30, (k) => g.move([slotAt.x + ((a3.x - slotAt.x) * (k + 1)) / 30, slotAt.z + ((a3.z - slotAt.z) * (k + 1)) / 30]));
    expect(up.most).toBeGreaterThan(0.2);
    expect(up.most).toBeLessThan(2.5);
    expect(deg(up.last, board)).toBeLessThan(1e-3);
    g.up('a3');
    frames(SEAT_SECONDS + 2 / 60);
    expect(legs('R1')).toEqual(['a3', 'a7']);

    // taken from the board and let go off it: on its way back to its slot it lays the tilt down, a little every frame
    const h2 = drag(part('R1'), 'a5', [[0, 1.6]]);
    h2.move([slotAt.x, slotAt.z]);
    expect(deg(turn(), board)).toBeLessThan(1e-3);
    h2.up([slotAt.x, slotAt.z]);
    const down = watch(60, () => frames(1 / 60));
    expect(down.most).toBeGreaterThan(0.2);
    expect(down.most).toBeLessThan(2.5);
    // its last frame before it is gone: level with the table again
    expect(deg(down.last, table)).toBeLessThan(1);
    frames(0.2);
    expect(bench.state.parts.has('R1')).toBe(false);
  });

  it('a click turns a placed part end for end (o + 2): lifted, turned, put back over the same sockets', () => {
    const { bench, click, frames, legs, part } = setup();
    bench.preset([{ id: 'LED1', spec: 'led-red', at: 'e7' }]);
    frames(1 / 60);
    click(part('LED1'));
    frames(0.1);
    expect(legs('LED1')).toEqual([null, null]);
    const mid = bench.parts.legs.get('LED1')!.map((l) => l.pos.y);
    expect(Math.min(...mid)).toBeGreaterThan(0.05);
    frames(0.3);
    expect(legs('LED1')).toEqual(['e8', 'e7']);
    // a step that does not let the part turn: the click does nothing
    bench.hands.policy = { take: () => true, flip: () => false };
    click(part('LED1'));
    frames(0.4);
    expect(legs('LED1')).toEqual(['e8', 'e7']);
  });

  it('on a phone the tray is in the dock: `offer` puts a new part in the hand over the board, taken from there', () => {
    const { bench, drag, frames, legs, part } = setup();
    const id = bench.hands.offer('resistor-1k');
    expect(id).toBe('R1');
    frames(0.3);
    expect(legs('R1')).toEqual([null, null]);
    const m = bench.parts.models.get('R1')!;
    expect(m.group.visible).toBe(true);
    // it hangs over the middle of the field of sockets, above the board
    const tips = bench.parts.legs.get('R1')!.map((l) => l.pos);
    expect(Math.min(...tips.map((t) => t.y))).toBeGreaterThanOrEqual(HOVER - 1e-9);
    const g = drag(part('R1'), [(tips[0]!.x + tips[1]!.x) / 2, tips[0]!.z], ['e9']);
    expect(bench.hands.held).toBe('part:R1');
    g.move('e10');
    g.up('e10');
    frames(SEAT_SECONDS + 2 / 60);
    expect(legs('R1')!.every((s) => s !== null)).toBe(true);
    // a second offer while one hangs replaces it: never two parts in the air
    bench.hands.offer('resistor-1k');
    bench.hands.offer('resistor-1k');
    frames(1 / 60);
    expect([...bench.state.parts.values()].filter((p) => p.legs.every((s) => s === null)).length).toBe(1);
  });

  it('ignores the late events of a gesture: after the hand let go, a drag of the same press changes nothing', () => {
    const { bench, drag, frames, legs, part } = setup();
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'c3' }]);
    frames(1 / 60);
    const g = drag(part('R1'), 'c5', ['d5']);
    g.up('d5');
    g.move('h5');
    g.up('h5');
    frames(0.5);
    expect(legs('R1')).toEqual(['d3', 'd7']);
    expect(bench.hands.held).toBeNull();
  });
});

describe('the leads drape over the parts on the board (synthesis §2.3)', () => {
  it('a plug let go on a part’s body lies on it and its wire goes over it; the part taken away, it sinks back, never a jump', () => {
    const { bench, drag, frames, grip, part, legs } = setup();
    bench.preset([{ id: 'R1', spec: 'resistor-1k', at: 'c11' }]);
    frames(0.3);
    /** The part's body box in the board's frame. */
    const body = () => {
      const hit = bench.parts.models.get('R1')!.hit;
      hit.updateWorldMatrix(true, false);
      const rel = bench.board.group.matrixWorld.clone().invert().multiply(hit.matrixWorld);
      return new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5)).applyMatrix4(rel);
    };
    const box = body();
    expect(box.max.y).toBeGreaterThan(0.1);
    // let go over the body, half a pitch from c12 and c13 (farther than SNAP from both: it lies)
    const lead = bench.fixed.leads.get('spk+')!;
    const c12 = bench.layout.socket('c12')!;
    const over: [number, number] = [c12.x + bench.layout.spec.pitch / 2, c12.z];
    expect(over[0]).toBeGreaterThan(box.min.x);
    expect(over[0]).toBeLessThan(box.max.x);
    const put = drag(grip('lead:spk+'), [lead.leg.pos.x, lead.leg.pos.z], [[over[0] + 0.6, over[1]], over]);
    // the plug comes to the hand in 0.08 s after the press, then follows it: a few frames over the body, let go there
    for (let k = 0; k < 8; k++) put.move(over);
    put.up(over);
    frames(0.4);
    expect(Math.hypot(lead.leg.pos.x - over[0], lead.leg.pos.z - over[1])).toBeLessThan(1e-6);
    expect(lead.leg.place.kind).toBe('lie');
    expect(bench.state.leads.has('spk+')).toBe(false);
    // the plug's axis lies over the body's top, not inside it
    expect(lead.leg.pos.y).toBeGreaterThan(box.max.y);
    // its wire goes over the body: no point of the tube is inside the body (a cylinder along x, the box's radius)
    const pos = lead.wire.geometry.getAttribute('position');
    const cy = (box.min.y + box.max.y) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    const r = (box.max.y - box.min.y) / 2;
    let across = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x < box.min.x || x > box.max.x) continue;
      const off = Math.hypot(pos.getY(i) - cy, pos.getZ(i) - cz);
      if (Math.abs(pos.getZ(i) - cz) < r) across++;
      expect(off).toBeGreaterThan(r);
    }
    expect(across).toBeGreaterThan(5);
    // R1 taken by its body off the board into the tray: the plug sinks onto the board's face a little every frame
    const slotAt = bench.board.group.worldToLocal(bench.tray.slot('resistor-1k')!.at.clone());
    const g = drag(part('R1'), 'c14', [[0, 1.6]]);
    expect(legs('R1')).toEqual([null, null]);
    let prev = lead.leg.pos.y;
    let most = 0;
    for (let k = 0; k < 30; k++) {
      g.move([slotAt.x, slotAt.z]);
      most = Math.max(most, Math.abs(lead.leg.pos.y - prev));
      prev = lead.leg.pos.y;
    }
    g.up([slotAt.x, slotAt.z]);
    frames(0.6);
    expect(bench.state.parts.has('R1')).toBe(false);
    expect(most).toBeGreaterThan(0.005);
    expect(most).toBeLessThan(0.05);
    // on the board's face again: the axis a plug's radius over it
    expect(lead.leg.pos.y).toBeCloseTo(0.05, 6);
  });
});

describe('the battery’s switch', () => {
  it('a tap flips the setting of SW, the slider follows', () => {
    const { bench, frames, handlers } = setup();
    const hit = bench.switch.hit;
    const hd = handlers.get(hit)!;
    expect(bench.state.settings.get('SW') ?? 0).toBe(0);
    hd.click!({} as never);
    expect(bench.state.settings.get('SW')).toBe(1);
    expect(bench.closed).toBe(1);
    frames(0.5);
    hd.click!({} as never);
    expect(bench.state.settings.get('SW')).toBe(0);
    bench.closed = 1;
    expect(bench.state.settings.get('SW')).toBe(1);
  });
});

/* ------------------------------------------------------------------------------- grips: VISUAL §6, §8 */

describe('the grips’ spheres (VISUAL §6, the table)', () => {
  const at = (bench: Bench, ids: readonly string[]) => ids.map((s) => bench.board.socketLocal(s));
  it('a ring on each leg of an axial part, below its bend; a tab before a radial part’s body', () => {
    const { bench } = setup();
    const cases: [string, PartModel, number][] = [
      ['resistor-1k', buildPart('resistor-1k')!, 0.215],
      ['diode-1n4148', buildPart('diode-1n4148')!, 0.3],
      ['diode-1n4007', buildPart('diode-1n4007')!, 0.28],
    ];
    for (const [name, m, r] of cases) {
      const tips = at(bench, ['e5', 'e9']);
      m.fit(tips);
      const spots = gripSpots(m, 'axial', tips);
      expect(spots.map((s) => s.kind), name).toEqual(['ring', 'ring']);
      spots.forEach((s, k) => {
        expect(s.r, name).toBeCloseTo(r, 3);
        expect(s.at.distanceTo(tips[k]!.clone().setY(RING_Y)), name).toBeLessThan(1e-9);
      });
    }
    for (const [name, m] of [
      ['LED', createLed('red')],
      ['1000 μF', createElectrolytic(1000e-6, 16)],
    ] as const) {
      // side by side: each head before its own leg; one behind the other: the back one left, the front one right
      for (const [ids, o] of [
        [['e5', 'e6'], 'side'],
        [['a5', 'b5'], 'behind'],
      ] as const) {
        const tips = at(bench, ids);
        m.fit(tips);
        m.group.updateMatrixWorld(true);
        const box = new Box3().setFromObject(m.hit);
        const spots = gripSpots(m, 'radial', tips);
        expect(spots.map((s) => s.kind), name).toEqual(['tab', 'tab']);
        for (const s of spots) {
          expect(s.r, name).toBeCloseTo(TAB_R, 9);
          expect(s.at.y).toBeCloseTo(0.05, 9);
          expect(s.at.z - box.max.z, `${name} ${o}`).toBeCloseTo(TAB_AHEAD, 6);
        }
        if (o === 'side') spots.forEach((s, k) => expect(s.at.x, name).toBeCloseTo(tips[k]!.x, 9));
        else {
          const cx = tips[0]!.x;
          expect(spots[0]!.at.x - cx, `${name}: the back leg's head`).toBeCloseTo(-TAB_SIDE, 9);
          expect(spots[1]!.at.x - cx, `${name}: the front leg's head`).toBeCloseTo(TAB_SIDE, 9);
        }
      }
    }
  });
});

/**
 * VISUAL §8, «Захвати й ознаки на екрані», the second part, as the plan's check does it: rays from the cameras of the
 * shots `stand`, `board` and `phone` (the phone's re-framing changes only the projection) at an LED and the biggest
 * electrolytic (tabs), a resistor and a 1N4007 (rings) on the lines a, e, j and the columns 1, 9, 17 at every quarter
 * turn. The grips are the code's (`gripSpots`), the body's box the model's own `hit`; the true shapes of the LED and the
 * can are their cylinders and dome.
 */
describe('every grip is seen and comes before the body; the body keeps its share (VISUAL §8)', () => {
  type Prim =
    | { kind: 'box'; min: Vector3; max: Vector3 }
    | { kind: 'sph'; c: Vector3; r: number }
    | { kind: 'cyl'; x: number; z: number; r: number; y0: number; y1: number };
  const hit = (o: Vector3, d: Vector3, q: Prim): number => {
    if (q.kind === 'box') {
      let t0 = 1e-9;
      let t1 = Infinity;
      for (const ax of ['x', 'y', 'z'] as const) {
        if (Math.abs(d[ax]) < 1e-12) {
          if (o[ax] < q.min[ax] || o[ax] > q.max[ax]) return Infinity;
          continue;
        }
        const a = (q.min[ax] - o[ax]) / d[ax];
        const b = (q.max[ax] - o[ax]) / d[ax];
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
      }
      return t0 <= t1 ? t0 : Infinity;
    }
    if (q.kind === 'sph') {
      const v = o.clone().sub(q.c);
      const a = d.lengthSq();
      const b = v.dot(d);
      const c = v.lengthSq() - q.r * q.r;
      if (b * b < a * c) return Infinity;
      const t = (-b - Math.sqrt(b * b - a * c)) / a;
      return t > 1e-9 ? t : Infinity;
    }
    const vx = o.x - q.x;
    const vz = o.z - q.z;
    let best = Infinity;
    const a = d.x * d.x + d.z * d.z;
    const b = vx * d.x + vz * d.z;
    const c = vx * vx + vz * vz - q.r * q.r;
    if (a > 1e-12 && b * b >= a * c) {
      const t = (-b - Math.sqrt(b * b - a * c)) / a;
      const y = o.y + t * d.y;
      if (t > 1e-9 && y >= q.y0 && y <= q.y1) best = t;
    }
    for (const y of [q.y0, q.y1]) {
      const t = Math.abs(d.y) > 1e-12 ? (y - o.y) / d.y : Infinity;
      if (t > 1e-9 && t < best && (vx + t * d.x) ** 2 + (vz + t * d.z) ** 2 <= q.r * q.r) best = t;
    }
    return best;
  };
  const first = (o: Vector3, d: Vector3, prims: readonly Prim[]) => Math.min(Infinity, ...prims.map((q) => hit(o, d, q)));
  /** Rays from `cam` through a disc of radius r around c, across the view. */
  const rays = (cam: Vector3, c: Vector3, r: number, n: number): Vector3[] => {
    const f = c.clone().sub(cam);
    const u = new Vector3(-f.z, 0, f.x).normalize();
    const v = new Vector3().crossVectors(u, f).normalize();
    const out: Vector3[] = [];
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++) {
        const a = i / n;
        const b = j / n;
        if (a * a + b * b <= 1) out.push(c.clone().addScaledVector(u, r * a).addScaledVector(v, r * b).sub(cam));
      }
    return out;
  };
  /** Share of points on a ring (or a disc's rim) of radius r around c (horizontal) that the camera sees. */
  const seen = (cam: Vector3, c: Vector3, r: number, shape: readonly Prim[]) => {
    let n = 0;
    for (let i = 0; i < 12; i++) {
      const p = c.clone().add(new Vector3(Math.cos((i * Math.PI) / 6) * r, 0, Math.sin((i * Math.PI) / 6) * r));
      const d = cam.clone().sub(p);
      if (first(p, d, shape) >= 1) n++;
    }
    return n / 12;
  };
  const before = (cam: Vector3, c: Vector3, r: number, box: Prim) => {
    const ts = rays(cam, c, r * 0.98, 10)
      .map((d) => [hit(cam, d, { kind: 'sph', c, r }), hit(cam, d, box)] as const)
      .filter(([s]) => s < Infinity);
    return ts.filter(([s, b]) => s < b).length / ts.length;
  };
  const keeps = (cam: Vector3, box: Prim & { kind: 'box' }, grips: readonly Prim[]) => {
    const c = box.min.clone().add(box.max).multiplyScalar(0.5);
    const r = box.min.distanceTo(box.max) / 2;
    const ts = rays(cam, c, r, 16)
      .map((d) => [hit(cam, d, box), first(cam, d, grips)] as const)
      .filter(([b]) => b < Infinity);
    return ts.filter(([b, g]) => b <= g).length / ts.length;
  };

  it('from the cameras of stand, board and phone, on the lines a, e, j, the columns 1, 9, 17, every quarter turn', () => {
    const { bench } = setup();
    const P = bench.layout.spec.pitch;
    const order = ['+', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', '-'];
    const kinds = [
      { name: 'led', make: () => createLed('red'), shape: 'radial' as const, span: 1 },
      { name: '1000 μF', make: () => createElectrolytic(1000e-6, 16), shape: 'radial' as const, span: 1 },
      { name: 'resistor', make: () => buildPart('resistor-1k')!, shape: 'axial' as const, span: 4 },
      { name: '1N4007', make: () => buildPart('diode-1n4007')!, shape: 'axial' as const, span: 4 },
    ];
    const worst = { head: 1, headBefore: 1, ring: 1, ringBefore: 1, keeps: 1 };
    bench.group.parent!.updateMatrixWorld(true);
    for (const shot of ['stand', 'board', 'phone'] as const) {
      const cam = bench.board.group.worldToLocal(new Vector3(...STAGE_SHOTS[shot].position));
      for (const kind of kinds) {
        // standing alone, the model's frame is the board's: its box is the board frame's
        const m = kind.make();
        for (const line of ['a', 'e', 'j']) {
          for (const col of [1, 9, 17]) {
            const g = order.indexOf(line);
            const placements: string[][] = [];
            for (const g1 of [g - kind.span, g + kind.span])
              if (g1 >= 0 && g1 < order.length) placements.push([`${line}${col}`, `${order[g1]}${col}`]);
            const c0 = Math.min(col, 17 - kind.span);
            placements.push([`${line}${c0}`, `${line}${c0 + kind.span}`]);
            const c1 = Math.max(col, 1 + kind.span);
            placements.push([`${line}${c1}`, `${line}${c1 - kind.span}`]);
            for (const ids of placements) {
              const tips = ids.map((s) => bench.board.socketLocal(s));
              m.fit(tips);
              m.group.updateWorldMatrix(true, true);
              const b = new Box3().setFromObject(m.hit);
              const box = { kind: 'box' as const, min: b.min, max: b.max };
              const spots = gripSpots(m, kind.shape, tips);
              const cx = (tips[0]!.x + tips[1]!.x) / 2;
              const cz = (tips[0]!.z + tips[1]!.z) / 2;
              const truth: Prim[] =
                kind.name === 'led'
                  ? [
                      { kind: 'cyl', x: cx, z: cz, r: 0.33, y0: 0.3, y1: 0.42 },
                      { kind: 'cyl', x: cx, z: cz, r: 0.29, y0: 0.3, y1: 1.01 },
                      { kind: 'sph', c: new Vector3(cx, 1.01, cz), r: 0.29 },
                    ]
                  : kind.name === '1000 μF'
                    ? [{ kind: 'cyl', x: cx, z: cz, r: b.max.x - cx, y0: 0.3, y1: b.max.y }]
                    : [box];
              const where = `${kind.name} on ${ids.join('→')} from ${shot}`;
              for (const s of spots) {
                if (s.kind === 'tab') {
                  const v = seen(cam, s.at, 0.07, truth);
                  worst.head = Math.min(worst.head, v);
                  expect(v, `${where}: the tab's head seen whole`).toBe(1);
                  const k = before(cam, s.at, s.r, box);
                  worst.headBefore = Math.min(worst.headBefore, k);
                  expect(k, `${where}: the whole tab sphere before the body`).toBe(1);
                } else {
                  const v = seen(cam, s.at, 0.05, truth);
                  worst.ring = Math.min(worst.ring, v);
                  expect(v, `${where}: the ring seen whole`).toBe(1);
                  const k = before(cam, s.at, s.r, box);
                  worst.ringBefore = Math.min(worst.ringBefore, k);
                  expect(k, `${where}: ≥ 0.6 of the ring's sphere before the body`).toBeGreaterThanOrEqual(0.6);
                }
              }
              const k = keeps(cam, box, spots.map((s) => ({ kind: 'sph' as const, c: s.at, r: s.r })));
              worst.keeps = Math.min(worst.keeps, k);
              expect(k, `${where}: the body keeps ≥ 0.8 of its screen for gesture 1`).toBeGreaterThanOrEqual(0.8);
            }
          }
        }
        m.dispose();
      }
    }
    // the plan's printed numbers (VISUAL §8): the rings ≥ 0.64 before the body, the bodies keep ≥ 0.81
    expect(worst.ringBefore).toBeGreaterThanOrEqual(0.6);
    expect(worst.keeps).toBeGreaterThanOrEqual(0.8);
    expect(P).toBe(0.3);
  });
});
