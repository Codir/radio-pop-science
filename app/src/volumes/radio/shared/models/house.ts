/**
 * Walls from a plan and the house cut open (B12, step 4), plus the neighbour's window with the router. Walls are
 * drawn in scene axes from `WallPlan` lists (the group stands at the origin): segment `a → b`, heights `y0…y1`, 0.2 m
 * thick (0.1 on each side of the line), coloured by `look`; a window is an opening with a wooden frame and dark glass
 * that never glows (the kitchen window shines only with the white light of the screen); a wall with `cut` stops
 * 0.6 m above the slab and carries a light band on its cut. The house has no roof. The surfaces here (`SURFACE`)
 * are the muted recipes of VISUAL.md §4, used by every model of the yard.
 */
import { type Color, Vector3 } from 'three';
import { Builder, type KitModel, type Slot, addRouter } from '@/kit';
import { type ColorLike, type GlassParams, col } from '@/style';
import type { P2, WallLook, WallPlan, YardPlan } from './index';
import { KITCHEN, addKitchenBlock } from './kitchen';

/** `mix(a, b, k)` = `col(a).lerp(col(b), k)` (VISUAL.md §4). */
export const mix = (a: ColorLike, b: ColorLike, k: number): Color => col(a).lerp(col(b), k);

/** Colour and material slot of each wall look; `slab` is also the skirt and the rooms' floor. */
export const SURFACE: Readonly<Record<WallLook, { readonly c: Color; readonly slot: Slot }>> = {
  brick: { c: mix('coral', 'mist', 0.8), slot: 'matte' },
  wood: { c: mix('wireBrown', 'mist', 0.6), slot: 'toon' },
  glass: { c: col('ink'), slot: 'glass' },
  slab: { c: mix('steel', 'mist', 0.5), slot: 'matte' },
  iron: { c: mix('slate', 'steel', 0.6), slot: 'metal' },
  white: { c: col('white'), slot: 'matte' },
};

/**
 * Glass of the yard's windows: a faint dark tint (the material is unlit, so a light tint would glow at night), a
 * dim edge and a weak highlight streak.
 */
export const GLASS: GlassParams = {
  color: 'ink',
  opacity: 0.12,
  edgeOpacity: 0.35,
  edgeColor: 'slate',
  specular: 0.3,
};

/**
 * The darker concrete of the cellar's floor and the trodden gravel of the back yard (B13, VISUAL.md §4): under the
 * slab the cellar reads as a pit through the cut, and the cat's body and the white wall stand out in the camera's frame.
 */
export const DARK_FLOOR: Color = mix('steel', 'slate', 0.5);

/** The skirt round the house: from the outer face of its outer walls `width` outward, its top `top` above ground, m. */
export const HOUSE_SKIRT = { width: 1.4, top: 0.03 } as const;

const THICK = 0.2;
const HALF = THICK / 2;
/** A cut wall stops this much above the slab (0.4 for the slab at −0.2: under the ray of `route` to the cellar). */
const CUT_ABOVE = 0.6;
const CUT_BAND = 0.03;
/** The light edge of the hole in the slab. */
const SECTION = 0.01;
const FRAME = 0.05;
const SKIRT_THICK = 0.08;
const CELLAR_FLOOR = 0.05;
const SILL = { thick: 0.04, beyond: 0.3, deeper: 0.25 } as const;

const near = (p: P2, q: P2): boolean => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;

/** Does another wall end at `p` at an angle (a corner, where the wall is lengthened by half its thickness)? */
function corner(p: P2, w: WallPlan, all: readonly WallPlan[]): boolean {
  const ux = w.b[0] - w.a[0];
  const uz = w.b[1] - w.a[1];
  return all.some((o) => {
    if (o === w || !(near(o.a, p) || near(o.b, p))) return false;
    const cross = ux * (o.b[1] - o.a[1]) - uz * (o.b[0] - o.a[0]);
    return Math.abs(cross) > 1e-6 * Math.hypot(ux, uz) * Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]);
  });
}

export interface WallOptions {
  /** Where a cut wall stops. Default 0.6 (above the ground). */
  cutTop?: number;
}

