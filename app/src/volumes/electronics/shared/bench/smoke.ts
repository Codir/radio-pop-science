/**
 * The moment a part burns (docs/volumes/electronics/VISUAL.md §4.8; plan decision 11): one small wisp — eight soft
 * puffs of `mist`, at most 0.35 opaque, rising 0.6 over the hottest place in 1.2 s and gone. Once, on the model's event
 * (the driver's `advance` gave the part's id), never a loop; no flame, no sparks, no flash, no sound. A bulged
 * electrolytic lets one soft puff of steam out of its vent the same way (1.5 s; the state is E1-5's, E2-9 binds it).
 * Nothing else: no recipe of smoke.
 *
 * The puffs are lit translucent plastic (`sheath`) with soft edges. Their meshes are made with the bench and hidden while
 * nothing burns; a pool of two wisps (two parts burning in one frame: the older one gives way after that). A hidden mesh
 * is compiled when the chapter loads but not again when the quality settles later (a phone's), so one more mesh of the
 * same shader is drawn every frame with nothing in it (an empty range, `keeper`): the shader stays compiled for the
 * frame's lights and quality, and a burn compiles none (the check counts the programs).
 *
 * Local frame of `group`: the world (add it to the chapter's root).
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { G } from '@/kit';
import type { KToonMaterial } from '@/style';
import { sheath, tame } from './materials';

/** VISUAL §4.8. */
export const SMOKE = {
  puffs: 8,
  opacity: 0.35,
  rise: 0.6,
  seconds: 1.2,
  /** The steam of a bulged can: a few puffs, slower, lower. */
  steam: { puffs: 4, rise: 0.4, seconds: 1.5 },
} as const;

/** How many wisps can be in the air at once. */
const WISPS = 2;
/** The golden angle: the puffs spread round the place without a pattern. */
const TURN = Math.PI * (3 - Math.sqrt(5));

export type Wisp = 'smoke' | 'steam';

export interface Smoke {
  readonly group: Group;
  /** One wisp over `at` (world): the place a part burnt, or a can's vent. */
  puff(at: Vector3, kind?: Wisp): void;
  /** Every frame (dt may be 0: the wisp holds). */
  update(dt: number): void;
  /** Wisps in the air now. */
  readonly active: number;
  /** Wisps let out since the bench was made. */
  readonly fired: number;
  dispose(): void;
}

interface Slot {
  readonly meshes: Mesh<BufferGeometry, KToonMaterial>[];
  readonly at: Vector3;
  kind: Wisp;
  /** Seconds since it was let out; < 0 when the slot is free. */
  age: number;
}

const ease = (u: number): number => 1 - (1 - u) * (1 - u);

/**
 * A mesh drawn every frame that draws nothing (its geometry's range is empty): it keeps `material`'s shader compiled
 * for the frame's lights and quality, for meshes of the same shader that only show now and then (a burn's wisp, its
 * marks). One draw call of no vertices.
 */
export function keeper(material: KToonMaterial, receiveShadow: boolean, name: string): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setDrawRange(0, 0);
  const m = new Mesh(g, material);
  m.name = name;
  m.frustumCulled = false;
  m.castShadow = false;
  m.receiveShadow = receiveShadow;
  m.raycast = () => {};
  return m;
}

const puffMaterial = (): KToonMaterial =>
  tame(sheath({ color: 'mist', opacity: SMOKE.opacity, edgeOpacity: 0, gloss: 0.5, highlight: 0, rim: 0 }));

export function createSmoke(): Smoke {
  const group = new Group();
  group.name = 'smoke';
  const ball = G.sphere(1, 14);
  const keep = keeper(puffMaterial(), false, 'smoke:keeper');
  group.add(keep);
  const slots: Slot[] = Array.from({ length: WISPS }, (_, w) => {
    const meshes = Array.from({ length: SMOKE.puffs }, (_, i) => {
      const m = new Mesh(ball, puffMaterial());
      m.name = `smoke:${w}:${i}`;
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = 8;
      m.raycast = () => {};
      m.visible = false;
      group.add(m);
      return m;
    });
    return { meshes, at: new Vector3(), kind: 'smoke' as Wisp, age: -1 };
  });
  let fired = 0;

  const show = (s: Slot): void => {
    const steam = s.kind === 'steam';
    const n = steam ? SMOKE.steam.puffs : SMOKE.puffs;
    const total = steam ? SMOKE.steam.seconds : SMOKE.seconds;
    const rise = steam ? SMOKE.steam.rise : SMOKE.rise;
    const stagger = total * 0.3;
    s.meshes.forEach((m, i) => {
      const start = i < n ? (stagger * i) / Math.max(n - 1, 1) : Infinity;
      const u = (s.age - start) / (total - stagger);
      if (!(u > 0 && u < 1)) {
        m.visible = false;
        return;
      }
      m.visible = true;
      const a = i * TURN;
      const spread = 0.02 + 0.07 * u;
      m.position.set(
        s.at.x + Math.cos(a) * spread,
        s.at.y + rise * ease(u) + 0.02 * i,
        s.at.z + Math.sin(a) * spread,
      );
      m.scale.setScalar((steam ? 0.09 : 0.07) + (steam ? 0.14 : 0.15) * u);
      // in quickly, out slowly: never more than 0.35 opaque
      m.material.uniforms.opacity!.value = SMOKE.opacity * Math.min(1, u / 0.12) * Math.sqrt(1 - u);
    });
  };

  return {
    group,
    puff(at, kind = 'smoke') {
      const s = slots.find((x) => x.age < 0) ?? slots.reduce((a, b) => (b.age > a.age ? b : a));
      s.at.copy(at);
      s.kind = kind;
      s.age = 0;
      fired++;
      show(s);
    },
    update(dt) {
      for (const s of slots) {
        if (s.age < 0) continue;
        s.age += Math.max(dt, 0);
        const total = s.kind === 'steam' ? SMOKE.steam.seconds : SMOKE.seconds;
        if (s.age >= total) {
          s.age = -1;
          for (const m of s.meshes) m.visible = false;
        } else show(s);
      }
    },
    get active() {
      return slots.filter((s) => s.age >= 0).length;
    },
    get fired() {
      return fired;
    },
    dispose() {
      group.removeFromParent();
      ball.dispose();
      keep.geometry.dispose();
      (keep.material as KToonMaterial).dispose();
      for (const s of slots) for (const m of s.meshes) m.material.dispose();
    },
  };
}
