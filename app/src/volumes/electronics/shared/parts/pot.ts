/**
 * The variable resistor (docs/volumes/electronics/VISUAL.md §4.3): a round `slate` case 1.1 across with a `steel` lid;
 * on it the shaft and a `mist` knob with a white line; three legs in a row 2 P apart (`ccw`, `wiper`, `cw`); «10 kΩ» on
 * the side. The hand does not turn the knob: a slider in the step's panel changes the setting and the knob follows it —
 * 300° from `ccw` (0) to `cw` (1), within 0.15 s (here: `setLook({ setting })`). At the middle the line points away
 * from the reader.
 *
 * Draw calls: the case, the metal, the knob, the legs, the print.
 */
import { Box3, Group, Vector3 } from 'three';
import { fmtSI } from '@/content';
import { damp } from '@/engine/api';
import { Builder } from '@/kit';
import { BOARD_SPEC } from '@electronics/sim/board';
import { Prints, assemble, radialLegs, slots, type PartModel } from './part';

export const POT = {
  radius: 0.55,
  /** The case from `bottom` to `top`, the knob's top. */
  bottom: 0.22,
  top: 0.5,
  knobTop: 0.84,
  /** The knob's travel from `ccw` to `cw`, radians (300°), and how fast it follows (≈ 95 % in 0.15 s). */
  travel: (300 * Math.PI) / 180,
  follow: 20,
} as const;

export interface PotModel extends PartModel {
  /** The knob: turns about the shaft (+y) with the setting. */
  readonly knob: Group;
}

/** The knob's turn for a setting: 0 at the middle, clockwise (seen from above) toward `cw`. */
export const knobAngle = (setting: number): number => -(Math.min(Math.max(setting, 0), 1) - 0.5) * POT.travel;

export function createPot(ohms: number, key = 'pot-10k'): PotModel {
  const P = BOARD_SPEC.pitch;
  const { radius: R, bottom, top, knobTop } = POT;
  const b = new Builder(key);
  b.cyl(R, top - bottom, { at: [0, bottom, 0], seg: 40, c: 'slate', bevel: 0.03 });
  b.cyl(R - 0.02, 0.03, { at: [0, top, 0], seg: 40, slot: 'metal', c: 'steel', bevel: 0.01 });
  b.cyl(0.13, 0.07, { at: [0, top + 0.03, 0], seg: 20, slot: 'metal', c: 'steel', bevel: 0.015 });
  b.cyl(0.06, 0.12, { at: [0, top + 0.1, 0], seg: 14, slot: 'metal', c: 'mist' });
  const knob = b.part('knob');
  knob.cyl(0.3, knobTop - 0.62, { at: [0, 0.62, 0], seg: 32, c: 'mist', bevel: 0.04 });
  // the line on the knob's top, from the shaft toward the far edge (the middle of the travel)
  knob.box(0.045, 0.012, 0.23, { at: [0, knobTop - 0.004, -0.13], r: 0, c: 'white' });
  const model = b.build();
  const body = new Group();
  body.add(model.group);
  const knobGroup = model.part('knob');

  const prints = new Prints();
  prints.add(body, fmtSI(ohms, 'Ω'), {
    size: 0.11,
    color: 'mist',
    at: [0, (bottom + top) / 2, R + 0.004],
  });

  let angle = knobAngle(0.5);
  const m = assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-R, bottom, -R), new Vector3(R, knobTop, R)),
    legX: [0, 2 * P, 4 * P],
    legPaths: radialLegs([-0.42, 0, 0.42], bottom),
    bodyMaterials: slots(model, 'toon'),
    prints,
    look: (state, dt) => {
      angle = damp(angle, knobAngle(state.setting), POT.follow, dt);
      knobGroup.rotation.y = angle;
    },
  });
  knobGroup.rotation.y = angle;
  return Object.assign(m, { knob: knobGroup });
}
