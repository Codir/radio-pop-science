/**
 * What the bench's oscilloscope shows of the circuit (docs/volumes/electronics/VISUAL.md §5.2; synthesis §5.2), with no
 * three.js: the instrument in 3D is `scope.ts`, the arithmetic of a sweep `sweep.ts`.
 *
 * The samples are the circuit model's (the stream of blocks in time, `shared/model/live.ts`, or a held page's window,
 * `BenchModel.still`): one array per channel, the voltage of the row each probe is in, numbered by the stream. The
 * scope keeps the last of them in a ring per channel and, every frame, shows them up to the sample `now` (the one the
 * bench shows at this moment):
 *
 * - **sweep** — a sweep starts where channel `trigger.channel` crosses the trigger's level the way its slope says (the
 *   level: the step's, or the middle of the last span of that channel), within the last span of candidates and not
 *   before the end of the last sweep and its holdoff; with `auto` and no edge for a whole span it runs free (the last
 *   full span). At most one sweep a frame, and only of samples that have come.
 * - **roll** — the newest sample at the right edge, the trace moving left: the window of ten divisions kept in
 *   `ROLL_BUCKETS` buckets of the same length of time, each its smallest and largest sample; a roll that starts
 *   fills the window behind its first sample with that sample (the circuit at rest before the scope came).
 *
 * Each sweep (or each frame of a roll with new samples) is one `version`: up to `SWEEP_BUCKETS` × 2 points a channel
 * for the step's board chart (`chart`), and `SCREEN_POINTS` for the instrument's screen (`screen`) — the same samples
 * in fewer buckets. The scale is the step's, never picked by the scope: `voltsPerDiv` over eight divisions with the
 * ground line `ground` divisions from the middle, `timePerDiv` over ten; what is beyond the screen is cut at its edge.
 * A channel may have a scale of its own (`channelVolts`, E3-8), on the chart the right axis of channel 1. A held page
 * (`?freeze`) shows `hold`: one span after the first edge of the window the model computed at once. `peak` is a
 * channel's crest over the last seconds shown (E3-8), kept per chunk of `PEAK_CHUNK` samples as they are fed.
 */
import { fmtNumber } from '@/content/format';
import type { ChartSpec } from '@/hud';
import type { ChartApi } from '@/ui3d';
import { fnv1a } from '../model/hash';
import { decimateMinMax, findTrigger } from './sweep';

export type ScopeDisplay = 'sweep' | 'roll';
export type ScopeUnit = 'ms' | 's';

export interface ScopeTrigger {
  /** The channel it watches: 0 (the first) or 1. */
  readonly channel: 0 | 1;
  /** The level (V); null — the middle of the last span of its channel. */
  readonly level: number | null;
  /** 1 rising, −1 falling. */
  readonly slope: 1 | -1;
  /** With no edge for a whole span, run free. */
  readonly auto: boolean;
}

export interface ScopeSettings {
  readonly display: ScopeDisplay;
  /** s a division (ten across the screen). */
  readonly timePerDiv: number;
  /** V a division (eight up the screen). */
  readonly voltsPerDiv: number;
  /**
   * A channel's own V a division, as a real scope has a knob for each channel (null: `voltsPerDiv`; E3-8): its trace
   * on the screen and its axis on the chart. The board's chart draws channel 1 at its own scale on the right axis — a
   * chart made with `ScopeWords.y2`; without it every channel is drawn there at `voltsPerDiv`.
   */
  readonly channelVolts: readonly [number | null, number | null];
  /** Where 0 V is: divisions from the middle of the screen (−4 its bottom … 4 its top). */
  readonly ground: number;
  readonly trigger: ScopeTrigger;
  /** s after a sweep before the next may start. */
  readonly holdoff: number;
  /** The unit of time on the chart's axis (by default ms while the screen spans less than a second). */
  readonly unit: ScopeUnit;
}

/** What a step gives; the rest is `SCOPE_DEFAULTS`. */
export type ScopeSetup = Partial<Omit<ScopeSettings, 'trigger'>> & { readonly trigger?: Partial<ScopeTrigger> };

