/**
 * The chapter's boards (`parts/boards.ts`) played by the circuit model, and the windows of the goals around the
 * model's numbers (the script's «Ціль», `docs/volumes/electronics/chapters/prologue.md`): the player straight on the
 * speaker past the amplifier (`quiet`), the amplifier off and on at the knob's low and high (`loud`), the parts the
 * hand may take in `stand` — none burns without it, the LED goes dark, the volume knob silences the speaker — and the
 * three rows of `riddle` as the scope sees them, with its input of 1 MΩ.
 */
import { describe, expect, it } from 'vitest';
import {
  createLayout,
  occupant,
  presetState,
  remove,
  setSetting,
  type BoardPreset,
  type BoardState,
} from '@electronics/sim/board';
import { Transient, createModelState, type PartInstance } from '@electronics/sim/core';
import { LEAD, LEADS } from '@electronics/shared/bench';
import { SCOPE_INPUT } from '@electronics/shared/instruments';
import { createBenchModel, type BenchModel } from '@electronics/shared/model';
import {
  AMP,
  IDS,
  KNOB,
  PLAYING,
  QUIET,
  RIDDLE_MARKS,
  RIDDLE_ROWS,
  ROWS,
  TAKE,
  WINDOWS,
} from '../parts/boards';

const layout = createLayout();
const FS = 24000;
const node = (row: string): number => layout.node(row);

/** The bench's model on a board, the switch, the player and the knob as given, the scope's inputs as given. */
function solve(
  preset: BoardPreset,
  opts: { closed?: number; player?: number; knob?: number; scope?: PartInstance[]; without?: string } = {},
): { s: BoardState; model: BenchModel } {
  const s = presetState(layout, preset);
  if (opts.without) remove(s, opts.without);
  setSetting(s, IDS.switch, opts.closed ?? 1);
  setSetting(s, IDS.player, opts.player ?? PLAYING);
  if (opts.knob !== undefined) setSetting(s, IDS.pot, opts.knob);
  const model = createBenchModel({ layout, board: s, extra: () => opts.scope ?? [] });
  model.sync();
  expect(model.ok).toBe(true);
  return { s, model };
}

/** The model in time from the operating point, the speaker's current and the given rows, `seconds` long. */
function play(model: BenchModel, seconds: number, rows: readonly string[] = []) {
  const t = new Transient(structuredClone(model.net!.net), { dt: 1 / FS, state: createModelState(), fails: false });
  expect(t.start('dc')).toBe(true);
  const n = Math.round(seconds * FS);
  const speaker = new Float32Array(n);
  const outs = rows.map(() => new Float32Array(n));
  expect(t.run(n, [{ part: 'SPK', out: speaker }, ...rows.map((r, k) => ({ node: node(r), out: outs[k]! }))])).toBe(n);
  return { t, speaker, outs };
}

/** The largest |v| of `a` from `from` to `to` s (× `scale`). */
const crest = (a: Float32Array, from: number, to: number, scale = 1): number => {
  let m = 0;
  for (let k = Math.round(from * FS); k < Math.min(a.length, Math.round(to * FS)); k++) m = Math.max(m, Math.abs(a[k]!));
  return m * scale;
};

