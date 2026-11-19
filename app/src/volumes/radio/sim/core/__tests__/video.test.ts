import { describe, expect, it } from 'vitest';
import reference from '../__fixtures__/video-lines.json';
import { COLS, FRAME_CH, LINE, ROWS } from '../standard';
import {
  createDecoder,
  type DecoderParams,
  type DecodeStats,
  encodeFrame,
  type VideoDecoder,
} from '../video';
import { centre, FLAT, FRAME, PLACES } from './helpers';

const CELLS = COLS * ROWS;
const LEN = LINE.samples;

/** The signal u of one frame of the camera. */
function encode(luma: Uint8Array, sync = true): Float32Array {
  const u = new Float32Array(FRAME_CH);
  encodeFrame(luma, u, { sync });
  return u;
}

/**
 * A new createDecoder(seed) is given `stream` `frames` times with `{ delay: 0, ...params }`, on a screen of
 * zeros: the screen, the numbers of the last call, and a copy of the numbers of every call (the decoder fills
 * its own object anew on each call).
 */
function decode(
  stream: Float32Array,
  params: Omit<DecoderParams, 'delay'> & { delay?: number },
  frames: number,
  seed = 1,
): { screen: Uint8Array; stats: DecodeStats; history: DecodeStats[] } {
  const decoder = createDecoder(seed);
  const screen = new Uint8Array(CELLS);
  const history: DecodeStats[] = [];
  for (let i = 0; i < frames; i++)
    history.push({ ...decoder.process(stream, { delay: 0, ...params }, screen) });
  return { screen, stats: history[frames - 1]!, history };
}

/** The largest |screen − FRAME| over the flat cells of the test frame. */
function worstFlat(screen: Uint8Array): number {
  let worst = 0;
  for (let i = 0; i < CELLS; i++) if (FLAT[i]) worst = Math.max(worst, Math.abs(screen[i]! - FRAME[i]!));
  return worst;
}

/** The frame «white band»: columns 40–59 are 255, the rest 0; its centre of mass is column 49.5. */
function bandFrame(): Uint8Array {
  const band = new Uint8Array(CELLS);
  for (let r = 0; r < ROWS; r++) band.fill(255, r * COLS + 40, r * COLS + 60);
  return band;
}

/** Row r of the frame of stripes is all of one brightness: 0 on top … 255 at the bottom. */
const stripe = (r: number): number => Math.round((r * 255) / (ROWS - 1));
function stripesFrame(): Uint8Array {
  const stripes = new Uint8Array(CELLS);
  for (let r = 0; r < ROWS; r++) stripes.fill(stripe(r), r * COLS, (r + 1) * COLS);
  return stripes;
}

/** The same endless stream, begun `start` samples later. */
function rotate(stream: Float32Array, start: number): Float32Array {
  const out = new Float32Array(stream.length);
  out.set(stream.subarray(start));
  out.set(stream.subarray(0, start), stream.length - start);
  return out;
}

/** The frame `u` with the first of its four frame marks only: lines 97–99 are copies of picture line 95. */
function oneMark(u: Float32Array): Float32Array {
  const out = u.slice();
  for (const line of [97, 98, 99]) out.copyWithin(line * LEN, 95 * LEN, 96 * LEN);
  return out;
}

/**
 * How far calls that follow each other disagree, samples: a call's lineOffset must be the one before it plus
 * its lineDrift over its lines, give or take whole lines of the camera.
 */
function slip(history: DecodeStats[]): number {
  let worst = 0;
  for (let i = 1; i < history.length; i++) {
    const before = history[i - 1]!;
    const off = history[i]!.lineOffset - before.lineOffset - before.lineDrift * before.lines;
    worst = Math.max(worst, Math.abs(off - LEN * Math.round(off / LEN)));
  }
  return worst;
}

