/**
 * How fast the model plays: seconds of sound per second of computing, in Node on this machine, in blocks of 2048
 * samples — the amplifier of the volume playing the melody, and beside it an RC low-pass on the player, at 48 000 and
 * 24 000 samples a second; the melody alone for scale. Each is measured in five runs after a warm-up; the plan's floor
 * for playing live is three times real time at the chosen rate (README.md, «Speed»). Not part of `pnpm test`: the
 * name of this file does not end in `.test.ts`. Run it with
 * `pnpm exec vitest bench src/volumes/electronics/sim --run --reporter verbose`.
 */
import { describe, expect, it } from 'vitest';
import {
  AMPLIFIER_NODES,
  amplifierNetlist,
  renderMelody,
  Transient,
  type Netlist,
  type Probe,
} from '../index';

const BLOCK = 2048;
const RUNS = 5;
/** The plan's floor for playing live: three times real time, at the rate the volume plays at (README.md). */
const LIVE = 3;
const LIVE_RATE = 24000;

/** The player into 1 kΩ and 100 nF: the low-pass of the filters' samples. */
const lowPass = (): Netlist => ({
  nodes: 3,
  parts: [
    { id: 'PL', spec: 'player', pins: [1, 0] },
    { id: 'R1', spec: 'resistor-1k', pins: [1, 2] },
    { id: 'C1', spec: 'ceramic-100n', pins: [2, 0] },
  ],
});

interface Case {
  readonly name: string;
  readonly fs: number;
  /** Builds the board and gives one block: what a sound output asks for. */
  readonly make: () => () => unknown;
}

/** A board playing at `fs` from its operating point, with the probes a stand reads: the sound and two nodes. */
function playing(net: Netlist, fs: number, nodes: readonly number[], part?: string, substeps = 1): () => number {
  const t = new Transient(net, { dt: 1 / fs, substeps });
  expect(t.start('dc')).toBe(true);
  const probes: Probe[] = nodes.map((node) => ({ node, out: new Float32Array(BLOCK) }));
  if (part) probes.unshift({ part, out: new Float32Array(BLOCK) });
  return () => t.run(BLOCK, probes);
}

const { speaker, output } = AMPLIFIER_NODES;
const amplifier = (fs: number): Case => ({
  name: `amplifier, melody, ${fs} Hz`,
  fs,
  make: () => playing(amplifierNetlist({ source: 'player', volume: 0.5 }), fs, [speaker, output], 'LS1'),
});
const filter = (fs: number, substeps = 1): Case => ({
  name: `RC low-pass, ${fs} Hz${substeps > 1 ? `, ${substeps} substeps` : ''}`,
  fs,
  make: () => playing(lowPass(), fs, [2, 1], undefined, substeps),
});
const melody = (fs: number): Case => ({
  name: `melody alone, ${fs} Hz`,
  fs,
  make: () => {
    const out = new Float32Array(BLOCK);
    let start = 0;
    return () => {
      renderMelody(fs, start, BLOCK, out);
      start += BLOCK;
    };
  },
});

const AMPLIFIERS = [amplifier(48000), amplifier(24000)];
const LIVE_CASE = AMPLIFIERS.find((c) => c.fs === LIVE_RATE)!;
const CASES: readonly Case[] = [
  ...AMPLIFIERS,
  filter(48000),
  filter(24000),
  filter(48000, 4),
  melody(48000),
];

const median = (x: readonly number[]): number => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)]!;

describe('the speed of the model: seconds of sound per second of computing', () => {
  for (const c of CASES) {
    it(c.name, { timeout: 120_000 }, async ({ bench }) => {
      const block = c.make();
      // a second of sound first: the compiler settles on the code of a step
      for (let k = 0; k < Math.ceil(c.fs / BLOCK); k++) block();
      const speeds: number[] = [];
      for (let run = 1; run <= RUNS; run++) {
        const result = await bench(`${c.name}, run ${run}`, () => {
          block();
        }).run({ time: 1000 });
        speeds.push((result.throughput.mean * BLOCK) / c.fs);
      }
      const shown = (x: number): string => x.toFixed(2);
      console.info(
        `${c.name}: ${speeds.map(shown).join(' ')} — min ${shown(Math.min(...speeds))}, ` +
          `median ${shown(median(speeds))}, max ${shown(Math.max(...speeds))}`,
      );
      if (c === LIVE_CASE) expect(median(speeds)).toBeGreaterThanOrEqual(LIVE);
    });
  }
});
