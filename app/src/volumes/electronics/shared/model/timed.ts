/**
 * The board in time for the bench's looks (plan decision 1 of batch E4; recon E4 §1.3, N1): a `Transient` of the
 * circuit now on the bench, stepped by the bench's own frames — the frame's `dt` in steps of 1/4800 s (80 a frame at 60
 * frames a second) — so that what the bench shows of a capacitor giving its charge, an LED fading after the switch,
 * the meter's volts on the can and the charges inside it, is the model's moment of that very frame. The driver
 * (`driver.ts`) runs it while the step asks (`BenchModel.timed`), and only there: a small board of a few parts; never
 * the amplifier, which costs several times real time already in the stream's thread (reports/batch-E2.md §4).
 *
 * - **Starts** from the operating point of the board (`start('dc')`): when it is turned on, and again when the driver
 *   is told a part is new (`forget`, a step's preset) — a step's board starts as its operating point says, the cans
 *   charged by a closed switch, empty behind an open one.
 * - **A new shape** (a part put in, taken into the hand, back) is a `rebuild`: the moment runs on, every capacitor
 *   keeps its charge by id (a part the model has not seen comes empty), the readings are those of the next step — till
 *   then, on a frame of no time, the last moment's of the parts still in the circuit.
 * - **A new setting** (the switch, a knob) is written into its own circuit and taken by the next step.
 * - **The damage is the driver's**: its own state is told the bench's burnt parts and bulged cans at every start and
 *   change, and its own heat fails nothing (`TransientOptions.fails` false), as the stream's (`live.ts`). Heat stays on
 *   the driver's operating point (`advance`): nothing in the steps that count in time warms.
 * - **A frame of no time** (`dt` 0: a held frame, `?freeze`) moves nothing. Its moment `now` runs on from start to
 *   start (a start does not take it back), so a moment told before a preset stays comparable after it.
 * - **A threshold watch** (`watch(part, level)`): the moment, between two of its steps (linear between them), a part's
 *   current crossed a level — a crossing quicker than a frame (10 μF gives 1 mA in 11 ms) is told to the step's
 *   precision, not to the frame's. `changed(id)` is the moment a part's setting last changed: the switch's opening.
 *
 * Its own `ModelState` (the bench's is the driver's): the charges, the node voltages, the heat it gathers but never
 * shows. What it costs a frame is `ms` (the driver's clock).
 */
import {
  Transient,
  createModelState,
  memoryOf,
  type DcFailure,
  type ModelState,
  type Netlist,
  type PartInstance,
  type PartReading,
} from '@electronics/sim/core';
import { fnv1a } from './hash';

/** Steps of the board in time a second: 80 a frame at 60 frames a second (recon E4 §1.3). */
export const TIMED = { rate: 4800 } as const;

/** The bench's damage on the board now (as `StreamDamage`): its burnt parts and its bulged cans. */
export interface TimedDamage {
  readonly burnt: readonly string[];
  readonly bulged: readonly string[];
}

/** The moments a part's current crossed a level (`Timeline.watch`). */
export interface TimedWatch {
  readonly part: string;
  /** The level (A), against the size of the current into the part's first pin, either way. */
  readonly level: number;
  /** Whether the current is below the level at the last moment; null while the part is not in the circuit. */
  readonly below: boolean | null;
  /** The moment (s, the timeline's `now`) the current last went from the level or above to below it; NaN until then. */
  readonly fell: number;
  /** The moment it last went from below the level to it or above; NaN until then. */
  readonly rose: number;
  /** Forget both moments (NaN again). */
  clear(): void;
}

/** What a chapter and the checks read of the board in time (`BenchModel.timeline`). */
export interface Timeline {
  /** Steps a second (`TIMED.rate`). */
  readonly rate: number;
  /** It has started on the board now: the bench's readings are its. */
  readonly running: boolean;
  /** Its last step (or start) succeeded; while not, the bench gives no reading (as after a failed solve). */
  readonly ok: boolean;
  readonly reason: DcFailure | null;
  /** The moment of its last step (s): from 0 at its first start, on through every start after it. */
  readonly now: number;
  /** How many times it started: on being turned on, and at every step's preset. */
  readonly starts: number;
  /** Steps it took since its last start (a frame of no time takes none). */
  readonly steps: number;
  /** Steps the last frame that let time pass took (80 at 60 frames a second): a frame of no time — a held page draws
   * them between the checks' steps — leaves it. */
  readonly frameSteps: number;
  /** What the steps of that frame cost (ms, the driver's clock). */
  readonly ms: number;
  /** The moment the setting of the part `id` last changed since the last start (the next step takes it); NaN when it
   * has not. */
  changed(id: string): number;
  /** Every part's setting changed since the last start, with its moment (`changed`), for the checks. */
  changes(): Readonly<Record<string, number>>;
  /** The watch of a part's current against a level: one for each pair, made at the first ask, kept for the bench's
   * life through every start (its crossings stay until `clear`). */
  watch(part: string, level: number): TimedWatch;
  /** Every watch made so far, for the checks. */
  watches(): readonly TimedWatch[];
  /** A hash of its last moment — the moment, every node's voltage, every part's reading: two pages that show the same
   * moment, the same hash. */
  hash(): string;
}

