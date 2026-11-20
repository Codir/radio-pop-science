/**
 * The melody of the volume (`music.ts`), the player that plays it on the board, and the model playing it in blocks
 * at the audio rate: the melody is the same at every render, stays within ±1, has low and high notes in it, loops and
 * starts from silence; the player gives the melody times its amplitude behind 32 Ω; blocks of a run are one long run,
 * and a run in blocks reuses its arrays.
 */
import { describe, expect, it } from 'vitest';
import {
  AMPLIFIER_NODES,
  amplifierNetlist,
  MELODY_PEAK,
  MELODY_SECONDS,
  melodyAt,
  PARTS,
  renderMelody,
  solveDC,
  Transient,
  type Netlist,
  type Probe,
} from '../index';

function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

/** How many samples of `a` and `b` differ in any bit. */
function differing(a: Float32Array | Float64Array, b: Float32Array | Float64Array): number {
  expect(a.length).toBe(b.length);
  let count = 0;
  for (let k = 0; k < a.length; k++) if (!Object.is(a[k], b[k])) count++;
  return count;
}

const rms = (x: Float64Array): number => Math.sqrt(x.reduce((sum, v) => sum + v * v, 0) / x.length);

/** A simple filter for the test: two second-order Butterworth sections (the biquads of R. Bristow-Johnson's «Audio EQ
 * Cookbook», Q = 1/√2) in a row — a low-pass or a high-pass of the fourth order at `hertz`. */
function band(x: Float64Array, fs: number, hertz: number, high: boolean): Float64Array {
  const w = (2 * Math.PI * hertz) / fs;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) * Math.SQRT1_2;
  const b0 = (high ? 1 + cos : 1 - cos) / 2;
  const b1 = high ? -(1 + cos) : 1 - cos;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let y = x;
  for (let section = 0; section < 2; section++) {
    const out = new Float64Array(y.length);
    let [x1, x2, y1, y2] = [0, 0, 0, 0];
    for (let k = 0; k < y.length; k++) {
      const x0 = y[k]!;
      const y0 = (b0 * x0 + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
      out[k] = y0;
      [x2, x1, y2, y1] = [x1, x0, y1, y0];
    }
    y = out;
  }
  return y;
}

/** The share of the RMS of `x` below 150 Hz and above 2 kHz. */
function bands(x: Float64Array, fs: number): { low: number; high: number } {
  const whole = rms(x);
  return { low: rms(band(x, fs, 150, false)) / whole, high: rms(band(x, fs, 2000, true)) / whole };
}

const RATE = 48000;
const LOOP = MELODY_SECONDS * RATE;

