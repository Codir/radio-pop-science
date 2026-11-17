/**
 * Two tiny pieces of copper with a gap between them (`charge/neutral`, VISUAL §6, as `wire/shared` shows a
 * piece): atoms in the copper world's own look and places (the lattice's pitch and planes, in `copper.space`
 * units), each front atom with its free electron roaming inside its piece. From `signs` on the marks are there:
 * every atom without its free electron is a «+» (copper ion; the step lays the stickers on the front atoms once
 * the crystal around has gone), every free electron a «−». The reader may carry an electron across the gap
 * (`hold`); the piece it is dropped in owns it from then on.
 */
import { Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import { type Rng } from '@/engine/api';
import { createOrbs, ORB_STYLES, type OrbStyle } from '@/fx';
import { col } from '@/style';
import { ATOM_R, ELECTRON_R, PITCH, PLANE_GAP } from '@circuit/shared/copper/layout';

/** Columns (lattice i) of the two pieces; the column between them is the gap. */
const PIECES = [
  [-2, -1, 0],
  [2, 3, 4],
] as const;
const ROWS = [-1, 0, 1];
const SPEED = 6.5;
const TOUCH = ATOM_R + ELECTRON_R * 1.3;

const ION: OrbStyle = {
  ...ORB_STYLES.blob,
  color: 'coral',
  shade: 'coral.dark',
  selfLit: 0,
  gloss: 0,
  rim: 0.55,
  glyph: 'none',
  shimmer: 0,
};

export interface Free {
  pos: Vector3;
  dir: Vector3;
  owner: 0 | 1;
  turnAt: number;
  pick: Mesh;
  hover: number;
}

export interface Crumbs {
  group: Group;
  /** 0…1 presence: atoms grow in from the middle of each piece, electrons fade in with them. */
  shown: number;
  electrons: Free[];
  /** Net charge of each piece in electron charges (+ = electrons missing). */
  charge(piece: 0 | 1): number;
  /** Centre of a piece (local), for labels; and of the gap. */
  centre(piece: 0 | 1 | 'gap', out: Vector3): Vector3;
  /** Front-plane atom centres (local): where the «+» stickers go. */
  ions: readonly Vector3[];
  /** Electrons carried across the gap so far. */
  readonly moved: number;
  /** Carry electron i to a local point (the reader's hand), or let go (null). */
  hold(i: number, at: Vector3 | null): void;
  readonly held: number;
  reset(): void;
  update(dt: number, t: number): void;
}

export function createCrumbs(rng: Rng): Crumbs {
  const group = new Group();
  group.name = 'charge-crumbs';
  const sites: { p: Vector3; piece: 0 | 1; plane: number }[] = [];
  PIECES.forEach((cols, piece) => {
    for (const plane of [0, 1, 2]) {
      const half = plane % 2 ? 0.5 : 0;
      const cs = plane % 2 ? cols.slice(0, 2) : cols;
      const rs = plane % 2 ? ROWS.slice(0, 2) : ROWS;
      for (const i of cs)
        for (const j of rs)
          sites.push({
            p: new Vector3((i + half) * PITCH, (j + half) * PITCH, -plane * PLANE_GAP),
            piece: piece as 0 | 1,
            plane,
          });
    }
  });
  const ions = createOrbs({
    kind: ION,
    count: sites.length,
    radius: ATOM_R,
    instanceColors: true,
    halo: false,
  });
  const front = sites.filter((s) => s.plane === 0);
  const dots = createOrbs({ kind: 'electron', count: front.length, radius: ELECTRON_R * 1.25 });
  group.add(ions, dots);
  const far = col('bg.indigo').lerp(col('coral.dark'), 0.45);
  const tint = col('coral');
  const paint = tint.clone();
  const pickMat = new MeshBasicMaterial({ visible: false });
  const box = (piece: 0 | 1) => {
    const xs = PIECES[piece].map((i) => i * PITCH);
    return {
      x0: Math.min(...xs) - ATOM_R * 1.25,
      x1: Math.max(...xs) + ATOM_R * 1.25,
      y0: -PITCH - ATOM_R * 1.25,
      y1: PITCH + ATOM_R * 1.25,
    };
  };
  const boxes = [box(0), box(1)] as const;
  const electrons: Free[] = front.map((s) => {
    const pick = new Mesh(new SphereGeometry(0.75, 10, 6), pickMat);
    group.add(pick);
    return { pos: new Vector3(), dir: new Vector3(), owner: s.piece, turnAt: 0, pick, hover: 0 };
  });
  let moved = 0;
  let held = -1;
  const turn = (e: Free, t: number): void => {
    const a = rng.range(0, Math.PI * 2);
    e.dir.set(Math.cos(a), Math.sin(a), rng.range(-0.15, 0.15)).normalize();
    e.turnAt = t + rng.range(0.35, 1.1);
  };
  const reset = (): void => {
    electrons.forEach((e, k) => {
      const s = front[k]!;
      e.owner = s.piece;
      e.pos.set(s.p.x + PITCH / 2, s.p.y + PITCH / 2 - (s.p.y > 0 ? PITCH : 0), 0.4);
      turn(e, 0);
    });
    moved = 0;
    held = -1;
  };
  reset();
  const tmp = new Vector3();
  const crumbs: Crumbs = {
    group,
    shown: 0,
    electrons,
    ions: front.map((s) => s.p),
    charge: (piece) =>
      front.filter((s) => s.piece === piece).length - electrons.filter((e) => e.owner === piece).length,
    centre(piece, out) {
      if (piece === 'gap') return out.set(PITCH, 0, 0);
      const b = boxes[piece];
      return out.set((b.x0 + b.x1) / 2, 0, 0);
    },
    get moved() {
      return moved;
    },
    get held() {
      return held;
    },
    hold(i, at) {
      // a release names no electron: it is the one in the hand
      const e = electrons[at ? i : held];
      if (!e) return;
      if (at) {
        held = i;
        e.pos.lerp(tmp.set(at.x, at.y, 0.9), 0.85);
        return;
      }
      held = -1;
      // dropped inside the other piece: that piece owns it now; anywhere else it goes home
      for (const piece of [0, 1] as const) {
        const b = boxes[piece];
        if (piece !== e.owner && e.pos.x > b.x0 && e.pos.x < b.x1 && e.pos.y > b.y0 && e.pos.y < b.y1) {
          e.owner = piece;
          moved++;
        }
      }
    },
    reset,
    update(dt, t) {
      const k = crumbs.shown;
      sites.forEach((s, i) => {
        // atoms grow from the middle of each piece outward, front plane first
        const centreX = (boxes[s.piece].x0 + boxes[s.piece].x1) / 2;
        const order = (Math.abs(s.p.x - centreX) / PITCH + Math.abs(s.p.y) / PITCH) * 0.12 + s.plane * 0.1;
        const g = Math.min(Math.max((k - order) / 0.5, 0), 1);
        const pop = g < 1 ? 1 + 2.7 * (g - 1) ** 3 + 1.7 * (g - 1) ** 2 : 1;
        const f = 0.05 * Math.sin(t * (5.3 + (i % 7) * 0.37) + i);
        ions.setPosition(i, s.p.x + f, s.p.y + f * 0.8, s.p.z, Math.max(pop, 0));
        const sink = 1 - Math.pow(0.72, s.plane);
        ions.setInstanceColor(i, paint.copy(tint).lerp(far, sink), 1 - 0.44 * sink);
      });
      electrons.forEach((e, i) => {
        if (i !== held) {
          const b = boxes[e.owner];
          if (t >= e.turnAt) turn(e, t);
          e.pos.addScaledVector(e.dir, SPEED * dt);
          // walls of its own piece: an electron carried outside comes home along the straight way
          if (e.pos.x < b.x0) e.dir.x = Math.abs(e.dir.x);
          if (e.pos.x > b.x1) e.dir.x = -Math.abs(e.dir.x);
          if (e.pos.y < b.y0) e.dir.y = Math.abs(e.dir.y);
          if (e.pos.y > b.y1) e.dir.y = -Math.abs(e.dir.y);
          if (e.pos.z < -0.5 || e.pos.z > 1.3) e.dir.z = -e.dir.z * 0.5;
          for (const s of front) {
            const d = e.pos.distanceTo(s.p);
            if (d < TOUCH && d > 1e-4) {
              tmp.copy(e.pos).sub(s.p).divideScalar(d);
              e.pos.copy(s.p).addScaledVector(tmp, TOUCH);
              if (e.dir.dot(tmp) < 0) e.dir.addScaledVector(tmp, -2 * e.dir.dot(tmp));
            }
          }
        }
        e.hover += ((i === held ? 1 : 0) - e.hover) * Math.min(dt * 10, 1);
        e.pick.position.copy(e.pos);
        dots.setPosition(
          i,
          e.pos.x,
          e.pos.y,
          e.pos.z,
          Math.min(Math.max(k * 1.4 - 0.4, 0), 1) * (1 + 0.35 * e.hover),
        );
      });
      ions.commit();
      dots.commit();
      group.visible = k > 0.002;
    },
  };
  return crumbs;
}
