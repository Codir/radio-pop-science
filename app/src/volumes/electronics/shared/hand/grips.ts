/**
 * The handles of the bench's hand (docs/volumes/electronics/VISUAL.md §6, «Захвати»), `cyan` — «you can take this»,
 * as in `circuit/build`. Copied from `circuit/chapters/build/parts/grips.ts` (shared/README.md, «Копії») and made
 * general: the parent group is a parameter, a grip has a key of the hand and one of three shapes —
 * - `ring`: a thin ring (radius 0.05) on a leg of an axial part, `RING_Y` above the mouth, below the leg's bend;
 * - `tab`: a flat strip 0.1 wide 0.02 above the board from the mouth of a radial part's leg (which its body covers) to
 *   a round head (radius 0.07, 0.05 high) before the body;
 * - `end`: a capsule (radius 0.07, 0.24 long) on the end of a jumper, a lead or a probe — thinner than the circuit's
 *   wire grips (0.1 × 0.34): these wires are half as thick.
 * A grip grows in and out (`shown`), calls when the step wants it taken (`call`: full cyan, a slow pulse), brightens
 * under the pointer (`hover`): glow 0.18, + 0.3 under the pointer, + 0.25 + 0.12 · sin(2.4 t) when called. An invisible
 * sphere around it is what the hand hits; its radius is the bench's (`place`), so that neighbouring spheres never
 * overlap.
 *
 * Frame: the parent's (the board's frame).
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { G } from '@/kit';
import { K, type KToonMaterial } from '@/style';
import { glide, type Glide } from './glide';

export type GripKind = 'ring' | 'tab' | 'end';

/** Where a grip is (parent frame) and the radius of its sphere. */
export interface GripSpot {
  /** The leg (or end) of its owner it moves. */
  readonly leg: number;
  readonly kind: GripKind;
  /** The ring's middle, the tab's head, the capsule's middle. */
  readonly at: Vector3;
  r: number;
  /** A tab: the mouth of its leg, where the strip starts. */
  readonly from?: Vector3;
  /** An end: the capsule's axis (unit). */
  readonly axis?: Vector3;
}

export interface Grip {
  readonly key: string;
  readonly kind: GripKind;
  readonly holder: Group;
  /** The hit volume (register it with `ctx.input`): a unit sphere scaled to the spot's radius. */
  readonly hit: Mesh;
  readonly material: KToonMaterial;
  readonly shown: Glide;
  call: number;
  hover: boolean;
  /** Where it is now (parent frame); null before the first `place`. */
  readonly spot: GripSpot | null;
  place(spot: GripSpot): void;
  update(dt: number, t: number): void;
  dispose(): void;
}

/** The ring around a leg, the tab's head, the end's capsule. */
export const GRIP = {
  ring: { radius: 0.05, tube: 0.012 },
  tab: { width: 0.1, y: 0.02, head: 0.07, headY: 0.05 },
  end: { radius: 0.07, length: 0.24 },
} as const;

const UP = new Vector3(0, 1, 0);

/** Geometries shared by every grip of a bench (one set per mount, freed with it). */
export interface GripGeometries {
  readonly ring: BufferGeometry;
  readonly strip: BufferGeometry;
  readonly head: BufferGeometry;
  readonly end: BufferGeometry;
  readonly sphere: BufferGeometry;
  readonly hidden: MeshBasicMaterial;
  dispose(): void;
}

export function gripGeometries(): GripGeometries {
  const ring = G.ring(GRIP.ring.radius, GRIP.ring.tube, 24, 6);
  // a strip one unit long along +x from its start, flat on the board
  const strip = new BoxGeometry(1, 0.008, GRIP.tab.width).translate(0.5, 0, 0);
  const head = new CylinderGeometry(GRIP.tab.head, GRIP.tab.head, 0.02, 20);
  const end = G.capsule(GRIP.end.radius, GRIP.end.length, 16);
  const sphere = new SphereGeometry(1, 12, 8);
  const hidden = new MeshBasicMaterial({ visible: false });
  return {
    ring,
    strip,
    head,
    end,
    sphere,
    hidden,
    dispose() {
      for (const g of [ring, strip, head, end, sphere]) g.dispose();
      hidden.dispose();
    },
  };
}

export function createGrip(parent: Group, key: string, kind: GripKind, geo: GripGeometries): Grip {
  const material = K.toon({
    color: 'cyan',
    emissive: 'cyan',
    emissiveIntensity: 0.18,
    gloss: 0.6,
    keepHue: true,
  });
  // the holder stays visible: an invisible object is never picked, and a grip hidden for want of the pointer must still
  // take it (over its sphere the pointer is over its part); only the look comes and goes
  const holder = new Group();
  holder.name = `grip:${key}`;
  const meshes: Mesh[] =
    kind === 'ring'
      ? [new Mesh(geo.ring, material)]
      : kind === 'tab'
        ? [new Mesh(geo.strip, material), new Mesh(geo.head, material)]
        : [new Mesh(geo.end, material)];
  for (const m of meshes) {
    m.castShadow = false;
    m.receiveShadow = false;
    m.name = `grip-mesh:${key}`;
  }
  const look = new Group();
  look.visible = false;
  look.add(...meshes);
  const hit = new Mesh(geo.sphere, geo.hidden);
  hit.name = `grip-hit:${key}`;
  holder.add(look, hit);
  parent.add(holder);
  const shown = glide(0);
  const dir = new Vector3();
  let spot: GripSpot | null = null;
  const grip: Grip = {
    key,
    kind,
    holder,
    hit,
    material,
    shown,
    call: 0,
    hover: false,
    get spot() {
      return spot;
    },
    place(s) {
      spot = s;
      hit.position.copy(s.at);
      hit.scale.setScalar(Math.max(s.r, 1e-3));
      if (kind === 'ring') meshes[0]!.position.copy(s.at);
      else if (kind === 'end') {
        meshes[0]!.position.copy(s.at);
        meshes[0]!.quaternion.setFromUnitVectors(UP, s.axis ?? UP);
      } else {
        // the strip from the leg's mouth to the head, flat on the board; the head round and low
        const from = s.from ?? s.at;
        const [strip, head] = meshes as [Mesh, Mesh];
        dir.set(s.at.x - from.x, 0, s.at.z - from.z);
        const len = dir.length();
        strip.position.set(from.x, GRIP.tab.y, from.z);
        strip.rotation.set(0, len > 1e-9 ? Math.atan2(-dir.z, dir.x) : 0, 0);
        strip.scale.set(Math.max(len, 1e-3), 1, 1);
        head.position.set(s.at.x, GRIP.tab.headY, s.at.z);
      }
    },
    update(dt, t) {
      const v = shown.update(dt);
      // the look grows in and out about its own spot; the hit sphere keeps its size
      look.visible = v > 0.002;
      const k = Math.max(v * (2 - v), 1e-3);
      for (const m of meshes) {
        // the tab's strip keeps its length (`place`) and grows in its thickness only
        if (kind === 'tab' && m === meshes[0]) m.scale.y = k;
        else m.scale.setScalar(k);
      }
      const c = Math.min(Math.max(grip.call, 0), 1);
      material.emissiveIntensity = 0.18 + c * (0.25 + 0.12 * Math.sin(t * 2.4)) + (grip.hover ? 0.3 : 0);
    },
    dispose() {
      holder.removeFromParent();
      material.dispose();
    },
  };
  return grip;
}
