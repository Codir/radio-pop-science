/**
 * The restless crowd: free electrons as points flying straight, turning at random and off the atoms — everywhere
 * and, on average, nowhere (`wire/restless`). A stated simplification: real electrons are not little balls and
 * the true speed (≈ 1 600 km/s) is slowed by many orders of magnitude.
 *
 * Two groups: `focus` electrons live in the slab of the focal plane — these are the 12–20 the eye may follow
 * (VISUAL §6); the rest live in the planes behind and are only depth. Electron e belongs to atom e (`Site.rank`
 * order): while `shared` is 0 it circles its own atom, and it exists only when that atom does (`wire/shared`).
 */
import type { Rng } from '@/engine/api';
import { collide, keepInCopper, keepInSlab, keepNear, type Obstacles } from './electron-rules';
import { clamp01, OUTER_R, PLANE_GAP } from './layout';

export const FOCUS_COUNT = 32;
export const DEPTH_COUNT = 44;
/**
 * The common shift (`sim.drift`) for a state of the circuit: none while it is open — a net drift exists only
 * while the lamp glows — and right → left (−X, the hand-over frame of the stand) in proportion to the glow
 * when it is closed. `share`: the share of `speed` at full glow (VISUAL §6: 0.03 … 0.06).
 */
export const driftFor = (lamp: number, share = 0.05): number => (lamp > 0 ? -share * Math.min(lamp, 1) : 0);
/** Half-size of the periodic box of the focus group around `centre` (wider than the frame at 16:9). */
const BOX = [15.5, 8.6] as const;
const BOX_DEEP = [21, 11.5] as const;
const SLAB = [-0.75, 1.7] as const;
/** Half-size of the area the followed electron keeps to (inside the frame at every screen shape but portrait). */
const LEASH = [6.4, 3.5] as const;

export interface ElectronSim {
  readonly count: number;
  /** Positions as drawn, 3 per electron; presence 0…1 per electron. */
  readonly pos: Float32Array;
  readonly shown: Float32Array;
  /** 0 = a focus electron, 1… = how deep behind the focal plane (0…1 → dimmer). */
  readonly depthOf: Float32Array;
  /** Speed of the random flight, units/s (the frame is ≈ 20 wide), and common drift along X as a share of it. */
  speed: number;
  drift: number;
  /** 0 = every electron circles its own atom, 1 = all are shared and roam. */
  shared: number;
  /** Atoms of the piece the electrons may roam (first n sites); ≥ `FOCUS_COUNT` = the whole crystal. */
  piece: number;
  /** Centre of the roaming box (follows the camera target in XY). */
  centre: { x: number; y: number };
  /**
   * The counter frame: a window in the plane x = `x`; crossings of focus electrons are counted.
   * `balance` (0 = off, the default; 1 = the counts never part by more than two): the pull toward equal counts
   * that a real wire has — whichever side leads, the next electron heading there is likelier to turn at the
   * frame (`turned` counts those turns). Use it only without a common drift.
   */
  gate: {
    on: boolean;
    x: number;
    y: number;
    half: number;
    left: number;
    right: number;
    last: number;
    balance: number;
    turned: number;
  };
  /** The electron the reader follows (the marked one): it keeps inside the frame. −1 = none. */
  followed: number;
  /** The focus electron nearest to a point of the focal plane right now, or −1. */
  nearest(x: number, y: number): number;
  reset(): void;
  step(dt: number, t: number): void;
}

