/**
 * The oscilloscope in the chapter's steps (VISUAL §5.2; the script's «Бачимо»): every step's scale and display, the
 * words of the board's chart — an axis' title is a caption («напруга, V», «час, ms») with its division beside it, the
 * number and the unit from the code and the words «на поділку» a caption («2,5 V на поділку», «5 ms на поділку») —, and
 * the crest readouts of `twice`. Pure but for the chart, which the bench's scope makes.
 */
import { fmtNumber, fmtSI, fmtUnit, NBSP } from '@/content/format';
import type { ReadoutSpec } from '@/hud';
import type { Bench } from '@electronics/shared/bench';
import type { ScopeSettings, ScopeSetup, ScopeWords } from '@electronics/shared/instruments';
import { voltsOf } from '@electronics/shared/instruments';

/** `flat`: a roll of 0,5 s a division (5 s on the screen), 2,5 V a division with 0 V in the middle (±10 V). */
export const FLAT: ScopeSetup = Object.freeze({ display: 'roll', timePerDiv: 0.5, voltsPerDiv: 2.5, ground: 0 } as const);
/** `wave`, `notes`: sweeps triggered by channel 1 (`auto`), 0,1 V a division with 0 V in the middle (±0,4 V). */
export const WAVE: ScopeSetup = Object.freeze({
  display: 'sweep',
  timePerDiv: 0.005,
  voltsPerDiv: 0.1,
  ground: 0,
  trigger: { channel: 0, slope: 1, auto: true },
} as const);
/** `notes`: the switch «Час на поділку» — 20, 5 (on entry) and 1 ms a division. */
export const NOTES_TIMES = Object.freeze([0.02, 0.005, 0.001] as const);
export const NOTES_ENTRY = 0.005;
/** `twice`: 1 ms a division, one scale of 0,25 V for both channels (±1 V); channel 1 may take 0,02 V of its own. */
export const TWICE: ScopeSetup = Object.freeze({
  display: 'sweep',
  timePerDiv: 0.001,
  voltsPerDiv: 0.25,
  channelVolts: [null, null] as const,
  ground: 0,
  trigger: { channel: 0, slope: 1, auto: true },
} as const);
export const TWICE_ZOOM = 0.02;
/** `twice`: the crest readouts look back this long (s), as the prologue's «Хвиля на динаміку». */
export const CREST_SECONDS = 0.5;

/** A time a division as the chart and the dock say it: «0,5 s», «20 ms», «5 ms», «1 ms». */
export const timeText = (s: number): string => (s >= 0.1 ? fmtUnit(s, 's') : fmtSI(s, 's'));
/** Volts a division as the chart and the dock say them: «2,5 V», «0,25 V», «0,1 V», «0,02 V». */
export const voltsText = (v: number): string => fmtUnit(v, 'V', { maxDigits: 3 });
/** A division with its words: «2,5 V на поділку». */
export const perDivision = (value: string, words: string): string => `${value}${NBSP}${words}`;

/** The chart's words for a step: the axes' captions, the division word, the channels' names. */
export interface ChartWords {
  readonly volts: string;
  readonly time: string;
  readonly division: string;
  readonly ch1: string;
  /** '' — the channel has no name in the step (one probe): kept out of the legend. */
  readonly ch2: string;
  /** Channel 1 on the right axis (`twice`): the titles share the width (`scopeWords`). */
  readonly own?: boolean;
}

/** An axis' title: its caption, then its division (VISUAL §5.2: the scale on the axis). */
export function axisTitle(caption: string, division: string): string {
  return `${caption} · ${division}`;
}

/**
 * The chart's words. With `own` (channel 1 on the right axis) the titles over the plot's top corners share its width:
 * while both channels have one scale the left one says it all and the right one nothing (its ticks are the left
 * one's); once channel 1 has a scale of its own each says its volts a division alone («0,25 V», «0,02 V»), in its
 * line's colour over its own ticks — two longer titles side by side do not fit over the chart of a phone 360 px wide.
 */
export function scopeWords(w: ChartWords): ScopeWords {
  const division = (v: number): string => perDivision(voltsText(v), w.division);
  const own = (s: ScopeSettings): boolean => s.channelVolts[0] !== null;
  return {
    x: (s: ScopeSettings) => axisTitle(w.time, perDivision(timeText(s.timePerDiv), w.division)),
    y: (s: ScopeSettings) =>
      w.own && own(s) ? voltsText(voltsOf(s, 1)) : axisTitle(w.volts, division(w.own ? voltsOf(s, 1) : s.voltsPerDiv)),
    ...(w.own ? { y2: (s: ScopeSettings) => (own(s) ? voltsText(voltsOf(s, 0)) : '') } : {}),
    ch1: w.ch1,
    ch2: w.ch2,
  };
}

/** The step's board: the title «Осцилограф» and the chart of the bench's scope. */
export function scopeBoard(bench: Bench, id: string, title: string, words: ChartWords) {
  return { title, size: 'md' as const, children: [bench.oscilloscope.chart(id, scopeWords(words))] };
}

/** A crest as the readout shows it: three decimals («0,060 V»); «—» with nothing to read. */
export function crestText(v: number | null): string {
  return v === null ? '—' : `${fmtNumber(v, { digits: 3 })}${NBSP}V`;
}

/** The readout of a channel's crest over the last `CREST_SECONDS` (`twice`): «—» while its probe is out. */
export function crestReadout(bench: Bench, id: string, label: string, channel: 0 | 1): ReadoutSpec {
  return { type: 'readout', id, label, text: () => crestText(bench.oscilloscope.model.peak(channel, CREST_SECONDS)) };
}
