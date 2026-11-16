/**
 * One copper atom from the inside (VISUAL §6, floor «один атом»): the nucleus is one small glowing coral ball
 * (drawn far too big — «ядро збільшено»), 28 electrons are soft blurs in three layers that slowly flow, and the
 * twenty-ninth, the outer one, keeps farther out and is drawn as the bright electron character. No orbit rings,
 * no shell spheres: they would show things that do not exist.
 *
 * States for chapter 1: `apart` moves the electrons aside and leaves the nucleus where it was
 * (`wire/inside-atom`); `hold(i, point)` drags one electron against the nucleus's pull — a near one barely gives
 * and springs back, the outer one comes off (`wire/outer`).
 */
import { Group, Vector3 } from 'three';
import { damp, type Rng } from '@/engine/api';
import { createOrbs, ORB_STYLES, RibbonLines, type Orbs } from '@/fx';
import { ELECTRON_R, NUCLEUS_R, OUTER_R, clamp01, smooth } from './layout';
import { createShells } from './shells';
import { createSoftDots } from './soft-dots';

/** Layers of the 28 inner electrons: how many and how far from the nucleus (units; the ion core's radius is 1). */
const LAYERS = [
  { count: 2, radius: 0.27, glow: 0.95 },
  { count: 8, radius: 0.53, glow: 0.8 },
  { count: 18, radius: 0.84, glow: 0.66 },
] as const;
export const INNER_COUNT = 28;
/** Index of the outer electron in `hold`, `electronPosition`, `nearest`. */
export const OUTER = INNER_COUNT;
/** The outer electron comes off when it is taken farther than this from the nucleus. */
const TEAR = 2.15;

export interface Atom {
  group: Group;
  nucleus: Orbs;
  outer: Orbs;
  /** 0…1 presence of the inside of the atom (the dive opens it). */
  open: number;
  /** 0…1: the electrons moved aside by `aside`, the nucleus stays (`wire/inside-atom`). */
  apart: number;
  aside: Vector3;
  /** 0…1 presence of the outer electron drawn here (0 while the free-electron crowd draws it). */
  outerShown: number;
  /** 0 / 1: the nucleus drawn here (the lattice's hero ball shrinks into it and hands over). */
  nucleusShown: number;
  /** True once the outer electron has been torn off; `reset()` puts it back. */
  freed: boolean;
  /** Drag electron i toward a point (units of the lattice, e.g. `copper.toLocal(hit)`), or let go with `hold(-1)`. */
  hold(i: number, to?: Vector3): void;
  held: number;
  /** Index of the electron nearest to a ray (local space) within `reach` units of it, or −1. */
  nearest(origin: Vector3, direction: Vector3, reach?: number): number;
  electronPosition(i: number, out: Vector3): Vector3;
  reset(): void;
  update(dt: number, t: number): void;
}

interface Bound {
  layer: number;
  axis: Vector3;
  start: Vector3;
  speed: number;
  /** Displacement by the reader's pull, eased. */
  off: Vector3;
  now: Vector3;
}