/** The screen's divisions (VISUAL §5.2). */
export const SCOPE_GRID = { x: 10, y: 8 } as const;
export const SCOPE_CHANNELS = 2;
/** A sweep on the board's chart: at most this many buckets, two points each (≤ 600 points a channel). */
export const SWEEP_BUCKETS = 300;
/** The instrument's screen: 80 buckets, 160 points (VISUAL §5.2). */
export const SCREEN_BUCKETS = 80;
export const SCREEN_POINTS = 2 * SCREEN_BUCKETS;
/** A roll's window in buckets of the same length of time. */
export const ROLL_BUCKETS = 300;
/** The colours of the two channels (VISUAL §2, §5.2). */
export const SCOPE_COLORS = ['lime', 'magenta'] as const;

/** The largest |v| of each channel is kept for every this many samples (10 ms at 24 000 a second): `peak`. */
export const PEAK_CHUNK = 240;
/** How many such chunks are kept: 5.12 s at 24 000 samples a second. */
const PEAK_CHUNKS = 512;

export const SCOPE_DEFAULTS: ScopeSettings = Object.freeze({
  display: 'sweep',
  timePerDiv: 0.002,
  voltsPerDiv: 1,
  channelVolts: Object.freeze([null, null] as const),
  ground: 0,
  trigger: Object.freeze({ channel: 0, level: null, slope: 1, auto: true }),
  holdoff: 0,
  unit: 'ms',
});

/** A step's setup with the defaults (the unit from the span when not given). */
export function scopeSettings(setup: ScopeSetup = {}): ScopeSettings {
  const timePerDiv = setup.timePerDiv ?? SCOPE_DEFAULTS.timePerDiv;
  const voltsPerDiv = setup.voltsPerDiv ?? SCOPE_DEFAULTS.voltsPerDiv;
  if (!(timePerDiv > 0 && Number.isFinite(timePerDiv)) || !(voltsPerDiv > 0 && Number.isFinite(voltsPerDiv)))
    throw new RangeError(`scope: time and volts a division above 0: ${timePerDiv}, ${voltsPerDiv}`);
  const [own1 = null, own2 = null] = setup.channelVolts ?? SCOPE_DEFAULTS.channelVolts;
  for (const v of [own1, own2])
    if (v !== null && !(v > 0 && Number.isFinite(v))) throw new RangeError(`scope: a channel's volts a division above 0: ${v}`);
  return {
    display: setup.display ?? SCOPE_DEFAULTS.display,
    timePerDiv,
    voltsPerDiv,
    channelVolts: [own1, own2],
    ground: setup.ground ?? SCOPE_DEFAULTS.ground,
    trigger: { ...SCOPE_DEFAULTS.trigger, ...setup.trigger },
    holdoff: setup.holdoff ?? SCOPE_DEFAULTS.holdoff,
    unit: setup.unit ?? (SCOPE_GRID.x * timePerDiv < 1 ? 'ms' : 's'),
  };
}

/** The unit's seconds: what a time in s is multiplied by on the chart. */
const UNIT_SCALE: Readonly<Record<ScopeUnit, number>> = { ms: 1000, s: 1 };

/** One channel's trace now: `n` points, the time on the chart's axis (`x`, in the settings' unit) and the volts. */
export interface ScopeTrace {
  readonly n: number;
  readonly x: Float64Array;
  readonly v: Float32Array;
}