/** What the driver drives (`driver.ts`). */
export interface TimedBoard extends Timeline {
  /**
   * The board now (a copy is taken): starts on it when it has not started or `fresh` (every capacitor as its operating
   * point says); a new shape or new damage rebuilds it (the charges by id); a new setting is written in.
   */
  follow(net: Netlist, key: string, damage: TimedDamage, fresh: boolean): void;
  /** The frame's time: `seconds` at `rate`, the fraction carried to the next frame; nothing on a frame of no time. */
  advance(seconds: number): void;
  /** Delete what it remembers of every part `gone` says left the bench for good (not one in the hand). */
  sweep(gone: (id: string) => boolean): void;
  /** Off: its board dropped; the next `follow` starts it again. */
  stop(): void;
  /** A part's reading at the last moment; null when it is not in the circuit now or not counted yet. */
  reading(id: string): PartReading | null;
  /** A node's voltage at the last moment (V); null for a node the board has not. */
  nodeVolts(node: number): number | null;
  /** A capacitor's voltage across its capacitance at the last moment (V); 0 for a bulged can; null for a part that is
   * not a capacitor or it has never seen. */
  volts(id: string): number | null;
}

/** The damage into its own state for every part of `net`: a part it names burnt or bulged, every other whole. */
function tell(state: ModelState, net: Netlist, damage: TimedDamage): void {
  const burnt = new Set(damage.burnt);
  const bulged = new Set(damage.bulged);
  for (const p of net.parts) {
    const memory = memoryOf(state, p.id);
    memory.burnt = burnt.has(p.id);
    memory.bulged = bulged.has(p.id);
  }
}

const damageKey = (d: TimedDamage): string => `${[...d.burnt].sort().join(',')}|${[...d.bulged].sort().join(',')}`;

interface Watch extends TimedWatch {
  below: boolean | null;
  fell: number;
  rose: number;
  /** The current's size at the last moment, null when the part was not in the circuit. */
  last: number | null;
}

/** The last moment's readings by id and node voltages, copied after every frame that moved (stable until the next). */
interface Moment {
  parts: Record<string, PartReading>;
  v: Float64Array;
}

