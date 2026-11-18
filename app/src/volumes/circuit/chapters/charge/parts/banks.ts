/**
 * Under the lens where the balloon touches the hair (`charge/charge`, VISUAL §3, §6 «Пластик»): two banks of
 * atoms in chains — rubber above (`violet`, as the plastic of chapter 1: rubber is an insulator too), hair
 * below (`magenta`, another shade). Every electron is tied to its atom by a short springy thread and only
 * trembles about it. A rub slides the rubber bank along the hair (`slide`), and a few electrons from the edge of
 * the hair hop across to atoms of the rubber (`hop`): there they stay, a second electron on that atom.
 * At most 20 electrons in focus. Local units: atom radius 0.8, the window shows ≈ 14 across; the boundary is y = 0.
 */
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { createOrbs, ORB_STYLES, RibbonLines, type OrbStyle } from '@/fx';
import { col } from '@/style';

const ATOM_R = 0.8;
const PITCH = 2.3;
/** Atoms per chain (the chains are longer than the window, so a slide never shows an end). */
const PER_CHAIN = 12;
/** Chain heights: rubber above the boundary, hair below. */
const RUBBER_Y = [1.45, 4.3];
const HAIR_Y = [-1.45, -4.3];
const TIE = 1.15;

const atomStyle = (color: string, shade: string): OrbStyle => ({
  ...ORB_STYLES.blob,
  color,
  shade,
  selfLit: 0.25,
  intensity: 0.8,
  gloss: 0,
  rim: 0.55,
  glyph: 'none',
});

interface Site {
  bank: 0 | 1;
  base: Vector3;
}
interface Electron {
  /** The atom it belongs to, and its own angle / phase about it. */
  site: number;
  angle: number;
  phase: number;
  /** A hop under way: 0…1 (1 = done), from where. */
  hop: number;
  from: Vector3;
}

export interface Banks {
  group: Group;
  /** Hops seen so far (electrons that crossed under the lens). */
  readonly hops: number;
  /** Slide the rubber along the hair by `way` (−1 / 1) one rub's worth. */
  slide(way: number): void;
  /** One electron from the edge of the hair hops onto the rubber (the nearest free pair in view). */
  hop(): boolean;
  /** Back to the state before any rub (step entry). */
  reset(): void;
  update(dt: number, t: number): void;
}

