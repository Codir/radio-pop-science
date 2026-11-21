/**
 * The multimeter on a real bench (no WebGL), its probes driven with fake pointer events through a stub `ctx.input`, as
 * `hand/__tests__/hands.test.ts` does: a probe is taken by its grip on the handle and clicks into the socket it is let
 * go over — a free one or one a leg is in (it touches what is there), never the other probe's; let go away from the
 * sockets it lies on the base, or goes back to rest by the meter off it; the meter reads the bench's model through
 * them, and its own wire is in the circuit in the A mode. The meter leaving takes its probes with it.
 */
import { Group, PerspectiveCamera, Ray, Vector2, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext, DragInfo, InteractionHandlers } from '@/engine/api';
import { seatLeg } from '@electronics/sim/board';
import { memoryOf, resistorKey } from '@electronics/sim/core';
import { STAGE_SHOTS, mountBench, type PresetPart } from '../../bench';
import { SEAT_SECONDS, type HandKey } from '../../hand';
import { METER_REFRESH } from '../meter-model';
import { SCOPE_INPUT } from '../scope';

function stubContext() {
  const handlers = new Map<Object3D, InteractionHandlers>();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const camera = new PerspectiveCamera(27, 1920 / 1080, 0.1, 100);
  camera.position.set(...STAGE_SHOTS.meter.position);
  camera.lookAt(...STAGE_SHOTS.meter.target);
  camera.updateMatrixWorld();
  const ctx = {
    root: new Group(),
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: () => () => {} },
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
    env: { base: () => {}, setScale: () => {}, setShadow: () => {}, tune: () => {}, params: { keyIntensity: 0 } },
    post: { base: () => {} },
    camera: { shots: () => {}, camera },
    renderer: { info: { render: { calls: 0 } } },
  } as unknown as ChapterContext;
  return { ctx, handlers, camera };
}

/** The sandbox's divider: + rail → jumper → 3ae → 1 kΩ → 7ae → 2 kΩ → 11ae → jumper → − rail. */
const DIVIDER: readonly PresetPart[] = [
  { id: 'J1', spec: 'jumper', at: '+3', to: 'a3' },
  { id: 'R1', spec: 'resistor-1k', at: 'b3' },
  { id: 'R2', spec: 'resistor-2k', at: 'c7' },
  { id: 'J2', spec: 'jumper', at: 'e11', to: '-11' },
];

function setup() {
  const { ctx, handlers, camera } = stubContext();
  const bench = mountBench(ctx);
  bench.preset(DIVIDER);
  bench.closed = 1;
  bench.meter = 1;
  let t = 0;
  const frames = (seconds: number, dt = 1 / 60) => {
    for (let k = 0; k < Math.round(seconds / dt); k++) bench.update(dt, (t += dt));
  };
  frames(0.1);
  /** A board point (board frame, on the face) as a pointer event: the pick ray from the camera through it. */
  const event = (x: number, z: number, object: Object3D): DragInfo => {
    const world = bench.board.group.localToWorld(new Vector3(x, 0, z));
    const ray = new Ray(camera.position.clone(), world.clone().sub(camera.position).normalize());
    const ndc = world.clone().project(camera);
    return {
      pointerId: 1,
      pointerType: 'mouse',
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
      dx: 0,
      dy: 0,
      totalX: 0,
      totalY: 0,
      startPoint: world,
    } as unknown as DragInfo;
  };
  const grip = (k: HandKey) => bench.hands.grip(k)!.hit;
  const tip = (name: 'red' | 'black'): [number, number] => {
    const p = bench.multimeter.probes.get(name)!.leg.pos;
    return [p.x, p.z];
  };
  const sock = (id: string): [number, number] => {
    const s = bench.layout.socket(id)!;
    return [s.x, s.z];
  };
  /** Press a probe's grip where its tip is, drag through `path`, let go at its end. */
  const drag = (name: 'red' | 'black', path: readonly (readonly [number, number])[], hold?: () => void) => {
    const o = grip(`probe:${name}`);
    const hd = handlers.get(o)!;
    expect(hd.enabled?.() ?? true, `probe:${name} enabled`).toBe(true);
    const from = tip(name);
    hd.press?.(event(...from, o));
    hd.dragStart?.(event(...from, o));
    frames(1 / 60);
    for (const p of path) {
      hd.drag?.(event(p[0], p[1], o));
      frames(1 / 60);
    }
    hold?.();
    const last = path.at(-1)!;
    hd.dragEnd?.(event(last[0], last[1], o));
    frames(1 / 60);
  };
  /** From where the tip is to `to`, through a point halfway and a little toward the reader. */
  const way = (name: 'red' | 'black', to: [number, number]): [number, number][] => {
    const [x, z] = tip(name);
    return [[(x + to[0]) / 2, (z + to[1]) / 2 + 0.3], [to[0] + 0.04, to[1] + 0.03]];
  };
  const text = () => bench.multimeter.text.replaceAll('\u00a0', ' ');
  return { bench, frames, drag, way, sock, tip, grip, handlers, text };
}

