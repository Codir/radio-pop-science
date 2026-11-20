/**
 * The plan of the sound output: where each block of samples plays on the output's clock. Pure bookkeeping — no Web
 * Audio, no clock of its own: every call is given the clock's reading `now` (s), so the tests drive it with a fake one.
 *
 * - A block that comes while the plan still runs starts exactly where the last one ends: the sound is continuous.
 * - A block that comes after the plan has run out is an underrun (the speaker fell silent between them): it starts
 *   `lead` seconds after `now`, and so does the first block after a start or a `reset` — that one is no underrun.
 * - At most `capacity` blocks are on the plan at once (those not yet ended); `add` refuses one more.
 * - A block counts as played once its end has passed.
 */

/** One block on the plan: its start and end on the output's clock (s), and which samples of the stream it holds. */
export interface PlannedBlock {
  readonly start: number;
  readonly end: number;
  /** The index of its first sample in the stream. */
  readonly first: number;
  readonly length: number;
}

export interface PlanOptions {
  /** Samples per second of the blocks. */
  rate: number;
  /** Blocks on the plan at most (3 when absent). */
  capacity?: number;
  /** How far after `now` a block starts when nothing plays (s; 0.05 when absent). */
  lead?: number;
}

export const PLAN_CAPACITY = 3;
export const PLAN_LEAD = 0.05;

export class BlockPlan {
  readonly rate: number;
  readonly capacity: number;
  readonly lead: number;
  /** Blocks whose end has passed. */
  played = 0;
  /** Blocks that came after the plan had run out (only while `counting`). */
  underruns = 0;
  /** Whether a late block counts as an underrun (a clock nobody hears does not count). */
  counting: boolean;
  private readonly blocks: PlannedBlock[] = [];
  /** The end of the last block planned; null after a start or a reset. */
  private tail: number | null = null;
  /** The sample after the last block planned (the stream's index), null before any. */
  private after: number | null = null;

  constructor(options: PlanOptions, counting = true) {
    if (!(options.rate > 0 && Number.isFinite(options.rate)))
      throw new RangeError(`the rate must be a finite number above 0: ${options.rate}`);
    const capacity = options.capacity ?? PLAN_CAPACITY;
    if (!(Number.isInteger(capacity) && capacity >= 1))
      throw new RangeError(`the capacity must be a whole number from 1: ${capacity}`);
    this.rate = options.rate;
    this.capacity = capacity;
    this.lead = options.lead ?? PLAN_LEAD;
    this.counting = counting;
  }

  /** Counts the blocks that have ended by `now` as played and takes them off the plan. */
  advance(now: number): void {
    while (this.blocks.length > 0 && this.blocks[0]!.end <= now) {
      this.blocks.shift();
      this.played++;
    }
  }

  /** Blocks on the plan at `now` (planned, not yet ended). */
  queued(now: number): number {
    this.advance(now);
    return this.blocks.length;
  }

  /** How many more blocks the plan takes at `now`. */
  room(now: number): number {
    return this.capacity - this.queued(now);
  }

  /** Seconds of sound planned after `now`. */
  ahead(now: number): number {
    this.advance(now);
    return this.tail === null ? 0 : Math.max(0, this.tail - now);
  }

  /**
   * Puts a block of `length` samples, the stream's samples from `first` on, at the end of the plan. Returns its start
   * on the output's clock, or null when the plan is full (nothing changes then).
   */
  add(now: number, length: number, first: number): number | null {
    if (!(Number.isInteger(length) && length >= 1))
      throw new RangeError(`a block holds a whole number of samples from 1: ${length}`);
    if (this.queued(now) >= this.capacity) return null;
    let start: number;
    if (this.tail === null) start = now + this.lead;
    else if (this.tail < now) {
      if (this.counting) this.underruns++;
      start = now + this.lead;
    } else start = this.tail;
    const end = start + length / this.rate;
    this.blocks.push({ start, end, first, length });
    this.tail = end;
    this.after = first + length;
    return start;
  }

  /**
   * The sample of the stream heard at `now`: inside a block that plays, its sample at that moment; before the first
   * block on the plan starts, that block's first sample; after the plan ends, the sample after the last block. Null
   * before any block.
   */
  at(now: number): number | null {
    this.advance(now);
    const next = this.blocks[0];
    if (next === undefined) return this.after;
    if (now < next.start) return next.first;
    return next.first + Math.min(next.length, Math.floor((now - next.start) * this.rate));
  }

  /** Forgets the plan: a new clock (the blocks on it are dropped, not played). The next block is a start. */
  reset(counting: boolean): void {
    this.blocks.length = 0;
    this.tail = null;
    this.counting = counting;
  }
}