/** Draw the walls of a plan (scene axes, current frame of `b`). */
export function addWalls(b: Builder, walls: readonly WallPlan[], o: WallOptions = {}): void {
  for (const w of walls) addWall(b, w, walls, o.cutTop ?? CUT_ABOVE);
}

function addWall(b: Builder, w: WallPlan, all: readonly WallPlan[], cutTop: number): void {
  const dx = w.b[0] - w.a[0];
  const dz = w.b[1] - w.a[1];
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return;
  const ux = dx / len;
  const uz = dz / len;
  const rot = [0, Math.atan2(-uz, ux), 0] as const;
  const top = w.cut ? Math.min(w.y1, cutTop) : w.y1;
  if (top <= w.y0) return;
  const { c, slot } = SURFACE[w.look];
  const band = mix(c, 'white', 0.65);
  /** One box of the wall: `s0…s1` along it, `y0…y1` up. */
  const piece = (s0: number, s1: number, y0: number, y1: number): void => {
    if (s1 - s0 < 1e-6 || y1 - y0 < 1e-6) return;
    const s = (s0 + s1) / 2;
    const at = (y: number) => [w.a[0] + ux * s, y, w.a[1] + uz * s] as const;
    const body = w.cut && y1 >= top - 1e-9 ? Math.max(y0, y1 - CUT_BAND) : y1;
    if (body - y0 > 1e-6) b.box(s1 - s0, body - y0, THICK, { r: 0, c, slot, at: at(y0), rot });
    if (body < y1) b.box(s1 - s0, y1 - body, THICK, { r: 0, c: band, slot, at: at(body), rot });
  };
  const s0 = corner(w.a, w, all) ? -HALF : 0;
  const s1 = len + (corner(w.b, w, all) ? HALF : 0);
  const windows = (w.windows ?? [])
    .map((win) => ({ ...win, y1: Math.min(win.y1, top) }))
    .filter((win) => win.to > win.from && win.y1 > win.y0)
    .sort((p, q) => p.from - q.from);
  let s = s0;
  for (const win of windows) {
    piece(s, win.from, w.y0, top);
    piece(win.from, win.to, w.y0, win.y0);
    piece(win.from, win.to, win.y1, top);
    addWindow(b, w, win, rot, ux, uz);
    s = win.to;
  }
  piece(s, s1, w.y0, top);
}

/** The wooden frame and the dark glass of one opening. */
function addWindow(
  b: Builder,
  w: WallPlan,
  win: { from: number; to: number; y0: number; y1: number },
  rot: readonly [number, number, number],
  ux: number,
  uz: number,
): void {
  const along = (s: number, y: number) => [w.a[0] + ux * s, y, w.a[1] + uz * s] as const;
  const wide = win.to - win.from;
  const tall = win.y1 - win.y0;
  const mid = (win.from + win.to) / 2;
  const wood = SURFACE.wood;
  const depth = THICK * 0.6;
  b.box(wide, FRAME, depth, { r: 0, c: wood.c, slot: wood.slot, at: along(mid, win.y0), rot });
  b.box(wide, FRAME, depth, { r: 0, c: wood.c, slot: wood.slot, at: along(mid, win.y1 - FRAME), rot });
  for (const s of [win.from + FRAME / 2, win.to - FRAME / 2])
    b.box(FRAME, tall - 2 * FRAME, depth, {
      r: 0,
      c: wood.c,
      slot: wood.slot,
      at: along(s, win.y0 + FRAME),
      rot,
    });
  b.box(wide - 2 * FRAME, tall - 2 * FRAME, 0.006, {
    r: 0,
    slot: 'glass',
    at: along(mid, win.y0 + FRAME),
    rot,
  });
}

/** The bounding rectangle of the wall lines (scene x and z). */
export function wallBox(walls: readonly WallPlan[]): { x0: number; x1: number; z0: number; z1: number } {
  const ends = walls.flatMap((w) => [w.a, w.b]);
  return {
    x0: Math.min(...ends.map((p) => p[0])),
    x1: Math.max(...ends.map((p) => p[0])),
    z0: Math.min(...ends.map((p) => p[1])),
    z1: Math.max(...ends.map((p) => p[1])),
  };
}

