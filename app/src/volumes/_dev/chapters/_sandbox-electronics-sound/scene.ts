/**
 * Scene of the electronics sound sandbox (`index.ts` holds its words). One step, `filter`: the volume's melody from
 * the player, straight or through a low-pass of R and 100 nF, into the volume's amplifier and its 8 Ω speaker
 * (`filterBoard`, `@electronics/shared/sound`). The circuit model plays it in blocks of 1536 samples at 24 kHz in a
 * background thread (`createStream`); the volume's own output plays the speaker's current (`createSoundOut`, full
 * scale `SPEAKER_FULL_SCALE`), and the board's scope shows the voltage on the speaker from the same blocks — the
 * 20 ms before the sample heard now, redrawn about 30 times a second.
 * Reader: `electronics-sound` — the output (state, clock, blocks played, underruns, latency, gain), the stream (mode,
 * blocks, the model's time a block), the board, the level of the last 32 blocks with its part above 2 kHz
 * (`meter.ts`) and the scope (how many times it was drawn, its peak).
 */
import { fmtSI } from '@/content';
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import {
  BOARD_PROBES,
  createSoundOut,
  createStream,
  FILTER_OHMS,
  filterBoard,
  SPEAKER_FULL_SCALE,
  Tape,
} from '@electronics/shared/sound';
import { createMeter } from './meter';
import { SANDBOX } from './index';

/**
 * The volume's rate (sim/core README, «Speed») and a block within the design's 50–100 ms: 64 ms. With up to three on
 * the plan, a change on the board is heard 0.12–0.21 s later (the design: ≈ 0.1–0.2 s; README of `shared/sound`).
 */
const RATE = 24000;
const BLOCK = 1536;
/** The scope: its sweep (ms), its redraws a second, its range (V). */
const SWEEP_MS = 20;
const REDRAWS = 30;
const RANGE_V = 1.2;
const SWEEP = Math.round((SWEEP_MS / 1000) * RATE);
/** The level of the last METER_BLOCKS blocks: 2.05 s, about one bar of the melody. */
const METER_BLOCKS = 32;
const DEFAULT_OHMS = 1000;

type Path = keyof typeof SANDBOX.labels.paths;

/** The resistor of the series nearest to `ohms` on a logarithmic scale. */
const nearest = (ohms: number): number =>
  FILTER_OHMS.reduce((best, r) =>
    Math.abs(Math.log(r / ohms)) < Math.abs(Math.log(best / ohms)) ? r : best,
  );

export default defineScene((ctx) => {
  const { labels } = SANDBOX;
  const sound = createSoundOut(ctx, { rate: RATE });
  // the scope reads the samples around the one heard now: those of the blocks on the plan and one before them
  const tape = new Tape(BLOCK * 6);
  const meter = createMeter(RATE, METER_BLOCKS);
  const stream = createStream(
    ctx,
    { net: filterBoard(DEFAULT_OHMS), rate: RATE, block: BLOCK, probes: BOARD_PROBES },
    {
      wants: () => sound.room > 0,
      onBlock: (b) => {
        const [current, volts] = b.samples;
        sound.enqueue(current!, { first: b.first, scale: 1 / SPEAKER_FULL_SCALE });
        tape.write(b.first, volts!);
        meter.add(current!, b.revision);
      },
    },
  );

  /* ------------------------------------------------------------------------------------------ controls */
  const ui = stepUi(ctx);
  const path = (): Path => ui.value<string>('path') as Path;
  const xs = Float32Array.from({ length: SWEEP }, (_, k) => ((k + 1 - SWEEP) / RATE) * 1000);
  const trace = new Float32Array(SWEEP);
  /** The engine time of the scope's next redraw. */
  let drawAt = -Infinity;
  let draws = 0;
  let peak = 0;
  ui.define({
    filter: {
      controls: [
        {
          type: 'segmented',
          id: 'path',
          label: labels.path,
          items: (['direct', 'filter'] as const).map((id) => ({ id, label: labels.paths[id] })),
          value: 'filter',
        },
        {
          type: 'slider',
          id: 'ohms',
          label: labels.ohms,
          min: FILTER_OHMS[0]!,
          max: FILTER_OHMS.at(-1)!,
          scale: 'log',
          stops: FILTER_OHMS,
          value: DEFAULT_OHMS,
          format: (v) => fmtSI(v, labels.units.ohm),
          marks: [100, 1e3, 1e4, 1e5].map((v) => ({ value: v, label: fmtSI(v, labels.units.ohm) })),
          disabled: () => path() === 'direct',
        },
        { type: 'readout', id: 'played', label: labels.played, digits: 0, get: () => sound.played },
        { type: 'readout', id: 'underruns', label: labels.underruns, digits: 0, get: () => sound.underruns },
        {
          type: 'readout',
          id: 'latency',
          label: labels.latency,
          unit: labels.units.ms,
          digits: 0,
          get: () => sound.latency * 1000,
        },
      ],
      board: {
        title: labels.scope,
        children: [
          {
            type: 'chart',
            id: 'scope',
            chart: {
              height: 220,
              x: { min: -SWEEP_MS, max: 0, label: labels.axes.t },
              y: { min: -RANGE_V, max: RANGE_V, label: labels.axes.u },
              series: [{ id: 'u', label: labels.trace, color: 'teal' }],
              legend: false,
            },
            update(chart, t) {
              // on a grid of 1/30 s of engine time, whatever the frame rate; after a pause the grid starts again
              if (t < drawAt) return;
              const end = sound.heard();
              if (end === null) return;
              const next = drawAt + 1 / REDRAWS;
              drawAt = next > t ? next : t + 1 / REDRAWS;
              tape.read(end, trace);
              chart.setData('u', xs, trace);
              draws++;
              peak = 0;
              for (const v of trace) if (Math.abs(v) > peak) peak = Math.abs(v);
            },
          },
        ],
      },
    },
  });

  /* ------------------------------------------------------------------------------- the board and the view */
  let board = `filter:${DEFAULT_OHMS}`;
  ctx.camera.shots({ main: { position: [0, 1.2, 6], target: [0, 0, 0] } });
  ctx.stage.define({ filter: { camera: 'main' } });

  /* ------------------------------------------------------------------------------------------ QA hooks */
  ctx.qa.expose('electronics-sound', () => ({
    rate: RATE,
    block: BLOCK,
    window: METER_BLOCKS,
    state: sound.state,
    clock: sound.clock,
    played: sound.played,
    underruns: sound.underruns,
    queued: sound.queued,
    latency: sound.latency,
    gain: sound.gain,
    gainNow: sound.gainNow,
    mode: stream.mode,
    blocks: stream.blocks,
    modelMs: stream.ms,
    revision: stream.revision,
    board,
    level: meter.read(),
    scope: { draws, peak },
  }));

  return {
    update() {
      // the board follows the controls: a new one only when the path or the resistor changed (a value set from
      // outside the slider's stops goes to the nearest resistor of the series)
      const ohms = nearest(ui.value<number>('ohms'));
      const want = path() === 'direct' ? 'direct' : `filter:${ohms}`;
      if (want !== board) {
        board = want;
        stream.board(filterBoard(want === 'direct' ? null : ohms));
      }
      stream.pump();
    },
  };
});
