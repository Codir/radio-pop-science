/**
 * The dock's controls (the script's «Бачимо»; VISUAL §9): the bar «Хвиля на динаміку» — the largest voltage on the
 * speaker over the last 0,5 s of what it sounded in this step, from the model's blocks that play (`speaker.peak`), one
 * scale of 0 … 4 V on `quiet`, `loud` and `stand`; the line that says the sound is off while the volume's output is
 * silent not by the circuit's will (`soundOff`: before the first gesture, with no sound at all, or the engine's sound
 * off or at 0); the volume knob as a slider; and the battery's switch as a toggle where the shot leaves the switch out
 * (a phone). The scene keeps the toggle showing the switch as it is.
 */
import { fmtPercent } from '@/content/format';
import type { GaugeSpec, NoteSpec, SliderSpec, ToggleSpec } from '@/hud';
import { setSetting, type Bench } from '@electronics/shared/bench';
import type { SoundState } from '@electronics/shared/sound';
import { IDS, WINDOWS } from './boards';

/** The dock's ids. */
export const WAVE_ID = 'wave';
export const SOUND_ID = 'sound-off';
export const SWITCH_ID = 'battery-switch';
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

/** The volume knob («Гучність», «тихо» at 0, «гучно» at 1): the model's setting of the pot; the knob follows it. */
export function volumeSlider(bench: Bench, words: { label: string; low: string; high: string }, value: number): SliderSpec {
  const set = (v: number): void => void setSetting(bench.state, IDS.pot, v);
  return {
    type: 'slider',
    id: VOLUME_ID,
    label: words.label,
    min: 0,
    max: 1,
    step: 0.01,
    value,
    marks: [
      { value: 0, label: words.low },
      { value: 1, label: words.high },
    ],
    format: (v: number) => fmtPercent(v),
    disabled: () => bench.flying,
    onInput: set,
    onChange: set,
  };
}

/** The battery's switch as a toggle, shown on a phone only (its shot leaves the battery's box out). */
export function switchToggle(bench: Bench, label: string, phone: () => boolean): ToggleSpec {
  return {
    type: 'toggle',
    id: SWITCH_ID,
    label,
    value: false,
    visible: phone,
    disabled: () => bench.flying || !(bench.hands.policy?.take('switch') ?? false),
    onChange: (on: boolean) => (bench.closed = on ? 1 : 0),
  };
}
