/**
 * What a free electron may not do in the picture: fly through an atom, leave the piece of copper it belongs to,
 * or enter the plastic. Pure helpers over flat arrays (positions and unit directions, 3 numbers per electron).
 */
import { ATOM_R, COPPER_TOP, ELECTRON_R, PITCH, PLANE_GAP, PLANES, type Site } from './layout';

/** Closest approach of an electron's centre to an atom's centre. */
const TOUCH = ATOM_R + ELECTRON_R * 1.15;

export interface Obstacles {
  /** Index of the lattice site at grid place (plane, i, j), or −1. */
  at(plane: number, i: number, j: number): number;
  /** Presence 0…1 of a site (atoms that are not there do not deflect anything). */
  presence(site: number): number;
  sites: readonly Site[];
}

export function siteIndex(sites: readonly Site[]): (plane: number, i: number, j: number) => number {
  const map = new Map<number, number>();
  const key = (k: number, i: number, j: number): number => (k * 128 + (i + 64)) * 128 + (j + 64);
  sites.forEach((s, n) => map.set(key(s.plane, s.i, s.j), n));
  return (k, i, j) => map.get(key(k, i, j)) ?? -1;
}

/** Mirror direction `d` (at 3e) about the unit normal n, only when it points into the surface. */
function bounce(dir: Float32Array, e: number, nx: number, ny: number, nz: number): void {
  const o = 3 * e;
  const dot = dir[o]! * nx + dir[o + 1]! * ny + dir[o + 2]! * nz;
  if (dot >= 0) return;
  dir[o] = dir[o]! - 2 * dot * nx;
  dir[o + 1] = dir[o + 1]! - 2 * dot * ny;
  dir[o + 2] = dir[o + 2]! - 2 * dot * nz;
}

/** Push electron e out of the atoms around it and turn it away from them. Returns the site hit, or −1. */
export function collide(pos: Float32Array, dir: Float32Array, e: number, world: Obstacles): number {
  const o = 3 * e;
  const k0 = Math.round(-pos[o + 2]! / PLANE_GAP);
  let hit = -1;
  for (let k = Math.max(k0 - 1, 0); k <= Math.min(k0 + 1, PLANES - 1); k++) {
    const shift = k % 2 === 1 ? PITCH / 2 : 0;
    const i = Math.round((pos[o]! - shift) / PITCH);
    const j = Math.round((pos[o + 1]! - shift) / PITCH);
    const site = world.at(k, i, j);
    if (site < 0 || world.presence(site) < 0.5) continue;
    const c = world.sites[site]!.p;
    const dx = pos[o]! - c.x;
    const dy = pos[o + 1]! - c.y;
    const dz = pos[o + 2]! - c.z;
    const d = Math.hypot(dx, dy, dz);
    if (d >= TOUCH || d < 1e-6) continue;
    const nx = dx / d;
    const ny = dy / d;
    const nz = dz / d;
    pos[o] = c.x + nx * TOUCH;
    pos[o + 1] = c.y + ny * TOUCH;
    pos[o + 2] = c.z + nz * TOUCH;
    bounce(dir, e, nx, ny, nz);
    hit = site;
  }
  return hit;
}

/** Keep electron e within `reach` of the nearest of the first `count` atoms (a lone atom, a pair, a row…). */
export function keepNear(
  pos: Float32Array,
  dir: Float32Array,
  e: number,
  world: Obstacles,
  count: number,
  reach: number,
): void {
  const o = 3 * e;
  let best = Infinity;
  let bx = 0;
  let by = 0;
  let bz = 0;
  for (let s = 0; s < count; s++) {
    if (world.presence(s) < 0.5) continue;
    const c = world.sites[s]!.p;
    const d = Math.hypot(pos[o]! - c.x, pos[o + 1]! - c.y, pos[o + 2]! - c.z);
    if (d < best) {
      best = d;
      bx = c.x;
      by = c.y;
      bz = c.z;
    }
  }
  if (best === Infinity || best <= reach) return;
  const nx = (bx - pos[o]!) / best;
  const ny = (by - pos[o + 1]!) / best;
  const nz = (bz - pos[o + 2]!) / best;
  pos[o] = bx - nx * reach;
  pos[o + 1] = by - ny * reach;
  pos[o + 2] = bz - nz * reach;
  bounce(dir, e, nx, ny, nz);
}

/**
 * The copper ends at its top surface: electrons turn back there and never enter the plastic. `below` lowers that
 * ceiling (units; default 0): a band under the surface the electron does not enter (a pole that lacks electrons).
 */
export function keepInCopper(pos: Float32Array, dir: Float32Array, e: number, below = 0): void {
  const o = 3 * e;
  const top = COPPER_TOP - ATOM_R * 0.2 - below;
  if (pos[o + 1]! <= top) return;
  pos[o + 1] = top;
  bounce(dir, e, 0, -1, 0);
}

/** Keep z inside a slab [lo, hi] by turning back at its faces. */
export function keepInSlab(pos: Float32Array, dir: Float32Array, e: number, lo: number, hi: number): void {
  const o = 3 * e;
  if (pos[o + 2]! < lo) {
    pos[o + 2] = lo;
    bounce(dir, e, 0, 0, 1);
  } else if (pos[o + 2]! > hi) {
    pos[o + 2] = hi;
    bounce(dir, e, 0, 0, -1);
  }
}