describe('the melody', () => {
  it('is the same at every render: two renders bit for bit, and blocks from any sample are one long render', () => {
    expect(MELODY_SECONDS).toBe(8);
    const one = renderMelody(RATE, 0, LOOP, new Float64Array(LOOP));
    const two = renderMelody(RATE, 0, LOOP, new Float64Array(LOOP));
    expect(differing(one, two)).toBe(0);
    // in blocks of 2048 into one array of the stand's, which comes back each time: nothing new is made
    const block = new Float64Array(2048);
    const blocks = new Float64Array(LOOP);
    for (let start = 0; start < LOOP; start += block.length) {
      const n = Math.min(block.length, LOOP - start);
      expect(renderMelody(RATE, start, n, block)).toBe(block);
      blocks.set(block.subarray(0, n), start);
    }
    expect(differing(blocks, one)).toBe(0);
    // into a Float32Array of a sound output too: the same numbers, rounded to its precision
    const narrow = renderMelody(RATE, 0, 4096, new Float32Array(4096));
    for (let k = 0; k < 4096; k++) expect(narrow[k]).toBe(Math.fround(one[k]!));
  });

  it('stays within ±1: its loudest moment is MELODY_PEAK, 0.98, at every rate', () => {
    expect(MELODY_PEAK).toBe(0.98);
    for (const fs of [24000, 48000, 96000, 192000]) {
      const x = renderMelody(fs, 0, MELODY_SECONDS * fs, new Float64Array(MELODY_SECONDS * fs));
      let peak = 0;
      for (const v of x) peak = Math.max(peak, Math.abs(v));
      expect(peak, `${fs} Hz`).toBeLessThanOrEqual(MELODY_PEAK + 1e-6);
      // the loudest moment falls on a sample of 48 kHz; 24 kHz steps over it
      expect(peak, `${fs} Hz`).toBeGreaterThan(fs === 24000 ? 0.95 : MELODY_PEAK - 1e-6);
    }
  });

  it('has a bass below 150 Hz and high notes above 2 kHz, which a tone of the middle has not', () => {
    for (const fs of [24000, 48000]) {
      const melody = bands(renderMelody(fs, 0, MELODY_SECONDS * fs, new Float64Array(MELODY_SECONDS * fs)), fs);
      // 0.77 of its RMS is below 150 Hz, 0.12 above 2 kHz
      expect(melody.low, `${fs} Hz: below 150 Hz`).toBeGreaterThan(0.5);
      expect(melody.high, `${fs} Hz: above 2 kHz`).toBeGreaterThan(0.08);
      // the filters tell the bands apart: a tone of 600 Hz has next to nothing in either
      const tone = new Float64Array(fs).map((_, k) => Math.sin((2 * Math.PI * 600 * k) / fs));
      const middle = bands(tone, fs);
      expect(middle.low).toBeLessThan(0.01);
      expect(middle.high).toBeLessThan(0.01);
    }
  });

  it('starts from silence, loops every eight seconds and never jumps', () => {
    expect(melodyAt(0)).toBe(0); // so the operating point of a board with the player is its rest
    const start = renderMelody(RATE, 0, 4096, new Float64Array(4096));
    const again = renderMelody(RATE, 3 * LOOP, 4096, new Float64Array(4096));
    // the same to the rounding of the moment: 24 s carry a few femtoseconds less precision than 0 s
    for (let k = 0; k < 4096; k++) close(again[k], start[k]!, 1e-10, `sample ${k} three loops on`);
    close(melodyAt(-1), melodyAt(MELODY_SECONDS - 1), 1e-15, 'and before the start');
    // every note rises from 0 and falls back to 0: where notes begin and end, on the grid of sixteenths (and at the
    // turn of the loop), the melody is continuous to its slope over two nanoseconds…
    for (let slot = 0; slot <= 64; slot++) {
      const t = slot / 8;
      close(melodyAt(t + 1e-9), melodyAt(t - 1e-9), 1e-4, `at the sixteenth ${slot}`);
    }
    // …and nowhere does it jump: the largest step between neighbouring samples halves with the sample (0.07 at
    // 192 kHz: the snare's noise, its numbers 48 000 a second joined by straight lines), as no jump would
    const largestStep = (fs: number): number => {
      const x = renderMelody(fs, 0, MELODY_SECONDS * fs, new Float64Array(MELODY_SECONDS * fs));
      let step = Math.abs(x[0]! - melodyAt(-1 / fs));
      for (let k = 1; k < x.length; k++) step = Math.max(step, Math.abs(x[k]! - x[k - 1]!));
      return step;
    };
    const coarse = largestStep(192000);
    expect(coarse).toBeLessThan(0.1);
    close(largestStep(384000) / coarse, 0.5, 0.02, 'half the sample, half the largest step');
  });

  it('a block it cannot render is a RangeError', () => {
    const out = new Float32Array(16);
    expect(() => renderMelody(0, 0, 16, out)).toThrow(RangeError);
    expect(() => renderMelody(Number.NaN, 0, 16, out)).toThrow(RangeError);
    expect(() => renderMelody(RATE, 0.5, 16, out)).toThrow(RangeError);
    expect(() => renderMelody(RATE, 0, 17, out)).toThrow(RangeError);
    expect(() => renderMelody(RATE, 0, -1, out)).toThrow(RangeError);
    expect(() => renderMelody(RATE, 0, 2.5, out)).toThrow(RangeError);
  });
});