/** What the checks read (`__app.read('electronics-scope')`, with the bench's own fields). */
export interface ScopeState {
  readonly display: ScopeDisplay;
  readonly fs: number;
  /** s across the screen. */
  readonly span: number;
  readonly unit: ScopeUnit;
  readonly timePerDiv: number;
  readonly voltsPerDiv: number;
  /** Each channel's own V a division (null: the common one), and the one each channel is shown at. */
  readonly channelVolts: readonly (number | null)[];
  readonly volts: readonly number[];
  readonly ground: number;
  /** The last sweep's trigger: its level (V; NaN when it ran free with its channel off), whether an edge started it,
   * the model's moment of its start (s). */
  readonly trigger: ScopeTrigger & { readonly used: number; readonly found: boolean; readonly at: number };
  readonly version: number;
  readonly sweeps: number;
  readonly holds: number;
  readonly on: readonly boolean[];
  readonly n: readonly number[];
  /** The smallest and largest volts of each channel's trace now (null: nothing shown). */
  readonly min: readonly (number | null)[];
  readonly max: readonly (number | null)[];
  /** The instrument's screen: each channel's lowest and highest point, −1 … 1 of its half height (null: not drawn). */
  readonly screen: readonly ({ readonly min: number; readonly max: number } | null)[];
  /** The model's moment (s) at x = 0 of the trace: a sweep's start, a roll's newest sample. */
  readonly t0: number;
  /** FNV-1a of the bytes of both channels' points: two pages that show the same, the same hash. */
  readonly hash: string;
  readonly points: readonly { readonly x: readonly number[]; readonly v: readonly number[] }[];
}

/** The words of a chart (the step's documents): an axis' title may follow the settings (V/div, time/div on it). */
export interface ScopeWords {
  readonly x: string | ((s: ScopeSettings) => string);
  /** The left axis: channel 2's scale with `y2`, the common one without. */
  readonly y: string | ((s: ScopeSettings) => string);
  /** The right axis, channel 1's at its own scale (`voltsOf(s, 0)`); without it the chart has the left one alone. */
  readonly y2?: string | ((s: ScopeSettings) => string);
  readonly ch1: string;
  readonly ch2: string;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** The V a division a channel is shown at: its own, or the common one. */
export function voltsOf(s: ScopeSettings, channel: number): number {
  return s.channelVolts[channel] ?? s.voltsPerDiv;
}

/** The volts the screen holds: from its bottom edge to its top one (of a channel at its own scale, when given). */
export function scopeRange(s: ScopeSettings, channel?: number): readonly [number, number] {
  const half = SCOPE_GRID.y / 2;
  const v = channel === undefined ? s.voltsPerDiv : voltsOf(s, channel);
  return [(0 - half - s.ground) * v, (SCOPE_GRID.y - half - s.ground) * v];
}

export class ScopeModel {
  readonly fs: number;
  /** How far the samples may come ahead of the one shown (the source's own lead), in samples. */
  readonly lookahead: number;
  private s: ScopeSettings;
  /** The probe of each channel is in a socket: an off channel shows nothing. */
  private readonly live: boolean[] = [true, true];
  // the ring: the last samples of each channel by the stream's index
  private ring: Float32Array[] = [];
  private head = 0;
  private held = 0;
  // the sweep
  private next = 0;
  private readonly tx: Float64Array[];
  private readonly tv: Float32Array[];
  private readonly tn: number[] = [0, 0];
  private readonly sx: Float64Array[];
  private readonly sv: Float32Array[];
  private readonly screens: Float32Array[];
  private t0 = 0;
  private trig = { used: Number.NaN, found: false, at: Number.NaN };
  // the roll: buckets of the window, each channel's smallest and largest sample with its index
  private rollAt = -1;
  private rollLen = 1;
  private readonly rLoV: Float64Array[];
  private readonly rLoI: Float64Array[];
  private readonly rHiV: Float64Array[];
  private readonly rHiI: Float64Array[];
  /** The ring of buckets: `rHead` the next to fill; `rCount` the samples in it so far. */
  private rHead = 0;
  private rCount = 0;
  private version_ = 0;
  private sweeps_ = 0;
  private holds_ = 0;
  /** The settings' revision (a chart follows a change of scale). */
  private settingsRev = 0;
  /** Scratch for the chart: the volts cut at the screen's edges. */
  private readonly cut = new Float32Array(2 * SWEEP_BUCKETS + 4);
  // the peaks: each channel's largest |v| of every chunk of PEAK_CHUNK samples, a ring by the chunk's own index
  private readonly pkId: Float64Array[];
  private readonly pkV: Float32Array[];
  /** The stream's index of the sample shown now (`update`); −1 before. */
  private shown = -1;

