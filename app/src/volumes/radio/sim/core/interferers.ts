/**
 * The only interference the course shows: what a household meets by chance — the neighbour's router and the
 * microwave oven in the kitchen. Both are added to the monitor's antenna at the band's rate, one frame of the model
 * per call; their rhythm is tied to the frame of the model (a decision of the plan).
 *
 * The level of each at the monitor's antenna is 10·lg(its mW) + pathGainDb(site, it, the antenna), where the
 * antenna is the route point plus `nudge` along the nudge axis, as in channel.ts.
 *
 * The router talks in bursts. The 100 lines of a frame fall into k parts (part i is the lines from ⌈100·i/k⌉ to
 * ⌈100·(i + 1)/k⌉ − 1), k a whole number of 3…6 from the generator; each part holds one burst of 3…12 whole lines,
 * with at least one quiet line after it before the part ends. A burst is noise at the channel's rate put round
 * 2437 MHz by a placer (rf.ts), so it is a hump about 20 MHz wide that covers channel 2 and the 2440–2447 MHz of
 * channel 3. Its amplitude is the level's divided by √(5·Σ CHANNEL_FILTER²): the interpolator takes 0.27 dB from
 * white noise, and this gives the level back on the antenna.
 *
 * The oven leaks a tone of steady amplitude in lines 0–49 of every frame. Its frequency goes as a triangle,
 * 2450 → 2470 → 2450 MHz in 2 lines, and its phase goes on from frame to frame. Why 2 lines (counted by the plan on
 * a second implementation of the chain): over 25 lines the tone would stand outside channel 3 half of the time, and
 * the screen would show three narrow bands, 29 lines in all; over 2 lines it touches every line, and the band is
 * one, all 50 lines, as in the table of the contract.
 */
import { type AirState, pathGainDb, routePoint } from './channel';
import { CHANNEL_FILTER, createPlacer } from './rf';
import { createRng } from './rng';
import type { Site, Vec3 } from './site';
import { BAND, FRAME_CH, FRAME_LINES, FRAME_WB, FS_WB, OVERSAMPLE, shown } from './standard';
import { dbmToAmp } from './units';

/** The neighbour's router: the middle of its hump, real Hz; how many bursts a frame holds; how many lines a burst lasts. */
export const ROUTER = { centre: 2437e6, bursts: [3, 6], burstLines: [3, 12] } as const;
/** The oven: the ends of its sweep, real Hz; lines 0…onLines − 1 of each frame it is on; lines of one sweep up and down. */
export const OVEN = { lo: 2450e6, hi: 2470e6, onLines: 50, sweepLines: 2 } as const;

const TWO_PI = 2 * Math.PI;
/** The band's rate in real Hz: 100 MHz. */
const BAND_HZ = shown(FS_WB);
/** Pairs of a line at the channel's rate (288) and at the band's (1440). */
const LINE_CH = FRAME_CH / FRAME_LINES;
const LINE_WB = FRAME_WB / FRAME_LINES;
/** The nudge of the monitor's antenna is held to ±0.15 m, as in `trace`. */
const NUDGE = 0.15;

/** Σ CHANNEL_FILTER², for the amplitude of the router's noise. */
const FILTER_SQUARES = CHANNEL_FILTER.reduce((sum, h) => sum + h * h, 0);

/** Pairs of the band in one sweep of the oven, up and down (2880), and while it is on in a frame (72 000). */
const SWEEP = OVEN.sweepLines * LINE_WB;
const OVEN_ON = OVEN.onLines * LINE_WB;

/**
 * One sweep of the oven: e^(jψ(n)) for n = 0…SWEEP − 1, where ψ(n) is the phase the tone gathers from the start of
 * the sweep to pair n (ψ(0) = 0, then the turn of each pair from its frequency, real Hz − BAND.centre over 100 MHz);
 * `whole` — ψ over the whole sweep; `onTurn` — ψ over the pairs a frame is on, from which the next frame goes on.
 */
const SWEEP_TABLE = (() => {
  const turns = new Float64Array(2 * SWEEP);
  const half = SWEEP / 2;
  const phases = new Float64Array(SWEEP + 1);
  for (let n = 0; n < SWEEP; n++) {
    turns[2 * n] = Math.cos(phases[n]!);
    turns[2 * n + 1] = Math.sin(phases[n]!);
    const up = n < half ? n / half : (SWEEP - n) / half;
    const hz = OVEN.lo + (OVEN.hi - OVEN.lo) * up;
    phases[n + 1] = phases[n]! + (TWO_PI * (hz - BAND.centre)) / BAND_HZ;
  }
  const whole = phases[SWEEP]!;
  const onTurn = Math.floor(OVEN_ON / SWEEP) * whole + phases[OVEN_ON % SWEEP]!;
  return { turns, whole, onTurn };
})();

