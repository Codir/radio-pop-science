/**
 * The air between the camera's antenna and the monitor's: the rays, the level they bring and the noise of the
 * antenna.
 *
 * The rules of geometry (the plan's task B6a, the same ones the reference model `link_budget.py` follows):
 * - a ray loses 20·lg(4πd/λ) of free space with λ = 0.1224 m, the wavelength of channel 3, for every channel,
 *   and each antenna gives 1.1 dBi;
 * - the walls are vertical and have no limits in height (the cellar has the same walls: the foundation); a ray
 *   pays for a wall when its trace on the plan crosses the wall's segment: the crossing lies strictly inside the
 *   ray (0 < t < 1) and on the wall with its ends (0 ≤ u ≤ 1); it pays for the slab when its ends lie on
 *   different sides of `slabZ`;
 * - the open leaf of the garage gate is a mirror on the plan: the source is the camera's antenna mirrored beyond
 *   the leaf's line, and the point of reflection must lie on the leaf from `a` to `b`; the reflected ray is
 *   √(plan length² + difference of heights²) long, the point of reflection divides the difference of heights in
 *   the same part as the plan path, and the ray pays for the walls on both of its legs; the reflection
 *   coefficient is 1, and the gate multiplies the amplitude by s²(3 − 2s), s = (gate − 0.3)/0.6 held to 0…1;
 * - the tray at the monitor's antenna is diffraction over one edge: J(v) = 6.9 + 20·lg(√((v − 0.1)² + 1) + v − 0.1)
 *   for v ≥ −0.78, otherwise 0, v = h·√(2(d₁ + d₂)/(λ·d₁·d₂)), where d₁ is the length of the direct ray,
 *   d₂ = 0.05 m and the edge stands h = −0.4 + 0.48·tray m from the line of sight; every ray loses the same J.
 */
import { createDelay } from './dsp';
import { createRng } from './rng';
import { LOSS_DB, type Site, type Vec2, type Vec3 } from './site';
import { BAND, CHANNELS, type ChannelNo, FS_WB, K } from './standard';
import { ampToDbm, dbmToAmp } from './units';

export const WAVELENGTH = 0.1224,
  ANTENNA_DBI = 1.1; // λ at 2450 MHz (channel 3), as in the contract

export interface AirState {
  /** 0…4: 0 the yard (20 m from the camera) · 1 the kitchen · 2 the hallway · 3 the far room · 4 the cellar. */
  route: number;
  /** «Move the antenna», metres, −0.15…+0.15. */
  nudge: number;
  /** The leaf of the garage gate: 0 shut … 1 open. */
  gate: number;
  /** The baking tray: 0 none … 1 right at the monitor's antenna. */
  tray: number;
  /** 0.1…10. */
  txPowerMw: number;
  /** The channel of the first camera, 3 by default. */
  txChannel: ChannelNo;
  router: boolean;
  oven: boolean;
}

/** One way from antenna to antenna: its gain with both antennas, dB; its delay, real ns; the carrier's phase, radians at 2441 MHz. */
export interface Ray {
  gainDb: number;
  delayNs: number;
  phase: number;
}

/** The rays (at most three; ray 0 is the direct one), the level in the middle of channel `txChannel`, dBm, and the field, V/m. */
export interface Air {
  rays: Ray[];
  rxDbm: number;
  fieldVm: number;
}

const TWO_PI = 2 * Math.PI;
const LIGHT_M_PER_NS = 0.299792458;
/** Where the tray stands behind the monitor's antenna, m. */
const TRAY_GAP = 0.05;
/** Gain of the monitor's antenna as a ratio, for the field. */
const ANTENNA_GAIN = 10 ** (ANTENNA_DBI / 10);
/** Samples of the band per real ns: the real delay stretched K times, at the band rate (0.1). */
const SAMPLES_PER_NS = (K * FS_WB) / 1e9;
const MAX_RAYS = 3;
/**
 * The longest delay of a ray behind ray 0 a delay line takes, samples of the band: 160 ns real. Reflections within
 * the yard stay under 100 ns (the contract); in this yard the longest one is about 70 ns.
 */