  constructor(fs: number, setup: ScopeSetup = {}, lookahead = 0) {
    if (!(fs > 0 && Number.isFinite(fs))) throw new RangeError(`scope: a rate above 0: ${fs}`);
    this.fs = fs;
    this.lookahead = Math.max(0, Math.ceil(lookahead));
    this.s = scopeSettings(setup);
    const many = <T>(make: () => T): T[] => Array.from({ length: SCOPE_CHANNELS }, make);
    this.tx = many(() => new Float64Array(2 * SWEEP_BUCKETS + 4));
    this.tv = many(() => new Float32Array(2 * SWEEP_BUCKETS + 4));
    this.sx = many(() => new Float64Array(SCREEN_POINTS));
    this.sv = many(() => new Float32Array(SCREEN_POINTS));
    this.screens = many(() => new Float32Array(SCREEN_POINTS));
    const buckets = (): Float64Array => new Float64Array(ROLL_BUCKETS + 1);
    this.rLoV = many(buckets);
    this.rLoI = many(buckets);
    this.rHiV = many(buckets);
    this.rHiI = many(buckets);
    this.pkId = many(() => new Float64Array(PEAK_CHUNKS).fill(-1));
    this.pkV = many(() => new Float32Array(PEAK_CHUNKS));
    this.fit();
  }

  get settings(): ScopeSettings {
    return this.s;
  }
  /** A step's scale and trigger: the sweep and the roll start again (the samples on the ring stay). */
  set settings(setup: ScopeSetup) {
    this.s = scopeSettings(setup);
    this.settingsRev++;
    this.fit();
    this.next = this.head - this.held;
    this.rollAt = -1;
    this.clear();
  }

  get version(): number {
    return this.version_;
  }
  get on(): readonly boolean[] {
    return this.live;
  }
  /** A channel's probe went into a socket (true) or out of it: an off channel shows nothing. */
  setOn(channel: number, on: boolean): void {
    if (this.live[channel] === on) return;
    this.live[channel] = on;
    this.version_++;
  }

  /** Samples a span of the screen. */
  get spanSamples(): number {
    return Math.max(2, Math.round(SCOPE_GRID.x * this.s.timePerDiv * this.fs));
  }

  /**
   * The ring big enough for what the display reads back and the source's lead: a sweep two spans and its holdoff, a
   * roll (which keeps its own buckets) two of its buckets. Made again only when a longer one is needed.
   */
  private fit(): void {
    const S = this.spanSamples;
    this.rollLen = Math.max(1, Math.round(S / ROLL_BUCKETS));
    const back = this.s.display === 'sweep' ? 2 * S + Math.ceil(this.s.holdoff * this.fs) : 2 * this.rollLen;
    const want = back + this.lookahead + 2;
    const have = this.ring[0]?.length ?? 0;
    if (want <= have) return;
    this.ring = Array.from({ length: SCOPE_CHANNELS }, () => new Float32Array(want));
    this.held = 0;
  }

  /** Nothing shown (a new board, a new scale): the next sweep or roll draws afresh. */
  private clear(): void {
    this.tn[0] = this.tn[1] = 0;
    this.trig = { used: Number.NaN, found: false, at: Number.NaN };
    this.version_++;
  }

  /** The time source started again (a step's new board): the ring, the sweep and the roll from nothing. */
  reset(): void {
    this.held = 0;
    this.next = this.head;
    this.rollAt = -1;
    for (const ids of this.pkId) ids.fill(-1);
    this.clear();
  }

