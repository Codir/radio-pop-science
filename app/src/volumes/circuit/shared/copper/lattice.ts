/**
 * The rows of copper atoms (VISUAL §6): matte coral spheres without marks, each wrapped in a faint haze of its
 * own electrons; the planes behind the focal one sink into the backdrop colour. Atoms tremble a little (heat
 * makes them tremble more — chapters 5 and 6), pop in one by one (`wire/shared`) and answer a touch
 * (`wire/atoms`). The atom at the origin is drawn apart from the swarm: the dive continues into it.
 */
import { Group, type Vector3 } from 'three';
import { damp } from '@/engine/api';
import { createOrbs, ORB_STYLES, type Orbs, type OrbStyle } from '@/fx';
import { col } from '@/style';
import { createHaze, type Haze } from './haze';
import { ATOM_R, NUCLEUS_R, clamp01, latticeSites, mix, smooth, type Site } from './layout';

/** Matte toy sphere: no gloss, a soft rim, no sign (signs arrive with `charge/signs`). */
const ATOM_STYLE: OrbStyle = {
  ...ORB_STYLES.blob,
  color: 'coral',
  shade: 'coral.dark',
  selfLit: 0,
  gloss: 0,
  rim: 0.55,
  glyph: 'none',
};

export interface Lattice {
  group: Group;
  sites: readonly Site[];
  /** The swarm (sites 1 …) and the hero atom at the origin (site 0): both pickable, `instanceId + 1` = site. */
  atoms: Orbs;
  hero: Orbs;
  haze: Haze;
  /** How many atoms are present, in the order of `Site.rank` (fractions pop the next one in). */
  reveal: number;
  /** Trembling amplitude, units (0.05 = 2.5 % of the diameter; hot: up to 0.24). */
  tremble: number;
  /** 0…1: heat — stronger trembling and an orange rim (chapters 5, 6). */
  heat: number;
  /** 0…1 presence of the whole lattice (dithered; the dive from the wire core switches it). */
  fade: number;
  /** 0…1: the hero's solid ball shrinks to the size of its nucleus (the dive into the atom: what looked like a
   *  ball is a tiny heavy nucleus with electrons around it). */
  heroShrink: number;
  /** 0…1 presence of every atom but the hero: they shrink away, the farthest first, when the reader is inside
   *  one atom. */
  others: number;
  /** 0…1: how far the planes behind are sunk into the backdrop (1 = as designed, 0 = all planes alike). */
  recede: number;
  /** Strength of the haze of own electrons around every atom, 0…1. */
  hazeAmount: number;
  /** The atom the reader has chosen (`wire/atoms`): it stays a little swollen, lit, in a brighter veil. −1 = none. */
  selected: number;
  /** The atom the dive opens (a site of the focal plane; default 0, the atom at the origin). Set by `Copper.hero`. */
  heroSite: number;
  /** The atom of the focal plane at a point (local units; e.g. the hit point of a click, see
   *  `Copper.toLocal`), or −1. */
  siteAt(point: Vector3): number;
  /** A touch: the atom swells and lights up for a moment. */
  touch(site: number): void;
  /** Position of atom `site` this frame (trembling included), local units. */
  positionOf(site: number, out: Vector3): Vector3;
  /** Presence 0…1 of atom `site` (revealed and popped in). */
  presence(site: number): number;
  update(dt: number, t: number): void;
}

const backOut = (t: number): number => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

