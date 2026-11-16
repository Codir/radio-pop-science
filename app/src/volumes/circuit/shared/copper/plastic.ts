/**
 * The plastic sheath from the inside (`wire/plastic`, VISUAL §6): atoms of another tint (violet), not in rows
 * but in long wavy chains, and every electron tied to its own atom — it only sways on a short springy thread.
 * No free electrons here: that is the whole difference between the insulator and the copper right below it.
 * (A stated simplification: real polymer chains are tangled coils of several kinds of atoms.)
 */
import { CylinderGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { Rng } from '@/engine/api';
import { createOrbs, ORB_STYLES, RibbonLines, type Orbs } from '@/fx';
import { K } from '@/style';
import { COPPER_TOP, ELECTRON_R } from './layout';

const ATOM = 0.9;
const STEP = 2.7;
/** Chains: height above the copper's top surface and depth; the ones at z = 0 are in focus. */
const CHAINS = [
  { y: 2.1, z: 0 },
  { y: 4.6, z: -2.6 },
  { y: 6.7, z: 0 },
  { y: 8.8, z: -2.6 },
  { y: 10.9, z: 0 },
  { y: 13.0, z: -2.6 },
  { y: 15.1, z: 0 },
] as const;
const HALF = 10;

interface Tied {
  home: Vector3;
  dir: Vector3;
  side: Vector3;
  rate: number;
  phase: number;
}

export interface Plastic {
  group: Group;
  atoms: Orbs;
  electrons: Orbs;
  /** 0…1 dissolve. */
  fade: number;
  update(t: number): void;
}

export function createPlastic(rng: Rng): Plastic {
  const group = new Group();
  group.name = 'plastic-sheath';
  const places: { p: Vector3; deep: boolean }[] = [];
  const bonds: [Vector3, Vector3][] = [];
  CHAINS.forEach((chain, c) => {
    let prev: Vector3 | null = null;
    const wave = rng.range(0, 6.28);
    for (let i = -HALF; i <= HALF; i++) {
      const x = i * STEP + (c % 3) * 0.7;
      // a zigzag backbone riding a slow wave: a chain, visibly not a crystal row
      const y = COPPER_TOP + chain.y + (i % 2 === 0 ? 0.42 : -0.42) + 0.55 * Math.sin(x * 0.33 + wave);
      const p = new Vector3(x, y, chain.z + 0.35 * Math.sin(x * 0.21 + wave * 2));
      places.push({ p, deep: chain.z < -1 });
      if (prev) bonds.push([prev, p]);
      prev = p;
    }
  });
  const atoms = createOrbs({
    kind: {
      ...ORB_STYLES.blob,
      color: 'violet',
      shade: 'violet.dark',
      selfLit: 0,
      gloss: 0,
      rim: 0.5,
      glyph: 'none',
    },
    count: places.length,
    radius: ATOM,
    instanceColors: true,
    halo: false,
  });
  atoms.name = 'plastic-atoms';
  places.forEach(({ p, deep }, i) => {
    atoms.setPosition(i, p.x, p.y, p.z);
    atoms.setInstanceColor(i, deep ? 'violet.dark' : 'violet', deep ? 0.7 : 1);
  });
  atoms.commit();
  // bonds of the backbone: short dark sticks, one instanced mesh
  const bondMaterial = K.toon({ color: 'violet.dark' });
  const stick = new InstancedMesh(new CylinderGeometry(0.2, 0.2, 1, 10, 1, true), bondMaterial, bonds.length);
  stick.name = 'plastic-bonds';
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const d = new Vector3();
  bonds.forEach(([a, b], i) => {
    d.subVectors(b, a);
    const len = d.length();
    q.setFromUnitVectors(up, d.normalize());
    m.compose(a.clone().add(b).multiplyScalar(0.5), q, new Vector3(1, len, 1));
    stick.setMatrixAt(i, m);
  });
  stick.frustumCulled = false;
  // one electron per atom of the chains in focus, on its thread
  const tied: Tied[] = places
    .filter((a) => !a.deep)
    .map(({ p }) => {
      const a = rng.range(0, 6.28);
      const dir = new Vector3(Math.cos(a), Math.sin(a) * 0.8, rng.range(0.15, 0.6)).normalize();
      return {
        home: p,
        dir,
        side: new Vector3(-dir.y, dir.x, 0).normalize(),
        rate: rng.range(2.4, 4.2),
        phase: rng.range(0, 6.28),
      };
    });
  const electrons = createOrbs({
    kind: {
      ...ORB_STYLES.electron,
      glyph: 'none',
      intensity: 0.95,
      halo: { color: 'cyan', size: 3, strength: 0.4 },
    },
    count: tied.length,
    radius: ELECTRON_R,
  });
  electrons.name = 'plastic-electrons';
  const threads = new RibbonLines({
    capacity: tied.length * 2,
    color: 'cyan',
    width: 0.11,
    intensity: 0.95,
    dashStrength: 0,
    base: 1,
    endFade: [0, 0],
    hotCore: 0,
    keepHue: true,
  });
  const lines = tied.map(() => ({ points: [new Vector3(), new Vector3()], brightness: [0.35, 1] }));
  group.add(stick, atoms, threads, electrons);
  const plastic: Plastic = {
    group,
    atoms,
    electrons,
    fade: 1,
    update(t) {
      group.visible = plastic.fade > 0.004;
      if (!group.visible) return;
      tied.forEach((e, i) => {
        // sways sideways and bobs in and out — always coming back
        const sway = 0.5 * Math.sin(t * e.rate + e.phase);
        const reach = ATOM + 0.5 + 0.16 * Math.sin(t * e.rate * 1.7 + e.phase * 2);
        const p = lines[i]!.points[1]!.copy(e.dir)
          .addScaledVector(e.side, sway)
          .normalize()
          .multiplyScalar(reach)
          .add(e.home);
        lines[i]!.points[0]!.copy(p)
          .sub(e.home)
          .setLength(ATOM * 0.96)
          .add(e.home);
        electrons.setPosition(i, p.x, p.y, p.z);
      });
      electrons.commit();
      threads.setLines(lines);
      atoms.fade = electrons.fade = bondMaterial.fade = plastic.fade;
      threads.visible = plastic.fade > 0.5;
    },
  };
  return plastic;
}
