/**
 * The boards of the pilot chapters on the bench (`sim/board/presets.ts` through `bench.preset`): every part of the
 * LED's loop and of the amplifier stands on its sockets with its model, no two bodies take the same place on the board
 * (their boxes, in the board's frame, do not meet), and the bench's model solves it as `sim/board`'s tests do. The
 * amplifier's board is held to more: no leg, no jumper and no plug where another part is either, and every plug within
 * its lead. A stub context, no WebGL.
 */
import { Box3, Group, Matrix4, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import {
  AMPLIFIER_PRESET,
  LEAD,
  LEADS,
  LED_LOOP,
  PLUG,
  createLayout,
  mountBench,
  type Bench,
  type BoardPreset,
} from '..';

/** A chapter context with what the bench uses (as `parts-on-board.test.ts` has it). */
function stubContext(): ChapterContext {
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return {
    root: new Group(),
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: (_n: string, _t: Object3D | (() => unknown)) => () => {} },
    input: { register: () => () => {}, on: () => () => {} },
    device: { formFactor: 'desktop', hover: true },
    viewport: { width: 1920, height: 1080, aspect: 1920 / 1080, dpr: 1 },
    quality: { count: (n: number) => n },
    random: { next, range: (a: number, b: number) => a + (b - a) * next() },
    env: { base: () => {}, setScale: () => {}, setShadow: () => {}, tune: () => {}, params: { keyIntensity: 0 } },
    post: { base: () => {} },
    camera: { shots: () => {}, camera: new PerspectiveCamera(27, 1920 / 1080, 0.1, 100) },
    renderer: { info: { render: { calls: 0 } } },
  } as unknown as ChapterContext;
}

/** The box of every part's body (its `hit`) in the board's frame: the parts stand at quarter turns there, so the box
 * of the turned body is its own. */
function bodies(bench: Bench): Map<string, Box3> {
  bench.board.group.updateWorldMatrix(true, true);
  const toBoard = new Matrix4().copy(bench.board.group.matrixWorld).invert();
  const out = new Map<string, Box3>();
  for (const [id, m] of bench.parts.models) {
    m.hit.geometry.computeBoundingBox();
    const box = m.hit.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(toBoard, m.hit.matrixWorld));
    out.set(id, box);
  }
  return out;
}

/** Pairs of bodies that take the same place (overlapping by more than a hair in all three directions). */
function overlaps(boxes: Map<string, Box3>): string[] {
  const list = [...boxes];
  const out: string[] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [a, A] = list[i]!;
      const [b, B] = list[j]!;
      const meet = A.clone().intersect(B);
      const size = meet.isEmpty() ? null : meet.max.clone().sub(meet.min);
      if (size && size.x > 1e-3 && size.y > 1e-3 && size.z > 1e-3) out.push(`${a} × ${b}`);
    }
  return out;
}

const on = (preset: BoardPreset) => {
  const bench = mountBench(stubContext());
  bench.preset(preset.parts, preset.leads);
  bench.closed = 1;
  bench.update(0, 0);
  return bench;
};

describe('the pilot chapters’ boards on the bench', () => {
  it('the LED’s loop: its four parts, no two bodies in one place, the LED at 21.2 mA', () => {
    const bench = on(LED_LOOP);
    expect([...bench.parts.models.keys()]).toEqual(['J1', 'R1', 'LED1', 'J2']);
    const boxes = bodies(bench);
    boxes.delete('J1');
    boxes.delete('J2');
    expect(overlaps(boxes)).toEqual([]);
    expect(bench.model.reading('LED1')!.i).toBeCloseTo(0.0212351, 7);
  });
});

/** Boxes that meet by more than a hair in all three directions. */
const meet = (A: Box3, B: Box3): boolean => {
  const m = A.clone().intersect(B);
  if (m.isEmpty()) return false;
  const size = m.max.clone().sub(m.min);
  return size.x > 1e-3 && size.y > 1e-3 && size.z > 1e-3;
};

/**
 * What every part takes of the board's space, in the board's frame: its body (its `hit`) and each of its legs — a post
 * from below the socket's mouth up to the top of the part's legs, and for a leg that runs along the board to its body
 * (a resistor's, a diode's) that run too. And every plug: a post as high as its sleeve, as wide.
 */