describe('quiet: the player straight on the speaker, past the amplifier', () => {
  it('the signal plugs together in the free row 16ae, the commons in the ground row 17ae; every plug within its lead', () => {
    const s = presetState(layout, QUIET);
    expect(layout.socket(QUIET.leads['pl+']!)!.row).toBe(ROWS.quiet);
    expect(layout.socket(QUIET.leads['spk+']!)!.row).toBe(ROWS.quiet);
    expect(layout.socket(QUIET.leads['pl-']!)!.row).toBe(ROWS.ground);
    expect(layout.socket(QUIET.leads['spk-']!)!.row).toBe(ROWS.ground);
    // no part of the amplifier in 16ae; 17ae is tied to the − rail by J1
    const rows = (id: string) => s.parts.get(id)!.legs.map((l) => layout.socket(l!)!.row);
    for (const p of s.parts.values()) expect(rows(p.id), p.id).not.toContain(ROWS.quiet);
    expect(rows('J1').sort()).toEqual([ROWS.ground, ROWS.minus].sort());
    for (const [name, socket] of Object.entries(QUIET.leads)) {
      const from = LEADS.find((l) => l.name === name)!.from;
      const at = layout.socket(socket)!;
      expect(Math.hypot(at.x - from.x, at.z - from.z), name).toBeLessThanOrEqual(LEAD.length);
    }
  });

  it('the switch open: the amplifier dark; the speaker’s crest over any 3 s of the melody within 0,05 … 0,06 V', () => {
    const { model } = solve(QUIET, { closed: 0 });
    expect(Math.abs(model.reading(IDS.battery)!.i)).toBeLessThan(1e-9);
    expect(model.reading(IDS.led)!.i).toBeLessThan(1e-9);
    const { speaker } = play(model, 7);
    for (const from of [0, 1, 2, 3, 4]) {
      const c = crest(speaker, from, from + 3, 8);
      expect(c, `from ${from} s`).toBeGreaterThanOrEqual(WINDOWS.quiet[0]);
      expect(c, `from ${from} s`).toBeLessThanOrEqual(WINDOWS.quiet[1]);
    }
    // the player stopped: nothing
    const { model: still } = solve(QUIET, { closed: 0, player: 0 });
    expect(crest(play(still, 0.5).speaker, 0, 0.5, 8)).toBeLessThan(1e-6);
  });
});

describe('loud: the amplifier between them', () => {
  it('the switch open: next to nothing on the speaker (μV); closed: the battery 13,31 mA, the LED «on» 2,99 mA', () => {
    const { model: off } = solve(AMP, { closed: 0, knob: KNOB.low });
    expect(crest(play(off, 1).speaker, 0.2, 1, 8)).toBeLessThan(1e-4);
    const { model } = solve(AMP, { closed: 1, player: 0, knob: KNOB.low });
    expect(Math.abs(model.reading(IDS.battery)!.i)).toBeCloseTo(0.01331, 4);
    expect(Math.abs(model.reading(IDS.battery)!.i)).toBeGreaterThan(WINDOWS.loud.battery);
    expect(model.reading(IDS.led)!.i).toBeCloseTo(0.00299, 4);
  });

  it('the knob at 0,1: crests up to 0,30 V; at 0,8: from 1,26 to 2,0 V over 2 s — within the gauge’s 4 V', () => {
    const low = play(solve(AMP, { knob: KNOB.low }).model, 3).speaker;
    expect(crest(low, 1, 3, 8)).toBeGreaterThan(0.19);
    expect(crest(low, 1, 3, 8)).toBeLessThanOrEqual(0.3 + 1e-3);
    const high = play(solve(AMP, { knob: WINDOWS.loud.knob }).model, 3).speaker;
    expect(crest(high, 1, 3, 8)).toBeGreaterThan(1.26);
    expect(crest(high, 1, 3, 8)).toBeLessThanOrEqual(2.0 + 1e-3);
    expect(crest(high, 1, 3, 8)).toBeLessThan(WINDOWS.gauge[1]);
  });
});

