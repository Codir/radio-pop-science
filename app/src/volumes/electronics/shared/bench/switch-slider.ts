/**
 * The slider of the battery's switch (docs/volumes/electronics/VISUAL.md §4.1: «жовтий повзунок на сталевому
 * містку, той самий, що в circuit»), copied from `circuit/shared/stage/small-parts.ts` `createSlider`
 * (shared/README.md, «Копії»); the gap and the travel come from the bench's layout (`SWITCH`). The circuit's conical
 * spring is not on this bench.
 */
import type { Group } from 'three';
import type { KToonMaterial } from '@/style';
import { Builder } from '@/kit';
import { SWITCH } from './layout';

/** Height of the slider's origin above the lid it rides on: on the tops of the two contact studs. */
export const SLIDER_Y = 0.1;
/**
 * How far the slider travels between closed (0) and open, along its own −x: the bridge leaves the right contact and
 * the gap shows between them.
 */
export const SLIDER_TRAVEL = SWITCH.travel;

/** Origin = centre of the bridge's underside; the bridge spans both contact studs when the slider is centred. */
export interface SliderModel {
  group: Group;
  /**
   * 0…1: the thumb's own faint glow — a glow-in-the-dark switch, so that the reader finds it in a dark frame. Below
   * the bloom threshold; the bench fades it out as the room gets light.
   */
  setGlow(amount: number): void;
}

export function createSlider(): SliderModel {
  const b = new Builder('slider');
  b.box(SWITCH.gap + 0.2, 0.035, 0.2, { r: 0.012, slot: 'metal', c: ['steel', 'mist'] });
  b.box(0.3, 0.15, 0.42, { at: [0, 0.03, 0], r: 0.05, slot: 'gloss', c: ['amber', 'yellow'] });
  // three grip ridges
  for (const dx of [-0.075, 0, 0.075])
    b.box(0.035, 0.035, 0.34, { at: [dx, 0.17, 0], r: 0.014, slot: 'gloss', c: 'yellow.light' });
  const model = b.build();
  const thumb = model.mats.get('gloss') as KToonMaterial;
  thumb.setEmissive('yellow', 0);
  return {
    group: model.group,
    setGlow(amount) {
      // a small floor keeps the thumb yellow under the lamp's warm light too
      thumb.emissiveIntensity = 0.14 + 0.5 * Math.min(Math.max(amount, 0), 1);
    },
  };
}
