/**
 * `mountBench` with a stub context (no WebGL): the lamp's light rig is placed as its comment promises — the lamp light
 * at the filament, the shadowless bounce above the lamp's pool, every frame (light.ts `LightRig.bounce`).
 */
import { Group, PerspectiveCamera, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { BOARD, LAMP, PLACES, mountBench, worldToBoard } from '..';

/** A chapter context with only what the bench uses at mount and per frame. */
function stubContext() {
  const root = new Group();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const ctx = {
    root,
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: (_n: string, _t: Object3D | (() => unknown)) => () => {} },
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
  return ctx;
}

describe('the lamp’s bounce light', () => {
  it('hangs above the lamp’s pool: over the face, between the lamp and the middle of the board', () => {
    const bench = mountBench(stubContext());
    bench.lamp = 1;
    bench.snap();
    expect(bench.light.bounce.intensity).toBeGreaterThan(0);
    const lamp = new Vector3(LAMP.x, LAMP.glassY, LAMP.z);
    const at = worldToBoard(bench.light.bounce.position);
    // above the face and above the glass's top, not under the base (where an unplaced light sits: the world origin)
    expect(at.y).toBeGreaterThan(LAMP.glassY + LAMP.glass);
    expect(at.y).toBeLessThan(3);
    // over the face, not past its edges
    expect(Math.abs(at.x)).toBeLessThan(BOARD.width / 2);
    expect(Math.abs(at.z)).toBeLessThan(BOARD.depth / 2);
    // near the lamp, toward the middle of the board: in plan, nearer the board's middle than the lamp is
    const plan = (p: Vector3) => new Vector3(p.x, 0, p.z);
    const middle = new Vector3(PLACES.breadboard.x, 0, PLACES.breadboard.z);
    const away = plan(at).distanceTo(plan(lamp));
    expect(away).toBeGreaterThan(0.5);
    expect(away).toBeLessThan(2);
    expect(plan(at).distanceTo(middle)).toBeLessThan(plan(lamp).distanceTo(middle) - 0.5);
  });

  it('follows the filament every frame, lamp lit or dark', () => {
    const bench = mountBench(stubContext());
    const before = bench.light.bounce.position.clone();
    const filament = new Vector3();
    bench.props.filament.getWorldPosition(filament);
    expect(before.distanceTo(filament)).toBeGreaterThan(1);
    // move the lamp (as if its post were elsewhere): the bounce keeps its offset from the filament
    bench.props.filament.position.x += 0.5;
    bench.update(1 / 60, 1 / 60);
    expect(bench.light.bounce.position.x - before.x).toBeCloseTo(0.5, 9);
    expect(bench.light.bounce.position.y - before.y).toBeCloseTo(0, 9);
  });
});
