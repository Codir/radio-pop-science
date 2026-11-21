/**
 * A copy of `chapters/resistor/parts/dock.ts`, unchanged but for this note: a chapter never imports another chapter.
 *
 * The dock's controls a phone needs instead of what its shot leaves out (VISUAL §9): the tray's slots as buttons that
 * put a new part over the board (`hands.offer`) and the battery's switch as a toggle bound to `bench.closed` (the step
 * may set it too: the scene keeps the toggle showing the switch as it is). Shown on a phone only.
 */
import type { ButtonSpec, ToggleSpec } from '@/hud';
import type { Bench } from '@electronics/shared/bench';

/** The dock's id of a tray slot's button. */
export const trayButtonId = (spec: string): string => `tray-${spec}`;
/** The dock's id of the battery's switch. */
export const SWITCH_ID = 'battery-switch';

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