export function createElectronSim(rng: Rng, world: Obstacles): ElectronSim {
  const n = FOCUS_COUNT + DEPTH_COUNT;
  const pos = new Float32Array(n * 3);
  const free = new Float32Array(n * 3);
  const dir = new Float32Array(n * 3);
  const shown = new Float32Array(n);
  const depthOf = new Float32Array(n);
  const pace = new Float32Array(n);
  const turnAt = new Float32Array(n);
  // every electron's own circle: two unit vectors across a random axis, an angular speed and a phase
  const orbit = Array.from({ length: n }, () => {
    const [ax, ay, az] = rng.onSphere();
    const ul = Math.hypot(ay, ax) || 1;
    const u = [ay / ul, -ax / ul, 0] as const;
    const v = [ay * u[2] - az * u[1], az * u[0] - ax * u[2], ax * u[1] - ay * u[0]] as const;
    return { u, v, phase: rng.range(0, 6.28), w: rng.range(1.7, 2.6) * (rng.next() < 0.5 ? -1 : 1) };
  });
  const turn = (e: number): void => {
    const [x, y, z] = rng.onSphere();
    // flights lie mostly in the plane of the picture: the eye follows them, and the slab keeps them in focus
    const k = 1 / Math.hypot(x, y, z * 0.3);
    dir.set([x * k, y * k, z * 0.3 * k], 3 * e);
  };
  const seed = (): void => {
    for (let e = 0; e < n; e++) {
      const deep = e >= FOCUS_COUNT;
      const box = deep ? BOX_DEEP : BOX;
      depthOf[e] = deep ? rng.range(0.25, 1) : 0;
      const z = deep ? -PLANE_GAP * (0.6 + 3.2 * depthOf[e]!) : rng.range(SLAB[0], SLAB[1]);
      free.set([rng.range(-box[0], box[0]), rng.range(-box[1], box[1]), z], 3 * e);
      pace[e] = rng.range(0.75, 1.25);
      turnAt[e] = rng.range(0, 0.6);
      shown[e] = 0;
      turn(e);
    }
  };
  seed();
  const sim: ElectronSim = {
    count: n,
    pos,
    shown,
    depthOf,
    speed: 12,
    drift: 0,
    shared: 1,
    piece: FOCUS_COUNT,
    centre: { x: 0, y: 0 },
    gate: { on: false, x: 0, y: 0, half: 2.4, left: 0, right: 0, last: -1, balance: 0, turned: 0 },
    followed: -1,
    nearest(x, y) {
      let best = -1;
      let d = Infinity;
      for (let e = 0; e < FOCUS_COUNT; e++) {
        const q = Math.hypot(pos[3 * e]! - x, pos[3 * e + 1]! - y);
        if (shown[e]! > 0.5 && q < d) {
          d = q;
          best = e;
        }
      }
      return best;
    },
    reset: seed,
    step(dt, t) {
      const whole = sim.piece >= FOCUS_COUNT;
      const w = clamp01(sim.shared);
      for (let e = 0; e < n; e++) {
        const o = 3 * e;
        const deep = e >= FOCUS_COUNT;
        // an electron is there when its atom is (focus group); the depth crowd belongs to the whole crystal
        const want = deep ? (whole ? 1 : 0) : whole ? 1 : world.presence(e);
        const was = shown[e]!;
        shown[e] = was + (want - was) * Math.min(dt * 6, 1);
        // its own circle around its own atom (focus group only)
        const home = world.sites[Math.min(e, world.sites.length - 1)]!.p;
        const q = orbit[e]!;
        const a = q.phase + t * q.w;
        const ca = Math.cos(a) * OUTER_R;
        const sa = Math.sin(a) * OUTER_R;
        const bx = home.x + q.u[0] * ca + q.v[0] * sa;
        const by = home.y + q.u[1] * ca + q.v[1] * sa;
        // flattened toward the picture plane, so the circling electron stays in focus
        const bz = home.z + 0.55 * (q.u[2] * ca + q.v[2] * sa);
        if (!deep && (w < 0.02 || (!whole && was < 0.05))) {
          // bound (or just born with its atom): the free flight starts from the circle when it is let go
          free.set([bx, by, bz], o);
        } else if (shown[e]! > 0.02 || whole) {
          const x0 = free[o]!;
          const v = sim.speed * pace[e]! * dt * (deep ? 0.8 : 1);
          free[o] = x0 + dir[o]! * v + sim.drift * sim.speed * dt;
          free[o + 1] = free[o + 1]! + dir[o + 1]! * v;
          free[o + 2] = free[o + 2]! + dir[o + 2]! * v;
          if (t >= turnAt[e]!) {
            turn(e);
            turnAt[e] = t + 0.18 - 0.42 * Math.log(1 - rng.next() * 0.98);
          }
          collide(free, dir, e, world);
          keepInCopper(free, dir, e);
          if (deep) keepInSlab(free, dir, e, -PLANE_GAP * 4.2, -PLANE_GAP * 0.6);
          else keepInSlab(free, dir, e, SLAB[0], SLAB[1]);
          if (!whole && !deep) keepNear(free, dir, e, world, Math.ceil(sim.piece), OUTER_R + 0.75);
          else if (e === sim.followed) {
            // the electron the reader follows turns back before the edge of the frame instead of leaving it
            for (const a of [0, 1] as const) {
              const off = free[o + a]! - (a === 0 ? sim.centre.x : sim.centre.y);
              if (Math.abs(off) > LEASH[a] && off * dir[o + a]! > 0) dir[o + a] = -dir[o + a]!;
            }
          } else {
            // periodic box around the camera target: what leaves on one side returns on the other, off screen
            const box = deep ? BOX_DEEP : BOX;
            const dx = free[o]! - sim.centre.x;
            const dy = free[o + 1]! - sim.centre.y;
            if (Math.abs(dx) > box[0]) free[o] = free[o]! - Math.sign(dx) * 2 * box[0];
            if (Math.abs(dy) > box[1]) free[o + 1] = free[o + 1]! - Math.sign(dy) * 2 * box[1];
          }
          const g = sim.gate;
          if (g.on && !deep && Math.abs(free[o + 1]! - g.y) < g.half && Math.abs(free[o]! - x0) < 2) {
            const to = free[o]!;
            const way = x0 < g.x && to >= g.x ? 1 : x0 >= g.x && to < g.x ? -1 : 0;
            // The balance: in a real wire the side that has gained electrons pushes the next ones back. Here
            // the electron about to add to the lead takes one of its random turns at the frame instead —
            // the more often, the bigger the lead (always once it would pass two, at balance 1).
            const ahead = (g.right - g.left) * way;
            if (way !== 0 && ahead > 0 && rng.next() < 0.5 * g.balance * ahead * ahead) {
              turn(e);
              dir[o] = -way * Math.abs(dir[o]!);
              free[o] = 2 * g.x - to;
              turnAt[e] = t + 0.18 - 0.42 * Math.log(1 - rng.next() * 0.98);
              g.turned++;
            } else if (way !== 0) {
              if (way > 0) g.right++;
              else g.left++;
              g.last = e;
            }
          }
        }
        pos[o] = bx + (free[o]! - bx) * (deep ? 1 : w);
        pos[o + 1] = by + (free[o + 1]! - by) * (deep ? 1 : w);
        pos[o + 2] = bz + (free[o + 2]! - bz) * (deep ? 1 : w);
      }
    },
  };
  return sim;
}