describe('stand: the parts the hand may take', () => {
  it('fourteen parts of the amplifier: not the bias diodes D2, D3, no jumper', () => {
    expect(TAKE).toHaveLength(14);
    expect(TAKE).not.toContain('D2');
    expect(TAKE).not.toContain('D3');
    expect(TAKE.every((id) => !id.startsWith('J'))).toBe(true);
    expect(TAKE).toContain(IDS.led);
    expect(TAKE).toContain(IDS.pot);
  });

  it('without any of them nothing burns in 5 s; without the LED «on» its light goes and the battery gives on', () => {
    for (const id of TAKE) {
      const { model } = solve(AMP, { knob: KNOB.middle, without: id });
      for (let k = 0; k < 5 * 60; k++) model.advance(1 / 60);
      const burnt = Object.entries(model.solution!.status).filter(([, x]) => x.condition === 'burnt');
      expect(burnt, `without ${id}`).toEqual([]);
    }
    const { model } = solve(AMP, { knob: KNOB.middle, without: IDS.led });
    expect(model.reading(IDS.led)).toBeNull();
    expect(Math.abs(model.reading(IDS.battery)!.i)).toBeGreaterThan(0.009);
  });

  it('without D2 the model burns Q2 within 1 s: why the hand never takes the bias diodes', () => {
    const { model } = solve(AMP, { knob: KNOB.middle, without: 'D2' });
    let frames = 0;
    while (model.part('Q2')!.condition !== 'burnt' && frames < 120) {
      model.advance(1 / 60);
      frames++;
    }
    expect(model.part('Q2')!.condition).toBe('burnt');
  });

  it('the melody at 0,5: the whole amplifier 0,61 … 0,98 V; without the knob P1 the speaker silent (under 5 mV) from 0,6 s', () => {
    const whole = play(solve(AMP, { knob: KNOB.middle }).model, 2).speaker;
    expect(crest(whole, 1, 1.5, 8)).toBeGreaterThan(0.6);
    expect(crest(whole, 0, 2, 8)).toBeLessThan(1);
    // taken out while it plays: the board without it, the model going on from its moment
    const { model } = solve(AMP, { knob: KNOB.middle });
    const { t } = play(model, 1);
    const s = presetState(layout, AMP);
    remove(s, IDS.pot);
    setSetting(s, IDS.switch, 1);
    setSetting(s, IDS.player, PLAYING);
    const without = createBenchModel({ layout, board: s });
    without.sync();
    t.rebuild(structuredClone(without.net!.net));
    const after = new Float32Array(2 * FS);
    expect(t.run(after.length, [{ part: 'SPK', out: after }])).toBe(after.length);
    expect(crest(after, 0.6, 2, 8)).toBeLessThan(WINDOWS.silent);
  });
});

describe('riddle: the three rows as the scope sees them', () => {
  it('the + rail 8,89 … 8,98 V, the player’s row within ±0,29 V, the speaker’s within ±0,98 V reaching 0,79 V in 2 s', () => {
    const scope: PartInstance[] = [{ id: SCOPE_INPUT.ids[0]!, spec: SCOPE_INPUT.spec, pins: [node(ROWS.speaker), 0] }];
    const { model } = solve(AMP, { knob: KNOB.middle, scope });
    const { outs } = play(model, 3, [RIDDLE_ROWS.battery, RIDDLE_ROWS.player, RIDDLE_ROWS.speaker]);
    const [rail, player, speaker] = outs as [Float32Array, Float32Array, Float32Array];
    expect(Math.min(...rail.subarray(FS))).toBeGreaterThan(8.85);
    expect(Math.max(...rail.subarray(FS))).toBeLessThan(8.99);
    expect(crest(player, 1, 3)).toBeLessThanOrEqual(0.3);
    expect(crest(player, 1, 3)).toBeGreaterThan(0.2);
    expect(crest(speaker, 1, 3)).toBeLessThan(1);
    expect(crest(speaker, 1, 3)).toBeGreaterThan(0.79);
    // on the scope's 2,5 V a division: the rail 3,6 divisions up, the speaker under half a division
    expect(8.98 / 2.5).toBeCloseTo(3.6, 1);
  });

  it('the words stand over free sockets of the three rows', () => {
    const s = presetState(layout, AMP);
    for (const [k, socket] of Object.entries(RIDDLE_MARKS)) {
      expect(occupant(s, socket), k).toBeNull();
      expect(layout.socket(socket)!.row).toBe(RIDDLE_ROWS[k as keyof typeof RIDDLE_ROWS]);
    }
    expect(layout.socket(AMP.leads['pl+']!)!.row).toBe(ROWS.player);
    expect(layout.socket(AMP.leads['spk+']!)!.row).toBe(ROWS.speaker);
  });
});
