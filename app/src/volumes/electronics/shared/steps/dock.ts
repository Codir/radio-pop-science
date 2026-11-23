/**
 * The dock's controls a phone needs instead of what its shot leaves out (VISUAL §9): the tray's slots as buttons that
 * put a new part over the board (`hands.offer`), the battery's switch as a toggle bound to `bench.closed` and the player
 * as a toggle that plays or stops it (a step may set them too: the chapter's scene keeps the toggles showing the switch
 * and the player as they are). Shown on a phone only — but the switch of a step that works it inside a part.
 */
import type { ButtonSpec, ToggleSpec } from '@/hud';
import type { Bench } from '../bench';

/** The dock's id of a tray slot's button. */
export const trayButtonId = (spec: string): string => `tray-${spec}`;
/** The dock's id of the battery's switch. */
export const SWITCH_ID = 'battery-switch';
/** The dock's id of the player. */
export const PLAYER_ID = 'player';

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

/**
 * The battery's switch as a toggle while the hand may take the switch. On the step's shot it is a phone's (its shot
 * leaves the battery's box out) and does nothing while the camera flies, as the slider under the hand; with `inside`
 * it is shown on every device and works while the camera is down in a part (`bench.flying`: the floor `inside`, where
 * the slider is out of the frame — `capacitor/inside` charges and empties the can it looks into).
 */
export function switchToggle(
  bench: Bench,
  label: string,
  phone: () => boolean,
  opts: { inside?: boolean } = {},
): ToggleSpec {
  const inside = opts.inside === true;
  return {
    type: 'toggle',
    id: SWITCH_ID,
    label,
    value: false,
    visible: inside ? () => true : phone,
    disabled: () => (!inside && bench.flying) || !(bench.hands.policy?.take('switch') ?? false),
    onChange: (on: boolean) => (bench.closed = on ? 1 : 0),
  };
}

/** The player as a toggle (its box is out of a phone's shot); `set` plays or stops it (`StepStand.play`). */
export function playerToggle(label: string, phone: () => boolean, set: (on: boolean) => void): ToggleSpec {
  return { type: 'toggle', id: PLAYER_ID, label, value: false, visible: phone, onChange: set };
}