export function createAtom(rng: Rng): Atom {
  const group = new Group();
  group.name = 'copper-atom';
  const nucleus = createOrbs({
    kind: {
      ...ORB_STYLES.blob,
      color: 'coral',
      shade: 'coral.dark',
      selfLit: 0.8,
      intensity: 1.3,
      glyph: 'none',
      shimmer: 0.3,
      halo: { color: 'coral', size: 4.2, strength: 0.6 },
    },
    radius: NUCLEUS_R,
  });
  nucleus.name = 'copper-nucleus';
  const dots = createSoftDots(INNER_COUNT, 'cyan');
  const outer = createOrbs({
    kind: { ...ORB_STYLES.electron, glyph: 'none', halo: { color: 'cyan', size: 3.6, strength: 0.75 } },
    radius: ELECTRON_R * 0.62,
  });
  outer.name = 'copper-outer-electron';
  const tether = new RibbonLines({
    capacity: 8,
    color: 'mist',
    width: 0.04,
    intensity: 1.0,
    dashStrength: 0,
    base: 1,
    endFade: [0, 0],
    hotCore: 0.4,
  });
  const shells = createShells([LAYERS[0].radius, LAYERS[1].radius, LAYERS[2].radius, OUTER_R]);
  group.add(shells.mesh, tether, dots.mesh, nucleus, outer);

  const bound: Bound[] = [];
  LAYERS.forEach((layer, k) => {
    for (let i = 0; i < layer.count; i++) {
      // spread round the layer, a little in front of and behind the picture plane, each turning about its own
      // axis close to the line of sight: the layer flows, and 2 · 8 · 18 can still be counted
      const a = ((i + rng.range(-0.22, 0.22)) / layer.count) * Math.PI * 2 + k * 0.7;
      const tilt = rng.onSphere();
      bound.push({
        layer: k,
        start: new Vector3(Math.cos(a), Math.sin(a), rng.range(-0.3, 0.3)).normalize(),
        axis: new Vector3(tilt[0] * 0.16, tilt[1] * 0.16, 1).normalize(),
        speed: rng.range(0.1, 0.2) * (k % 2 === 0 ? 1 : -1),
        off: new Vector3(),
        now: new Vector3(),
      });
    }
  });
  const outerAxis = new Vector3(0.25, 0.3, 0.92).normalize();
  const outerOff = new Vector3();
  const outerNow = new Vector3();
  const freeAt = new Vector3();
  const target = new Vector3();
  const centre = new Vector3();
  const v = new Vector3();
  const line = {
    points: Array.from({ length: 8 }, () => new Vector3()),
    brightness: new Array<number>(8).fill(0),
  };
  let tension = 0;
  // Positions inside are relative to the nucleus; the public ones are in the units of the lattice, where the
  // atom stands at `group.position` (the hero site, `Copper.hero`).
  const inner = (i: number, out: Vector3): Vector3 => out.copy(i === OUTER ? outerNow : bound[i]!.now);
  const atom: Atom = {
    group,
    nucleus,
    outer,
    open: 1,
    apart: 0,
    aside: new Vector3(-2.2, 0, 0),
    outerShown: 1,
    nucleusShown: 1,
    freed: false,
    held: -1,
    hold(i, to) {
      atom.held = i;
      if (to) target.copy(to).sub(group.position);
    },
    nearest(origin, direction, reach = 0.22) {
      let best = -1;
      let bestD = reach;
      for (let i = 0; i <= OUTER; i++) {
        atom.electronPosition(i, v).sub(origin);
        const d = v.addScaledVector(direction, -v.dot(direction)).length();
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    electronPosition: (i, out) => inner(i, out).add(group.position),
    reset() {
      atom.freed = false;
      atom.held = -1;
      outerOff.set(0, 0, 0);
      for (const b of bound) b.off.set(0, 0, 0);
    },
    update(dt, t) {
      const open = clamp01(atom.open);
      group.visible = open > 0.004;
      if (!group.visible) return;
      const a = smooth(0, 1, atom.apart);
      centre.copy(atom.aside).multiplyScalar(a);
      bound.forEach((b, i) => {
        const layer = LAYERS[b.layer]!;
        const breathe = 1 + 0.05 * Math.sin(t * 0.9 + i * 1.3);
        const rest = v
          .copy(b.start)
          .applyAxisAngle(b.axis, t * b.speed)
          .multiplyScalar(layer.radius * breathe)
          .add(centre);
        // a near electron is held hard: it follows the hand less and less the farther it is pulled
        if (atom.held === i) {
          const want = target.clone().sub(rest);
          const d = want.length();
          want.multiplyScalar(0.55 / (0.55 + d));
          b.off.x = damp(b.off.x, want.x, 14, dt);
          b.off.y = damp(b.off.y, want.y, 14, dt);
          b.off.z = damp(b.off.z, want.z, 14, dt);
        } else b.off.multiplyScalar(Math.exp(-9 * dt));
        b.now.copy(rest).add(b.off);
        const lifted = Math.min(b.off.length() * 1.6, 1);
        dots.set(i, b.now.x, b.now.y, b.now.z, 0.15 + 0.05 * lifted, layer.glow * (1 + 0.8 * lifted));
      });
      dots.fade = open;
      dots.commit();
      shells.mesh.position.copy(centre);
      shells.fade = open;
      shells.outer = atom.freed ? 0 : atom.outerShown;
      // the outer electron: a slow wide circle of its own, until it is held or torn off
      const rest = v
        .set(0.2, 0.97, 0)
        .applyAxisAngle(outerAxis, t * 0.55)
        .multiplyScalar(OUTER_R)
        .add(centre);
      if (atom.held === OUTER) {
        outerOff.copy(target).sub(rest);
        if (target.distanceTo(centre) > TEAR) atom.freed = true;
        freeAt.copy(target);
      } else if (atom.freed) outerOff.copy(freeAt).sub(rest);
      else outerOff.multiplyScalar(Math.exp(-5 * dt));
      outerNow.copy(rest).add(outerOff);
      if (atom.freed && atom.held !== OUTER) {
        outerNow.x += 0.12 * Math.sin(t * 0.7);
        outerNow.y += 0.1 * Math.sin(t * 0.9 + 1);
      }
      outer.position.copy(outerNow);
      outer.scale.setScalar(Math.max(atom.outerShown * open, 1e-3));
      outer.visible = atom.outerShown * open > 0.01;
      nucleus.visible = atom.nucleusShown > 0.5;
      // the pull of the nucleus on the electron in hand: a taut thread for a near one, a thin one that gives way
      // for the outer one
      const h = atom.held;
      const stretch = h < 0 ? 0 : h === OUTER ? (atom.freed ? 0 : 0.35) : 1;
      tension = damp(tension, stretch, 10, dt);
      tether.visible = tension > 0.02 && h >= 0;
      if (tether.visible) {
        // strongest at the nucleus, thinning toward the electron; the outer one's thread fades as it stretches
        inner(h, v);
        const far = h === OUTER ? 1 - clamp01(v.length() / TEAR) ** 2 : 1;
        line.points.forEach((p, j) => {
          const s = j / (line.points.length - 1);
          p.copy(v).multiplyScalar(s);
          line.brightness[j] = tension * open * far * (1 - 0.6 * s);
        });
        tether.setLines([line]);
      }
    },
  };
  return atom;
}
