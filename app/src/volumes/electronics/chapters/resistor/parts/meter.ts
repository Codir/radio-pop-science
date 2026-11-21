/**
 * The multimeter in the step's panel (VISUAL §5.1): the dial's switch (`meter-mode`, the positions a step offers —
 * «вимкнено» is a word of the step's captions, V, A and Ω are the instrument's symbols) and the number (`meter`, a
 * text readout, no count-up). Every step that shows the meter declares them anew; `reset` brings the dial back.
 */
import type { ReadoutSpec, SegmentedSpec } from '@/hud';
import type { Bench } from '@electronics/shared/bench';
import type { MeterMode } from '@electronics/shared/instruments';

export const MODE_ID = 'meter-mode';
export const READOUT_ID = 'meter';

/** The symbol on the dial of a mode that has one. */
const SYMBOL: Readonly<Record<Exclude<MeterMode, 'off'>, string>> = { V: 'V', A: 'A', ohm: 'Ω' };

export function meterSwitch(
  bench: Bench,
  label: string,
  modes: readonly MeterMode[],
  off: string,
  value: MeterMode,
): SegmentedSpec {
  return {
    type: 'segmented',
    id: MODE_ID,
    label,
    items: modes.map((m) => ({ id: m, label: m === 'off' ? off : SYMBOL[m] })),
    value,
    disabled: () => bench.flying,
    onChange: (m: string) => (bench.multimeter.mode = m as MeterMode),
  };
}

export function meterReadout(bench: Bench, label: string): ReadoutSpec {
  return bench.multimeter.readout(READOUT_ID, label);
}