  /** The stream's samples from `first` on, a channel each. A block that does not follow the last starts the ring afresh. */
  feed(first: number, samples: readonly ArrayLike<number>[]): void {
    const n = samples[0]?.length ?? 0;
    if (n === 0) return;
    if (first !== this.head) {
      this.held = 0;
      this.head = first;
      this.next = first;
      this.rollAt = -1;
    }
    const size = this.ring[0]!.length;
    for (let c = 0; c < SCOPE_CHANNELS; c++) {
      const src = samples[c];
      const dst = this.ring[c]!;
      for (let k = Math.max(0, n - size); k < n; k++) dst[(first + k) % size] = src ? src[k]! : 0;
      // the chunks' peaks, by the samples' own index
      const ids = this.pkId[c]!;
      const pk = this.pkV[c]!;
      for (let k = Math.max(0, n - PEAK_CHUNKS * PEAK_CHUNK); k < n; k++) {
        const chunk = Math.floor((first + k) / PEAK_CHUNK);
        const slot = chunk % PEAK_CHUNKS;
        if (ids[slot] !== chunk) {
          ids[slot] = chunk;
          pk[slot] = 0;
        }
        const a = src ? Math.abs(src[k]!) : 0;
        if (a > pk[slot]!) pk[slot] = a;
      }
    }
    this.head = first + n;
    this.held = Math.min(size, this.held + n);
  }

  /**
   * Every frame: show the samples up to `now` (the stream's index of the sample shown at this moment; never beyond
   * those that came). True when something new is drawn — a sweep, or a roll's new samples.
   */
  update(now: number): boolean {
    if (this.held === 0 || !Number.isFinite(now)) return false;
    const at = Math.min(Math.floor(now), this.head);
    this.shown = at;
    return this.s.display === 'sweep' ? this.sweep(at) : this.roll(at);
  }

  /**
   * A channel's largest |v| over the last `seconds` of the samples shown (up to the one `update` showed last; the
   * samples that came ahead of it do not count yet), within a chunk of `PEAK_CHUNK` samples at either end: a step's
   * readout of a wave's crest (E3-8). Null while the channel is off, or before any of its samples was shown.
   */
  peak(channel: number, seconds: number): number | null {
    if (!this.live[channel] || this.shown < 0 || !(seconds > 0)) return null;
    const ids = this.pkId[channel]!;
    const pk = this.pkV[channel]!;
    // the chunks wholly shown, whose end lies within the window
    const last = Math.floor(this.shown / PEAK_CHUNK) - 1;
    const first = Math.max(Math.floor((this.shown - seconds * this.fs) / PEAK_CHUNK), last - PEAK_CHUNKS + 1);
    let best = -1;
    for (let chunk = first; chunk <= last; chunk++) {
      const slot = ((chunk % PEAK_CHUNKS) + PEAK_CHUNKS) % PEAK_CHUNKS;
      if (ids[slot] === chunk && pk[slot]! > best) best = pk[slot]!;
    }
    return best < 0 ? null : best;
  }

  /** The middle of the smallest and the largest sample of `src` in [a, b) (a ring by index). */
  private middle(src: ArrayLike<number>, a: number, b: number): number {
    const n = src.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = a; i < b; i++) {
      const v = src[((i % n) + n) % n]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return lo <= hi ? (lo + hi) / 2 : Number.NaN;
  }

  private sweep(now: number): boolean {
    const S = this.spanSamples;
    const oldest = this.head - this.held;
    if (this.next < oldest) this.next = oldest;
    // the candidates: a full span must follow; only the recent ones (a scope shows the present, not a backlog)
    const latest = now - S;
    const from = Math.max(this.next, now - 2 * S, oldest + 1);
    if (latest < from) return false;
    const { channel, slope, auto } = this.s.trigger;
    let at = -1;
    let used = Number.NaN;
    if (this.live[channel]) {
      used = this.s.trigger.level ?? this.middle(this.ring[channel]!, Math.max(now - S, oldest), now);
      at = findTrigger(this.ring[channel]!, this.head, this.held, used, slope, from, latest);
    }
    const found = at >= 0;
    if (!found) {
      // no edge: wait for one, or with `auto` after a whole span of none run free with the last full span
      if (!auto || latest - this.next < S) return false;
      at = latest;
    }
    this.draw(this.ring, at, S, at / this.fs);
    this.trig = { used, found, at: at / this.fs };
    this.next = at + S + Math.round(this.s.holdoff * this.fs);
    this.sweeps_++;
    return true;
  }

