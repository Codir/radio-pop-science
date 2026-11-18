/**
 * Pale copies of the probe's arrow left where the probe has been (`charge/field`, VISUAL §7 `charge-field/field`:
 * «бліда коротка копія стрілки … з них поступово складається картина поля»). Up to `capacity` arrows in two
 * instanced draws (shafts, heads), pale `amber`, opaque: an arrow grows in and thins out, the oldest first.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { col } from '@/style';

const UP = new Vector3(0, 1, 0);

interface Copy {
  from: Vector3;
  dir: Vector3;
  length: number;
  /** 0…1 light (rises when laid, falls when it is among the oldest). */
  light: number;
  alive: boolean;
}

export interface Trail {
  group: Group;
  /** Lay a copy (world): the newest; beyond capacity the oldest starts to fade. */
  lay(from: Vector3, dir: Vector3, length: number): void;
  /** Copies laid and not fading. */
  readonly count: number;
  /** World points of the copies' tails (for goals and labels). */
  points(): Vector3[];
  /** 0…1 presence of the whole trail. */
  shown: number;
  clear(): void;
  update(dt: number): void;
}

export function createTrail(capacity = 40, radius = 0.022, head = 0.11): Trail {
  // opaque and depth-writing: the copies lie in the focal plane and the depth of field keeps them crisp (a
  // transparent arrow took the blur of the room behind it); pale = a light amber, less bright than the probe's
  const material = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const shafts = new InstancedMesh(new CylinderGeometry(radius, radius, 1, 8), material, capacity);
  const heads = new InstancedMesh(new ConeGeometry(radius * 2.6, head, 12), material, capacity);
  for (const m of [shafts, heads]) {
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = false;
  }
  const group = new Group();
  group.name = 'charge-field-trail';
  group.add(shafts, heads);
  const copies: Copy[] = Array.from({ length: capacity }, () => ({
    from: new Vector3(),
    dir: new Vector3(0, 1, 0),
    length: 0,
    light: 0,
    alive: false,
  }));
  let next = 0;
  let laid = 0;
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const tint = col('amber').lerp(col('white'), 0.3);
  const c = tint.clone();
  const trail: Trail = {
    group,
    shown: 1,
    lay(from, dir, length) {
      const k = copies[next]!;
      k.from.copy(from);
      k.dir.copy(dir).normalize();
      k.length = length;
      k.light = 0;
      k.alive = true;
      next = (next + 1) % capacity;
      laid = Math.min(laid + 1, capacity);
    },
    get count() {
      return copies.filter((k) => k.alive).length;
    },
    points: () => copies.filter((k) => k.alive).map((k) => k.from.clone()),
    clear() {
      copies.forEach((k) => ((k.alive = false), (k.light = 0)));
      next = laid = 0;
    },
    update(dt) {
      copies.forEach((k, i) => {
        // the oldest few fade as the trail fills up, so the 41st never pops the 1st away
        const age = (i - next + capacity) % capacity; // 0 = the oldest slot
        const fading = laid >= capacity - 4 && age < 4;
        const want = k.alive ? (fading ? 0.25 * age : 1) : 0;
        k.light += (want - k.light) * Math.min(dt * 4, 1);
        const h = Math.min(head, k.length * 0.6);
        const body = Math.max(k.length - h, 1e-3);
        q.setFromUnitVectors(UP, k.dir);
        // a copy grows in and fades out by its thickness (it is opaque)
        const z = k.light * trail.shown;
        m.compose(p.copy(k.from).addScaledVector(k.dir, body / 2), q, s.set(z, body * z, z));
        shafts.setMatrixAt(i, m);
        m.compose(p.copy(k.from).addScaledVector(k.dir, body + h / 2), q, s.set(z, (h / head) * z, z));
        heads.setMatrixAt(i, m);
        c.copy(tint).multiplyScalar(0.62);
        shafts.setColorAt(i, c);
        heads.setColorAt(i, c);
      });
      for (const mesh of [shafts, heads]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      group.visible = trail.shown > 0.002;
    },
  };
  return trail;
}
