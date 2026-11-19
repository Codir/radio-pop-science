/**
 * The video signal. The camera's side writes a frame of cells line by line, with sync pulses; the monitor's
 * side finds the pulses in whatever has reached it and lays the lines on the screen by its own line rhythm.
 *
 * The signal u is a Float32Array at the channel rate: 0 is the bottom of a sync pulse, 0.3 black, 1 white.
 * A frame is 100 lines of 288 samples (`standard.ts`): 96 lines of the picture, then 4 of the frame mark.
 *
 * Nothing here draws a fault. Torn lines, a rolling picture and lost sync on the monitor's screen are what
 * this decoder makes of a damaged signal or of a wrong rhythm.
 */
import { createRng } from './rng';
import { COLS, FRAME_CH, FRAME_LINES, LEVEL, LINE, ROWS } from './standard';

const BLACK = LEVEL.black;
const WHITE = LEVEL.white;
/** Where the visible part of a line begins, samples from the start of the line: 7 + 21 + 26 = 54. */
const ACTIVE_FROM = LINE.front + LINE.sync + LINE.back;
/** Cells per sample of the visible part: 128 / 234. */
const CELLS_PER_SAMPLE = COLS / LINE.active;

/**
 * The stretch of 128 cells over 234 samples: sample k stands at p = (k + 0.5)·128/234 − 0.5 (cell c has its
 * middle at p = c) and takes cells ⌊p⌋ and ⌊p⌋ + 1 in the parts 1 − (p − ⌊p⌋) and p − ⌊p⌋; beyond the middle
 * of the first or of the last cell both are that edge cell.
 */
const STRETCH_LO = new Uint8Array(LINE.active);
const STRETCH_HI = new Uint8Array(LINE.active);
const STRETCH_MIX = new Float64Array(LINE.active);
for (let k = 0; k < LINE.active; k++) {
  const p = (k + 0.5) * CELLS_PER_SAMPLE - 0.5;
  const cell = Math.floor(p);
  STRETCH_LO[k] = Math.max(0, cell);
  STRETCH_HI[k] = Math.min(COLS - 1, cell + 1);
  STRETCH_MIX[k] = p - cell;
}

/**
 * The camera's side: one frame of 128 × 96 cells (`luma`, brightness 0…255, row 0 on top) as FRAME_CH samples
 * of u in `out`. A line of the picture is [front 7 × 0.3][sync 21 × 0][back 26 × 0.3][234 samples of its
 * row], a brightness b giving u = 0.3 + 0.7·b/255. Lines 96–99 are the frame mark,
 * [front 7 × 0.3][255 × 0][back 26 × 0.3]: its pulse falls where a picture line's does and lasts to the back
 * porch. A camera without its sync block (`sync: false`) puts 0.3 wherever a pulse would be.
 */
export function encodeFrame(luma: Uint8Array, out: Float32Array, opts: { sync: boolean }): void {
  if (luma.length !== COLS * ROWS) throw new RangeError(`encodeFrame: a frame of ${luma.length} cells`);
  if (out.length !== FRAME_CH) throw new RangeError(`encodeFrame: room for ${out.length} samples`);
  const front = LINE.front;
  const sync = LINE.sync;
  const back = LINE.back;
  const active = LINE.active;
  const mark = LINE.samples - front - back;
  const frameLines = FRAME_LINES;
  const rows = ROWS;
  const cols = COLS;
  const bottom = opts.sync ? LEVEL.sync : BLACK;
  const scale = (WHITE - BLACK) / 255;
  const lo = STRETCH_LO;
  const hi = STRETCH_HI;
  const mix = STRETCH_MIX;
  let at = 0;
  for (let line = 0; line < frameLines; line++) {
    for (let i = 0; i < front; i++) out[at++] = BLACK;
    if (line < rows) {
      for (let i = 0; i < sync; i++) out[at++] = bottom;
      for (let i = 0; i < back; i++) out[at++] = BLACK;
      const row = line * cols;
      for (let k = 0; k < active; k++) {
        const a = luma[row + lo[k]!]!;
        const b = luma[row + hi[k]!]!;
        out[at++] = BLACK + scale * (a + (b - a) * mix[k]!);
      }
    } else {
      for (let i = 0; i < mark; i++) out[at++] = bottom;
      for (let i = 0; i < back; i++) out[at++] = BLACK;
    }
  }
}

/** A pulse is seen once the signal has stayed below the threshold for this many samples… */
const PULSE_RUN = 10;
/** …and it is a frame mark once it has stayed there for this many. */
const MARK_RUN = 65;
/** A line has found its pulse when the pulse began within this many samples of its place. */
const FOUND_WITHIN = 16;
/** The monitor's own line length may be set within these bounds, samples. */
const LINE_MIN = 240;
const LINE_MAX = 336;
/** The wander of that length: a step of up to ±WANDER_STEP/2 a line, kept within ±WANDER_MAX samples. */
const WANDER_STEP = 0.02;
const WANDER_MAX = 0.05;
/** A cell is redrawn when the samples of a line covered more than this part of it. */
const MIN_COVER = 0.25;