export function createBanks(): Banks {
  const group = new Group();
  group.name = 'charge-banks';
  const sites: Site[] = [];
  for (const [bank, rows] of [
    [0, RUBBER_Y],
    [1, HAIR_Y],
  ] as const)
    rows.forEach((y, r) => {
      for (let i = 0; i < PER_CHAIN; i++) {
        // zigzag chains, the outer chain half a pitch along
        const x = (i - PER_CHAIN / 2 + 0.5 + (r % 2) * 0.5) * PITCH;
        sites.push({ bank, base: new Vector3(x, y + (i % 2 ? 0.45 : -0.45) * Math.sign(y), -0.4 * r) });
      }
    });
  const rubber = createOrbs({
    kind: atomStyle('violet', 'plum'),
    count: sites.length / 2,
    radius: ATOM_R,
    halo: false,
  });
  const hair = createOrbs({
    kind: atomStyle('pink', 'magenta.dark'),
    count: sites.length / 2,
    radius: ATOM_R,
    halo: false,
  });
  const max = sites.length + 12;
  const dots = createOrbs({ kind: 'electron', count: max, radius: 0.3, glyph: 'none' });
  const ties = new RibbonLines({
    capacity: max * 2,
    color: col('cyan'),
    width: 0.09,
    intensity: 0.8,
    dashStrength: 0,
    base: 1,
    endFade: [0.2, 0.1],
  });
  const lines = Array.from({ length: max }, () => ({ points: [new Vector3(), new Vector3()] }));
  // the two shores behind the atoms: a faint tint of each material, so the boundary reads at a glance
  const shore = (tint: string, y: number): Mesh => {
    const m = new Mesh(
      new PlaneGeometry(40, 14),
      new MeshBasicMaterial({ color: col(tint).lerp(col('bg.void'), 0.7), depthWrite: false }),
    );
    m.position.set(0, y, -2.5);
    return m;
  };
  group.add(shore('violet', 7 + 0.05), shore('pink', -7 - 0.05), rubber, hair, ties, dots);
  const electrons: Electron[] = [];
  let shift = 0;
  let shiftTo = 0;
  let hops = 0;
  const at = (s: number, out: Vector3): Vector3 => {
    const site = sites[s]!;
    out.copy(site.base);
    // the banks slide along each other (the rubber with the balloon, the hair a little the other way); each
    // wraps far outside the window, so no atom ever pops in view
    const span = PER_CHAIN * PITCH;
    const by = site.bank === 0 ? shift : -0.45 * shift;
    out.x = ((((out.x + by + span / 2) % span) + span) % span) - span / 2;
    return out;
  };
  const reset = (): void => {
    electrons.length = 0;
    sites.forEach((_, s) =>
      electrons.push({ site: s, angle: (s * 2.4) % 6.28, phase: s * 1.7, hop: 1, from: new Vector3() }),
    );
    shift = shiftTo = 0;
    hops = 0;
  };
  reset();
  const p = new Vector3();
  const q = new Vector3();
  const banks: Banks = {
    group,
    get hops() {
      return hops;
    },
    slide(way) {
      shiftTo += way * PITCH * 0.55;
    },
    hop() {
      // an electron of the hair's edge chain in view that is still home, onto the nearest rubber atom above it
      const candidates = electrons.filter(
        (e) =>
          e.hop >= 1 &&
          sites[e.site]!.bank === 1 &&
          sites[e.site]!.base.y > -2.5 &&
          Math.abs(at(e.site, p).x) < 5.6,
      );
      if (!candidates.length || electrons.length >= max) return false;
      const e = candidates[(hops * 3) % candidates.length]!;
      at(e.site, p);
      let best = -1;
      let d = Infinity;
      sites.forEach((s, i) => {
        if (s.bank !== 0 || s.base.y > 2.5) return;
        const dd = at(i, q).distanceTo(p);
        if (dd < d) {
          d = dd;
          best = i;
        }
      });
      e.from.copy(p).add(q.set(Math.cos(e.angle) * TIE, Math.sin(e.angle) * TIE, 0));
      e.site = best;
      e.angle = -1.2 - (hops % 3) * 0.4; // it settles on the hair's side of its new atom
      e.hop = 0;
      hops++;
      return true;
    },
    reset,
    update(dt, t) {
      shift += (shiftTo - shift) * Math.min(dt * 5, 1);
      let r = 0;
      let h = 0;
      sites.forEach((s, i) => {
        at(i, p);
        const k = 1 + 0.02 * Math.sin(t * 5 + i);
        if (s.bank === 0) rubber.setPosition(r++, p.x, p.y, p.z, k);
        else hair.setPosition(h++, p.x, p.y, p.z, k);
      });
      electrons.forEach((e, i) => {
        at(e.site, p);
        // bound: it only trembles about its atom on its thread
        const a = e.angle + 0.35 * Math.sin(t * 3.1 + e.phase);
        const l = TIE * (1 + 0.08 * Math.sin(t * 4.3 + e.phase * 2));
        q.set(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l, p.z + 0.5);
        if (e.hop < 1) {
          e.hop = Math.min(e.hop + dt / 0.55, 1);
          const s = e.hop * e.hop * (3 - 2 * e.hop);
          q.lerpVectors(e.from, q, s);
          q.z += Math.sin(Math.PI * s) * 0.8;
        }
        dots.setPosition(i, q.x, q.y, q.z, 1);
        // the thread to its atom; mid-hop it has none
        const line = lines[i]!;
        line.points[0]!.set(p.x, p.y, p.z + 0.4);
        line.points[1]!.copy(e.hop < 1 ? line.points[0]! : q);
      });
      for (let i = electrons.length; i < max; i++) dots.setPosition(i, 0, 0, 0, 0);
      rubber.commit();
      hair.commit();
      dots.commit();
      ties.setLines(
        lines.slice(0, electrons.length).filter((l) => l.points[0]!.distanceToSquared(l.points[1]!) > 1e-4),
      );
    },
  };
  return banks;
}
