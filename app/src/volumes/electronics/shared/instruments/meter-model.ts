/**
 * What the bench's multimeter reads and shows (docs/volumes/electronics/VISUAL.md §5.1; synthesis §5.1), with no
 * three.js: the instrument in 3D is `meter.ts`, its probes `probe.ts`.
 *
 * - **V** — the voltage from the red probe's row to the black one's, in the circuit now on the board. An ideal
 *   voltmeter: it takes no current.
 * - **A** — the meter is a wire between its probes (`METER`, the catalog's jumper, 1 mΩ), a part of the circuit like
 *   any other (`meterExtra`, which the bench's model driver takes in at every sync): the current that flows into the
 *   red probe. Put across the battery it is an honest short (plan decision 8): no fuse.
 * - **Ω** — the meter's own small test current through the circuit with its sources out (`BenchModel.ohms`); «OL»
 *   when no current flows or the resistance is beyond `OHM_LIMIT`.
 *
 * A probe out of a socket reads nothing («—»); so does the meter turned off. The display shows four significant
 * digits with a decimal comma and an SI prefix («5,997 V», «4,700 kΩ») and, as a real meter's, refreshes every
 * `METER_REFRESH` of engine time, holding its last reading between; when the model has no good solution it keeps what
 * it shows (G7). The «—» and «OL» are the instrument's symbols, not words.
 */
import { fmtUnit } from '@/content/format';
import type { PartInstance } from '@electronics/sim/core';
import type { BoardLayout, SocketId } from '@electronics/sim/board';
import type { BenchModel } from '../model';

/** The modes of the dial: off, volts, amperes, ohms (VISUAL §5.1). */
export type MeterMode = 'off' | 'V' | 'A' | 'ohm';
export const METER_MODES: readonly MeterMode[] = ['off', 'V', 'A', 'ohm'];
export type MeterUnit = 'V' | 'A' | 'Ω';
export const UNIT: Readonly<Record<Exclude<MeterMode, 'off'>, MeterUnit>> = { V: 'V', A: 'A', ohm: 'Ω' };

/** The display reads again every this many seconds of engine time (VISUAL §5.1, `METER_REFRESH`, plan decision 7). */
export const METER_REFRESH = 0.33;
/** The id of the meter in the circuit, in the A mode. */
export const METER_ID = 'METER';
/** Above this the Ω mode says «OL» (Ω): the top range of a pocket meter (the plan's decision, made in task E2-6); the
 * catalog's largest resistor is 10 MΩ. */
export const OHM_LIMIT = 40e6;

/** The two probes: red into the meter's «V Ω A» jack, black into «COM». */
export type ProbeName = 'red' | 'black';
export const PROBE_NAMES: readonly ProbeName[] = ['red', 'black'];
/** The socket each probe's tip is in, or null. A probe takes no socket of the board: it touches what is there. */
export type ProbeSockets = Readonly<Record<ProbeName, SocketId | null>>;

const nodeOf = (layout: BoardLayout, socket: SocketId | null): number | null =>
  socket === null ? null : (layout.socket(socket)?.node ?? null);

/** The meter's own part in the board's circuit: in the A mode with both tips in sockets, a wire between them. */
export function meterExtra(layout: BoardLayout, mode: MeterMode, probes: ProbeSockets): PartInstance[] {
  if (mode !== 'A') return [];
  const red = nodeOf(layout, probes.red);
  const black = nodeOf(layout, probes.black);
  return red === null || black === null ? [] : [{ id: METER_ID, spec: 'jumper', pins: [red, black] }];
}

/**
 * What the meter reads now (SI): a number (Infinity in the Ω mode: no current flows); null — nothing to read (off, a
 * probe out); undefined — the model has no good solution of the circuit now on the board (or has not taken the meter
 * in yet): keep what is shown.
 */
export function readMeter(
  layout: BoardLayout,
  model: BenchModel,
  mode: MeterMode,
  probes: ProbeSockets,
): number | null | undefined {
  if (mode === 'off') return null;
  const red = nodeOf(layout, probes.red);
  const black = nodeOf(layout, probes.black);
  if (red === null || black === null) return null;
  if (!model.ok) return undefined;
  if (mode === 'V') {
    const a = model.nodeVolts(red);
    const b = model.nodeVolts(black);
    return a === null || b === null ? undefined : a - b;
  }
  if (mode === 'A') return model.reading(METER_ID)?.i ?? undefined;
  return model.ohms(red, black) ?? undefined;
}