export interface DecoderParams {
  /** The monitor's own line rhythm, samples per line, kept within 240…336; the camera's line has 288. */
  lineLength: number;
  /** How far the rhythm listens to sync pulses, kept within 0…1: the part of a pulse's error taken out. */
  trust: number;
  /** A sample below this level belongs to a sync pulse. */
  threshold: number;
  /** Line 0 of the camera begins this many samples after the first sample of the call. */
  delay: number;
}

/**
 * What one call saw. The three `line…` numbers keep the sign of `Meters`: positive moves the picture to the
 * left, the camera's cell (c, r) standing on the screen in column c − (lineOffset + r·lineDrift)·128/234 and
 * in row (r + lineRow) mod 100.
 */
export interface DecodeStats {
  /** Sync pulses seen, the frame marks among them. */
  pulses: number;
  /** Lines of the rhythm that found no pulse within 16 samples of its place. */
  lost: number;
  /** Lines the rhythm counted during the call. */
  lines: number;
  /** How many samples the start of the monitor's nearest line lags behind that of camera line 0, ±144. */
  lineOffset: number;
  /** How many samples that lag grows by with every line; 0 when the rhythm counted no line. */
  lineDrift: number;
  /**
   * The row of the screen, 0…99, that line 0 of the camera lands on; 0 when the call met a fourth frame mark
   * in a row.
   */
  lineRow: number;
}

export interface VideoDecoder {
  /**
   * Takes the next stretch of the received signal (in the chain, one frame of the camera) and redraws the
   * cells of `screen` (128 × 96, row 0 on top) that its lines covered; the other cells keep what they showed.
   * Returns the decoder's own object, which the next call fills anew; nothing is allocated.
   */
  process(video: Float32Array, p: DecoderParams, screen: Uint8Array): DecodeStats;
  /** Forgets the stream so far; after it the decoder repeats its output bit for bit. */
  reset(): void;
}

/**
 * The monitor's side. Its line rhythm is a phase `ph` that grows by one a sample; when it passes the line
 * length (the set length plus a small wander drawn from `seed`) the line is put on the screen and the next
 * begins. Every sample is shared among the cells its place in the line covers, by the length of the cover.
 * A sync pulse (ten samples in a row below the threshold) is set against the place where the rhythm expects
 * it, and the rhythm takes out the part `trust` of the difference. A pulse 65 samples long is a frame mark:
 * the marks are lines 96–99, so the line after the fourth is the top row of the screen.
 */