describe('video', () => {
  it('рядок складено з поличок, синхроімпульсу й видимої частини', () => {
    const u = encode(FRAME);
    expect(Array.from(u.subarray(0, 7))).toEqual(Array(7).fill(Math.fround(0.3)));
    expect(Math.max(...u.subarray(7, 28))).toBe(0);
    expect(u[28]).toBeCloseTo(0.3, 6);
    expect(u[53]).toBeCloseTo(0.3, 6);
    expect(u[54]).toBeCloseTo(0.4098, 4);
    const m = 96 * 288;
    expect(Math.max(...u.subarray(m + 7, m + 262))).toBe(0);
    expect(u[m + 262]).toBeCloseTo(0.3, 6);
    const noSync = encode(FRAME, false);
    expect(Math.min(...noSync)).toBeCloseTo(0.3, 6);

    // without the sync block the camera differs exactly where the pulses were: 96 · 21 + 4 · 255 samples at 0
    let pulses = 0;
    let other = 0;
    for (let i = 0; i < FRAME_CH; i++) {
      if (u[i] === 0) pulses++;
      if (u[i] !== noSync[i] && !(u[i] === 0 && noSync[i] === Math.fround(0.3))) other++;
    }
    expect([pulses, other]).toEqual([96 * 21 + 4 * 255, 0]);
    // the stretch: at the two ends of a row a sample is the edge cell alone (the ramp is 0, 2, … 253, 255)
    const ramp = PLACES.ramp[1]! * LEN + 54;
    expect(u[ramp]).toBeCloseTo(0.3, 6);
    expect(u[ramp + 1]).toBeGreaterThan(0.3001);
    expect(u[ramp + 232]).toBeLessThan(0.9999);
    expect(u[ramp + 233]).toBeCloseTo(1, 6);
    // every line of the picture comes from its own row of cells
    const stripes = encode(stripesFrame());
    for (let r = 0; r < ROWS; r++) {
      const want = 0.3 + (0.7 * stripe(r)) / 255;
      const seen = stripes.subarray(r * LEN + 54, (r + 1) * LEN);
      expect(Math.max(...seen.map((v) => Math.abs(v - want))), `row ${r}`).toBeLessThan(1e-6);
    }
    // a frame or a buffer of another size is refused
    expect(() => encodeFrame(new Uint8Array(CELLS - 1), new Float32Array(FRAME_CH), { sync: true })).toThrow(
      RangeError,
    );
    expect(() => encodeFrame(FRAME, new Float32Array(FRAME_CH + 1), { sync: true })).toThrow(RangeError);
  });

  it('збігається з еталоном', () => {
    // video-lines.json is written by tools/ref-models/radio/fm_chain.py from the plan, not from video.ts
    const worst = (u: Float32Array, line: string, want: readonly number[]): number => {
      const at = Number(line) * LEN;
      return Math.max(...want.map((v, i) => Math.abs(u[at + i]! - v)));
    };
    const u = encode(FRAME);
    const noSync = encode(FRAME, false);
    expect(Object.keys(reference.lines).sort()).toEqual(['0', '50', '96']);
    expect(Object.keys(reference.noSync)).toEqual(['0']);
    for (const [line, want] of Object.entries(reference.lines)) {
      expect(want, `line ${line}`).toHaveLength(LEN);
      expect(worst(u, line, want), `line ${line}`).toBeLessThanOrEqual(1e-4);
    }
    expect(reference.noSync['0']).toHaveLength(LEN);
    expect(worst(noSync, '0', reference.noSync['0'])).toBeLessThanOrEqual(1e-4);
  });

  it('кадр туди й назад', () => {
    const u = encode(FRAME);
    const { screen, stats } = decode(u, { lineLength: 288, trust: 0.25, threshold: 0.15 }, 3);
    expect(stats.lost).toBe(0);
    expect(stats.pulses).toBe(100);
    // the boundary of a line falls now on the last sample of a call, now on the first of the next
    expect(Math.abs(stats.lines - 100)).toBeLessThanOrEqual(1);
    expect(stats.lineRow).toBe(0);
    expect(worstFlat(screen)).toBeLessThanOrEqual(3);
    // pickets one cell wide come back with less contrast; the spot on the forehead of the cat stays brighter
    const [c0, r0, c1, r1] = PLACES.pickets;
    let dimmestLight = 255;
    let brightestDark = 0;
    for (let r = r0!; r <= r1!; r++)
      for (let c = c0!; c <= c1!; c++) {
        const i = r * COLS + c;
        if (FRAME[i] === 255) dimmestLight = Math.min(dimmestLight, screen[i]!);
        else brightestDark = Math.max(brightestDark, screen[i]!);
      }
    expect(dimmestLight).toBeGreaterThanOrEqual(160);
    expect(brightestDark).toBeLessThanOrEqual(95);
    const spot = PLACES.spot[1]! * COLS + PLACES.spot[0]!;
    expect(screen[spot]).toBeGreaterThanOrEqual(190);
    expect(Math.max(screen[spot - 1]!, screen[spot + 1]!)).toBeLessThanOrEqual(140);

    // the stream may be cut anywhere, inside a pulse too: the same screen, the counts of the pieces add up,
    // the offsets agree, and the next call goes on as if nothing was cut. The cuts: inside a picture line;
    // just before the pulse of line 20, whose front porch ends at 0.2; 5 samples into the pulse of line 46;
    // 33 samples into the pulse of the mark line 97
    const p = { lineLength: 288, trust: 0.25, threshold: 0.15, delay: 0 };
    const sloped = u.slice();
    sloped[20 * LEN + 6] = 0.2;
    const two = decode(sloped, p, 2);
    const three = decode(sloped, p, 3);
    const decoder = createDecoder(1);
    const cut = new Uint8Array(CELLS);
    const first = decoder.process(sloped, p, cut);
    const pieces: DecodeStats[] = [];
    for (const [from, to] of [
      [0, 1000],
      [1000, 20 * LEN + 7],
      [20 * LEN + 7, 46 * LEN + 12],
      [46 * LEN + 12, 97 * LEN + 40],
      [97 * LEN + 40, FRAME_CH],
    ] as const)
      pieces.push({ ...decoder.process(sloped.subarray(from, to), p, cut) });
    expect(cut).toEqual(two.screen);
    for (const name of ['pulses', 'lost', 'lines'] as const)
      expect(
        pieces.reduce((sum, s) => sum + s[name], 0),
        name,
      ).toBe(two.stats[name]);
    expect(slip(pieces)).toBeLessThan(1e-6);
    // the numbers come in the decoder's own object: a call makes no new one
    const next = decoder.process(sloped, p, cut);
    expect(next).toBe(first);
    expect({ ...next }).toEqual(three.stats);
    expect(cut).toEqual(three.screen);

    // after reset() the decoder repeats itself bit for bit, whatever it was in the middle of
    const twice = (
      monitor: VideoDecoder,
      stream: Float32Array,
    ): { stats: DecodeStats; screen: Uint8Array }[] => {
      const shown = new Uint8Array(CELLS);
      return [0, 1].map(() => ({ stats: { ...monitor.process(stream, p, shown) }, screen: shown.slice() }));
    };
    const lone = oneMark(u);
    const toMark = rotate(lone, 96 * LEN - 60); // its only frame mark comes before any other pulse
    const onSlope = rotate(lone, 7); // begins inside the pulse of line 0, its first sample half way down
    onSlope[0] = 0.1;
    for (const before of [
      u.subarray(0, 50 * LEN + 200), // stops in the middle of a picture line whose pulse was found
      u.subarray(0, 98 * LEN + 19), // stops inside the pulse of the third mark line, two marks counted
    ])
      for (const after of [toMark, onSlope]) {
        const used = createDecoder(1);
        used.process(u, p, new Uint8Array(CELLS));
        used.process(before, p, new Uint8Array(CELLS));
        used.reset();
        expect(twice(used, after)).toEqual(twice(createDecoder(1), after));
      }
  });

  it('без синхроімпульсів рядки пливуть', () => {
    const { screen, stats } = decode(
      encode(bandFrame(), false),
      { lineLength: 288.5, trust: 0.25, threshold: 0.15 },
      1,
    );
    expect(stats.pulses).toBe(0);
    expect(stats.lost).toBe(stats.lines);
    expect(Math.abs(stats.lineDrift - 0.5)).toBeLessThan(0.06);
    expect(centre(screen, 10) - centre(screen, 30)).toBeGreaterThan(4.87);
    expect(centre(screen, 10) - centre(screen, 30)).toBeLessThan(6.07); // 20 lines · 0.2735 of a cell

    // the rhythm's own length wanders with the seed, within 0.05 of a sample to both sides
    const black = new Float32Array(FRAME_CH).fill(0.3);
    const drifts = (seed: number): number[] =>
      decode(black, { lineLength: 288, trust: 0.25, threshold: 0.15 }, 40, seed).history.map(
        (s) => s.lineDrift,
      );
    const one = drifts(1);
    expect(drifts(1)).toEqual(one);
    expect(drifts(2)).not.toEqual(one);
    expect(Math.max(...one.map(Math.abs))).toBeLessThanOrEqual(0.05);
    expect(Math.min(...one)).toBeLessThan(-0.01);
    expect(Math.max(...one)).toBeGreaterThan(0.01);
  });

  it('підстроювання тримає чужу довжину рядка', () => {
    const u = encode(FRAME);
    const { stats, history } = decode(u, { lineLength: 290, trust: 0.25, threshold: 0.15 }, 4);
    expect(stats.lost).toBe(0);
    expect(stats.lineOffset).toBeGreaterThan(5);
    expect(stats.lineOffset).toBeLessThan(7);
    expect(Math.abs(stats.lineDrift)).toBeLessThan(0.05);
    expect(slip(history)).toBeLessThan(1e-6);

    // the picture stands where the number says: lineOffset samples to the left
    const band = decode(encode(bandFrame()), { lineLength: 290, trust: 0.25, threshold: 0.15 }, 4);
    const left = ((49.5 - centre(band.screen, 50)) * LINE.active) / COLS;
    expect(Math.abs(left - band.stats.lineOffset)).toBeLessThan(0.3);

    // the signal comes 33 samples late and the decoder is told so: the same numbers
    const late = decode(
      rotate(u, FRAME_CH - 33),
      { lineLength: 290, trust: 0.25, threshold: 0.15, delay: 33 },
      4,
    );
    expect(late.stats.lost).toBe(0);
    expect(late.stats.lineOffset).toBeGreaterThan(5);
    expect(late.stats.lineOffset).toBeLessThan(7);
    expect(late.stats.lineRow).toBe(0);

    // a pulse begins where the signal crosses the threshold, to a part of a sample (trust 1 stands on it)
    const edge = (at: number, level: number): number => {
      const sloped = u.slice();
      for (let line = 0; line < 100; line++) sloped[line * LEN + at] = level;
      return decode(sloped, { lineLength: 288, trust: 1, threshold: 0.15 }, 3).stats.lineOffset;
    };
    expect(Math.abs(edge(6, 0.2) + 0.25)).toBeLessThan(0.06); // 0.3, 0.2, 0: a quarter of a sample earlier
    expect(Math.abs(edge(7, 0.06) - 0.125)).toBeLessThan(0.06); // 0.3, 0.06, 0: an eighth of a sample later
  });

  it('вікно захоплення за довіри 0,25 — три відліки на рядок', () => {
    const u = encode(FRAME);
    const at = (n: number): DecodeStats =>
      decode(u, { lineLength: n, trust: 0.25, threshold: 0.15 }, 4).stats;
    for (const n of [285, 291]) expect(at(n).lost).toBe(0);
    for (const n of [283, 293]) {
      expect(at(n).lost).toBe(at(n).lines);
      expect(Math.abs(at(n).lineDrift)).toBeLessThan(0.05);
    } // the picture stands, but more than 16 samples away from its place
  });

  it('без довіри синхроімпульси видно, але ритм їх не слухає', () => {
    const { stats, history } = decode(encode(FRAME), { lineLength: 288.5, trust: 0, threshold: 0.15 }, 6);
    const meanLostShare = history.reduce((sum, s) => sum + s.lost / s.lines, 0) / history.length;
    expect(stats.pulses).toBe(100);
    expect(meanLostShare).toBeGreaterThan(0.5);
    expect(Math.abs(stats.lineDrift - 0.5)).toBeLessThan(0.06);
    expect(slip(history)).toBeLessThan(1e-6);

    // ten samples in a row below the threshold make a pulse, nine do not
    const dip = (length: number): number => {
      const stream = new Float32Array(FRAME_CH).fill(0.3);
      stream.fill(0, 1000, 1000 + length);
      return decode(stream, { lineLength: 288, trust: 0.25, threshold: 0.15 }, 1).stats.pulses;
    };
    expect([dip(9), dip(10), dip(64), dip(300)]).toEqual([0, 1, 1, 1]);
  });

  it('чорний і білий кадр тримають ритм', () => {
    for (const level of [0, 255]) {
      const { screen, stats } = decode(
        encode(new Uint8Array(CELLS).fill(level)),
        { lineLength: 288, trust: 0.25, threshold: 0.15 },
        3,
      );
      expect(stats.lost).toBe(0);
      let worst = 0;
      for (let r = 0; r < ROWS; r++)
        for (let c = 1; c <= 126; c++) worst = Math.max(worst, Math.abs(screen[r * COLS + c]! - level));
      expect(worst, `level ${level}`).toBeLessThanOrEqual(1);
    }
  });

  it('кадрова позначка ставить рядки на місце', () => {
    const by = 30 * LEN; // the stream begins with line 30 of the camera
    const u = encode(FRAME);
    const { screen, stats } = decode(rotate(u, by), { lineLength: 288, trust: 0.25, threshold: 0.15 }, 3);
    expect(worstFlat(screen)).toBeLessThanOrEqual(3);
    expect(stats.lineRow).toBe(0);

    // without the mark nothing tells the monitor where the frame begins
    const noSync = encode(FRAME, false);
    const decoder = createDecoder(1);
    const params = { lineLength: 288, trust: 0.25, threshold: 0.15, delay: 0 };
    const screen2 = new Uint8Array(CELLS).fill(7);
    decoder.process(noSync.subarray(0, by), params, screen2);
    // the rows no line of the call has reached keep what they showed
    expect(Array.from(new Set(screen2.subarray(30 * COLS)))).toEqual([7]);
    const s2 = decoder.process(noSync, params, screen2);
    expect(s2.lineRow).toBe(30);

    // …and the picture has rolled: row r of the camera is row r + 30 of the screen, the bottom of the frame
    // is on top, and the four lines of the mark, black without the sync block, are rows 26–29. The wander of
    // the seed decides whether the 30th line ends with the first call or with the first sample of the second;
    // the row is the same. It also decides whether the last line, row 29, ends with the second call or just
    // after it: a row goes on the screen when its line ends, and until then row 29 keeps the first call's.
    const rolled = encode(stripesFrame(), false);
    const want = Array.from({ length: ROWS }, (_, r) =>
      r >= 30 ? stripe(r - 30) : r < 26 ? stripe(r + 70) : 0,
    );
    const notLast = (_: number, r: number): boolean => r !== 29;
    for (let seed = 1; seed <= 8; seed++) {
      const monitor = createDecoder(seed);
      const shown = new Uint8Array(CELLS);
      monitor.process(rolled.subarray(0, by), params, shown);
      expect(monitor.process(rolled, params, shown).lineRow, `seed ${seed}`).toBe(30);
      const middle = Array.from({ length: ROWS }, (_, r) => shown[r * COLS + 64]!);
      expect(middle.filter(notLast), `seed ${seed}`).toEqual(want.filter(notLast));
      expect([0, stripe(29)], `seed ${seed}`).toContain(middle[29]);
    }

    // one mark of the four still puts the lines in place, but it does not hold the frame: lineRow is the row
    // the rhythm counts for the first line of the call
    const lone = decode(rotate(oneMark(u), by), { lineLength: 288, trust: 0.25, threshold: 0.15 }, 3);
    expect(worstFlat(lone.screen)).toBeLessThanOrEqual(3);
    expect(lone.stats.lineRow).toBe(30);
  });

  it('крайні довжини рядка й довіра', () => {
    const u = encode(FRAME);
    for (const lineLength of [280, 296])
      for (const trust of [0, 1]) {
        const { stats, history } = decode(u, { lineLength, trust, threshold: 0.15 }, 3);
        for (const s of history)
          for (const [name, value] of Object.entries(s))
            expect(Number.isFinite(value), `${name} at ${lineLength}, trust ${trust}`).toBe(true);
        if (trust === 1) expect(stats.lost, `at ${lineLength}`).toBe(0);
      }
    const base = { lineLength: 288, trust: 0.25, threshold: 0.15, delay: 0 };
    const empty = createDecoder(1).process(new Float32Array(0), base, new Uint8Array(CELLS));
    expect(empty.lines).toBe(0);
    expect(empty.lineDrift).toBe(0);

    // the length is kept within 240…336 and the trust within 0…1
    const black = new Float32Array(FRAME_CH).fill(0.3);
    const drift = (lineLength: number): number =>
      decode(black, { lineLength, trust: 0.25, threshold: 0.15 }, 1).stats.lineDrift;
    expect(Math.abs(drift(100) + 48)).toBeLessThan(0.06);
    expect(Math.abs(drift(1000) - 48)).toBeLessThan(0.06);
    for (const [beyond, edge] of [
      [-1, 0],
      [5, 1],
    ] as const) {
      const a = decode(u, { lineLength: 290, trust: beyond, threshold: 0.15 }, 2);
      const b = decode(u, { lineLength: 290, trust: edge, threshold: 0.15 }, 2);
      expect(a.history, `trust ${beyond}`).toEqual(b.history);
      expect(a.screen, `trust ${beyond}`).toEqual(b.screen);
    }
    // a new length acts at once: 144 samples into a line of 288, a line of 240 ends 96 samples later
    const turned = createDecoder(1);
    turned.process(black.subarray(0, 144), base, new Uint8Array(CELLS));
    expect(
      turned.process(black.subarray(0, 95), { ...base, lineLength: 240 }, new Uint8Array(CELLS)).lines,
    ).toBe(0);
    expect(
      turned.process(black.subarray(0, 1), { ...base, lineLength: 240 }, new Uint8Array(CELLS)).lines,
    ).toBe(1);

    // a cell is redrawn only when the line covered more than a quarter of it; the rest keep what they showed.
    // With trust 1 the white frame's lines stand on the pulses; at 280.5 the last sample of a line covers
    // cell 124 by 0.17, at 281.5 the last two cover it by 0.72, and cell 125 is never reached
    const white = encode(new Uint8Array(CELLS).fill(255));
    const edgeOf = (lineLength: number): number[][] => {
      const monitor = createDecoder(1);
      const shown = new Uint8Array(CELLS).fill(7);
      for (let i = 0; i < 3; i++) monitor.process(white, { ...base, lineLength, trust: 1 }, shown);
      return [123, 124, 125].map((c) =>
        Array.from(new Set(Array.from({ length: ROWS }, (_, r) => shown[r * COLS + c]!))),
      );
    };
    expect(edgeOf(280.5)).toEqual([[255], [7], [7]]);
    expect(edgeOf(281.5)).toEqual([[255], [255], [7]]);

    // below black is black, above white is white
    for (const [level, want] of [
      [0, 0],
      [2, 255],
    ] as const) {
      const shown = new Uint8Array(CELLS).fill(7);
      createDecoder(1).process(new Float32Array(FRAME_CH).fill(level), { ...base, threshold: -1 }, shown);
      expect(Array.from(new Set(shown)), `level ${level}`).toEqual([want]);
    }

    // a sample without end does not reach the rhythm
    const endless = u.slice();
    endless[6] = Infinity;
    for (const s of decode(endless, base, 2).history) {
      expect(s.pulses).toBe(100);
      for (const [name, value] of Object.entries(s)) expect(Number.isFinite(value), name).toBe(true);
    }

    // parameters that are not numbers and a screen of another size are refused
    const monitor = createDecoder(1);
    for (const name of ['lineLength', 'trust', 'threshold', 'delay'] as const)
      for (const bad of [NaN, Infinity])
        expect(() => monitor.process(u, { ...base, [name]: bad }, new Uint8Array(CELLS)), name).toThrow(
          RangeError,
        );
    expect(() => monitor.process(u, base, new Uint8Array(CELLS + 1))).toThrow(RangeError);
  });
});