export function createLattice(): Lattice {
  const group = new Group();
  group.name = 'copper-lattice';
  const sites = latticeSites();
  const n = sites.length;
  const atoms = createOrbs({
    kind: ATOM_STYLE,
    count: n - 1,
    radius: ATOM_R,
    instanceColors: true,
    halo: false,
  });
  const hero = createOrbs({ kind: ATOM_STYLE, count: 1, radius: ATOM_R, instanceColors: true, halo: false });
  atoms.name = 'copper-atoms';
  hero.name = 'copper-hero-atom';
  const haze = createHaze(n);
  group.add(atoms, hero, haze.mesh);

  const pop = new Float32Array(n); // 0…1 eased presence
  const pulse = new Float32Array(n); // touch feedback, decays
  const now = sites.map((s) => s.p.clone());
  const base = col('coral');
  const far = col('bg.indigo').lerp(col('coral.dark'), 0.45);
  const hot = col('orange');
  const tint = base.clone();
  const lattice: Lattice = {
    group,
    sites,
    atoms,
    hero,
    haze,
    reveal: n,
    tremble: 0.05,
    heat: 0,
    fade: 1,
    heroShrink: 0,
    others: 1,
    recede: 1,
    hazeAmount: 1,
    selected: -1,
    heroSite: 0,
    touch: (site) => (pulse[site] = 1),
    siteAt(point) {
      let best = -1;
      let d = ATOM_R * 1.25;
      for (let i = 0; i < n && sites[i]!.plane === 0; i++) {
        const q = now[i]!.distanceTo(point);
        if (q < d && pop[i]! > 0.5) {
          d = q;
          best = i;
        }
      }
      return best;
    },
    positionOf: (site, out) => out.copy(now[site]!),
    presence: (site) => pop[site]!,
    update(dt, t) {
      const amp = lattice.tremble * (1 + 3.8 * lattice.heat);
      // the hero: any atom of the focal plane (the one the reader chose); it is drawn apart from the swarm
      const heroSite = sites[lattice.heroSite]?.plane === 0 ? lattice.heroSite : 0;
      const centre = sites[heroSite]!.p;
      for (let i = 0; i < n; i++) {
        const s = sites[i]!;
        pop[i] = damp(pop[i]!, clamp01(lattice.reveal - i), 10, dt);
        // a touch is a quick swell that settles; the selected atom stays a little swollen and lit
        const chosen = i === lattice.selected ? 0.5 : 0;
        pulse[i] = damp(pulse[i]!, chosen, 3.2, dt);
        const glowing = pulse[i]!;
        const k =
          backOut(pop[i]!) * (1 + 0.1 * glowing + 0.08 * Math.sin(Math.PI * Math.min(glowing * 1.4, 1)));
        // three incommensurate sines per atom: a tremble that never repeats visibly and needs no state
        const f = 5.3 + (i % 7) * 0.37;
        const p = now[i]!.set(
          s.p.x + amp * Math.sin(t * f + i * 1.7),
          s.p.y + amp * Math.sin(t * f * 1.13 + i * 2.3),
          s.p.z + amp * Math.sin(t * f * 0.91 + i * 0.9),
        );
        // depth cue that does not depend on the host chapter's fog: planes behind lose light and saturation
        const sink = lattice.recede * (1 - Math.pow(0.72, s.plane));
        tint
          .copy(base)
          .lerp(far, sink)
          .lerp(hot, 0.35 * lattice.heat * (1 - sink));
        const light = mix(1, 0.56, sink) + 0.5 * pulse[i]!;
        if (i === heroSite) {
          // the hero does not vanish: its ball shrinks into its own nucleus (atom.ts takes over at that size)
          const shrink = mix(1, NUCLEUS_R / ATOM_R, smooth(0, 1, lattice.heroShrink));
          hero.setPosition(0, p.x, p.y, p.z, Math.max(k, 0) * shrink);
          hero.setInstanceColor(0, tint, light + 0.25 * lattice.heroShrink);
          const veil = (1 + 2.4 * glowing) * (1 - smooth(0, 0.5, lattice.heroShrink));
          haze.set(i, p.x, p.y, p.z, Math.max(k, 0) * veil);
          continue;
        }
        // the others leave by shrinking, the farthest first (a_i grows with distance)
        const a = 0.15 + 0.7 * Math.min(Math.hypot(s.p.x - centre.x, s.p.y - centre.y) / 16, 1);
        const stay = lattice.others >= 1 ? 1 : clamp01(lattice.others * (1 + a) - a);
        const slot = i > heroSite ? i - 1 : i;
        // the radius goes with the root of it, so the area an atom covers — the light it gives the frame — leaves evenly
        atoms.setPosition(slot, p.x, p.y, p.z, Math.max(k, 0) * Math.sqrt(stay));
        atoms.setInstanceColor(slot, tint, light);
        haze.set(i, p.x, p.y, p.z, Math.max(k, 0) * (1 - sink) ** 3 * stay * (1 + 2.4 * glowing));
      }
      atoms.commit();
      hero.commit();
      atoms.fade = hero.fade = lattice.fade;
      atoms.visible = lattice.others > 0.004;
      hero.visible = lattice.heroShrink < 0.995;
      haze.amount = lattice.hazeAmount * lattice.fade;
      haze.heat = lattice.heat;
      haze.commit();
      group.visible = lattice.fade > 0.004;
    },
  };
  return lattice;
}