function occupied(bench: Bench, preset: BoardPreset): { who: string; what: string; box: Box3 }[] {
  const out: { who: string; what: string; box: Box3 }[] = [];
  const toBoard = new Matrix4().copy(bench.board.group.matrixWorld).invert();
  const boxOf = (mesh: { geometry: { computeBoundingBox(): void; boundingBox: Box3 | null }; matrixWorld: Matrix4 }) => {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(toBoard, mesh.matrixWorld));
  };
  for (const [id, m] of bench.parts.models) {
    const body = boxOf(m.hit);
    out.push({ who: id, what: 'body', box: body });
    const top = boxOf(m.legs).max.y;
    const toBoardFromParent = new Matrix4().multiplyMatrices(toBoard, m.group.parent!.matrixWorld);
    m.legTips.forEach((t, k) => {
      const tip = t.clone().applyMatrix4(toBoardFromParent);
      // the nearest point of the body in plan: a leg that stands under its body has no run
      const to = new Vector3(
        Math.min(Math.max(tip.x, body.min.x), body.max.x),
        0,
        Math.min(Math.max(tip.z, body.min.z), body.max.z),
      );
      const leg = new Box3(new Vector3(tip.x - 0.03, -0.04, tip.z - 0.03), new Vector3(tip.x + 0.03, top, tip.z + 0.03));
      leg.union(new Box3(new Vector3(to.x - 0.03, -0.04, to.z - 0.03), new Vector3(to.x + 0.03, top, to.z + 0.03)));
      out.push({ who: id, what: `leg ${k}`, box: leg });
    });
  }
  const layout = createLayout();
  for (const [name, socket] of Object.entries(preset.leads)) {
    const s = layout.socket(socket)!;
    const r = PLUG.radius;
    const top = PLUG.pin - PLUG.dip + PLUG.sleeve;
    out.push({ who: name, what: 'plug', box: new Box3(new Vector3(s.x - r, -PLUG.dip, s.z - r), new Vector3(s.x + r, top, s.z + r)) });
  }
  return out;
}

describe('the amplifier of E1-6 on the bench (AMPLIFIER_PRESET)', () => {
  const bench = on(AMPLIFIER_PRESET);
  bench.snap();
  bench.update(0, 0);
  bench.board.group.updateWorldMatrix(true, true);

  it('every part on its sockets with its model, the plugs in theirs, and the model at the amplifier’s point', () => {
    expect([...bench.parts.models.keys()]).toEqual(AMPLIFIER_PRESET.parts.map((p) => p.id));
    for (const p of AMPLIFIER_PRESET.parts) expect(bench.parts.models.get(p.id)!.key, p.id).toBe(p.spec);
    for (const [name, socket] of Object.entries(AMPLIFIER_PRESET.leads)) {
      const lead = bench.fixed.leads.get(name)!;
      expect(lead.leg.socket, name).toBe(socket);
    }
    // sim/core/README.md, «The amplifier»: 13.3 mA from the battery at rest, the output near half the supply
    expect(bench.model.reading('BAT')!.i).toBeCloseTo(-0.01331, 5);
    expect(bench.model.rowVolts('7fj')).toBeCloseTo(3.771, 3);
    expect(bench.model.reading('LED1')!.i).toBeCloseTo(0.002994, 6);
  });

  it('no two bodies in one place — the jumpers’ too', () => {
    expect(overlaps(bodies(bench))).toEqual([]);
  });

  it('no leg, jumper or plug where another part’s body or leg is: legs only under the raised bodies they clear', () => {
    const all = occupied(bench, AMPLIFIER_PRESET);
    const hits: string[] = [];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        if (a.who === b.who || (a.what === 'body' && b.what === 'body')) continue; // bodies: the test above
        if (meet(a.box, b.box)) hits.push(`${a.who} ${a.what} × ${b.who} ${b.what}`);
      }
    expect(hits).toEqual([]);
  });

  it('every plug within its lead’s reach of its thing', () => {
    const layout = createLayout();
    for (const [name, socket] of Object.entries(AMPLIFIER_PRESET.leads)) {
      const from = LEADS.find((l) => l.name === name)!.from;
      const s = layout.socket(socket)!;
      expect(Math.hypot(s.x - from.x, s.z - from.z), name).toBeLessThanOrEqual(LEAD.length);
    }
  });
});
