/**
 * The chapter's view of the composed world (`@circuit/shared/world`: the stand and «усередині міді» in one scene,
 * the flights through the lens). Every mount detail — param names, shot names, who owns env and post — stays in
 * this file; the steps speak of floors, the lamp and copper shots.
 */
import { Vector3 } from 'three';
import type { ChapterContext, MoveOptions, Shot, StepSpec } from '@/engine/api';
import type { Copper } from '@circuit/shared/copper/copper';
import { COPPER_SHOTS, copperShots, type CopperShot } from '@circuit/shared/copper/shots';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';

type Vec = [number, number, number];

/** The lower floors the chapter visits: «ряди атомів» and «один атом» (the world's `deep` 2 and 3). */
export type Floor = 'rows' | 'atom';
const DEEP: Record<Floor, number> = { rows: 2, atom: 3 };

export interface WireWorld {
  world: CircuitWorld;
  copper: Copper;
  /** A shot between two copper shots (t 0…1): continuous camera moves driven by the reader. */
  between(a: CopperShot, b: CopperShot, t: number): Shot;
  /** A copper-local point in world space (for callout anchors and probes); `out` is overwritten. */
  toWorld(local: Vector3, out?: Vector3): Vector3;
  /** The declarative part of a step below the stand: floor, the lamp on the stand (0 off · 1 on), camera. */
  state(floor: Floor, lamp: 0 | 1, camera: CopperShot | string): StepSpec;
  go(camera: CopperShot | string | Shot, opts?: MoveOptions): void;
  /** Register a shot of the chapter's own. */
  name(name: string, make: () => Shot): void;
  update(dt: number, t: number): void;
}

export function createWireWorld(ctx: ChapterContext): WireWorld {
  const world = mountWorld(ctx);
  // chapter 1 shows no common drift, not even with the lamp on (it comes in chapter 4)
  world.drift = 0;
  const { copper } = world;
  const shots = copperShots(copper.group, 'copper-');
  const nameOf = (c: string): string => (c in COPPER_SHOTS ? `copper-${c}` : c);
  const pa = new Vector3();
  const pb = new Vector3();
  const lerp = (a: Shot['position'], b: Shot['position'], t: number): Vec =>
    pa
      .fromArray(a as Vec)
      .lerp(pb.fromArray(b as Vec), t)
      .toArray() as Vec;

  const out: WireWorld = {
    world,
    copper,
    between(a, b, t) {
      const A = shots[`copper-${a}`]!;
      const B = shots[`copper-${b}`]!;
      const fa = A.fit as { center: Vec; radius: number };
      const fb = B.fit as { center: Vec; radius: number };
      return {
        ...B,
        position: lerp(A.position, B.position, t),
        target: lerp(A.target, B.target, t),
        fit: { center: lerp(fa.center, fb.center, t), radius: fa.radius + (fb.radius - fa.radius) * t },
      };
    },
    toWorld: (local, o = new Vector3()) => copper.space.localToWorld(o.copy(local)),
    state: (floor, lamp, camera) => ({
      camera: nameOf(camera),
      params: { deep: DEEP[floor], closed: lamp, lens: 1 },
    }),
    go: (camera, opts) => ctx.camera.go(typeof camera === 'string' ? nameOf(camera) : camera, opts),
    name(name, make) {
      ctx.camera.shots({ [name]: make() });
    },
    update: (dt, t) => world.update(dt, t),
  };
  return out;
}