  /**
   * A held page's window (`BenchModel.still`): one span after its first edge — or from its start when there is none —
   * the samples a channel each, the first of them at the model's moment `start` (s). A roll keeps what it shows.
   */
  hold(samples: readonly ArrayLike<number>[], start = 0): boolean {
    if (this.s.display !== 'sweep') return false;
    const n = samples[0]?.length ?? 0;
    const S = this.spanSamples;
    if (n < S) return false;
    const { channel, slope } = this.s.trigger;
    const src = samples[channel];
    let at = -1;
    let used = Number.NaN;
    if (this.live[channel] && src) {
      used = this.s.trigger.level ?? this.middle(src, 0, Math.min(n, 2 * S));
      at = findTrigger(src, n, n, used, slope, 1, n - S);
    }
    const found = at >= 0;
    if (!found) at = 0;
    this.draw(samples, at, S, start + at / this.fs);
    this.trig = { used, found, at: start + at / this.fs };
    this.holds_++;
    return true;
  }

  /** One sweep from the samples [at, at + S) of `src` (rings by index, or a held window's arrays). */
  private draw(src: readonly ArrayLike<number>[], at: number, S: number, t0: number): void {
    const scale = UNIT_SCALE[this.s.unit];
    for (let c = 0; c < SCOPE_CHANNELS; c++) {
      const s = src[c];
      if (!this.live[c] || !s || s.length === 0) {
        this.tn[c] = 0;
        continue;
      }
      this.tn[c] = decimateMinMax(s, at, S, SWEEP_BUCKETS, this.tx[c]!, this.tv[c]!, 0, scale / this.fs);
      const m = decimateMinMax(s, at, S, SCREEN_BUCKETS, this.sx[c]!, this.sv[c]!, 0, 1);
      this.toScreen(c, this.sv[c]!, m);
    }
    this.t0 = t0;
    this.version_++;
  }

  /** The screen's −1 … 1 (its bottom edge … its top one) of `m` volts; cut at the edges; fewer points: the last again. */
  private toScreen(c: number, volts: ArrayLike<number>, m: number): void {
    const out = this.screens[c]!;
    const half = SCOPE_GRID.y / 2;
    const { ground } = this.s;
    const voltsPerDiv = voltsOf(this.s, c);
    for (let k = 0; k < SCREEN_POINTS; k++) {
      const v = m > 0 ? volts[Math.min(k, m - 1)]! : 0;
      out[k] = clamp((v / voltsPerDiv + ground) / half, -1, 1);
    }
  }

  private roll(now: number): boolean {
    const L = this.rollLen;
    const oldest = this.head - this.held;
    if (this.rollAt < 0 || this.rollAt < oldest) {
      // a roll starts: the window behind its first sample holds that sample, the circuit as it was at rest
      const first = Math.max(oldest, Math.min(now, this.head) - 1);
      if (first < oldest || first >= this.head) return false;
      const size = this.ring[0]!.length;
      for (let c = 0; c < SCOPE_CHANNELS; c++) {
        const v = this.ring[c]![first % size]!;
        for (let b = 0; b < ROLL_BUCKETS; b++) {
          const i = first - (ROLL_BUCKETS - b) * L;
          this.rLoV[c]![b] = this.rHiV[c]![b] = v;
          this.rLoI[c]![b] = i;
          this.rHiI[c]![b] = i + L - 1;
        }
      }
      this.rHead = ROLL_BUCKETS;
      this.rCount = 0;
      this.rollAt = first;
    }
    if (this.rollAt >= now) return false;
    const size = this.ring[0]!.length;
    const B = ROLL_BUCKETS + 1;
    for (let i = this.rollAt; i < now; i++) {
      const b = this.rHead % B;
      for (let c = 0; c < SCOPE_CHANNELS; c++) {
        const v = this.ring[c]![i % size]!;
        if (this.rCount === 0 || v < this.rLoV[c]![b]!) {
          this.rLoV[c]![b] = v;
          this.rLoI[c]![b] = i;
        }
        if (this.rCount === 0 || v > this.rHiV[c]![b]!) {
          this.rHiV[c]![b] = v;
          this.rHiI[c]![b] = i;
        }
      }
      if (++this.rCount === L) {
        this.rHead++;
        this.rCount = 0;
      }
    }
    this.rollAt = now;
    this.drawRoll(now);
    return true;
  }