const MAX_DELAY = 16;
const LIMITS = {
  route: [0, 4],
  nudge: [-0.15, 0.15],
  gate: [0, 1],
  tray: [0, 1],
  txPowerMw: [0.1, 10],
} as const;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A number of the state that has no value is a mistake of the caller, not something to hold to a range. */
function given(v: number, what: string): number {
  if (Number.isNaN(v)) throw new RangeError(`${what} is NaN`);
  return v;
}

/** The monitor's antenna on the route: exactly on the stops, on a straight line between them; `route` is held to 0…4. */
export function routePoint(site: Site, route: number): [number, number, number] {
  const r = clamp(given(route, 'routePoint: route'), 0, 4);
  const i = Math.min(3, Math.floor(r));
  const t = r - i;
  const a = site.route[i]!;
  const b = site.route[i + 1]!;
  // (1 − t)·a + t·b gives a at t = 0 and b at t = 1 exactly
  return [(1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1], (1 - t) * a[2] + t * b[2]];
}

/** The monitor's antenna: the route point moved by `nudge` metres along the (normalised) nudge axis. */
function antennaAt(site: Site, route: number, nudge: number): Vec3 {
  const [x, y, z] = routePoint(site, route);
  const [ax, ay] = site.nudgeAxis;
  const length = Math.hypot(ax, ay);
  return [x + (nudge * ax) / length, y + (nudge * ay) / length, z];
}

/** Does the plan trace from p to q cross the wall a–b: strictly inside the trace, on the wall with its ends? */
function crosses(p: Vec3, q: Vec3, a: Vec2, b: Vec2): boolean {
  const rx = q[0] - p[0];
  const ry = q[1] - p[1];
  const sx = b[0] - a[0];
  const sy = b[1] - a[1];
  const across = rx * sy - ry * sx;
  if (across === 0) return false; // parallel: the trace runs along the wall's line or beside it
  const wx = a[0] - p[0];
  const wy = a[1] - p[1];
  const t = (wx * sy - wy * sx) / across; // along the trace
  const u = (wx * ry - wy * rx) / across; // along the wall
  return t > 0 && t < 1 && u >= 0 && u <= 1;
}

/** Do the ends of the ray lie on different sides of the slab? */
function throughSlab(site: Site, p: Vec3, q: Vec3): boolean {
  const z = site.slabZ;
  return (p[2] < z && q[2] > z) || (p[2] > z && q[2] < z);
}

/** The ids of the walls the ray crosses, in the order of site.json; the slab, 'slab', last. */
export function wallsBetween(site: Site, from: Vec3, to: Vec3): string[] {
  const ids: string[] = [];
  for (const wall of site.walls) if (crosses(from, to, wall.a, wall.b)) ids.push(wall.id);
  if (throughSlab(site, from, to)) ids.push('slab');
  return ids;
}

/** What the walls and the slab on the ray take, dB. */
function wallLossDb(site: Site, from: Vec3, to: Vec3): number {
  let loss = 0;
  for (const wall of site.walls) if (crosses(from, to, wall.a, wall.b)) loss += LOSS_DB[wall.material];
  if (throughSlab(site, from, to)) loss += LOSS_DB.slab;
  return loss;
}

/** Loss of free space over d metres, dB. */
const freeSpaceDb = (d: number): number => 20 * Math.log10((4 * Math.PI * d) / WAVELENGTH);

/** Gain of the straight way from antenna to antenna, dB: 2·1.1 − free space − walls; without the tray and reflections. */
export function pathGainDb(site: Site, from: Vec3, to: Vec3): number {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  return 2 * ANTENNA_DBI - freeSpaceDb(d) - wallLossDb(site, from, to);
}

/**
 * The point of reflection on the open leaf, with its height, for the camera's antenna `tx` and the monitor's `rx`;
 * null when the mirror line from the image of `tx` to `rx` misses the leaf (or the two lie on different sides of it).
 */
