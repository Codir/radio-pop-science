/**
 * The oscilloscope in the chapter's steps (VISUAL §5.2; the script's «Бачимо»): every step's scale and display, and how
 * far back the crests of `twice` look. The chart's words, the divisions' text and the crests' block are the bench's
 * chapters' own: `@electronics/shared/steps` (`scopeBoard`, `scopeWords`, `crestStats`).
 */
import type { ScopeSetup } from '@electronics/shared/instruments';

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
