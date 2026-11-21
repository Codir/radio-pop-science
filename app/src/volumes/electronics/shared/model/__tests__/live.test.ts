/**
 * The model in time on the bench (`live.ts`) follows the bench's model driver in what is burnt: the driver is the one
 * that burns a part (`advance`), and the stream plays its word — at its first start, at a start after a pause, and
 * from the next block on when a part burns while it plays; its own heat burns nothing. On the main thread (a held
 * page's path; the same handler as the thread's), paced by the plan on the frames' own time.
 */
import { describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { WIRE_OHMS, burnSeconds, HEAT_SECONDS } from '@electronics/sim/core';
import {
  createBoardState,
  createLayout,
  place,
  put,
  setSetting,
  type BoardState,
} from '@electronics/sim/board';
import { createBenchModel } from '../driver';
import { benchDamage, createLive } from '../live';

const layout = createLayout();
const ctx = { onDispose: () => {} } as unknown as ChapterContext;
const DT = 1 / 60;

/** + rail → jumper → 9ae → 100 Ω across the channel → 9fj → jumper → − rail (the sandbox's step `overload`). */
function overload(): BoardState {
  const s = createBoardState();
  expect(put(layout, s, { id: 'J1', spec: 'jumper', legs: ['+9', 'a9'] })).toBe(true);
  expect(place(layout, s, { id: 'R1', spec: 'resistor-100', anchor: 'b9', o: 1 })).toBe(true);
  expect(put(layout, s, { id: 'J2', spec: 'jumper', legs: ['j9', '-9'] })).toBe(true);
  setSetting(s, 'SW', 1);
  return s;
}

/** R1's current when it is whole: 9 V behind the battery's 1.5 Ω, the switch and two jumpers, on 100 Ω. */
const WHOLE = 9 / (101.5 + 3 * WIRE_OHMS);
/** It burns on its own heat after τ·ln(L / (L − 1)) ≈ 3.83 s (sim/core README, «Limits»). */
const BURNS = burnSeconds((WHOLE ** 2 * 100) / 0.25, HEAT_SECONDS.resistor!);

/** The bench's frame for the model: its sync, its time (`advance`, which may burn R1) when `heat`, then the stream. */
function rig() {
  const model = createBenchModel({ layout, board: overload() });
  model.sync();
  const blocks: { first: number; i: number[] }[] = [];
  let restarts = 0;
  const live = createLive(ctx, model, {
    frozen: true,
    onBlock: (first, samples, steps) => blocks.push({ first, i: Array.from(samples[0]!.subarray(0, steps)) }),
    onRestart: () => restarts++,
  });
  live.taps([{ part: 'R1' }]);
  const frames = (seconds: number, { run = true, heat = false } = {}) => {
    for (let k = 0; k < Math.round(seconds / DT); k++) {
      model.sync();
      if (heat) model.advance(DT);
      live.update(DT, run);
    }
  };
  /** Burn R1 on the bench at once: the driver's time passes past its limit. */
  const burn = () => {
    model.sync();
    expect(model.advance(BURNS + 1)).toEqual(['R1']);
  };
  return { model, live, blocks, frames, burn, restarts: () => restarts };
}

const gap = (i: readonly number[]) => i.length > 0 && i.every((x) => x === 0);
const carries = (i: readonly number[]) =>
  i.length > 0 && i.every((x) => Math.abs(Math.abs(x) - WHOLE) < 1e-6);

describe('the model in time follows the bench’s damage (E2-9)', () => {
  it('the damage of the board: the driver’s burnt parts and bulged cans, by id', () => {
    const { model, burn } = rig();
    expect(benchDamage(model)).toEqual({ burnt: [], bulged: [] });
    burn();
    expect(benchDamage(model)).toEqual({ burnt: ['R1'], bulged: [] });
  });

  it('a part burnt before the scope came plays as a gap from the first block', () => {
    const { model, live, blocks, frames, burn } = rig();
    burn();
    expect(model.part('R1')!.condition).toBe('burnt');
    expect(live.mode).toBe('off');
    frames(0.5);
    expect(live.mode).toBe('sync');
    expect(blocks.length).toBeGreaterThan(2);
    for (const b of blocks) expect(gap(b.i), `block at ${b.first}`).toBe(true);
  });

  it('a part burnt while the scope was away plays as a gap when it comes back', () => {
    const { live, blocks, frames, burn, restarts } = rig();
    frames(0.5);
    expect(blocks.length).toBeGreaterThan(2);
    for (const b of blocks) expect(carries(b.i)).toBe(true);
    // the scope leaves; R1 burns on the bench meanwhile; the scope comes back: a start after a pause
    frames(0.2, { run: false });
    burn();
    const before = blocks.length;
    frames(0.5);
    expect(restarts()).toBe(2);
    expect(blocks.length).toBeGreaterThan(before + 2);
    for (const b of blocks.slice(before)) expect(gap(b.i), `block at ${b.first}`).toBe(true);
    expect(live.since).toBeGreaterThan(0);
  });

  it('a part the bench burns while the scope plays is a gap from the next block on; the stream burns nothing itself', () => {
    const { live, blocks, frames, burn } = rig();
    // longer than R1 takes to burn on its own heat: the bench lets no time of heat pass, so R1 stays whole there
    frames(BURNS + 1.5);
    const played = (blocks.at(-1)!.first + blocks.at(-1)!.i.length) / live.rate;
    expect(played).toBeGreaterThan(BURNS + 1);
    for (const b of blocks) expect(carries(b.i), `block at ${b.first / live.rate} s`).toBe(true);
    // the bench burns it: the next request carries the damage with the board, and the model plays it from there
    burn();
    const before = blocks.length;
    frames(0.5);
    const after = blocks.slice(before);
    expect(after.length).toBeGreaterThan(2);
    for (const b of after) expect(gap(b.i), `block at ${b.first / live.rate} s`).toBe(true);
    expect(live.since).toBeCloseTo(after[0]!.first / live.rate, 9);
  });
});
