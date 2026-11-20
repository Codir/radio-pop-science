/**
 * The resistor (docs/volumes/electronics/VISUAL.md §4.2): a carbon-film «dumbbell» 0.73 long and 0.29 across, matte
 * beige, its value in four colour bands from the data (`resistorBands` → `bandColor`, never a texture): digit, digit,
 * multiplier toward leg 0, a wider gap, the tolerance toward leg 1. Gold and silver bands shine as metal. No print.
 * Axial: the axis 0.18 above the board, legs 4 P apart.
 *
 * Draw calls: the body (matte), the painted bands (toon), the metal bands (only when there are any), the legs; burnt,
 * the charred belt with its crack (VISUAL §4.8).
 */
import { Box3, Group, Vector3 } from 'three';
import { Builder, type G } from '@/kit';
import { BOARD_SPEC } from '@electronics/sim/board';
import { BAND_METAL, bandColor, resistorBands, type BandColor } from './code';
import {
  AXIAL_Y,
  CRACK_COLOR,
  Prints,
  assemble,
  axialLegs,
  crackPath,
  mix,
  slots,
  type PartModel,
} from './part';

export const RESISTOR = {
  length: 0.73,
  /** Radius of the end caps and of the waist between them. */
  radius: 0.145,
  waist: 0.125,
  /** The four bands: width and the middle of each from the body's end by leg 0. */
  band: 0.07,
  bands: [0.135, 0.235, 0.335, 0.595],
  /** The charred belt round the middle of a burnt body (VISUAL §4.8). */
  belt: 0.14,
} as const;

/** Matte beige of the carbon film: hue 26°, saturation 0.24 (VISUAL §4.2). */
export const RESISTOR_BODY = mix(mix('yellow', 'wireBrown', 0.3), 'mist', 0.45);

/**
 * The radius of the body at `u` from the end by leg 0: a cap 0.17 long rounded at its end, a short slope to the waist,
 * the waist, a slope, the other cap.
 */
export function resistorRadius(u: number): number {
  const { length: L, radius: R, waist: W } = RESISTOR;
  const v = Math.min(u, L - u); // from the nearer end
  const capEnd = 0.035;
  if (v < 0) return 0;
  if (v < capEnd) return R - capEnd + Math.sqrt(Math.max(capEnd * capEnd - (capEnd - v) ** 2, 0));
  if (v < 0.17) return R;
  if (v < 0.2) return R + ((W - R) * (v - 0.17)) / 0.03;
  return W;
}

/** The lathe profile of a stretch of the body from `u0` to `u1`, `lift` above its surface, closed at both ends. */
function profile(u0: number, u1: number, lift: number, steps: number): G.Pt[] {
  const pts: G.Pt[] = [[0, u0]];
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    pts.push([resistorRadius(u) + lift, u]);
  }
  pts.push([0, u1]);
  return pts;
}

export interface ResistorModel extends PartModel {
  /** The four bands it wears, from leg 0. */
  readonly bands: readonly BandColor[];
}

export function createResistor(ohms: number, tolerance: number, key = 'resistor'): ResistorModel {
  const bands = resistorBands(ohms, tolerance);
  const { length: L, band: w } = RESISTOR;
  const b = new Builder(key);
  const along = { axis: 'x' as const, at: [-L / 2, AXIAL_Y, 0] as const };
  b.lathe(profile(0, L, 0, 96), { ...along, seg: 28, crease: 70, slot: 'matte', c: RESISTOR_BODY });
  bands.forEach((c, i) => {
    const mid = RESISTOR.bands[i]!;
    b.lathe(profile(mid - w / 2, mid + w / 2, 0.004, 8), {
      ...along,
      seg: 28,
      crease: 70,
      slot: BAND_METAL.has(c) ? 'metal' : 'toon',
      c: bandColor(c),
    });
  });
  const model = b.build();
  const body = new Group();
  body.add(model.group);
  // burnt (VISUAL §4.8): a black belt round the middle of the body, over the multiplier's band, split by a crack
  const burnt = new Builder(`${key}:burnt`);
  const half = RESISTOR.belt / 2;
  burnt.lathe(profile(L / 2 - half, L / 2 + half, 0.008, 12), { ...along, seg: 28, crease: 70, c: 'ink' });
  burnt.tube(crackPath(0, RESISTOR.waist + 0.01), 0.015, { seg: 6, c: CRACK_COLOR });
  const marks = burnt.build().group;
  marks.name = `${key}:burnt`;
  body.add(marks);
  const R = RESISTOR.radius;
  const m = assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-L / 2, AXIAL_Y - R, -R), new Vector3(L / 2, AXIAL_Y + R, R)),
    legX: [0, 4 * BOARD_SPEC.pitch],
    legPaths: axialLegs(AXIAL_Y, L / 2 - 0.02),
    bodyMaterials: slots(model, 'matte'),
    // the bands take no heat (the value reads on a warm part) but char with the body: barely seen when it burnt
    charMaterials: slots(model, 'toon', 'metal'),
    marks,
    prints: new Prints(),
  });
  return Object.assign(m, { bands });
}