describe('the player', () => {
  const board = (amplitude?: number): Netlist => ({
    nodes: 2,
    parts: [
      amplitude === undefined
        ? { id: 'PL', spec: 'player', pins: [1, 0] }
        : { id: 'PL', spec: 'player', pins: [1, 0], setting: amplitude },
      { id: 'R', spec: 'resistor-10k', pins: [1, 0] },
    ],
  });
  const load = 10e3 / (10e3 + 32);

  it('is a source: alone on the board its loop is open; it has no limits', () => {
    expect(PARTS.player).toMatchObject({ kind: 'player', amplitude: 0.3, ohms: 32, limits: {} }); // parts.test.ts
    const open = solveDC({ nodes: 2, parts: [{ id: 'PL', spec: 'player', pins: [1, 0] }] });
    expect(open.issues).toContainEqual({ kind: 'open', part: 'PL' });
    expect(solveDC(board()).status.PL).toEqual({ condition: 'ok', load: 0 });
  });

  it('gives the melody times its amplitude behind its 32 Ω; its setting is the amplitude', () => {
    // at rest (t = 0) the melody is silent
    expect(solveDC(board()).v[1]).toBe(0);
    // at its loudest moment, 0.98 × 0.3 V, less what its 32 Ω take
    const loudest = 1.0214375;
    close(melodyAt(loudest), MELODY_PEAK, 1e-6, 'the loudest moment');
    close(solveDC(board(), { time: loudest }).v[1], 0.3 * melodyAt(loudest) * load, 1e-12, 'at its loudest');
    const net = board();
    const t = new Transient(net, { dt: 1 / RATE });
    expect(t.start('dc')).toBe(true);
    const volts = new Float32Array(RATE / 10);
    expect(t.run(volts.length, [{ node: 1, out: volts }])).toBe(volts.length);
    // sample k is the moment (k + 1)/48000
    for (let k = 0; k < volts.length; k++)
      close(volts[k], 0.3 * melodyAt((k + 1) / RATE) * load, 1e-7, `sample ${k}`);
    t.set('PL', 0.6); // twice as loud
    expect(t.run(volts.length, [{ node: 1, out: volts }])).toBe(volts.length);
    for (let k = 0; k < volts.length; k++)
      close(volts[k], 0.6 * melodyAt((volts.length + k + 1) / RATE) * load, 1e-7, `louder, sample ${k}`);
    t.set('PL', 0); // stopped
    expect(t.run(10, [{ node: 1, out: volts }])).toBe(10);
    expect([...volts.subarray(0, 10)]).toEqual(new Array(10).fill(0));
    t.set('PL', -1); // never below 0
    expect(t.run(10, [{ node: 1, out: volts }])).toBe(10);
    expect([...volts.subarray(0, 10)]).toEqual(new Array(10).fill(0));
  });
});

