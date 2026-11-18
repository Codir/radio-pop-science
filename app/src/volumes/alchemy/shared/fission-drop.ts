/**
 * Copied from `app/src/volumes/electricity/chapters/plant-nuclear/parts/nucleus.ts` at commit ad65b6d: a volume may
 * not import another one (lint `local/volume-boundary`), so the model is duplicated on purpose. `packCluster` is
 * unchanged, and so is the pose of the drop (trembling, stretching into a dumbbell, two fragment centres, rounding
 * of the fragments). What differs: the original builds one fixed split (²³⁵U → ¹⁴¹Ba + ⁹²Kr + 3 n, two of the free
 * neutrons from the drop); this copy deals any split again (`deal`) into swarms sized once for the heaviest drop of
 * the game — any parent, any pair of fragments, any number of free neutrons, all of them from the drop. Added: the
 * fragments' centroids in the round drop (`centroids`, where each half starts from when it tears off) and an
 * optional size per fragment in the pose (`scale`: one fragment can fade while the other stays); the per-frame
 * placement reuses scratch vectors instead of cloning (same positions).
 *
 * A nucleus as a cluster of nucleon orbs (FX characters: protons `coral`, neutrons `mist`→`steel`). `packCluster`
 * places N touching spheres in a ball (golden spiral in volume + a few rounds of relaxation, deterministic). The
 * drop's pose is a pure function of a few numbers: wobble (the trembling liquid drop), stretch (the «dumbbell»
 * before the split), the two fragment centres and how round the fragments already are — so a fission animation is
 * random-access (it just sets numbers).
 */
import { Group, Vector3 } from 'three';
import { createOrbs, type Orbs } from '@/fx';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** N points filling a ball so that spheres of radius `r` just touch (packing fraction ≈ 0.6). */
export function packCluster(n: number, r: number): Vector3[] {
  const R = r * Math.cbrt(n / 0.6);
  const pts: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const rad = R * Math.cbrt((i + 0.5) / n);
    const y = 1 - (2 * ((i * 0.6180339887) % 1));
    const ring = Math.sqrt(1 - y * y);
    pts.push(new Vector3(Math.cos(i * GOLDEN) * ring, y, Math.sin(i * GOLDEN) * ring).multiplyScalar(rad));
  }
  const d = new Vector3();
  const lim = R - r * 0.7;
  for (let it = 0; it < 14; it++) {
    // keep the drop round: nothing pokes out of the ball, then neighbours push apart
    for (const q of pts) if (q.length() > lim) q.setLength(lim);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        d.subVectors(pts[j]!, pts[i]!);
        const l = d.length();
        if (l > 1e-6 && l < 2 * r) {
          d.multiplyScalar((2 * r - l) / l / 2);
          pts[i]!.sub(d);
          pts[j]!.add(d);
        }
      }
  }
  return pts;
}

/** Radius of a packed ball of `n` nucleons of radius `r` (what `packCluster` fills). */
export const clusterRadius = (n: number, r: number): number => r * Math.cbrt(n / 0.6);

export interface DropPose {
  /** 0…1 trembling of the drop (the excited compound nucleus oscillates strongly). */
  wobble: number;
  /** 0…1 elongation into a dumbbell before the split. */
  stretch: number;
  /** Fragment centres (local), used once `split` > 0. */
  heavy: Vector3;
  light: Vector3;
  /** 0 = still one drop … 1 = two round fragments at `heavy` / `light`. */
  split: number;
  /** Size of each fragment's nucleons, 0…1 (default 1). */
  scale?: { readonly heavy: number; readonly light: number };
}

/** A split to deal: the drop (Z, A), the heavy fragment (Z, A) and the neutrons that fly off free. */
export interface DropSplit {
  readonly z: number;
  readonly a: number;
  readonly heavy: { readonly z: number; readonly a: number };
  readonly freed: number;
}

export interface FissionDrop {
  readonly group: Group;
  readonly protons: Orbs;
  readonly neutrons: Orbs;
  /** Indices (into the neutron swarm) of the neutrons that leave as free neutrons at the split. */
  readonly freed: readonly number[];
  /** Local radius of the whole drop, and of the two round fragments, for the split dealt last. */
  readonly radius: number;
  readonly fragmentRadius: { readonly heavy: number; readonly light: number };
  /** Centroid of each fragment's nucleons in the round, unstretched drop (local). */
  readonly centroids: { readonly heavy: Vector3; readonly light: Vector3 };
  /** Re-seat the nucleons for another split (packs three balls: a few ms for the heaviest drop). */
  deal(split: DropSplit): void;
  pose(p: DropPose, t: number): void;
}

