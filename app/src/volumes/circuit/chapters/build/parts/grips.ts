/**
 * The practicum's handles (VISUAL §5.7): a big `cyan` grip on the wire just behind each end's stripped copper —
 * the material and size of `flow/connect`'s loose end. A grip grows in and out (`shown`), calls when the step wants
 * it taken (`call`: full cyan, a slow pulse), brightens under the pointer (`hover`); an invisible sphere around it
 * is what the hand hits (generous on a phone).
 */
import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { G } from '@/kit';
import { K, type KToonMaterial } from '@/style';
import type { CircuitStage } from '@circuit/shared/stage';
import { glide, type Glide } from './glide';
import type { End, EndKey } from './ends';

/** Distance of the grip's centre behind the tip, along the wire. */
const BEHIND = 0.3;
const UP = new Vector3(0, 1, 0);

export interface Grip {
  holder: Group;
  grip: Mesh;
  /** The hit volume (register it with `ctx.input`). */
  hit: Mesh;
  material: KToonMaterial;
  shown: Glide;
  call: number;
  hover: boolean;
}

export interface Grips {
  of: Readonly<Record<EndKey, Grip>>;
  /** Lay a grip on the wire: `pts` from the wire's start to its end; `fromEnd` = the grip's end is the last point. */
  place(key: EndKey, pts: readonly Vector3[], fromEnd: boolean): void;
  snap(): void;
  update(dt: number, t: number): void;
}

export function createGrips(stage: CircuitStage, ends: Readonly<Record<EndKey, End>>): Grips {
  const geo = G.capsule(0.1, 0.34, 20);
  const hitGeo = new SphereGeometry(0.3, 12, 8);
  const hitMat = new MeshBasicMaterial({ visible: false });
  const of = {} as Record<EndKey, Grip>;
  for (const key of Object.keys(ends) as EndKey[]) {
    const material = K.toon({
      color: 'cyan',
      emissive: 'cyan',
      emissiveIntensity: 0.25,
      gloss: 0.6,
      keepHue: true,
    });
    const grip = new Mesh(geo, material);
    grip.name = `build-grip:${key}`;
    grip.castShadow = true;
    const hit = new Mesh(hitGeo, hitMat);
    hit.name = `build-grip-hit:${key}`;
    const holder = new Group();
    holder.add(grip, hit);
    holder.visible = false;
    stage.base.frame.add(holder);
    of[key] = { holder, grip, hit, material, shown: glide(0), call: 0, hover: false };
  }
  const a = new Vector3();
  const b = new Vector3();
  const axis = new Vector3();
  return {
    of,
    place(key, pts, fromEnd) {
      const g = of[key];
      // walk BEHIND along the wire from its tip
      const n = pts.length;
      const at = (i: number): Vector3 => pts[fromEnd ? n - 1 - i : i]!;
      let d = 0;
      let i = 1;
      while (i < n - 1 && d + at(i).distanceTo(at(i - 1)) < BEHIND) {
        d += at(i).distanceTo(at(i - 1));
        i++;
      }
      a.copy(at(Math.max(i - 2, 0)));
      b.copy(at(Math.min(i + 1, n - 1)));
      g.holder.position.copy(at(i));
      g.holder.quaternion.setFromUnitVectors(UP, axis.subVectors(b, a).normalize());
    },
    snap() {
      for (const g of Object.values(of)) g.shown.set(g.shown.target);
    },
    update(dt, t) {
      for (const g of Object.values(of)) {
        const s = g.shown.update(dt);
        g.holder.visible = s > 0.002;
        g.holder.scale.setScalar(Math.max(s * (2 - s), 1e-3));
        const c = Math.min(Math.max(g.call, 0), 1);
        g.material.emissiveIntensity = 0.18 + c * (0.25 + 0.12 * Math.sin(t * 2.4)) + (g.hover ? 0.3 : 0);
      }
    },
  };
}