/** The ranges of each unit: the prefixes the display steps through, smallest first. */
const RANGES: Readonly<Record<MeterUnit, readonly (readonly [number, string])[]>> = {
  V: [
    [1e-3, 'm'],
    [1, ''],
  ],
  A: [
    [1e-6, 'μ'],
    [1e-3, 'm'],
    [1, ''],
  ],
  Ω: [
    [1, ''],
    [1e3, 'k'],
    [1e6, 'M'],
  ],
};

/**
 * Four significant digits, a decimal comma, the range's SI prefix: `(5.997, 'V')` → «5,997 V», `(4700, 'Ω')` →
 * «4,700 kΩ», `(0.5, 'V')` → «500,0 mV». The range is picked on the rounded value (0.99996 V is «1,000 V»); below the
 * lowest range the display keeps that range's resolution («0,005 mV»), and what rounds to nothing there is plain
 * zero in the base unit («0,000 V»). No-break space before the unit.
 */
export function formatReading(value: number, unit: MeterUnit): string {
  const ranges = RANGES[unit];
  const abs = Math.abs(value);
  const rounded = Number(abs.toPrecision(4));
  const at = (f: number): boolean => rounded >= f * (1 - 1e-12);
  let [factor, prefix] = ranges[0]!;
  for (const [f, p] of ranges) if (at(f)) [factor, prefix] = [f, p];
  // the decimals from the rounded value in its range: 99.996 Ω is «100,0 Ω», not «100,00 Ω»
  const r = rounded / factor;
  const digits = r >= 1000 * (1 - 1e-12) ? 0 : r >= 100 * (1 - 1e-12) ? 1 : r >= 10 * (1 - 1e-12) ? 2 : 3;
  const m = abs / factor;
  if (Number(m.toFixed(digits)) === 0) return fmtUnit(0, unit, { digits: 3, group: false });
  return fmtUnit(value < 0 ? -m : m, prefix + unit, { digits, group: false });
}

/** The text of a reading: «—» for nothing (or a mode turned off), «OL» for an open circuit or a resistance beyond the
 * top range, else the number. */
export function meterText(mode: MeterMode, value: number | null): string {
  if (mode === 'off' || value === null || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value) || (mode === 'ohm' && value > OHM_LIMIT)) return 'OL';
  return formatReading(value, UNIT[mode]);
}

/** The meter's display: what it shows now, refreshed as a real meter's. */
export interface MeterDisplay {
  /** What the display shows (SI): Infinity — «OL», null — «—». */
  readonly value: number | null;
  readonly text: string;
  /** How many times it read (the checks count them). */
  readonly refreshes: number;
  /**
   * Every frame, after the model was synced: `live` is `readMeter` now. The display reads it every `METER_REFRESH`
   * of engine time, at once on its first frame, when the mode turned, or with `now` (a deep link); `undefined` keeps
   * what it shows.
   */
  update(dt: number, mode: MeterMode, live: number | null | undefined, now?: boolean): void;
}

export function createMeterDisplay(): MeterDisplay {
  let value: number | null = null;
  let text = '—';
  let refreshes = 0;
  let since = 0;
  let mode: MeterMode | null = null;
  return {
    get value() {
      return value;
    },
    get text() {
      return text;
    },
    get refreshes() {
      return refreshes;
    },
    update(dt, next, live, now = false) {
      since += Math.max(dt, 0);
      const turned = next !== mode;
      mode = next;
      if (!now && !turned && since < METER_REFRESH - 1e-9) return;
      // the next refresh one period after this one (a long frame never makes two in a row)
      since = now || turned ? 0 : Math.max(since - METER_REFRESH, 0);
      if (since >= METER_REFRESH) since = 0;
      if (live === undefined) return;
      refreshes++;
      value = live;
      text = meterText(next, live);
    },
  };
}