function leafPoint(site: Site, tx: Vec3, rx: Vec3): Vec3 | null {
  const [ax, ay] = site.gateLeaf.a;
  const ex = site.gateLeaf.b[0] - ax;
  const ey = site.gateLeaf.b[1] - ay;
  // the image of tx beyond the leaf's line
  const k = ((tx[0] - ax) * ex + (tx[1] - ay) * ey) / (ex * ex + ey * ey);
  const ix = 2 * (ax + k * ex) - tx[0];
  const iy = 2 * (ay + k * ey) - tx[1];
  // where the plan path from the image to rx crosses the leaf's line
  const rx0 = rx[0] - ix;
  const ry0 = rx[1] - iy;
  const across = rx0 * ey - ry0 * ex;
  if (across === 0) return null;
  const wx = ax - ix;
  const wy = ay - iy;
  const t = (wx * ey - wy * ex) / across; // along the path: the part of it from tx to the leaf
  const u = (wx * ry0 - wy * rx0) / across; // along the leaf, from the hinge
  if (!(t > 0 && t < 1 && u >= 0 && u <= 1)) return null;
  return [ax + u * ex, ay + u * ey, tx[2] + (rx[2] - tx[2]) * t];
}

/** Loss behind the tray, dB: diffraction over one edge h = −0.4 + 0.48·tray m from the line of sight. */
function trayLossDb(direct: number, tray: number): number {
  const h = -0.4 + 0.48 * tray;
  const v = h * Math.sqrt((2 * (direct + TRAY_GAP)) / (WAVELENGTH * direct * TRAY_GAP));
  if (v < -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}

/** A ray of `length` metres: its delay, real ns, and the phase of the carrier, −2π·2441 MHz·delay, in [0, 2π). */
function ray(gainDb: number, length: number): Ray {
  const delayNs = length / LIGHT_M_PER_NS;
  const turns = BAND.centre * delayNs * 1e-9;
  const back = -TWO_PI * (turns - Math.floor(turns)); // (−2π, 0]
  let phase = back < 0 ? back + TWO_PI : 0;
  if (phase >= TWO_PI) phase = 0;
  return { gainDb, delayNs, phase };
}

/** The level of the rays at a real frequency against one ray of gain 0 dB: 20·lg|Σ 10^(gainDb/20)·e^(−j2π·f·τ)|. */
export function responseDb(air: Air, shownHz: number): number {
  const rays = air.rays;
  if (rays.length === 0) return ampToDbm(0);
  const first = rays[0]!.delayNs; // a delay common to all rays turns the sum, it does not change its length
  let re = 0;
  let im = 0;
  for (const r of rays) {
    const amp = 10 ** (r.gainDb / 20);
    const angle = -TWO_PI * shownHz * (r.delayNs - first) * 1e-9;
    re += amp * Math.cos(angle);
    im += amp * Math.sin(angle);
  }
  return ampToDbm(Math.hypot(re, im));
}

/** The field that would give `rxDbm` on the monitor's antenna, V/m: √(480·π²·P/(λ²·G)), P in watts. */
function fieldVm(rxDbm: number): number {
  const watts = 10 ** (rxDbm / 10) / 1000;
  return Math.sqrt((480 * Math.PI ** 2 * watts) / (WAVELENGTH ** 2 * ANTENNA_GAIN));
}

/**
 * The rays from the camera's antenna to the monitor's for this state of the air: ray 0 is the direct one, ray 1
 * comes from the leaf of the garage gate (only when gate > 0.3 and the point of reflection is on the leaf).
 * route, nudge, gate, tray and txPowerMw are held to their ranges; NaN in them or a channel other than 1…4 is a
 * RangeError. The router and the oven are not rays: they live in interferers.ts.
 */
export function trace(site: Site, air: AirState): Air {
  const route = clamp(given(air.route, 'trace: route'), ...LIMITS.route);
  const nudge = clamp(given(air.nudge, 'trace: nudge'), ...LIMITS.nudge);
  const gate = clamp(given(air.gate, 'trace: gate'), ...LIMITS.gate);
  const tray = clamp(given(air.tray, 'trace: tray'), ...LIMITS.tray);
  const power = clamp(given(air.txPowerMw, 'trace: txPowerMw'), ...LIMITS.txPowerMw);
  const centre = CHANNELS[air.txChannel - 1];
  if (centre === undefined) throw new RangeError(`trace: txChannel ${air.txChannel}`);

  const tx = site.tx;
  const rx = antennaAt(site, route, nudge);
  const direct = Math.hypot(rx[0] - tx[0], rx[1] - tx[1], rx[2] - tx[2]);
  const behindTray = trayLossDb(direct, tray); // every ray loses the same
  const rays: Ray[] = [ray(pathGainDb(site, tx, rx) - behindTray, direct)];

  const s = clamp((gate - 0.3) / 0.6, 0, 1);
  const at = s > 0 ? leafPoint(site, tx, rx) : null;
  if (at) {
    const plan = Math.hypot(at[0] - tx[0], at[1] - tx[1]) + Math.hypot(rx[0] - at[0], rx[1] - at[1]);
    const length = Math.hypot(plan, tx[2] - rx[2]);
    const opened = 20 * Math.log10(s * s * (3 - 2 * s));
    const walls = wallLossDb(site, tx, at) + wallLossDb(site, at, rx);
    rays.push(ray(2 * ANTENNA_DBI - freeSpaceDb(length) - walls + opened - behindTray, length));
  }

  const out: Air = { rays, rxDbm: 0, fieldVm: 0 };
  out.rxDbm = 10 * Math.log10(power) + responseDb(out, centre);
  out.fieldVm = fieldVm(out.rxDbm);
  return out;
}

/**
 * The air as a signal, on the band's rate. `apply` adds every ray of `air` to `out`: the band signal `tx` with the
 * amplitude dbmToAmp(10·lg(txPowerMw) + gainDb) (txPowerMw held to 0.1…10, as in `trace`), turned by the ray's
 * phase and delayed by (delayNs − delayNs of ray 0)·0.1 samples, the real delay stretched K times. Every ray has
 * a delay line of its own (`createDelay`), which adds DELAY_LATENCY samples to all rays alike; a ray that is
 * missing from a call has its line cleared, so when it comes back it starts from silence. `noise` adds normal
 * noise of deviation `sigma` to each shadow of `out`, from the generator of `seed`. `reset()` clears the lines
 * and starts the generator again; after it the output repeats bit for bit.
 */
export function createAir(seed: number): {
  apply(tx: Float32Array, air: Air, txPowerMw: number, out: Float32Array): void;
  noise(out: Float32Array, sigma: number): void;
  reset(): void;
} {
  const lines = Array.from({ length: MAX_RAYS }, () => createDelay(MAX_DELAY));
  let rng = createRng(seed);
  let scratch = new Float32Array(0);
  return {
    apply(tx, air, txPowerMw, out) {
      const rays = air.rays;
      if (rays.length > MAX_RAYS) throw new RangeError(`air: ${rays.length} rays, at most ${MAX_RAYS}`);
      const level = 10 * Math.log10(clamp(given(txPowerMw, 'air: txPowerMw'), ...LIMITS.txPowerMw));
      const first = rays.length > 0 ? rays[0]!.delayNs : 0;
      for (let i = 0; i < MAX_RAYS; i++) {
        const line = lines[i]!;
        const r = rays[i];
        if (r === undefined) {
          line.reset();
          continue;
        }
        const amp = dbmToAmp(level + r.gainDb);
        const delay = (r.delayNs - first) * SAMPLES_PER_NS;
        line.add(tx, out, delay, amp * Math.cos(r.phase), amp * Math.sin(r.phase));
      }
    },
    noise(out, sigma) {
      if (!(sigma >= 0)) throw new RangeError(`air: noise of deviation ${sigma}`);
      if (scratch.length !== out.length) scratch = new Float32Array(out.length);
      const add = scratch;
      rng.gaussFill(add, sigma);
      for (let i = 0, n = out.length; i < n; i++) out[i] += add[i]!;
    },
    reset() {
      for (const line of lines) line.reset();
      rng = createRng(seed);
    },
  };
}
