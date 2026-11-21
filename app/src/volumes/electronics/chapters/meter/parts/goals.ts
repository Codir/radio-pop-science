/**
 * The goals' small pure maths: which rows the probes are in, a tally of states that each have to hold for a while
 * (the script's «щонайменше 1 s»), a counter of time in a row, and the check of the player's wave over its seconds
 * (`wave`). Every goal of the chapter reads the bench's numbers — the board as data, the model's currents, the
 * multimeter's display, the oscilloscope's trace and peaks — through these. The first four are a copy of the
 * chapter `resistor`'s `parts/goals.ts` (a chapter never imports another).
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

/** A number within [lo, hi]; null and NaN are not. */
export const within = (v: number | null | undefined, lo: number, hi: number): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** States that each must hold `need` seconds in a row to count; once counted, a state stays counted. */
export interface Tally<K extends string> {
  /** This frame's state (null: none of them) over `dt` seconds. */
  feed(key: K | null, dt: number): void;
  done(key: K): boolean;
  /** Every state counted. */
  all(): boolean;
  /** The states counted, in the order they were. */
  readonly counted: readonly K[];
  /** How long the state of this frame has held (s). */
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

/**
 * The player's wave on the scope over the seconds the probe stood on its row (`wave`): a frame's verdict from how
 * long the run is now (`held`, s), the largest |v| of the last `window` seconds shown (`crest`) and of the whole run
 * so far (`whole`). While the run is shorter than `window` there is nothing to say; from then on every frame's last
 * `window` seconds must reach the crest (in every such stretch the player is heard), and the whole run never reaches
 * the screen's edge. `go` — the run goes on; `broke` — start again; `done` — `need` seconds of it.
 */
export function waveVerdict(
  held: number,
  crest: number | null,
  whole: number | null,
  rules: { need: number; window: number; crest: number; edge: number },
): 'go' | 'broke' | 'done' {
  if (whole !== null && whole > rules.edge) return 'broke';
  if (held < rules.window - 1e-9) return 'go';
  if (crest === null || crest < rules.crest) return 'broke';
  return held >= rules.need - 1e-9 ? 'done' : 'go';
}