/** A flat box from `x0…x1`, `z0…z1` (scene), `y0…y1`; nothing when empty. */
function slab(
  b: Builder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1: number,
  c: Color,
): void {
  if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6 || y1 - y0 < 1e-6) return;
  b.box(x1 - x0, y1 - y0, z1 - z0, { r: 0, c, slot: 'matte', at: [(x0 + x1) / 2, y0, (z0 + z1) / 2] });
}

/**
 * The house cut open: walls from the plan, no roof. Parts (they do not move; tests and `cellarSeen` of B13 find
 * them by name): `floor` — the rooms' floor and the slab over the cellar in one, `slabY…0` over the bounding
 * rectangle of the wall lines with the hole `slabCut` (its edge a light 1 cm band, like the cut of the walls);
 * `cellarFloor` — 0.05 m of the darker `DARK_FLOOR` with its top at the lowest `y0` of the walls; `skirt` — the
 * frame round the house in the rooms' concrete (`SURFACE.slab`, `HOUSE_SKIRT`), which hides the ragged edge of the
 * island's pit.
 * Anchors: `sill` (top of the window board the monitor stands on), `microwave` (the middle of the oven door, from the
 * kitchen block), `phone` — each at the plan's point.
 */
export function house(plan: YardPlan['house']): KitModel {
  const b = new Builder('house', { glass: GLASS });
  const box = wallBox(plan.walls);
  const cellar = Math.min(...plan.walls.map((w) => w.y0));
  const grey = SURFACE.slab.c;
  addWalls(b, plan.walls, { cutTop: plan.slabY + CUT_ABOVE });

  const floor = b.part('floor');
  // the slab round the hole, and the hole's own edge: a light band 1 cm wide, like the cut of the walls, so that
  // the hole reads in any light
  const { min, max } = plan.slabCut;
  const lip = (inside: boolean) => (inside ? SECTION : 0);
  const h0 = [min[0] - lip(min[0] > box.x0), min[1] - lip(min[1] > box.z0)] as const;
  const h1 = [max[0] + lip(max[0] < box.x1), max[1] + lip(max[1] < box.z1)] as const;
  const section = mix(grey, 'white', 0.65);
  const y0 = plan.slabY;
  slab(floor, box.x0, box.x1, box.z0, h0[1], y0, 0, grey);
  slab(floor, box.x0, box.x1, h1[1], box.z1, y0, 0, grey);
  slab(floor, box.x0, h0[0], h0[1], h1[1], y0, 0, grey);
  slab(floor, h1[0], box.x1, h0[1], h1[1], y0, 0, grey);
  slab(floor, h0[0], h1[0], h0[1], min[1], y0, 0, section);
  slab(floor, h0[0], h1[0], max[1], h1[1], y0, 0, section);
  slab(floor, h0[0], min[0], min[1], max[1], y0, 0, section);
  slab(floor, max[0], h1[0], min[1], max[1], y0, 0, section);

  b.part('cellarFloor').box(box.x1 - box.x0, CELLAR_FLOOR, box.z1 - box.z0, {
    r: 0,
    c: DARK_FLOOR,
    slot: 'matte',
    at: [(box.x0 + box.x1) / 2, cellar - CELLAR_FLOOR, (box.z0 + box.z1) / 2],
  });

  const skirt = b.part('skirt');
  const i = { x0: box.x0 - HALF, x1: box.x1 + HALF, z0: box.z0 - HALF, z1: box.z1 + HALF };
  const o = {
    x0: i.x0 - HOUSE_SKIRT.width,
    x1: i.x1 + HOUSE_SKIRT.width,
    z0: i.z0 - HOUSE_SKIRT.width,
    z1: i.z1 + HOUSE_SKIRT.width,
  };
  const sy = HOUSE_SKIRT.top - SKIRT_THICK;
  slab(skirt, o.x0, o.x1, o.z0, i.z0, sy, HOUSE_SKIRT.top, grey);
  slab(skirt, o.x0, o.x1, i.z1, o.z1, sy, HOUSE_SKIRT.top, grey);
  slab(skirt, o.x0, i.x0, i.z0, i.z1, sy, HOUSE_SKIRT.top, grey);
  slab(skirt, i.x1, o.x1, i.z0, i.z1, sy, HOUSE_SKIRT.top, grey);

  addSill(b, plan);
  addKitchen(b, plan);
  b.anchor('sill', ...plan.sill);
  b.anchor('phone', ...plan.phone);
  return b.build();
}

