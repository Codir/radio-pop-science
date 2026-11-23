/**
 * The goals' small pure maths: which rows a part's legs or the instruments' probes are in, a tally of readings that
 * each have to hold for a while (a script's «щонайменше 1 s») and a run of time while a condition holds. The goals of
 * the chapters on the bench read the bench's numbers — the board as data, the model's currents, the instruments'
 * displays — through these. How long each of a chapter's states must hold is the chapter's own (its `parts/goals.ts`,
 * `HOLD`), passed to `createTally` and `createHold`.
 */
import type { BoardLayout, RowId, SocketId } from '@electronics/sim/board';

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

/** The row of one socket; null when it is out (or not the board's). */
export const rowOf = (layout: BoardLayout, socket: SocketId | null): RowId | null =>
  socket === null ? null : (layout.socket(socket)?.row ?? null);

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

/** Time in a row while a condition holds; `done` once it held `need` seconds (and stays so until `reset`). */
export interface Hold {
  feed(on: boolean, dt: number): void;
  readonly held: number;
  readonly done: boolean;
  /** Start counting again (the run broke), keeping `done`. */
  restart(): void;
  reset(): void;
}

export function createHold(need: number): Hold {
  let held = 0;
  let done = false;
  return {
    feed(on, dt) {
      held = on ? held + Math.max(dt, 0) : 0;
      if (held >= need - 1e-9) done = true;
    },
    get held() {
      return held;
    },
    get done() {
      return done;
    },
    restart() {
      held = 0;
    },
    reset() {
      held = 0;
      done = false;
    },
  };
}
