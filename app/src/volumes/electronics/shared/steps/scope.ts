/**
 * The oscilloscope in a step's panel (VISUAL §5.2): the words of the board's chart — an axis' title is a caption of the
 * step («напруга, V», «час, ms») with its division beside it, the number and the unit from the code and the words
 * «на поділку» a caption («2,5 V на поділку», «5 ms на поділку») — and the crests of both channels over a step's
 * seconds. A chapter keeps its own scales and displays (`ScopeSetup`) and passes its words in. Pure but for the chart,
 * which the bench's scope makes.
 */
import { fmtNumber, fmtSI, fmtUnit, NBSP } from '@/content/format';
import type { StatsSpec } from '@/hud';
import type { Bench } from '../bench';
import { voltsOf, type ScopeSettings, type ScopeWords } from '../instruments';

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
  /** Channel 1 on the right axis (`meter/twice`): the titles share the width (`scopeWords`). */
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

/** The step's board: its title («Осцилограф») and the chart of the bench's scope. */
export function scopeBoard(bench: Bench, id: string, title: string, words: ChartWords) {
  return { title, size: 'md' as const, children: [bench.oscilloscope.chart(id, scopeWords(words))] };
}

/** A crest as a readout shows it: three decimals («0,060 V»); «—» with nothing to read. */
export function crestText(v: number | null): string {
  return v === null ? '—' : `${fmtNumber(v, { digits: 3 })}${NBSP}V`;
}

/**
 * Both channels' crests over the last `seconds` (`ScopeModel.peak`), side by side, «—» while a probe is out: one block
 * of two numbers (`stats`), not two readouts. The dock puts its readouts after every block, so a control declared
 * between would stand before them, and on a phone's sheet at its height on entry their numbers fell under the bottom
 * navigation (review of E3-8); a block keeps the place it is declared at.
 */
export function crestStats(bench: Bench, id: string, labels: readonly [string, string], seconds: number): StatsSpec {
  return {
    type: 'stats',
    id,
    columns: 2,
    items: labels.map((label, channel) => ({
      label,
      get: () => crestText(bench.oscilloscope.model.peak(channel, seconds)),
    })),
  };
}
