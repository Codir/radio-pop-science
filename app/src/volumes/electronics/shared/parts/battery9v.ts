/**
 * The 9 V battery in its box (docs/volumes/electronics/VISUAL.md §4.1), a permanent thing on the base: an open `slate`
 * box with a lid at the near end; in it the «Крона» (1.87 × 1.02 × 0.67) lying along z — an `ink` case with an `amber`
 * band by its contacts (under the lid, where the snap is) and «9 V» on top; on the lid the switch's two contacts, steel
 * lands with a stud each and the air gap between them. The switch's yellow slider is the bench's (`switch-slider.ts`).
 * The battery never burns (the model says so): on a short it only warms, and the box takes the tint (E2-7).
 *
 * Origin: the middle of the box's footprint on the base's face.
 */
import { Group } from 'three';
import { Builder } from '@/kit';
import { PLACES } from '../bench/layout';
import { SLIDER_TRAVEL, SLIDER_Y } from '../bench/switch-slider';
import { Prints, fixedView, slots, type PartView } from './part';

const STEEL = ['steel', 'mist'] as const;

export const BATTERY_9V = { length: 1.87, width: 1.02, height: 0.67 } as const;

export function createBattery9v(): PartView {
  const { width: W, depth: D, height: H } = PLACES.battery;
  const b = new Builder('battery-box');
  const wall = 0.06;
  const lidZ = PLACES.switch.z - PLACES.battery.z; // the switch sits in the middle of the lid
  const lid = 2 * (D / 2 - lidZ); // from the lid's far edge to the box's near wall, the switch in its middle
  b.box(W, 0.08, D, { r: 0.03, c: 'slate' });
  for (const s of [-1, 1] as const) {
    b.box(wall, H, D, { at: [s * (W / 2 - wall / 2), 0, 0], r: 0.02, c: 'slate' });
    b.box(W, H, wall, { at: [0, 0, s * (D / 2 - wall / 2)], r: 0.02, c: 'slate' });
  }
  b.box(W, 0.07, lid, { at: [0, H - 0.07, D / 2 - lid / 2], r: 0.025, c: 'slate' });
  // the battery lies along z, its contacts under the lid; an amber band beside them
  const { length: len, width: bw, height: bh } = BATTERY_9V;
  const z0 = D / 2 - wall - len / 2;
  b.box(bw, bh, len, { at: [0, 0.08, z0], r: 0.06, slot: 'gloss', c: 'ink' });
  b.box(bw + 0.01, bh + 0.01, 0.18, {
    at: [0, 0.075, D / 2 - lid - 0.1],
    r: 0.05,
    slot: 'gloss',
    c: 'amber',
  });
  // the switch's two contacts on the lid: steel lands with a stud each, the air gap between them
  for (const s of [-1, 1] as const) {
    const cx = s * (SLIDER_TRAVEL / 2 + 0.11);
    b.box(0.2, 0.04, 0.24, { at: [cx, H, lidZ], r: 0.012, slot: 'metal', c: STEEL });
    b.cyl(0.05, SLIDER_Y, {
      at: [s * (SLIDER_TRAVEL / 2 + 0.06), H, lidZ],
      seg: 14,
      slot: 'metal',
      c: 'mist',
    });
  }
  const model = b.build();
  const group = new Group();
  group.name = 'battery-9v';
  group.add(model.group);
  // «9 V» on the battery's top, in the open part of the box, reading from the reader's side
  const prints = new Prints();
  const open = D / 2 - lid; // the near edge of the open part
  prints.add(group, '9\u00a0V', {
    size: 0.3,
    color: 'mist',
    at: [0, 0.08 + bh + 0.004, (z0 - len / 2 + open) / 2],
    rot: [-Math.PI / 2, 0, 0],
  });
  return fixedView('battery-9v', group, slots(model, 'toon', 'gloss'), prints);
}
