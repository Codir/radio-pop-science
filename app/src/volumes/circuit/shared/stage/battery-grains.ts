/**
 * The grains of the section: zinc powder in the gel (round, silvery, bulging out of the recessed gel), the pale
 * deposit that grows where a zinc grain is spent, and the fine grain of the pressed manganese oxide (form, not
 * texture — VISUAL §5.2). Placed once by a seeded random, so every frame and every machine shows the same cut.
 */
import { Color, IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { K, col } from '@/style';
import { SEC } from './battery-section';
import { oxideSpent, zincSpent } from './battery-layers';

/** Small deterministic random (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Grain {
  x: number;
  y: number;
  r: number;
  /** Across the layer, 0 … 1 (as `Cell.s`), with a little jitter so the front is not a ruler line. */
  s: number;
}

/** Zinc grains: x, y in the section frame; none on the pin. */
export function placeZinc(count = 260): Grain[] {
  const rnd = seeded(7);
  const out: Grain[] = [];
  for (let tries = 0; out.length < count && tries < 20000; tries++) {
    const r = 0.011 + 0.007 * rnd();
    const x = SEC.coreFrom + 0.05 + r + (SEC.coreTo - SEC.coreFrom - 0.05 - 2 * r) * rnd();
    const y = (rnd() * 2 - 1) * (SEC.sepIn - r - 0.006);
    if (Math.abs(y) < SEC.pin + r + 0.006 && x < SEC.pinTip + r) continue;
    if (out.some((g) => Math.hypot(g.x - x, g.y - y) < g.r + r + 0.006)) continue;
    out.push({ x, y, r, s: Math.min(1, Math.abs(y) / SEC.sepIn + (rnd() - 0.5) * 0.12) });
  }
  return out;
}

/** Fine grain of the oxide rings: small low bumps, both sides of the axis, none on the seams. */
export function placeOxide(count = 240): Grain[] {
  const rnd = seeded(11);
  const out: Grain[] = [];
  const width = SEC.canIn - SEC.cathodeIn;
  for (let tries = 0; out.length < count && tries < 20000; tries++) {
    const r = 0.007 + 0.006 * rnd();
    const pellet = SEC.pellets[Math.floor(rnd() * 3)]!;
    const x = pellet[0] + r + 0.004 + (pellet[1] - pellet[0] - 2 * r - 0.008) * rnd();
    const a = SEC.cathodeIn + r + 0.003 + (width - 2 * r - 0.006) * rnd();
    const y = rnd() < 0.5 ? a : -a;
    if (out.some((g) => Math.hypot(g.x - x, g.y - y) < g.r + r + 0.003)) continue;
    out.push({ x, y, r, s: (a - SEC.cathodeIn) / width });
  }
  return out;
}

/**
 * The cut face lies flat toward the viewer, so the lamp and the moon graze it: with the default bands the whole
 * section sat in the half-tone and its colours went grey. The cut is read by its colours — keep it in the lit band.
 */
export const CUT_LIGHT = { terminator: -0.55, midThreshold: -0.25 } as const;

const PASTE_TOP = -0.022;
// a cool silver: under the warm lamp it reads neutral grey, not pink (the room's light is magenta-warm there)
const ZINC = col('mist').lerp(col('sky'), 0.22).lerp(col('white'), 0.42);
const DEPOSIT = col('mist').lerp(col('white'), 0.2);
const OXIDE = col('slate').lerp(col('ink'), 0.35);
const OXIDE_SPENT = col('slate').lerp(col('steel'), 0.75);

export interface Grains {
  zinc: InstancedMesh;
  deposit: InstancedMesh;
  oxide: InstancedMesh;
  /** Re-shape the grains for a life (zinc shrinks, deposit grows, oxide bumps lighten) and highlight dims. */
  set(life: number, dim: { zinc: number; cathode: number }): void;
}

export function createGrains(): Grains {
  const zs = placeZinc();
  const os = placeOxide();
  const ball = new IcosahedronGeometry(1, 2);
  const zinc = new InstancedMesh(
    ball,
    // a little light of their own (neutral silver): the grains keep their colour under the warm lamp and the moon
    K.toon({ color: 'white', gloss: 0.9, highlight: 0.8, emissive: 'mist', emissiveIntensity: 0.22, ...CUT_LIGHT }),
    zs.length,
  );
  const deposit = new InstancedMesh(
    ball,
    K.toon({ color: 'white', highlight: 0.15, ...CUT_LIGHT }),
    zs.length,
  );
  const oxide = new InstancedMesh(ball, K.toon({ color: 'white', highlight: 0.2, ...CUT_LIGHT }), os.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const c = new Color();
  for (const mesh of [zinc, deposit, oxide]) {
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  }
  const set = (life: number, dim: { zinc: number; cathode: number }): void => {
    zs.forEach((g, i) => {
      const spent = zincSpent(g.s, life);
      // a grain melts away; its deposit spreads flat around where it was
      const k = Math.max(1 - spent * 1.15, 0);
      zinc.setMatrixAt(i, m.compose(p.set(g.x, g.y, PASTE_TOP + 0.002), q, s.set(g.r * k, g.r * k, g.r * k)));
      const d = Math.min(spent * 1.3, 1);
      const dr = g.r * (0.35 + 0.95 * d);
      deposit.setMatrixAt(i, m.compose(p.set(g.x, g.y, PASTE_TOP), q, s.set(dr, dr, dr * 0.3 * d + 1e-4)));
    });
    os.forEach((g, i) => {
      oxide.setMatrixAt(i, m.compose(p.set(g.x, g.y, -0.001), q, s.set(g.r, g.r, g.r * 0.45)));
      oxide.setColorAt(i, c.copy(OXIDE).lerp(OXIDE_SPENT, oxideSpent(g.s, life)).multiplyScalar(dim.cathode));
    });
    for (let i = 0; i < zs.length; i++) {
      zinc.setColorAt(i, c.copy(ZINC).multiplyScalar(dim.zinc));
      deposit.setColorAt(i, c.copy(DEPOSIT).multiplyScalar(dim.zinc));
    }
    for (const mesh of [zinc, deposit, oxide]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
  set(0, { zinc: 1, cathode: 1 });
  return { zinc, deposit, oxide, set };
}