export function createTimedBoard(clock: () => number): TimedBoard {
  const rate = TIMED.rate;
  const h = 1 / rate;
  let t: Transient | null = null;
  let own: ModelState = createModelState();
  let running = false;
  let ok = true;
  let reason: DcFailure | null = null;
  let key = '';
  let told = '';
  /** The moment of the last start on the timeline (the transient's own time starts at 0 there). */
  let base = 0;
  /** The fraction of a step owed to the next frame. */
  let owed = 0;
  let starts = 0;
  let steps = 0;
  let frameSteps = 0;
  let ms = 0;
  /** The settings of its own circuit's parts, by id, and those parts (a setting is written into them). */
  let parts = new Map<string, PartInstance>();
  const changedAt = new Map<string, number>();
  const watches = new Map<string, Watch>();
  let list: Watch[] = [];
  let moment: Moment = { parts: {}, v: new Float64Array(0) };

  const now = (): number => (t && running ? base + t.time : base);

  /** The moment now into `moment`: new objects, so a reading held by a chapter stays what it was. */
  const take = (): void => {
    const tr = t!;
    const readings: Record<string, PartReading> = {};
    for (const [id, r] of Object.entries(tr.parts)) readings[id] = { u: r.u, i: r.i, p: r.p };
    moment = { parts: readings, v: Float64Array.from(tr.v) };
  };

  /** Every watch's current at the last moment, a crossing between it and the one before told at `before` + a share
   * of the step. */
  const look = (before: number | null): void => {
    const tr = t!;
    for (const w of list) {
      const r = tr.parts[w.part];
      if (r === undefined) {
        w.last = null;
        w.below = null;
        continue;
      }
      const a = Math.abs(r.i);
      const prev = w.last;
      if (before !== null && prev !== null && prev !== a) {
        if (prev >= w.level && a < w.level) w.fell = before + (h * (prev - w.level)) / (prev - a);
        else if (prev < w.level && a >= w.level) w.rose = before + (h * (w.level - prev)) / (a - prev);
      }
      w.last = a;
      w.below = a < w.level;
    }
  };

  /** Its own circuit's parts by id, and their settings, after a build. */
  const index = (): void => {
    parts = new Map(t!.circuit.elements.map((e) => [e.part.id, e.part]));
  };

  const start = (net: Netlist, k: string, damage: TimedDamage): void => {
    base = now();
    own = createModelState();
    tell(own, net, damage);
    t = new Transient(structuredClone(net), { dt: h, state: own, fails: false });
    index();
    key = k;
    told = damageKey(damage);
    owed = 0;
    steps = 0;
    frameSteps = 0;
    ms = 0;
    changedAt.clear();
    running = t.start('dc');
    ok = running;
    reason = running ? null : (t.reason ?? 'singular');
    if (!running) return;
    starts++;
    take();
    look(null);
  };

  const board: TimedBoard = {
    rate,
    get running() {
      return running;
    },
    get ok() {
      return ok;
    },
    get reason() {
      return reason;
    },
    get now() {
      return now();
    },
    get starts() {
      return starts;
    },
    get steps() {
      return steps;
    },
    get frameSteps() {
      return frameSteps;
    },
    get ms() {
      return ms;
    },
    changed(id) {
      return changedAt.get(id) ?? Number.NaN;
    },
    changes() {
      return Object.fromEntries(changedAt);
    },
    watches() {
      return list;
    },
    watch(part, level) {
      const k = `${part}|${level}`;
      let w = watches.get(k);
      if (!w) {
        const r = running ? t?.parts[part] : undefined;
        const made: Watch = {
          part,
          level,
          below: r === undefined ? null : Math.abs(r.i) < level,
          fell: Number.NaN,
          rose: Number.NaN,
          last: r === undefined ? null : Math.abs(r.i),
          clear() {
            made.fell = Number.NaN;
            made.rose = Number.NaN;
          },
        };
        w = made;
        watches.set(k, w);
        list = [...watches.values()];
      }
      return w;
    },
    hash() {
      const ids = Object.keys(moment.parts).sort();
      const cells = new Float64Array(1 + moment.v.length + 3 * ids.length);
      cells[0] = now();
      cells.set(moment.v, 1);
      ids.forEach((id, k) => {
        const r = moment.parts[id]!;
        cells.set([r.u, r.i, r.p], 1 + moment.v.length + 3 * k);
      });
      return fnv1a(new Uint8Array(cells.buffer));
    },
    follow(net, k, damage, fresh) {
      if (fresh || !running || t === null) {
        start(net, k, damage);
        return;
      }
      const d = damageKey(damage);
      if (k !== key || d !== told) {
        // the damage first, into the state the build reads; the settings that changed with the shape are a change
        tell(own, net, damage);
        const was = new Map([...parts].map(([id, p]) => [id, p.setting]));
        t.rebuild(structuredClone(net));
        index();
        key = k;
        told = d;
        for (const p of net.parts) if (was.has(p.id) && was.get(p.id) !== p.setting) changedAt.set(p.id, now());
        return;
      }
      for (const p of net.parts) {
        const mine = parts.get(p.id);
        if (!mine || mine.setting === p.setting) continue;
        if (p.setting === undefined) delete mine.setting;
        else mine.setting = p.setting;
        changedAt.set(p.id, now());
      }
    },
    advance(seconds) {
      // a frame of no time takes no step and leaves the last frame's count and cost as they were
      if (!running || t === null || !(seconds > 0) || !Number.isFinite(seconds)) return;
      owed += seconds * rate;
      // a frame of 1/60 s is 80 steps to the last bit: no step lost to the rounding
      const n = Math.floor(owed + 1e-9);
      owed = Math.max(owed - n, 0);
      const t0 = clock();
      let done = 0;
      for (let k = 0; k < n; k++) {
        const before = now();
        if (!t.step()) {
          // the board stays at its last moment; the next frame tries again (its readings meanwhile: none)
          ok = false;
          reason = t.reason ?? 'singular';
          break;
        }
        ok = true;
        reason = null;
        done++;
        if (list.length > 0) look(before);
      }
      if (done > 0) take();
      steps += done;
      frameSteps = done;
      ms = clock() - t0;
    },
    sweep(gone) {
      for (const id of [...own.parts.keys()]) if (gone(id)) own.parts.delete(id);
    },
    stop() {
      base = now();
      t = null;
      running = false;
      ok = true;
      reason = null;
      steps = 0;
      frameSteps = 0;
      ms = 0;
      owed = 0;
      for (const w of list) {
        w.last = null;
        w.below = null;
      }
    },
    reading(id) {
      if (!running || !ok || t === null || !(id in t.parts)) return null;
      return moment.parts[id] ?? null;
    },
    nodeVolts(node) {
      if (!running || !ok || !Number.isInteger(node) || node < 0 || node >= moment.v.length) return null;
      return moment.v[node]!;
    },
    volts(id) {
      if (!running || !ok) return null;
      const memory = own.parts.get(id);
      if (memory?.bulged) return 0;
      return memory?.volts ?? null;
    },
  };
  return board;
}
