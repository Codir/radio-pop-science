/**
 * The dock's controls (VISUAL §5.1, §9): the multimeter's dial switch (`meter-mode`: the positions a step offers —
 * «вимкнено» is a word of the step's captions, V and A are the instrument's symbols) and its number (`meter`, a text
 * readout, no count-up); and what a phone needs instead of what its shot leaves out — the tray's slots as buttons
 * that put a new part over the board (`hands.offer`), the battery's switch and the player as toggles. The scene keeps
 * the toggles showing the switch and the player as they are (a step sets them; a tap on the slider or the player
 * flips them). Copied in its shape from the chapter `resistor`'s `parts/dock.ts` and `parts/meter.ts`.
 */
import type { ButtonSpec, ReadoutSpec, SegmentedSpec, ToggleSpec } from '@/hud';
import type { Bench } from '@electronics/shared/bench';
import type { MeterMode } from '@electronics/shared/instruments';

export const MODE_ID = 'meter-mode';
export const READOUT_ID = 'meter';
/** The dock's id of the battery's switch and of the player. */
export const SWITCH_ID = 'battery-switch';
export const PLAYER_ID = 'player';
/** The dock's id of a tray slot's button. */
export const trayButtonId = (spec: string): string => `tray-${spec}`;

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

export function trayButtons(
  bench: Bench,
  specs: readonly string[],
  label: (spec: string) => string,
  phone: () => boolean,
): ButtonSpec[] {
  return specs.map((spec) => ({
    type: 'button' as const,
    id: trayButtonId(spec),
    label: label(spec),
    visible: phone,
    disabled: () => bench.flying || !(bench.hands.policy?.take(`tray:${spec}`) ?? false),
    onClick: () => void bench.hands.offer(spec),
  }));
}

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

/** The player as a toggle (a phone: its box is out of the shot `phone`); `set` plays or stops it. */
export function playerToggle(label: string, phone: () => boolean, set: (on: boolean) => void): ToggleSpec {
  return { type: 'toggle', id: PLAYER_ID, label, value: false, visible: phone, onChange: set };
}