/** Unit direction of a wall and the distance of a plan point from its line, toward the point. */
function across(w: WallPlan, p: P2): { u: P2; n: P2; s: number; d: number } {
  const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const u: P2 = [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len];
  const rx = p[0] - w.a[0];
  const rz = p[1] - w.a[1];
  const s = rx * u[0] + rz * u[1];
  const px = rx - s * u[0];
  const pz = rz - s * u[1];
  const d = Math.hypot(px, pz);
  const n: P2 = d > 1e-9 ? [px / d, pz / d] : [-u[1], u[0]];
  return { u, n, s, d };
}

/**
 * The window board under the monitor: 0.04 m thick, its top at `sill`, along the wall of the window nearest to the
 * sill — from the window's edge farther from the sill to 0.3 m beyond the sill, and from the wall's inner face to
 * 0.25 m beyond the sill into the room.
 */
function addSill(b: Builder, plan: YardPlan['house']): void {
  const p: P2 = [plan.sill[0], plan.sill[2]];
  let best: { w: WallPlan; win: { from: number; to: number } } | null = null;
  let bestD = Infinity;
  for (const w of plan.walls)
    for (const win of w.windows ?? []) {
      const { s, d } = across(w, p);
      const dist = Math.hypot(d, s - (win.from + win.to) / 2);
      if (dist < bestD) [best, bestD] = [{ w, win }, dist];
    }
  if (!best) return;
  const { u, n, s, d } = across(best.w, p);
  const far = Math.abs(best.win.from - s) > Math.abs(best.win.to - s) ? best.win.from : best.win.to;
  const end = s + Math.sign(s - far) * SILL.beyond;
  const along = (far + end) / 2;
  const inward = (HALF + d + SILL.deeper) / 2;
  const wood = SURFACE.wood;
  b.box(Math.abs(end - far), SILL.thick, d + SILL.deeper - HALF, {
    r: 0.008,
    seg: 1,
    c: wood.c,
    slot: wood.slot,
    at: [
      best.w.a[0] + u[0] * along + n[0] * inward,
      plan.sill[1] - SILL.thick,
      best.w.a[1] + u[1] * along + n[1] * inward,
    ],
    rot: [0, Math.atan2(-u[1], u[0]), 0],
  });
}

/**
 * The kitchen block along the wall nearest to the oven, facing into the room, running from the oven away from the
 * sill up to the next wall (length rounded down to 5 cm), placed so that its anchor `microwave` lies on the plan's
 * point: the kit's `addKitchen` cannot do it (its oven is 1.85 m from the end of the run and its anchor sits on top of
 * the oven at 1.2 m, `kit/home/appliances.ts:46-54`).
 */