/** A drop of up to `maxZ` protons and `maxN` neutrons of radius `r`; deal a split before the first `pose`. */
export function createFissionDrop(maxZ: number, maxN: number, r = 0.5): FissionDrop {
  const protons = createOrbs({ kind: 'proton', count: maxZ, radius: r });
  const neutrons = createOrbs({ kind: 'neutron', count: maxN, radius: r });
  protons.instances = neutrons.instances = 0;
  const group = new Group();
  group.name = 'fission-drop';
  group.add(protons, neutrons);

  let pts: Vector3[] = [];
  let pIdx: number[] = [];
  let nIdx: number[] = [];
  const side = new Map<number, 0 | 1 | 2>(); // 0 heavy, 1 light, 2 freed
  const home = new Map<number, Vector3>();
  let centroid: Vector3[] = [new Vector3(), new Vector3()];
  let R = r;
  const p = new Vector3();
  const moved = new Vector3();
  const round = new Vector3();

  const drop = {
    group,
    protons,
    neutrons,
    freed: [] as number[],
    radius: r,
    fragmentRadius: { heavy: r, light: r },
    centroids: { heavy: new Vector3(), light: new Vector3() },

    deal(split: DropSplit): void {
      const { z, a, freed } = split;
      const heavyZ = split.heavy.z;
      const heavyA = split.heavy.a;
      pts = packCluster(a, r);
      // mix protons and neutrons evenly through the drop (deterministic shuffle)
      const order = pts.map((_, i) => i).sort((i, j) => ((i * 7919) % a) - ((j * 7919) % a));
      pIdx = order.slice(0, z);
      nIdx = order.slice(z);
      protons.instances = z;
      neutrons.instances = a - z;
      // fragment membership by x (left = heavy); the free neutrons come from between the halves
      const byX = (ids: number[]): number[] => [...ids].sort((i, j) => pts[i]!.x - pts[j]!.x);
      const heavyN = heavyA - heavyZ;
      side.clear();
      byX(pIdx).forEach((id, k) => side.set(id, k < heavyZ ? 0 : 1));
      byX(nIdx).forEach((id, k) => side.set(id, k < heavyN ? 0 : k < heavyN + freed ? 2 : 1));
      // packed places inside each round fragment, matched to the nucleons in x order
      const lightA = a - heavyA - freed;
      const fragPts = [packCluster(heavyA, r), packCluster(lightA, r)];
      const members: number[][] = [[], []];
      for (const id of [...pIdx, ...nIdx].sort((i, j) => pts[i]!.x - pts[j]!.x)) {
        const s = side.get(id)!;
        if (s < 2) members[s]!.push(id);
      }
      home.clear();
      members.forEach((ids, f) => {
        const places = [...fragPts[f]!].sort((u, v) => u.x - v.x);
        ids.forEach((id, k) => home.set(id, places[k]!));
      });
      centroid = [0, 1].map((f) =>
        members[f]!.reduce((s, id) => s.add(pts[id]!), new Vector3()).multiplyScalar(1 / Math.max(1, members[f]!.length)),
      );
      drop.freed = nIdx.filter((id) => side.get(id) === 2).map((id) => nIdx.indexOf(id));
      R = clusterRadius(a, r);
      drop.radius = R;
      drop.fragmentRadius = { heavy: clusterRadius(heavyA, r), light: clusterRadius(lightA, r) };
      drop.centroids = { heavy: centroid[0]!.clone(), light: centroid[1]!.clone() };
    },

    pose(pose: DropPose, t: number): void {
      const size = (id: number): number => {
        const s = side.get(id)!;
        if (s === 2) return pose.split > 0 ? 0 : 1;
        return (s === 0 ? pose.scale?.heavy : pose.scale?.light) ?? 1;
      };
      pIdx.forEach((id, i) => {
        const q = place(id, pose, t);
        protons.setPosition(i, q.x, q.y, q.z, size(id));
      });
      nIdx.forEach((id, i) => {
        const q = place(id, pose, t);
        neutrons.setPosition(i, q.x, q.y, q.z, size(id));
      });
      protons.commit();
      neutrons.commit();
    },
  };

  function place(id: number, pose: DropPose, t: number): Vector3 {
    const b = pts[id]!;
    const s = side.get(id)!;
    const sign = s === 0 ? -1 : s === 1 ? 1 : 0;
    // drop: ellipsoidal breathing + jitter, then the dumbbell pulls the halves apart along x
    const breathe = 1 + 0.12 * pose.wobble * Math.sin(t * 9);
    p.set(b.x * breathe, b.y / Math.sqrt(breathe), b.z / Math.sqrt(breathe));
    p.x += sign * pose.stretch * R * 0.75;
    p.y *= 1 - 0.3 * pose.stretch * Math.exp(-((b.x / R) ** 2) * 4);
    const j = 0.06 * pose.wobble * r;
    p.x += j * Math.sin(t * 23 + id);
    p.y += j * Math.sin(t * 19 + id * 1.7);
    if (pose.split > 0 && s < 2) {
      const c = s === 0 ? pose.heavy : pose.light;
      round.copy(home.get(id)!).add(c);
      moved.copy(p).sub(centroid[s]!).add(c);
      p.copy(moved.lerp(round, Math.min(1, pose.split * 1.4)));
    }
    return p;
  }

  return drop;
}
