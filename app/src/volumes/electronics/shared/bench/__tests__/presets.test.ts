/**
 * The boards of the pilot chapters on the bench (`sim/board/presets.ts` through `bench.preset`): every part of the
 * LED's loop stands on its sockets with its model, no two bodies take the same place on the board (their boxes, in the
 * board's frame, do not meet), and the bench's model solves it as `sim/board`'s tests do. A stub context, no WebGL.
 */
import { Group, Matrix4, PerspectiveCamera, type Box3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { LED_LOOP, mountBench, type Bench, type BoardPreset } from '..';

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