  /** The roll's points: the buckets inside the window [now − span, now), oldest first, and the one being filled. */
  private drawRoll(now: number): void {
    const B = ROLL_BUCKETS + 1;
    const S = this.spanSamples;
    const scale = UNIT_SCALE[this.s.unit] / this.fs;
    const last = this.rCount > 0 ? this.rHead : this.rHead - 1;
    const first = Math.max(0, last - ROLL_BUCKETS + 1);
    for (let c = 0; c < SCOPE_CHANNELS; c++) {
      let w = 0;
      if (this.live[c]) {
        for (let k = first; k <= last; k++) {
          const b = k % B;
          const lo = this.rLoI[c]![b]!;
          const hi = this.rHiI[c]![b]!;
          if (Math.min(lo, hi) < now - S) continue;
          const [i1, v1, i2, v2] =
            lo <= hi ? [lo, this.rLoV[c]![b]!, hi, this.rHiV[c]![b]!] : [hi, this.rHiV[c]![b]!, lo, this.rLoV[c]![b]!];
          this.tx[c]![w] = (i1 - now) * scale;
          this.tv[c]![w++] = v1;
          this.tx[c]![w] = (i2 - now) * scale;
          this.tv[c]![w++] = v2;
        }
      }
      this.tn[c] = w;
      // the screen: the window's points in SCREEN_BUCKETS groups, each its smallest and largest
      if (w > 0) this.toScreen(c, this.sv[c]!, decimateMinMax(this.tv[c]!, 0, w, SCREEN_BUCKETS, this.sx[c]!, this.sv[c]!, 0, 1));
    }
    this.t0 = now / this.fs;
    this.version_++;
  }

  /** A channel's trace now (the chart's points). */
  trace(channel: number): ScopeTrace {
    return { n: this.tn[channel] ?? 0, x: this.tx[channel]!, v: this.tv[channel]! };
  }

  /** A channel's points on the instrument's screen (−1 … 1 of its half height), or null while it shows nothing. */
  screen(channel: number): Float32Array | null {
    return this.live[channel] && (this.tn[channel] ?? 0) > 0 ? this.screens[channel]! : null;
  }

  /**
   * The step's board chart (VISUAL §5.2): time across, volts up, ten and eight divisions, the step's scale, the
   * channels `lime` and `magenta`. `init` (every entry of a step: its charts are made again) draws the last sweep;
   * `update` draws again only when there is a new one.
   */
  chart(id: string, words: ScopeWords, height = 220): ChartSpec {
    const seen = new WeakMap<ChartApi, { version: number; settings: number }>();
    const text = (w: string | ((s: ScopeSettings) => string)): string => (typeof w === 'string' ? w : w(this.s));
    // with a right axis channel 1 is drawn on it at its own scale, channel 2 on the left one at its own
    const two = words.y2 !== undefined;
    const scaleOf = (ch: number): number | undefined => (two ? ch : undefined);
    const axes = (c: ChartApi): void => {
      const { x, y, y2 } = this.axes(two);
      c.setAxis('x', { ...x, label: text(words.x) });
      c.setAxis('y', { ...y, label: text(words.y) });
      if (two) c.setAxis('y2', { ...y2, label: text(words.y2!) });
    };
    const draw = (c: ChartApi): void => {
      for (let ch = 0; ch < SCOPE_CHANNELS; ch++) {
        const [lo, hi] = scopeRange(this.s, scaleOf(ch));
        const { n, x, v } = this.trace(ch);
        const shown = this.live[ch] ? n : 0;
        for (let k = 0; k < shown; k++) this.cut[k] = clamp(v[k]!, lo, hi);
        c.setData(`ch${ch + 1}`, x.subarray(0, shown), this.cut.subarray(0, shown));
      }
    };
    const { x, y, y2 } = this.axes(two);
    return {
      type: 'chart',
      id,
      chart: {
        height,
        x: { ...x, label: text(words.x) },
        y: { ...y, label: text(words.y) },
        ...(two ? { y2: { ...y2, label: text(words.y2!) } } : {}),
        series: [
          { id: 'ch1', label: words.ch1, color: SCOPE_COLORS[0], width: 2, ...(two ? { axis: 'y2' as const } : {}) },
          { id: 'ch2', label: words.ch2, color: SCOPE_COLORS[1], width: 2 },
        ],
        legend: true,
      },
      init: (c) => {
        axes(c);
        draw(c);
        seen.set(c, { version: this.version_, settings: this.settingsRev });
      },
      update: (c) => {
        const was = seen.get(c);
        if (was?.settings !== this.settingsRev) axes(c);
        if (was?.version === this.version_ && was.settings === this.settingsRev) return;
        draw(c);
        seen.set(c, { version: this.version_, settings: this.settingsRev });
      },
    };
  }

