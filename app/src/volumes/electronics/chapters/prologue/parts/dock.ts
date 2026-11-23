/**
 * The dock's own controls (the script's «Бачимо»; VISUAL §9): the bar «Хвиля на динаміку» — the largest voltage on the
 * speaker over the last 0,5 s of what it sounded in this step, from the model's blocks that play (`speaker.peak`), one
 * scale of 0 … 4 V on `quiet`, `loud` and `stand`; the line that says the sound is off while the volume's output is
 * silent not by the circuit's will (`soundOff`: before the first gesture, with no sound at all, or the engine's sound
 * off or at 0). The volume knob's slider (`knobSlider`) and the battery's switch as a phone's toggle (`switchToggle`;
 * the scene keeps it showing the switch as it is) are `@electronics/shared/steps`'.
 */
import type { GaugeSpec, NoteSpec } from '@/hud';
import type { SoundState } from '@electronics/shared/sound';
import { WINDOWS } from './boards';

/** The dock's ids. */
export const WAVE_ID = 'wave';
export const SOUND_ID = 'sound-off';
export const VOLUME_ID = 'volume';

/**
 * The volume's sound is silent not by the circuit's will: its output never plays (`off`: `?noaudio`, no Web Audio) or
 * waits for the first gesture, or the engine's sound is off or at 0. Pure.
 */
export function soundOff(
  state: SoundState | null,
  settings: { readonly audio: boolean; readonly volume: number },
): boolean {
  return state === null || state === 'off' || state === 'waiting' || !settings.audio || !(settings.volume > 0);
}

/**
 * The step's crest on the speaker (V): the largest voltage over the last `seconds` heard, but nothing before `from`
 * (the first sample of the step's own board: a step's preset starts the model again, and what the speaker still
 * sounds of the board before is not the step's) — `peak` starts at the first whole chunk at or after it, so a chunk
 * that holds the last samples of the board before never counts. 0 while nothing of the step's board is heard yet.
 * Pure over the speaker's numbers.
 */
export function stepCrest(
  heard: number | null,
  from: number | null,
  seconds: number,
  peak: (seconds: number, start: number) => number | null,
): number {
  if (heard === null || from === null || heard <= from) return 0;
  return peak(seconds, from) ?? 0;
}

export function waveGauge(label: string, get: () => number): GaugeSpec {
  const [min, max] = WINDOWS.gauge;
  return { type: 'gauge', kind: 'linear', id: WAVE_ID, label, min, max, unit: 'V', digits: 2, get };
}

export function soundNote(text: string, off: () => boolean): NoteSpec {
  return { type: 'note', id: SOUND_ID, text, icon: 'soundOff', visible: off };
}
