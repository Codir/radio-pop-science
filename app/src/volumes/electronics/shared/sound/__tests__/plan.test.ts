import { describe, expect, it } from 'vitest';
import { BlockPlan, PLAN_CAPACITY, PLAN_LEAD } from '../plan';

const RATE = 24000;
const BLOCK = 2048;
const SECONDS = BLOCK / RATE;

describe('the plan of the sound output', () => {
  it('plays blocks that come in time back to back: each starts where the last one ends', () => {
    const plan = new BlockPlan({ rate: RATE });
    let now = 1;
    const starts: number[] = [];
    // the output asks for a block whenever it has room; each comes 10 ms after it was asked for
    for (let k = 0; k < 40; k++) {
      while (plan.room(now) === 0) now += 0.001;
      now += 0.01;
      starts.push(plan.add(now, BLOCK, k * BLOCK)!);
    }
    expect(starts[0]).toBeCloseTo(1.01 + PLAN_LEAD, 12);
    for (let k = 1; k < starts.length; k++) expect(starts[k]).toBeCloseTo(starts[k - 1]! + SECONDS, 9);
    expect(plan.underruns).toBe(0);
  });

  it('counts a block that comes after the sound ran out as an underrun, and starts it after a lead', () => {
    const plan = new BlockPlan({ rate: RATE });
    const first = plan.add(0, BLOCK, 0)!; // the first block is a start, not an underrun
    expect(first).toBe(PLAN_LEAD);
    expect(plan.underruns).toBe(0);
    const late = first + SECONDS + 0.02; // 20 ms of silence
    const start = plan.add(late, BLOCK, BLOCK)!;
    expect(plan.underruns).toBe(1);
    expect(start).toBeCloseTo(late + PLAN_LEAD, 12);
    // just in time: the block after starts exactly where this one ends
    expect(plan.add(start + SECONDS, BLOCK, 2 * BLOCK)).toBeCloseTo(start + SECONDS, 12);
    expect(plan.underruns).toBe(1);
  });

  it('never holds more than three blocks: a fourth is refused until one has played', () => {
    const plan = new BlockPlan({ rate: RATE });
    expect(PLAN_CAPACITY).toBe(3);
    const at = [0, 0, 0].map((_, k) => plan.add(0, BLOCK, k * BLOCK));
    expect(at.every((s) => s !== null)).toBe(true);
    expect(plan.queued(0)).toBe(3);
    expect(plan.room(0)).toBe(0);
    expect(plan.add(0, BLOCK, 3 * BLOCK)).toBeNull();
    expect(plan.queued(0)).toBe(3);
    const end = at[0]! + SECONDS;
    expect(plan.queued(end - 1e-9)).toBe(3);
    expect(plan.queued(end)).toBe(2);
    expect(plan.played).toBe(1);
    expect(plan.add(end, BLOCK, 3 * BLOCK)).toBeCloseTo(at[2]! + SECONDS, 12);

    // a producer faster than the sound: the plan stays at three, however often it is offered a block
    let now = end;
    let most = 0;
    for (let i = 0; i < 2000; i++) {
      now += 0.003;
      plan.add(now, BLOCK, 0);
      plan.add(now, BLOCK, 0);
      most = Math.max(most, plan.queued(now));
    }
    expect(most).toBe(3);
  });

  it('counts the blocks played, the sound ahead and the sample heard', () => {
    const plan = new BlockPlan({ rate: RATE });
    expect(plan.at(0)).toBeNull();
    const s0 = plan.add(0, BLOCK, 4096)!;
    plan.add(0, BLOCK, 6144);
    expect(plan.ahead(0)).toBeCloseTo(PLAN_LEAD + 2 * SECONDS, 12);
    expect(plan.at(0)).toBe(4096); // not started yet: its first sample
    expect(plan.at(s0 + 0.01002)).toBe(4096 + 240); // 10 ms (and a half sample) in at 24 kHz
    expect(plan.at(s0 + SECONDS + 0.00102)).toBe(6144 + 24);
    expect(plan.played).toBe(1);
    expect(plan.at(s0 + 3 * SECONDS)).toBe(8192); // after the plan: the sample after the last block
    expect(plan.played).toBe(2);
    expect(plan.ahead(s0 + 3 * SECONDS)).toBe(0);
  });

  it('a reset drops the plan: the next block is a start; a clock nobody hears counts no underrun', () => {
    const plan = new BlockPlan({ rate: RATE }, false);
    plan.add(0, BLOCK, 0);
    plan.add(1, BLOCK, BLOCK); // late, but nobody hears this clock
    expect(plan.underruns).toBe(0);
    plan.reset(true);
    expect(plan.queued(1)).toBe(0);
    expect(plan.played).toBe(1);
    expect(plan.add(5, BLOCK, 2 * BLOCK)).toBe(5 + PLAN_LEAD);
    expect(plan.underruns).toBe(0);
    plan.add(6, BLOCK, 3 * BLOCK);
    expect(plan.underruns).toBe(1);
  });

  it('refuses a rate, a capacity or a block it cannot plan', () => {
    expect(() => new BlockPlan({ rate: 0 })).toThrow(RangeError);
    expect(() => new BlockPlan({ rate: RATE, capacity: 0 })).toThrow(RangeError);
    expect(() => new BlockPlan({ rate: RATE }).add(0, 0, 0)).toThrow(RangeError);
  });
});
