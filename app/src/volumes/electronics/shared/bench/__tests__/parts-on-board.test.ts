/**
 * The parts on the board in 3D follow the board's state (`on-board.ts`, docs/volumes/electronics/VISUAL.md §4):
 * `bench.preset` puts a step's parts on the board, every part gets its model standing on the mouths of its sockets,
 * a leg moved or taken out moves the model's leg, a part taken off is disposed; a model the state does not hold can be
 * shown on the board; the readers list it all. A stub context, no WebGL.
 */
import { Group, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { seatLeg } from '@electronics/sim/board';
import { createCeramic } from '../../parts';
import { mountBench } from '..';

/** A chapter context with what the bench uses, keeping the readers it exposes. */
function stubContext() {
  const readers = new Map<string, () => unknown>();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const ctx = {
    root: new Group(),
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: {
      expose: (name: string, fn: () => unknown) => (readers.set(name, fn), () => {}),
      probe: (_n: string, _t: Object3D | (() => unknown)) => () => {},
    },
    device: { formFactor: 'desktop' },
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
    camera: { shots: () => {}, camera: new PerspectiveCamera(27, 1920 / 1080, 0.1, 100) },
    renderer: { info: { render: { calls: 0 } } },
  } as unknown as ChapterContext;
  return { ctx, read: (name: string) => readers.get(name)!() };
}

const near = (a: Vector3, b: Vector3) => a.distanceTo(b) < 1e-9;

describe('the parts on the board follow its state', () => {
  it('preset: every part on its sockets, its model standing on their mouths, tamed like the rest of the bench', () => {
    const { ctx, read } = stubContext();
    const bench = mountBench(ctx);
    bench.preset([
      { id: 'R1', spec: 'resistor-4k7', at: 'a3' },
      { id: 'LED1', spec: 'led-red', at: 'e7', o: 1 }, // across the channel: e7 → f7
      { id: 'P1', spec: 'pot-10k', at: 'h2', setting: 0.2 },
    ]);
    expect([...bench.parts.models.keys()]).toEqual(['R1', 'LED1', 'P1']);
    expect(read('electronics-board')).toMatchObject({
      parts: {
        R1: { spec: 'resistor-4k7', legs: ['a3', 'a7'] },
        LED1: { spec: 'led-red', legs: ['e7', 'f7'] },
        P1: { spec: 'pot-10k', legs: ['h2', 'h4', 'h6'] },
      },
      settings: { P1: 0.2 },
      models: ['R1', 'LED1', 'P1'],
      shown: [],
    });
    for (const [id, m] of bench.parts.models) {
      const legs = bench.state.parts.get(id)!.legs;
      legs.forEach((s, i) =>
        expect(near(m.legTips[i]!, bench.board.socketLocal(s!)), `${id} leg ${i}`).toBe(true),
      );
      expect(m.group.parent).toBe(bench.parts.group);
      expect(
        m.materials.every((x) => x.userData.tamed === true),
        id,
      ).toBe(true);
    }
    expect(bench.parts.group.parent).toBe(bench.board.group);
  });

  it('a leg moved, a leg in the air, a part taken off: the model follows at the next frame', () => {
    const { ctx } = stubContext();
    const bench = mountBench(ctx);
    bench.preset([{ id: 'R1', spec: 'resistor-4k7', at: 'b3' }]);
    const r = bench.parts.models.get('R1')!;
    expect(seatLeg(bench.layout, bench.state, 'R1', 1, 'b8')).toBe(true);
    bench.update(1 / 60, 1 / 60);
    expect(near(r.legTips[1]!, bench.board.socketLocal('b8'))).toBe(true);
    // a leg out of its socket hangs in the air, where the part's shape puts it; the other one stays in its socket
    seatLeg(bench.layout, bench.state, 'R1', 1, null);
    bench.update(1 / 60, 2 / 60);
    expect(r.legTips[1]!.y).toBeGreaterThan(0.1);
    /** The lowest point of the legs near a tip, in the board's frame. */
    const lowest = (at: Vector3): number => {
      bench.group.updateMatrixWorld(true);
      const pos = r.legs.geometry.getAttribute('position');
      let y = Infinity;
      for (let i = 0; i < pos.count; i++) {
        const v = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(r.legs.matrixWorld);
        bench.parts.group.worldToLocal(v);
        if (Math.hypot(v.x - at.x, v.z - at.z) < 0.05) y = Math.min(y, v.y);
      }
      return y;
    };
    expect(lowest(bench.board.socketLocal('b3'))).toBeCloseTo(-0.04, 6); // into the mouth of b3
    expect(lowest(r.legTips[1]!)).toBeGreaterThan(0.1); // the loose one ends in the air
    // taken off the board: the model is gone and freed
    let freed = false;
    r.legs.geometry.addEventListener('dispose', () => (freed = true));
    bench.clear();
    expect(bench.parts.models.size).toBe(0);
    expect(r.group.parent).toBeNull();
    expect(freed).toBe(true);
  });

  it('a leg in the air keeps the part’s turn at every quarter: the body does not swing, the loose leg hangs over its place', () => {
    const cases = [
      ['b3', 0], // b3 → b7
      ['b5', 1], // b5 → f5, across the strips and the channel
      ['j9', 2], // j9 → j5
      ['f5', 3], // f5 → b5
    ] as const;
    for (const [at, o] of cases) {
      for (const lifted of [1, 0]) {
        const { ctx } = stubContext();
        const bench = mountBench(ctx);
        bench.preset([{ id: 'R1', spec: 'resistor-4k7', at, o }]);
        const r = bench.parts.models.get('R1')!;
        const turn = r.bodyGroup.quaternion.clone();
        const sockets = [...bench.state.parts.get('R1')!.legs];
        const kept = 1 - lifted;
        expect(seatLeg(bench.layout, bench.state, 'R1', lifted, null)).toBe(true);
        for (const t of [1 / 60, 2 / 60]) {
          bench.update(1 / 60, t);
          const name = `at ${at}, o ${o}, leg ${lifted} in the air, t ${t.toFixed(3)}`;
          expect(r.bodyGroup.quaternion.angleTo(turn), name).toBeLessThan(1e-9);
          expect(near(r.legTips[kept]!, bench.board.socketLocal(sockets[kept]!)), name).toBe(true);
          const over = bench.board.socketLocal(sockets[lifted]!);
          const tip = r.legTips[lifted]!;
          expect(Math.hypot(tip.x - over.x, tip.z - over.z), name).toBeLessThan(1e-9);
          expect(tip.y, name).toBeGreaterThan(0.1);
        }
      }
    }
  });

  it('a pot’s knob follows the setting of the board’s state', () => {
    const { ctx } = stubContext();
    const bench = mountBench(ctx);
    bench.preset([{ id: 'P1', spec: 'pot-10k', at: 'c5', setting: 1 }]);
    bench.update(1, 1);
    const knob = bench.parts.models.get('P1')!.group.getObjectByName('knob')!;
    expect((knob.rotation.y * 180) / Math.PI).toBeCloseTo(-150, 3);
  });

  it('refuses a preset part that does not stand where it is put', () => {
    const { ctx } = stubContext();
    const bench = mountBench(ctx);
    expect(() => bench.preset([{ id: 'R1', spec: 'resistor-4k7', at: 'a15' }])).toThrow(RangeError); // a19 is off the board
    expect(() =>
      bench.preset([
        { id: 'R1', spec: 'resistor-4k7', at: 'a3' },
        { id: 'R2', spec: 'resistor-1k', at: 'a7' }, // a7 is taken by R1's leg 1
      ]),
    ).toThrow(RangeError);
  });

  it('shows a model the state does not hold (a kind the catalog has not yet), outside the circuit', () => {
    const { ctx, read } = stubContext();
    const bench = mountBench(ctx);
    bench.parts.show('C1', createCeramic(100e-9), ['d7', 'd9']);
    const c = bench.parts.shown.get('C1')!;
    expect(near(c.legTips[0]!, bench.board.socketLocal('d7'))).toBe(true);
    expect(near(c.legTips[1]!, bench.board.socketLocal('d9'))).toBe(true);
    expect(read('electronics-board')).toMatchObject({ parts: {}, shown: ['C1'] });
    expect(Object.keys(read('electronics-parts') as object)).toEqual(
      expect.arrayContaining(['C1', 'battery', 'player', 'speaker', 'lamp']),
    );
    expect(() => bench.parts.show('C2', createCeramic(100e-9), ['d7'])).toThrow(RangeError);
    bench.parts.hide('C1');
    expect(bench.parts.shown.size).toBe(0);
    expect(c.group.parent).toBeNull();
  });
});
