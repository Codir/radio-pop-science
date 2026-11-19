/**
 * States of the whole link for the tests of the model, and the measure of cleanliness (the plan's decision, the same
 * as in tools/ref-models/radio/fm_chain.py, task B9a): the model screen is the mean of 16 frames after 2 frames of
 * warming up at stop 0; the cleanliness of a state is 10·lg(255²/mean square of the difference from it) over all
 * cells of 6 frames taken after `reset()` and 2 frames of warming up; its share of lost lines is the mean over the
 * same 6 frames. Every frame of the camera is the test frame `FRAME`.
 */
import { type AirState, trace } from '../channel';
import {
  type CameraState,
  createFmLink,
  DEFAULT_STATE,
  type FmLink,
  type FmLinkState,
  type MonitorState,
} from '../fm-link';
import { SITE } from '../site';
import { COLS, ROWS } from '../standard';
import { FRAME } from './helpers';

const CELLS = COLS * ROWS;
/** Frames of warming up after `reset()`, frames of a state in the measure, frames of the model screen. */
const WARM = 2;
const FRAMES = 6;
const REFERENCE_FRAMES = 16;
/** The curve: its seed and levels at the antenna, −60, −62, …, −92 dBm. */
const SEED = 2026;
const LEVELS: readonly number[] = Array.from({ length: 17 }, (_, i) => -60 - 2 * i);
/** The straight line above the threshold goes through the levels −62…−74 dBm (both ends inside). */
const ABOVE = { from: -62, to: -74 } as const;
/** The knee: the highest level of the grid where the curve lies more than this many dB under that line, extended. */
const KNEE_DB = 6;
/** A row of a screen is bad when its cells differ from the model screen by more than this on average. */
const BAD_ROW = 12;
/** The stops that give the levels of the curve, in the order they are tried. */
const CURVE_STOPS = [0, 1, 3] as const;

/**
 * A copy of DEFAULT_STATE in which the given fields of its three parts are replaced:
 * `S({ route: 3 })`, `S({}, { lineLength: 288.5 }, { sync: false })`. Every call gives new objects.
 */
export function S(
  air: Partial<AirState> = {},
  monitor: Partial<MonitorState> = {},
  camera: Partial<CameraState> = {},
): FmLinkState {
  return {
    air: { ...DEFAULT_STATE.air, ...air },
    camera: { ...DEFAULT_STATE.camera, ...camera },
    monitor: { ...DEFAULT_STATE.monitor, ...monitor },
  };
}

/**
 * The state whose level at the antenna is `dbm`: the first of the stops 0, 1 and 3 whose level `L` at 10 mW (the
 * gate shut, no tray, channel 3) gives `L − 20 ≤ dbm ≤ L`, with the camera's power 10·10^((dbm − L)/10) mW, so
 * 0.1…10 mW. A level no stop reaches that way is a RangeError.
 */
export function at(dbm: number): FmLinkState {
  for (const route of CURVE_STOPS) {
    const level = trace(SITE, S({ route }).air).rxDbm;
    if (level - 20 <= dbm && dbm <= level) return S({ route, txPowerMw: 10 * 10 ** ((dbm - level) / 10) });
  }
  throw new RangeError(`curve: no stop gives ${dbm} dBm with 0.1…10 mW`);
}

/** The model screen: `reset()`, then the mean of 16 frames after 2 frames of warming up at stop 0, 10 mW. */
export function reference(link: FmLink): Float32Array {
  const state = S({ route: 0, txPowerMw: 10 });
  const sum = new Float64Array(CELLS);
  link.reset();
  for (let i = 0; i < WARM + REFERENCE_FRAMES; i++) {
    const { screen } = link.step(state, FRAME);
    if (i >= WARM) for (let k = 0; k < CELLS; k++) sum[k] += screen[k]!;
  }
  return Float32Array.from(sum, (v) => v / REFERENCE_FRAMES);
}

/**
 * The cleanliness of `state` against the model screen `ref`, dB, and its share of lost lines: `reset()`, 2 frames of
 * warming up, then 6 frames into the measure.
 */
export function measure(
  link: FmLink,
  state: FmLinkState,
  ref: ArrayLike<number>,
): { clean: number; syncLost: number } {
  let square = 0;
  let lost = 0;
  link.reset();
  for (let i = 0; i < WARM + FRAMES; i++) {
    const { screen, meters } = link.step(state, FRAME);
    if (i < WARM) continue;
    for (let k = 0; k < CELLS; k++) square += (screen[k]! - ref[k]!) ** 2;
    lost += meters.syncLost;
  }
  return { clean: 10 * Math.log10(255 ** 2 / (square / (FRAMES * CELLS))), syncLost: lost / FRAMES };
}

/** The curve of cleanliness against the level at the antenna. */
export interface Curve {
  /** The cleanliness at a level of the grid −60, −62, …, −92 dBm; any other level is a RangeError. */
  clean(dbm: number): number;
  /** The share of lost lines at a level of the grid. */
  syncLost(dbm: number): number;
  /** The slope of the least-squares straight line through the points −62…−74 dBm, dB per dB. */
  slopeAbove: number;
  /** The highest level of the grid where the curve lies more than 6 dB under that line, extended; NaN if none. */
  knee: number;
}

let made: Curve | null = null;

/**
 * The curve of seed 2026 at the levels −60…−92 dBm in steps of 2, each level in the state `at(dbm)`, against the
 * model screen of the same link. Computed on the first call and kept: every later call returns the same object.
 */
export function curve(): Curve {
  if (made) return made;
  const link = createFmLink(SEED);
  const ref = reference(link);
  const points = new Map(LEVELS.map((dbm) => [dbm, measure(link, at(dbm), ref)] as const));
  const point = (dbm: number): { clean: number; syncLost: number } => {
    const p = points.get(dbm);
    if (!p) throw new RangeError(`curve: ${dbm} dBm is not a level of the curve`);
    return p;
  };
  const above = LEVELS.filter((dbm) => dbm <= ABOVE.from && dbm >= ABOVE.to);
  const x0 = above.reduce((s, x) => s + x, 0) / above.length;
  const y0 = above.reduce((s, x) => s + point(x).clean, 0) / above.length;
  let sxy = 0;
  let sxx = 0;
  for (const x of above) {
    sxy += (x - x0) * (point(x).clean - y0);
    sxx += (x - x0) ** 2;
  }
  const slopeAbove = sxy / sxx;
  const line = (dbm: number): number => y0 + slopeAbove * (dbm - x0);
  const under = LEVELS.filter((dbm) => line(dbm) - point(dbm).clean > KNEE_DB);
  made = {
    clean: (dbm) => point(dbm).clean,
    syncLost: (dbm) => point(dbm).syncLost,
    slopeAbove,
    knee: under.length > 0 ? Math.max(...under) : NaN,
  };
  return made;
}

/** The rows of a 128 × 96 screen, top to bottom, whose mean |screen − ref| over the row is more than 12. */
export function badRows(screen: ArrayLike<number>, ref: ArrayLike<number>): number[] {
  const rows: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    let sum = 0;
    for (let c = 0; c < COLS; c++) sum += Math.abs(screen[r * COLS + c]! - ref[r * COLS + c]!);
    if (sum / COLS > BAD_ROW) rows.push(r);
  }
  return rows;
}