export function createDecoder(seed: number): VideoDecoder {
  const acc = new Float64Array(COLS); // Σ sample · cover, for every cell of the line being drawn
  const weight = new Float64Array(COLS); // Σ cover
  const stats: DecodeStats = { pulses: 0, lost: 0, lines: 0, lineOffset: 0, lineDrift: 0, lineRow: 0 };
  let rng = createRng(seed);
  let n = 0; // samples since the reset, modulo the camera's line
  // The state of the stream between calls. `process` copies it into locals of the same names without `last`,
  // the fractional numbers through a unary plus, and writes them back after its loop. V8 stores such a number
  // in a closure variable as a new heap number every time, and a plain copy of one has no type the compiler
  // can see, so the loop would keep the copy boxed as well. Either way `ph` and `prev`, which change at every
  // sample, would allocate about 0.9 MB a frame; with the plus the loop keeps them unboxed (Node 24, measured).
  let lastPh = 0; // phase of the rhythm, samples since its line began
  let lastLine = 0; // the line of the frame the rhythm is on, 0…99
  let lastRun = 0; // samples in a row below the threshold
  let lastMarks = 0; // frame marks in a row, 3 at most
  let lastWander = 0; // what the wander adds to the line length now
  let lastPrev: number = BLACK; // the sample before
  let lastFrac = 0.5; // where between two samples the signal went below the threshold
  let lastFound = false; // has the line being drawn found its pulse

  return {
    process(video, p, screen) {
      if (screen.length !== COLS * ROWS) throw new RangeError(`decoder: a screen of ${screen.length} cells`);
      const { lineLength: setLength, trust: setTrust, threshold, delay } = p;
      const finite = Number.isFinite;
      if (!(finite(setLength) && finite(setTrust) && finite(threshold) && finite(delay)))
        throw new RangeError(
          `decoder: line length ${setLength}, trust ${setTrust}, threshold ${threshold}, delay ${delay}`,
        );
      const lineLength = Math.min(LINE_MAX, Math.max(LINE_MIN, setLength));
      const trust = Math.min(1, Math.max(0, setTrust));
      const samples = LINE.samples;
      const front = LINE.front;
      const rows = ROWS;
      const cols = COLS;
      const frameLines = FRAME_LINES;
      const from = ACTIVE_FROM;
      const step = CELLS_PER_SAMPLE;
      const black = BLACK;
      const levels = 255 / (WHITE - BLACK);
      const count = video.length;
      // the plus is not redundant: it gives the compiler a number to start the loop from (see above)
      let ph = +lastPh;
      let line = lastLine;
      let run = lastRun;
      let marks = lastMarks;
      let wander = +lastWander;
      let prev = +lastPrev;
      let frac = +lastFrac;
      let found = lastFound;
      const n0 = n;
      const ph0 = ph;
      const line0 = line;
      let pulses = 0;
      let lost = 0;
      let counted = 0;
      let drift = 0; // Σ (P − 288) over the lines counted
      let pull = 0; // Σ of what the pulses took out of the phase
      let held = false;
      let period = lineLength + wander;

      for (let i = 0; i < count; i++) {
        const v = video[i]!;
        if (v < threshold) {
          run++;
          if (run === 1) {
            frac = prev > v ? (prev - threshold) / (prev - v) : 0.5;
            if (Number.isNaN(frac)) frac = 0.5; // a sample without end must not reach the phase
          } else if (run === PULSE_RUN) {
            // the start of the pulse against its place in the line, within half a line either way
            let err = ph - (PULSE_RUN - 0.5) + frac - front;
            err -= period * Math.round(err / period);
            const take = trust * err;
            ph -= take;
            pull += take;
            pulses++;
            if (Math.abs(err) <= FOUND_WITHIN) found = true;
          } else if (run === MARK_RUN) {
            // four frame marks in a row are lines 96…99
            if (marks === 3) held = true;
            line = rows + marks;
            if (marks < 3) marks++;
          }
        } else {
          if (run >= PULSE_RUN && run < MARK_RUN) marks = 0;
          run = 0;
        }
        prev = v;

        if (line < rows) {
          // the sample covers [left, left + step) of the row, cell c being [c, c + 1); step < 1
          const left = (ph - from) * step;
          const right = left + step;
          const c0 = Math.floor(left);
          const c1 = Math.floor(right);
          if (c0 === c1) {
            if (c0 >= 0 && c0 < cols) {
              acc[c0] += v * step;
              weight[c0] += step;
            }
          } else {
            if (c0 >= 0 && c0 < cols) {
              acc[c0] += v * (c1 - left);
              weight[c0] += c1 - left;
            }
            if (c1 >= 0 && c1 < cols) {
              acc[c1] += v * (right - c1);
              weight[c1] += right - c1;
            }
          }
        }

        ph += 1;
        if (ph >= period) {
          ph -= period;
          if (line < rows) {
            const row = line * cols;
            for (let c = 0; c < cols; c++) {
              if (weight[c]! > MIN_COVER) {
                const level = Math.round((acc[c]! / weight[c]! - black) * levels);
                screen[row + c] = level < 0 ? 0 : level > 255 ? 255 : level;
              }
            }
          }
          acc.fill(0);
          weight.fill(0);
          if (!found) lost++;
          found = false;
          counted++;
          line = line + 1 === frameLines ? 0 : line + 1;
          drift += period - samples;
          const moved = wander + (rng.float() - 0.5) * WANDER_STEP;
          wander = moved < -WANDER_MAX ? -WANDER_MAX : moved > WANDER_MAX ? WANDER_MAX : moved;
          period = lineLength + wander;
        }
      }
      lastPh = ph;
      lastLine = line;
      lastRun = run;
      lastMarks = marks;
      lastWander = wander;
      lastPrev = prev;
      lastFrac = frac;
      lastFound = found;

      // the monitor's line nearest to the start of the camera's line 0 is k lines after the one it was on
      const behind = (n0 % samples) - ph0 - delay;
      const k = Math.round(-behind / samples);
      n = (n0 + count) % samples;
      stats.pulses = pulses;
      stats.lost = lost;
      stats.lines = counted;
      stats.lineOffset = behind + samples * k;
      stats.lineDrift = counted > 0 ? (drift + pull) / counted : 0;
      stats.lineRow = held ? 0 : (((line0 + k) % frameLines) + frameLines) % frameLines;
      return stats;
    },
    reset() {
      acc.fill(0);
      weight.fill(0);
      rng = createRng(seed);
      n = 0;
      lastPh = 0;
      lastLine = 0;
      lastRun = 0;
      lastMarks = 0;
      lastWander = 0;
      lastPrev = BLACK;
      lastFrac = 0.5;
      lastFound = false;
    },
  };
}
