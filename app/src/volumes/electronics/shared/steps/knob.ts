/**
 * A pot's knob in the step's panel (VISUAL §4.3: the hand does not turn the knob on the board): a slider 0 … 1 whose
 * value is the model's setting of the part (`setSetting` on every move — a drag, a click, a key), the knob on the board
 * following it within 0.15 s; the marks at its ends are the step's words («тихо», «гучно»), the value a percentage.
 * Off while the camera flies. A step sets the slider's value on entry (`ui.set(id, v)`) with the setting it puts.
 */
import { fmtPercent } from '@/content/format';
import type { SliderSpec } from '@/hud';
import { setSetting, type Bench } from '../bench';

export function knobSlider(
  bench: Bench,
  id: string,
  partId: string,
  label: string,
  marks: readonly { value: number; label: string }[],
  value = 0.5,
): SliderSpec {
  const set = (v: number): void => void setSetting(bench.state, partId, v);
  return {
    type: 'slider',
    id,
    label,
    min: 0,
    max: 1,
    step: 0.01,
    value,
    marks,
    format: (v: number) => fmtPercent(v),
    disabled: () => bench.flying,
    onInput: set,
    onChange: set,
  };
}