describe('the model plays the melody in blocks', () => {
  const BLOCK = 2048;
  const BLOCKS = 6;
  const { speaker, output } = AMPLIFIER_NODES;
  const playing = (): Transient => {
    const t = new Transient(amplifierNetlist({ source: 'player', volume: 0.5 }), { dt: 1 / RATE });
    expect(t.start('dc')).toBe(true);
    return t;
  };

  it('blocks of 2048 samples are one long run: the speaker’s voltage and current, the output', () => {
    const long = playing();
    const all = [0, 1, 2].map(() => new Float32Array(BLOCK * BLOCKS));
    expect(
      long.run(BLOCK * BLOCKS, [
        { node: speaker, out: all[0]! },
        { part: 'LS1', out: all[1]! },
        { node: output, out: all[2]! },
      ]),
    ).toBe(BLOCK * BLOCKS);
    const inBlocks = playing();
    const blocks = [0, 1, 2].map(() => new Float32Array(BLOCK));
    const joined = [0, 1, 2].map(() => new Float32Array(BLOCK * BLOCKS));
    const probes: Probe[] = [
      { node: speaker, out: blocks[0]! },
      { part: 'LS1', out: blocks[1]! },
      { node: output, out: blocks[2]! },
    ];
    for (let b = 0; b < BLOCKS; b++) {
      expect(inBlocks.run(BLOCK, probes)).toBe(BLOCK);
      blocks.forEach((block, j) => joined[j]!.set(block, b * BLOCK));
    }
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < BLOCK * BLOCKS; k++) close(joined[j]![k], all[j]![k]!, 1e-9, `probe ${j}, sample ${k}`);
    close(inBlocks.time, long.time, 1e-15, 'the same moment');
    // and the speaker plays: the melody is there, its current is its voltage over 8 Ω
    let square = 0;
    for (let k = 0; k < BLOCK * BLOCKS; k++) {
      square += all[0]![k]! ** 2;
      close(all[1]![k], all[0]![k]! / 8, 1e-6, `the speaker's current at ${k}`);
    }
    expect(Math.sqrt(square / (BLOCK * BLOCKS))).toBeGreaterThan(0.1);
  });

  it('a run in blocks makes nothing new: the same arrays and readings, block after block', () => {
    const t = playing();
    const block = new Float32Array(BLOCK);
    const current = new Float32Array(BLOCK);
    const probes: Probe[] = [
      { node: speaker, out: block },
      { part: 'LS1', out: current },
    ];
    // everything a stand reads and everything a step works in, by reference
    const held = (): Record<string, unknown> => ({
      v: t.v,
      parts: t.parts,
      speaker: t.parts.LS1,
      status: t.status,
      condition: t.status.LS1,
      circuit: t.circuit,
      matrix: t.circuit.system.a,
      right: t.circuit.system.b,
      solution: t.circuit.system.x,
      unknowns: t.circuit.operating.v,
      memory: t.circuit.memory,
      history: t.circuit.history,
      state: t.state,
      nodes: t.state.v,
      capacitor: t.state.parts.get('C2'),
    });
    expect(t.run(BLOCK, probes)).toBe(BLOCK);
    const before = held();
    for (let k = 0; k < 4; k++) expect(t.run(BLOCK, probes)).toBe(BLOCK);
    const after = held();
    for (const key of Object.keys(before)) expect(after[key], key).toBe(before[key]);
    expect(probes[0]!.out).toBe(block);
    expect(probes[1]!.out).toBe(current);
    expect(block[BLOCK - 1]).toBe(Math.fround(t.v[speaker]!));
  });
});

describe('the worked example of sim/core/README.md, as written there', () => {
  it('the melody, a block of it, and the amplifier playing it in blocks at 24 kHz', () => {
    expect(melodyAt(0)).toBe(0);
    expect(melodyAt(1.0214375).toFixed(2)).toBe('0.98');
    const block = new Float32Array(2048);
    expect(renderMelody(48000, 0, 2048, block)).toBe(block);
    expect(renderMelody(48000, 2048, 2048, block)).toBe(block);
    const long = renderMelody(48000, 0, 4096, new Float32Array(4096));
    expect(differing(block, long.subarray(2048))).toBe(0);
    const t = new Transient(amplifierNetlist({ source: 'player', volume: 0.5 }), { dt: 1 / 24000 });
    expect(t.start('dc')).toBe(true);
    const sound = new Float32Array(2048);
    const scope = new Float32Array(2048);
    const probes: Probe[] = [
      { part: 'LS1', out: sound },
      { node: AMPLIFIER_NODES.output, out: scope },
    ];
    expect(t.run(2048, probes)).toBe(2048);
    expect(t.time.toFixed(5)).toBe('0.08533');
    expect(sound[2047]).toBe(Math.fround(t.parts.LS1!.i));
    expect(scope[2047]).toBe(Math.fround(t.v[AMPLIFIER_NODES.output]!));
  });
});
