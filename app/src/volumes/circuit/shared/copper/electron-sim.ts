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
import { leanX } from './lean';
import { clamp01, OUTER_R, PITCH, PLANE_GAP } from './layout';
import { accelerate, steerInward } from './run';

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
/** A field run never grows past this many times its restart speed. */
const RUN_TOP = 2.4;
/** `d` folded into −half … half (periodic box); unchanged when already inside. */
const wrap = (d: number, half: number): number =>
  Math.abs(d) <= half ? d : d - 2 * half * Math.round(d / (2 * half));

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
  /**
   * The common drift made visible (chapters 4 – 6; default 0 = off, free roaming as in chapter 1). With `leash` > 0
   * (units) every electron darts about a home point of its own, never farther than `leash` from it, and the homes
   * are carried along X by `drift` together: the crowd keeps its pattern and the whole of it slides, while each
   * electron still flies straight and turns at random. Without it a drift of a few per cent is lost in the darting
   * (each electron wanders farther in a second than the drift carries it in ten). Homes are taken where the
   * electrons are when the leash engages, so turning it on moves nothing. Collisions (`electron-rules.ts`) apply as
   * before; an electron thrown past its leash turns back toward its home.
   */
  leash: number;
  /**
   * Half-size of the focus electrons' periodic box around `centre` (default 15.5 × 8.6: wider than the frame at
   * 16:9). Seen through a small window (the lens on the stand) the box can shrink to just beyond the window plus
   * the leash, so that the same 32 electrons crowd the glass (≈ 12 in a window 8.5 units across with a box of
   * 6.2 × 6.2). Electrons outside a new box are wrapped into it on the next step.
   */
  box: { x: number; y: number };
  /** 0 = every electron circles its own atom, 1 = all are shared and roam. */
  shared: number;
  /**
   * −1 … 1, default 0: a charged surface (`battery/poles`, the metal of a pole seen in the lens). > 0: three in
   * four focus electrons are pushed toward the top surface and crowd under it (a surplus); < 0: three in four turn
   * back a band of up to one row below it (a lack). The random flight goes on either way.
   */
  surface: number;
  /**
   * Half-width of the focus electrons' roaming box along X (default 15.5, wider than the frame). A small view (the
   * lens window) narrows it to its own width, so the crowd it shows keeps VISUAL §6's 12–20 electrons.
   */
  width: number;
  /** Atoms of the piece the electrons may roam (first n sites); ≥ `FOCUS_COUNT` = the whole crystal. */
  piece: number;
  /** Centre of the roaming box (follows the camera target in XY). */
  centre: { x: number; y: number };
  /**
   * The crowd leaning toward +x (− = toward −x) as drawn, 0 = none (default): denser on one side over `leanSpan`
   * units each way of `centre.x`, the random flight untouched (`lean.ts`; `charge/shift`).
   */
  lean: number;
  leanSpan: number;
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
  /**
   * The field's pull on the followed electron (`resistance/bumps`; units/s², default 0 = off, as before). With
   * `field` > 0 the followed electron no longer turns at random: the field speeds it up toward −X (the plus) between
   * atoms, so its path bends, and at every atom it hits it bounces off and starts again at `restart` units/s — it
   * loses its run (`run.ts`). The leash does not hold it. `runSpeed` (read) is its speed now.
   */
  field: number;
  restart: number;
  readonly runSpeed: number;
  /**
   * Called for every hit of a focus electron on an atom (`hits.ts` counts them and makes the atoms flash). Default
   * none. The same contact may report on two frames running; debounce it yourself.
   */
  onHit: ((electron: number, site: number) => void) | null;
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
  /** Home points of the leash (x, y per electron); `leashed` = the homes are taken. */
  const anchor = new Float32Array(n * 2);
  let leashed = false;
  /** The followed electron's speed in a field run (units/s); 0 = not running yet. */
  let run = 0;
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
    leash: 0,
    box: { x: BOX[0], y: BOX[1] },
    shared: 1,
    surface: 0,
    width: BOX[0],
    piece: FOCUS_COUNT,
    centre: { x: 0, y: 0 },
    lean: 0,
    leanSpan: 7.5,
    gate: { on: false, x: 0, y: 0, half: 2.4, left: 0, right: 0, last: -1, balance: 0, turned: 0 },
    followed: -1,
    field: 0,
    restart: 7,
    get runSpeed() {
      return run;
    },
    onHit: null,
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
      const leash = whole ? sim.leash : 0;
      if (leash > 0 && !leashed)
        for (let e = 0; e < n; e++) anchor.set([free[3 * e]!, free[3 * e + 1]!], 2 * e);
      leashed = leash > 0;
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
          const running = e === sim.followed && sim.field > 0 && !deep;
          if (running)
            run = accelerate(free, dir, e, run || sim.speed * pace[e]!, sim.field, dt, RUN_TOP * sim.restart);
          else if (e === sim.followed) run = 0;
          const v = sim.speed * pace[e]! * dt * (deep ? 0.8 : 1);
          if (!running) {
            free[o] = x0 + dir[o]! * v + sim.drift * sim.speed * dt;
            free[o + 1] = free[o + 1]! + dir[o + 1]! * v;
            free[o + 2] = free[o + 2]! + dir[o + 2]! * v;
          }
          if (!running && t >= turnAt[e]!) {
            turn(e);
            turnAt[e] = t + 0.18 - 0.42 * Math.log(1 - rng.next() * 0.98);
          }
          if (leashed) {
            anchor[2 * e] = anchor[2 * e]! + sim.drift * sim.speed * dt;
            // past the leash and still going away: reflect the flight off the circle around the home
            const ox = free[o]! - anchor[2 * e]!;
            const oy = free[o + 1]! - anchor[2 * e + 1]!;
            const d = Math.hypot(ox, oy);
            const away = (dir[o]! * ox + dir[o + 1]! * oy) / (d || 1);
            if (d > leash && away > 0 && !running) {
              dir[o] = dir[o]! - (2 * away * ox) / d;
              dir[o + 1] = dir[o + 1]! - (2 * away * oy) / d;
            }
          }
          const surf = deep ? 0 : sim.surface;
          if (surf > 0 && e % 4 !== 0) free[o + 1] = free[o + 1]! + surf * sim.speed * 0.6 * dt;
          const hit = collide(free, dir, e, world);
          if (hit >= 0) {
            // the run is lost at the atom: it starts again from a slow speed, away from the atom (and, near the
            // edge of the frame, back toward the middle — so the field never presses it against the edge)
            if (running) {
              run = sim.restart;
              steerInward(free, dir, e, sim.centre, LEASH);
            }
            if (!deep) sim.onHit?.(e, hit);
          }
          keepInCopper(free, dir, e, surf < 0 && e % 4 !== 0 ? -surf * PITCH : 0);
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
            // (with the leash the home decides, and the electron goes along with it)
            const bx = deep ? BOX_DEEP[0] : sim.width !== BOX[0] ? sim.width : sim.box.x;
            const by = deep ? BOX_DEEP[1] : sim.box.y;
            const dx = (leashed ? anchor[2 * e]! : free[o]!) - sim.centre.x;
            const dy = (leashed ? anchor[2 * e + 1]! : free[o + 1]!) - sim.centre.y;
            const sx = wrap(dx, bx) - dx;
            const sy = wrap(dy, by) - dy;
            free[o] = free[o]! + sx;
            free[o + 1] = free[o + 1]! + sy;
            if (leashed) {
              anchor[2 * e] = anchor[2 * e]! + sx;
              anchor[2 * e + 1] = anchor[2 * e + 1]! + sy;
            }
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
        if (sim.lean !== 0) pos[o] = leanX(pos[o]!, sim.centre.x, sim.leanSpan, sim.lean);
        pos[o + 1] = by + (free[o + 1]! - by) * (deep ? 1 : w);
        pos[o + 2] = bz + (free[o + 2]! - bz) * (deep ? 1 : w);
      }
    },
  };
  return sim;
}
