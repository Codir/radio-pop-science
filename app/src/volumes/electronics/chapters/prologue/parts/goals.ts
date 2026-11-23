/**
 * The goals' small pure maths: which row a socket is in, a run of time while a condition holds, a tally of states that
 * each have to hold for a while, the crest of a run (`quiet`), and the visits of `stand` — a part out of the circuit
 * and back. Every goal of the chapter reads the bench's numbers — the board as data, the model's currents, the
 * speaker's crest, the scope's probe — through these. `rowOf`, `within`, `createHold` and `createTally` are copies of
 * the chapter `meter`'s `parts/goals.ts` (a chapter never imports another).
 */
import type { BoardLayout, RowId, SocketId } from '@electronics/sim/board';

/** The row of one socket; null when it is out (or not the board's). */
export const rowOf = (layout: BoardLayout, socket: SocketId | null | undefined): RowId | null =>
  socket === null || socket === undefined ? null : (layout.socket(socket)?.row ?? null);

/** A number within [lo, hi]; null and NaN are not. */
export const within = (v: number | null | undefined, lo: number, hi: number): boolean =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Time in a row while a condition holds; `done` once it held `need` seconds (and stays so until `reset`). */
export interface Hold {
  feed(on: boolean, dt: number): void;
  readonly held: number;
  readonly done: boolean;
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
    reset() {
      held = 0;
      done = false;
    },
  };
}

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

/**
 * A run of `need` seconds while a condition holds, and its crest — the largest of a number over the run (`quiet`: the
 * speaker's crest while the player plays past the amplifier). The run counts once it has lasted `need` and its crest
 * lies within `[lo, hi]`; a broken run starts again with its crest.
 */
export interface Run {
  feed(on: boolean, value: number | null, dt: number): void;
  readonly held: number;
  /** The largest value of the run so far (0 before any). */
  readonly crest: number;
  readonly done: boolean;
  reset(): void;
}

export function createRun(need: number, lo: number, hi: number): Run {
  let held = 0;
  let crest = 0;
  let done = false;
  return {
    feed(on, value, dt) {
      if (!on) {
        held = 0;
        crest = 0;
        return;
      }
      held += Math.max(dt, 0);
      if (typeof value === 'number' && Number.isFinite(value) && value > crest) crest = value;
      if (held >= need - 1e-9 && crest >= lo && crest <= hi) done = true;
    },
    get held() {
      return held;
    },
    get crest() {
      return crest;
    },
    get done() {
      return done;
    },
    reset() {
      held = 0;
      crest = 0;
      done = false;
    },
  };
}

/** One frame of `stand` as the goal sees it. */
export interface StandFrame {
  /** The part out of the circuit now (in the hand, or on its way), or null: none. */
  readonly out: string | null;
  /** The board's circuit is the one of the step's entry (the netlist's key). */
  readonly whole: boolean;
  /** The speaker's crest now (V), null while nothing is heard yet. */
  readonly crest: number | null;
}

/** A visit of a part out of the circuit and back (`stand`). */
export interface Visit {
  readonly id: string;
  /** How long it was out (s). */
  readonly out: number;
  /** The speaker was silent for `silent` s in a row while it was out. */
  readonly silenced: boolean;
}

export interface VisitRules {
  /** The LED «on»: its visit counts when it was out this long. */
  readonly led: string;
  readonly ledSeconds: number;
  /** Silent: the crest below this, for this long in a row while the part is out. */
  readonly silent: number;
  readonly silentSeconds: number;
  /** After a visit the board is whole again for this long, and the visit counts. */
  readonly back: number;
}

/**
 * The visits of `stand` (the script's «Ціль»): a part taken out and put back, counted once the board has been the
 * entry's again for `back` s. Two halves of the goal: the LED «on» out for `ledSeconds` (`led`), and another part
 * without which the speaker fell silent — its crest below `silent` for `silentSeconds` in a row while it was out
 * (`mute`). A part taken before the last one's `back` had passed starts a new visit; the last one is not counted.
 */
export interface Visits {
  feed(frame: StandFrame, dt: number): void;
  readonly led: boolean;
  readonly mute: boolean;
  readonly done: boolean;
  /** The visits counted, in their order. */
  readonly counted: readonly Visit[];
  /** The visit now (a part out, or back and waiting for `back`), or null. */
  readonly open: Visit | null;
  /** The half of the goal the step calls after a first visit: the LED until it was out, then `other`; null before
   * any visit counted and once both halves are there. */
  call(other: string): string | null;
  reset(): void;
}

export function createVisits(rules: VisitRules): Visits {
  const counted: Visit[] = [];
  let open: { id: string; out: number; quiet: number; silenced: boolean; back: number } | null = null;
  let led = false;
  let mute = false;
  return {
    feed(f, dt) {
      const d = Math.max(dt, 0);
      if (f.out !== null) {
        if (open === null || open.id !== f.out) open = { id: f.out, out: 0, quiet: 0, silenced: false, back: 0 };
        open.back = 0;
        open.out += d;
        open.quiet = f.crest !== null && f.crest < rules.silent ? open.quiet + d : 0;
        if (open.quiet >= rules.silentSeconds - 1e-9) open.silenced = true;
        return;
      }
      if (open === null) return;
      open.back = f.whole ? open.back + d : 0;
      if (open.back < rules.back - 1e-9) return;
      const v: Visit = { id: open.id, out: open.out, silenced: open.silenced };
      counted.push(v);
      if (v.id === rules.led && v.out >= rules.ledSeconds - 1e-9) led = true;
      if (v.id !== rules.led && v.silenced) mute = true;
      open = null;
    },
    get led() {
      return led;
    },
    get mute() {
      return mute;
    },
    get done() {
      return led && mute;
    },
    get counted() {
      return counted;
    },
    get open() {
      return open === null ? null : { id: open.id, out: open.out, silenced: open.silenced };
    },
    call(other) {
      if (counted.length === 0 || (led && mute)) return null;
      return led ? other : rules.led;
    },
    reset() {
      counted.length = 0;
      open = null;
      led = false;
      mute = false;
    },
  };
}