function addKitchen(b: Builder, plan: YardPlan['house']): void {
  const m: P2 = [plan.microwave[0], plan.microwave[2]];
  let wall = plan.walls[0]!;
  let dist = Infinity;
  for (const w of plan.walls) {
    const { s, d } = across(w, m);
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const out = Math.max(0, -s, s - len);
    const e = Math.hypot(d, out);
    if (e < dist) [wall, dist] = [w, e];
  }
  const { u, n } = across(wall, m);
  // along the wall, away from the sill
  const side = (plan.microwave[0] - plan.sill[0]) * u[0] + (plan.microwave[2] - plan.sill[2]) * u[1];
  const t: P2 = side < 0 ? [-u[0], -u[1]] : u;
  // the next wall straight ahead along t
  let ahead = Infinity;
  for (const w of plan.walls) {
    if (w === wall) continue;
    const ex = w.b[0] - w.a[0];
    const ez = w.b[1] - w.a[1];
    const den = t[0] * ez - t[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const qx = w.a[0] - m[0];
    const qz = w.a[1] - m[1];
    const lambda = (qx * ez - qz * ex) / den;
    const mu = (qx * t[1] - qz * t[0]) / den;
    if (lambda > 0 && mu >= -1e-9 && mu <= 1 + 1e-9) ahead = Math.min(ahead, lambda);
  }
  const room = Number.isFinite(ahead) ? ahead - HALF + KITCHEN.oven.width / 2 : 2;
  const length = Math.floor(room / 0.05 + 1e-6) * 0.05;
  const anchor = KITCHEN.microwave(length);
  // local Z → n (into the room); local X → t, mirrored when the frame would point it the other way
  const yaw = Math.atan2(n[0], n[1]);
  const mirror = Math.cos(yaw) * t[0] - Math.sin(yaw) * t[1] < 0;
  const p = new Vector3(
    plan.microwave[0] - t[0] * anchor[0] - n[0] * anchor[2],
    plan.microwave[1] - anchor[1],
    plan.microwave[2] - t[1] * anchor[0] - n[1] * anchor[2],
  );
  b.frame({ at: [p.x, p.y, p.z], rot: [0, yaw, 0], s: mirror ? [-1, 1, 1] : 1 }, () =>
    addKitchenBlock(b, { length }),
  );
}

/**
 * A piece of the neighbour's wall with a window (B12): it faces its own +X like the small props, its origin is on
 * the ground under the middle of the window, and the anchor `router` (the kit's router on the inner sill) is 2.0 m
 * above it — the height of the router in the model. Behind the router a curtain in the `window` slot glows yellow
 * with `night` (the yard sets it with the lantern, VISUAL.md §4). Anchors: `window` (the middle of the opening),
 * `router`.
 */
export function neighbourWindow(): KitModel {
  const b = new Builder('neighbour', { glass: GLASS, windowGlow: mix('yellow', 'white', 0.35) });
  const wall = mix('mist', 'steel', 0.35);
  const depth = 0.25;
  const w = 3.2;
  const h = 3.4;
  const open = { z0: -0.6, z1: 0.6, y0: 1.88, y1: 2.78 } as const;
  const rot = [0, Math.PI / 2, 0] as const; // local X of a box → −Z, so that boxes lie along the wall
  const piece = (z0: number, z1: number, y0: number, y1: number) =>
    b.box(z1 - z0, y1 - y0, depth, {
      r: 0,
      c: wall,
      slot: 'matte',
      at: [-depth / 2, y0, (z0 + z1) / 2],
      rot,
    });
  piece(-w / 2, open.z0, 0, h);
  piece(open.z1, w / 2, 0, h);
  piece(open.z0, open.z1, 0, open.y0);
  piece(open.z0, open.z1, open.y1, h);
  // eave
  b.box(0.4, 0.08, w + 0.3, {
    r: 0.01,
    seg: 1,
    c: SURFACE.iron.c,
    slot: SURFACE.iron.slot,
    at: [-0.05, h, 0],
  });
  // frame, glass on the outer side, the curtain behind the router
  const wood = SURFACE.wood;
  const fw = open.z1 - open.z0;
  const fh = open.y1 - open.y0;
  b.box(0.06, FRAME, fw, { r: 0, c: wood.c, slot: wood.slot, at: [-0.03, open.y1 - FRAME, 0] });
  b.box(0.06, FRAME, fw, { r: 0, c: wood.c, slot: wood.slot, at: [-0.03, open.y0 - 0.01, 0] });
  for (const z of [open.z0 + FRAME / 2, open.z1 - FRAME / 2])
    b.box(0.06, fh, FRAME, { r: 0, c: wood.c, slot: wood.slot, at: [-0.03, open.y0, z] });
  b.box(0.006, fh - 2 * FRAME, fw - 2 * FRAME, { r: 0, slot: 'glass', at: [-0.02, open.y0 + FRAME, 0] });
  b.box(0.01, fh, fw, {
    r: 0,
    c: mix('yellow', 'mist', 0.7),
    slot: 'window',
    at: [-depth - 0.006, open.y0, 0],
  });
  b.frame({ at: [-0.15, open.y0, 0], rot: [0, Math.PI / 2, 0] }, () => addRouter(b));
  b.anchor('window', 0, (open.y0 + open.y1) / 2, 0);
  return b.build();
}