  /**
   * The chart's axes for the settings now: a tick every division, a label every other on the time's. With `two`
   * the left one is channel 2's scale and the right one channel 1's; without, the left one is the common scale.
   */
  private axes(two = false) {
    const { timePerDiv, unit, display, voltsPerDiv, ground } = this.s;
    const scale = UNIT_SCALE[unit];
    const shift = display === 'roll' ? SCOPE_GRID.x : 0;
    const xt = Array.from({ length: SCOPE_GRID.x + 1 }, (_, k) => (k - shift) * timePerDiv * scale);
    const half = SCOPE_GRID.y / 2;
    const volts = (v: number) => {
      const t = Array.from({ length: SCOPE_GRID.y + 1 }, (_, k) => (k - half - ground) * v);
      return { min: t[0]!, max: t[SCOPE_GRID.y]!, ticks: t, format: fmtTick };
    };
    const label = (v: number): string => {
      const k = Math.round(v / (timePerDiv * scale)) + shift;
      return k % 2 === 0 ? fmtTick(v) : '';
    };
    return {
      x: { min: xt[0]!, max: xt[SCOPE_GRID.x]!, ticks: xt, format: label },
      y: volts(two ? voltsOf(this.s, 1) : voltsPerDiv),
      y2: volts(voltsOf(this.s, 0)),
    };
  }

  state(): ScopeState {
    const points = [0, 1].map((c) => {
      const { n, x, v } = this.trace(c);
      const shown = this.live[c] ? n : 0;
      return { x: Array.from(x.subarray(0, shown)), v: Array.from(v.subarray(0, shown)) };
    });
    const parts: Uint8Array[] = [];
    for (let c = 0; c < SCOPE_CHANNELS; c++) {
      const { n, x, v } = this.trace(c);
      const shown = this.live[c] ? n : 0;
      parts.push(new Uint8Array(x.buffer, 0, shown * 8), new Uint8Array(v.buffer, 0, shown * 4));
    }
    const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let off = 0;
    for (const p of parts) {
      all.set(p, off);
      off += p.length;
    }
    return {
      display: this.s.display,
      fs: this.fs,
      span: SCOPE_GRID.x * this.s.timePerDiv,
      unit: this.s.unit,
      timePerDiv: this.s.timePerDiv,
      voltsPerDiv: this.s.voltsPerDiv,
      channelVolts: [...this.s.channelVolts],
      volts: [voltsOf(this.s, 0), voltsOf(this.s, 1)],
      ground: this.s.ground,
      trigger: { ...this.s.trigger, ...this.trig },
      version: this.version_,
      sweeps: this.sweeps_,
      holds: this.holds_,
      on: [...this.live],
      n: points.map((p) => p.x.length),
      min: points.map((p) => (p.v.length ? Math.min(...p.v) : null)),
      max: points.map((p) => (p.v.length ? Math.max(...p.v) : null)),
      screen: [0, 1].map((c) => {
        const v = this.screen(c);
        return v ? { min: Math.min(...v), max: Math.max(...v) } : null;
      }),
      t0: this.t0,
      hash: fnv1a(all),
      points,
    };
  }
}

/** A tick's text: a number with a decimal comma and no more digits than it needs (three significant at most). */
function fmtTick(v: number): string {
  return Math.abs(v) < 1e-12 ? '0' : fmtNumber(v, { maxDigits: Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v)))) });
}