describe('the multimeter’s probes in the hand', () => {
  it('click into the socket they are let go over: the meter reads the divider, 5,997 V', () => {
    const { bench, frames, drag, way, sock, text } = setup();
    expect(bench.multimeter.probes.get('red')!.ready()).toBe(true);
    expect(text()).toBe('—');
    drag('red', way('red', sock('a7')), () => {
      // carried: the hand holds it, a7 is where it would go, and it is not in a socket yet
      expect(bench.hands.held).toBe('probe:red');
      expect(bench.hands.near).toBe('a7');
      expect(bench.multimeter.sockets.red).toBeNull();
    });
    // let go: it goes in, and is the meter's when it has arrived
    expect(bench.hands.held).toBeNull();
    expect(bench.multimeter.sockets.red).toBeNull();
    frames(SEAT_SECONDS + 2 / 60);
    expect(bench.multimeter.sockets.red).toBe('a7');
    drag('black', way('black', sock('-3')));
    frames(SEAT_SECONDS + 2 / 60);
    expect(bench.multimeter.sockets.black).toBe('-3');
    // the probes take no socket of the board: its circuit is the same
    expect(bench.state.leads.size).toBe(0);
    frames(METER_REFRESH + 0.05);
    expect(text()).toBe('5,997 V');
    expect(bench.multimeter.value).toBeCloseTo(bench.model.rowVolts('7ae')!, 12);
  });

  it('go into a socket a leg is in, touching it, but never into the other probe’s', () => {
    const { bench, frames, drag, way, sock, text } = setup();
    bench.multimeter.put({ red: 'a7', black: '-3' });
    frames(0.05);
    // b7 holds R1's leg: the probe goes in all the same, its tip on the leg, and the reading is the same row's
    drag('red', way('red', sock('b7')));
    frames(SEAT_SECONDS + 2 / 60);
    expect(bench.multimeter.sockets.red).toBe('b7');
    const pos = bench.multimeter.probes.get('red')!.leg.pos;
    expect(pos.y).toBeGreaterThan(0.03);
    frames(METER_REFRESH + 0.05);
    expect(text()).toBe('5,997 V');
    // the black probe's socket is not the red one's to take: it is not offered, and the red one lies off its row
    drag('red', way('red', sock('-3')), () => expect(bench.hands.near).not.toBe('-3'));
    frames(0.4);
    expect(bench.multimeter.sockets.red).not.toBe('-3');
    expect(bench.multimeter.sockets.black).toBe('-3');
  });

  it('let go away from the sockets: lie on the base, or go back to rest by the meter off it', () => {
    const { bench, frames, drag, way, sock, text } = setup();
    bench.multimeter.put({ red: 'a7', black: '-3' });
    frames(METER_REFRESH + 0.05);
    expect(text()).toBe('5,997 V');
    // between a8 and a9, off the line: no socket within SNAP — it lies there, out of every socket
    const [x, z] = sock('a8');
    drag('red', way('red', [x + 0.15, z + 0.12]));
    frames(0.4);
    const red = bench.multimeter.probes.get('red')!;
    expect(red.leg.place.kind).toBe('lie');
    expect(bench.multimeter.sockets.red).toBeNull();
    frames(METER_REFRESH + 0.05);
    expect(text()).toBe('—');
    // over the table, off the base: back to rest beside the meter
    drag('red', [[-4.6, 2.0], [-5.2, 3.4]]);
    frames(0.4);
    expect(red.leg.place.kind).toBe('rest');
  });

  it('in the A mode the meter is a wire in the circuit: in the divider’s branch, 2,998 mA', () => {
    const { bench, frames, text } = setup();
    // the jumper to the − rail out, the meter in its place: from 11ae to the rail
    expect(seatLeg(bench.layout, bench.state, 'J2', 1, null)).toBe(true);
    bench.multimeter.mode = 'A';
    bench.multimeter.put({ red: 'a11', black: '-3' });
    frames(METER_REFRESH + 0.05);
    expect(bench.model.circuit!.net.parts.map((p) => p.id)).toContain('METER');
    expect(bench.model.reading('METER')!.i).toBeCloseTo(9 / 3001.5, 8);
    expect(text()).toBe('2,998 mA');
    // the dial turns to its position in 0.25 s
    bench.multimeter.mode = 'ohm';
    frames(0.3);
    expect(bench.model.circuit!.net.parts.map((p) => p.id)).not.toContain('METER');
    frames(METER_REFRESH + 0.05);
    // the battery out: from 11ae through 2 kΩ, 1 kΩ and the jumper to the + rail and the switch, whose other end the
    // battery left — none of it to the − rail
    expect(text()).toBe('OL');
  });

  it('a step’s preset puts whole parts: a burnt R1 is forgotten when the preset gives its id to a new one', () => {
    const { bench, frames, text } = setup();
    bench.multimeter.put({ red: 'a7', black: '-3' });
    frames(METER_REFRESH + 0.05);
    expect(text()).toBe('5,997 V');
    // R1 burns (E2-7 sets this on an overload): a gap from the next solve on — the switch flipped twice solves twice
    memoryOf(bench.model.state, 'R1').burnt = true;
    bench.closed = 0;
    frames(1 / 60);
    bench.closed = 1;
    frames(METER_REFRESH + 0.05);
    expect(text()).toBe('0,000 V');
    // the next step's preset: the same list, so the same circuit's shape, but every part in it new and whole
    bench.preset(DIVIDER);
    expect(bench.model.state.parts.has('R1')).toBe(false);
    frames(METER_REFRESH + 0.05);
    expect(bench.model.state.parts.get('R1')?.burnt ?? false).toBe(false);
    expect(text()).toBe('5,997 V');
    // across R1 with the battery out: its 1 kΩ, no gap
    bench.multimeter.mode = 'ohm';
    bench.multimeter.put({ red: 'c3', black: 'd7' });
    frames(0.3 + METER_REFRESH + 0.05);
    expect(text()).toBe('1,000 kΩ');
    // the same for `clear`: what it takes off is forgotten at once, before any frame
    memoryOf(bench.model.state, 'R2').burnt = true;
    bench.clear();
    expect(bench.model.state.parts.has('R2')).toBe(false);
  });

  it('leave with the meter: the tips come out of their sockets, the grips are not taken', () => {
    const { bench, frames, grip, handlers } = setup();
    bench.multimeter.put({ red: 'a7', black: '-3' });
    frames(0.05);
    bench.meter = 0.5;
    frames(1 / 60);
    expect(bench.multimeter.sockets).toEqual({ red: null, black: null });
    expect(handlers.get(grip('probe:red'))!.enabled!()).toBe(false);
    bench.meter = 0;
    frames(0.5);
    expect(bench.multimeter.probes.get('black')!.leg.place.kind).toBe('rest');
    expect(bench.multimeter.probes.get('black')!.body.visible).toBe(false);
  });

  it('the oscilloscope’s are the same pair (createProbePair): put by a step, its taps, gone with the scope', () => {
    const { bench, frames, grip, handlers } = setup();
    expect(() => bench.multimeter.put({ red: 'z99' })).toThrow('meter.put: the board has no socket z99');
    expect(() => bench.oscilloscope.put({ ch1: 'z99' })).toThrow('scope.put: the board has no socket z99');
    bench.scope = 1;
    frames(0.05);
    expect(bench.oscilloscope.probes.get('ch1')!.ready()).toBe(true);
    bench.oscilloscope.put({ ch1: 'a7', ch2: 'c11' });
    frames(0.05);
    expect(bench.oscilloscope.sockets).toEqual({ ch1: 'a7', ch2: 'c11' });
    expect(bench.oscilloscope.taps()).toEqual([
      { node: bench.layout.socket('a7')!.node },
      { node: bench.layout.socket('c11')!.node },
    ]);
    // the meter's pair is its own: its probes stay at rest
    expect(bench.multimeter.sockets).toEqual({ red: null, black: null });
    bench.scope = 0.5;
    frames(1 / 60);
    expect(bench.oscilloscope.sockets).toEqual({ ch1: null, ch2: null });
    expect(handlers.get(grip('probe:ch1'))!.enabled!()).toBe(false);
    bench.scope = 0;
    frames(0.5);
    expect(bench.oscilloscope.probes.get('ch2')!.leg.place.kind).toBe('rest');
    expect(bench.oscilloscope.probes.get('ch2')!.body.visible).toBe(false);
  });

  it('the oscilloscope’s inputs take current as a real one’s do: 1 MΩ from each probe’s row to the − rail (E3-8)', () => {
    const { bench, frames, text } = setup();
    bench.multimeter.put({ red: 'a7', black: '-3' });
    bench.scope = 1;
    frames(METER_REFRESH + 0.05);
    expect(text()).toBe('5,997 V');
    expect(bench.oscilloscope.extra()).toEqual([]);
    // channel 1 on the divider's middle: its 2 kΩ with the scope's 1 MΩ beside it — 9 V · 1996,0 / (1,5 + 1000 + 1996,0)
    // (the wires' milliohms aside)
    bench.oscilloscope.put({ ch1: 'b7' });
    frames(METER_REFRESH + 0.05);
    const node = bench.layout.socket('b7')!.node;
    expect(bench.oscilloscope.extra()).toEqual([{ id: 'SCOPE1', spec: resistorKey(1e6), pins: [node, 0] }]);
    expect(SCOPE_INPUT.ohms).toBe(1e6);
    const lower = (2000 * 1e6) / (2000 + 1e6);
    const v = (9 * lower) / (1.5 + 1000 + lower);
    expect(bench.model.rowVolts('7ae')).toBeCloseTo(v, 5);
    expect(bench.model.reading('SCOPE1')!.i).toBeCloseTo(bench.model.rowVolts('7ae')! / 1e6, 15);
    expect(text()).toBe('5,993 V');
    // both probes: two inputs; a probe on the − rail has nothing to take a current across
    bench.oscilloscope.put({ ch1: 'b7', ch2: '-5' });
    frames(1 / 60);
    expect(bench.oscilloscope.extra().map((p) => p.id)).toEqual(['SCOPE1']);
    bench.oscilloscope.put({ ch2: 'c3' });
    frames(1 / 60);
    expect(bench.oscilloscope.extra().map((p) => p.id)).toEqual(['SCOPE1', 'SCOPE2']);
    // gone with the scope: its probes out, the divider as it was
    bench.scope = 0;
    frames(METER_REFRESH + 0.05);
    expect(bench.oscilloscope.extra()).toEqual([]);
    expect(bench.model.circuit!.net.parts.map((p) => p.id)).not.toContain('SCOPE1');
    expect(text()).toBe('5,997 V');
  });
});
