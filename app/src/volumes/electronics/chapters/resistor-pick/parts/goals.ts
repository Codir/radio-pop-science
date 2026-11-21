/**
 * A copy of `chapters/resistor/parts/goals.ts` (a chapter never imports another chapter), unchanged but for this note
 * and `HOLD`, which holds this chapter's times.
 *
 * The goals' small pure maths: which rows a part's legs or the meter's probes are in, and a tally of readings that
 * each have to hold for a while (the script's «щонайменше 1 s»). Every goal of the chapter reads the bench's numbers —
 * the board as data, the model's currents, the multimeter's display — through these.
 */
import type { BoardLayout, RowId, SocketId } from '@electronics/sim/board';

/** How long a goal's state holds before it counts (s): the script's «Ціль». */
export const HOLD = {
  /** Every value of `series` that counts, every reading of `calc` and `on`. */
  reading: 1,
  /** `power`: each resistor with its readings. */
  power: 2,
  /** `burn`: after the resistor burnt. */
  burnt: 1,
} as const;

/** The rows of these sockets, in their order; null when one is out of a socket (or not the board's). */
export function rowsOf(layout: BoardLayout, sockets: readonly (SocketId | null)[]): RowId[] | null {
  const rows: RowId[] = [];
  for (const s of sockets) {
    const row = s === null ? undefined : layout.socket(s)?.row;
    if (row === undefined) return null;
    rows.push(row);
  }
  return rows;
}

/** Two rows are these two, in any order. */
export function sameRows(rows: readonly RowId[] | null, want: readonly RowId[]): boolean {
  if (rows === null || rows.length !== 2 || want.length !== 2) return false;
  return (rows[0] === want[0] && rows[1] === want[1]) || (rows[0] === want[1] && rows[1] === want[0]);
}

/** One of two rows is in `a`, the other in `b`. */
export function across(rows: readonly RowId[] | null, a: readonly RowId[], b: readonly RowId[]): boolean {
  if (rows === null || rows.length !== 2) return false;
  const [x, y] = rows as [RowId, RowId];
  return (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x));
}

/** A number within [lo, hi]; null and NaN are not. */
export const within = (v: number | null | undefined, lo: number, hi: number): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Readings that each must hold `need` seconds in a row to count; once counted, a reading stays counted. */
export interface Tally<K extends string> {
  /** This frame's reading (null: none of them) over `dt` seconds. */
  feed(key: K | null, dt: number): void;
  done(key: K): boolean;
  /** Every reading counted. */
  all(): boolean;
  /** The readings counted, in the order they were. */
  readonly counted: readonly K[];
  /** How long the reading of this frame has held (s). */
  readonly holding: number;
  reset(): void;
}

export function createTally<K extends string>(keys: readonly K[], need: number): Tally<K> {
  const counted: K[] = [];
  let last: K | null = null;
  let held = 0;
  return {
    feed(key, dt) {
      if (key === null || key !== last) held = 0;
      last = key;
      if (key === null || !keys.includes(key)) return;
      held += Math.max(dt, 0);
      if (held >= need - 1e-9 && !counted.includes(key)) counted.push(key);
    },
    done: (key) => counted.includes(key),
    all: () => keys.every((k) => counted.includes(k)),
    get counted() {
      return counted;
    },
    get holding() {
      return held;
    },
    reset() {
      counted.length = 0;
      last = null;
      held = 0;
    },
  };
}