/** The monitor's antenna: the route point moved by `nudge` (held to ±0.15 m) along the normalised nudge axis. */
function antennaAt(site: Site, air: AirState): Vec3 {
  if (Number.isNaN(air.nudge)) throw new RangeError('interferers: nudge is NaN');
  const nudge = Math.min(NUDGE, Math.max(-NUDGE, air.nudge));
  const [x, y, z] = routePoint(site, air.route);
  const [ax, ay] = site.nudgeAxis;
  const length = Math.hypot(ax, ay);
  return [x + (nudge * ax) / length, y + (nudge * ay) / length, z];
}

/** A whole number from `lo` to `hi`, both ends included. */
const between = (rng: { float(): number }, lo: number, hi: number): number =>
  lo + Math.floor(rng.float() * (hi - lo + 1));

/**
 * The neighbour's router and the oven. `add` adds to `antenna` — one frame of the band, FRAME_WB pairs, otherwise a
 * RangeError — what is switched on in `air` (`router`, `oven`) at the level each has on the monitor's antenna in
 * `site`. The bursts and the router's noise come from `seed`; the router's interpolator and the oven's phase go on
 * from frame to frame; a source that is off draws nothing and keeps its place. `reset()` starts all again: after
 * it the frames repeat bit for bit.
 */
export function createInterferers(seed: number): {
  add(antenna: Float32Array, air: AirState, site: Site): void;
  reset(): void;
} {
  const placer = createPlacer();
  const burst = new Float32Array(2 * FRAME_CH); // the router's frame at the channel's rate
  let bursts = createRng(seed).fork(1); // how many bursts, where and how long
  let noise = createRng(seed).fork(2); // what the router sends
  let ovenPhase = 0;

  const router = (antenna: Float32Array, level: number): void => {
    const parts = between(bursts, ROUTER.bursts[0], ROUTER.bursts[1]);
    // the router's noise runs the whole frame; it is sent only in the bursts
    noise.gaussFill(burst, dbmToAmp(level) / Math.sqrt(2 * OVERSAMPLE * FILTER_SQUARES));
    const line = 2 * LINE_CH;
    let quiet = 0; // the first line after the last burst
    for (let i = 0; i < parts; i++) {
      const first = Math.ceil((FRAME_LINES * i) / parts);
      const next = Math.ceil((FRAME_LINES * (i + 1)) / parts);
      const lines = between(bursts, ROUTER.burstLines[0], ROUTER.burstLines[1]);
      const start = first + Math.floor(bursts.float() * (next - first - lines)); // the line next − 1 stays quiet
      burst.fill(0, quiet * line, start * line);
      quiet = start + lines;
    }
    burst.fill(0, quiet * line);
    placer.placeAt(burst, ROUTER.centre, antenna);
  };

  const oven = (antenna: Float32Array, level: number): void => {
    const amp = dbmToAmp(level);
    const { turns, whole, onTurn } = SWEEP_TABLE;
    const sweep = SWEEP;
    const on = OVEN_ON;
    let phase = ovenPhase;
    for (let start = 0; start < on; start += sweep, phase += whole) {
      const c = amp * Math.cos(phase);
      const s = amp * Math.sin(phase);
      const end = Math.min(sweep, on - start);
      for (let n = 0, i = 2 * start; n < end; n++, i += 2) {
        const tr = turns[2 * n]!;
        const ti = turns[2 * n + 1]!;
        antenna[i] += c * tr - s * ti;
        antenna[i + 1] += c * ti + s * tr;
      }
    }
    ovenPhase = (ovenPhase + onTurn) % TWO_PI;
  };

  return {
    add(antenna, air, site) {
      if (antenna.length !== 2 * FRAME_WB) {
        throw new RangeError(`interferers: ${antenna.length >> 1} pairs, one frame is ${FRAME_WB}`);
      }
      if (typeof air.router !== 'boolean' || typeof air.oven !== 'boolean') {
        throw new RangeError(`interferers: router ${air.router}, oven ${air.oven}`);
      }
      const at = antennaAt(site, air);
      if (air.router) router(antenna, 10 * Math.log10(site.router.mw) + pathGainDb(site, site.router.at, at));
      if (air.oven) oven(antenna, 10 * Math.log10(site.oven.leakMw) + pathGainDb(site, site.oven.at, at));
    },
    reset() {
      placer.reset();
      bursts = createRng(seed).fork(1);
      noise = createRng(seed).fork(2);
      ovenPhase = 0;
    },
  };
}
