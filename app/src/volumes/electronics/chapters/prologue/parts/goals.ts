/**
 * The goals' own small pure maths: the crest of a run (`quiet`) and the visits of `stand` — a part out of the circuit
 * and back. Every goal of the chapter reads the bench's numbers — the board as data, the model's currents, the
 * speaker's crest, the scope's probe — through these and the shared ones of `@electronics/shared/steps` (`rowOf`,
 * `createHold`, `createTally`).
 */

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
