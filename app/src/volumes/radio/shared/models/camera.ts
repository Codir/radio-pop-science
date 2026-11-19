/**
 * The wireless camera (B12): a light body 0.09 × 0.09 × 0.18 m with its origin in the middle of the back wall, the
 * lens on the front (it looks along −Z of the anchor `lens`), a sun hood, the 6 cm whip antenna (design II §7) on a
 * thin stand from the top of the body, a short cable out of its underside and a small red light that says it is on
 * (`on: false` — the light is dark: the second camera).
 * Anchors: `lens` (on the front glass), `antenna` (the middle of the whip, `CAMERA.antennaUp` above `lens`), `cable`.
 * Part `rod` — the whip with its stand, pivoting about X at the foot of the stand: the yard tilts the body toward
 * the cat and turns the rod back upright.
 */
import { Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';

/** The anchor `antenna` is this far above the anchor `lens`, m. */
export const CAMERA = { antennaUp: 0.2 } as const;

const BODY = { w: 0.09, h: 0.09, d: 0.18 } as const;
const LENS_Z = -BODY.d - 0.012;
const ROD = { z: -0.16, stand: 0.125, whip: 0.06 } as const;

export function cameraModel(o: { on?: boolean } = {}): KitModel {
  const on = o.on ?? true;
  const b = new Builder(on ? 'camera' : 'camera-off');
  const shell = col('mist').lerp(col('white'), 0.4);
  const dark = col('ink');
  // body, its back plate with the bracket boss, the sun hood over it
  b.box(BODY.w, BODY.h, BODY.d, {
    r: 0.014,
    seg: 1,
    c: shell,
    slot: 'gloss',
    at: [0, 0, -BODY.d / 2],
    mid: true,
  });
  b.cyl(0.018, 0.012, { axis: 'z', seg: 10, c: col('steel'), slot: 'metal', at: [0, 0, 0] });
  b.box(BODY.w + 0.012, 0.005, BODY.d + 0.006, {
    r: 0,
    c: shell,
    slot: 'gloss',
    at: [0, BODY.h / 2, -BODY.d / 2 - 0.009],
  });
  // lens: barrel, dark glass, a thin bright ring
  b.cyl(0.03, 0.012, { axis: 'z', seg: 16, c: col('slate'), slot: 'gloss', at: [0, 0, LENS_Z] });
  b.cyl(0.023, 0.002, { axis: 'z', seg: 16, c: dark, slot: 'gloss', at: [0, 0, LENS_Z - 0.001] });
  b.ring(0.026, 0.002, {
    axis: 'z',
    seg: 16,
    tubeSeg: 3,
    c: col('steel'),
    slot: 'metal',
    at: [0, 0, LENS_Z],
  });
  b.anchor('lens', 0, 0, LENS_Z);
  // the light that says the camera is on
  b.sphere(0.005, {
    seg: 6,
    c: on ? col('red') : dark,
    slot: on ? 'glow' : 'gloss',
    at: [0.03, 0.03, -BODY.d - 0.001],
  });
  // the cable out of the underside, near the back
  b.cyl(0.008, 0.012, { seg: 8, c: dark, slot: 'gloss', at: [0, -BODY.h / 2 - 0.01, -0.03] });
  const cable = [
    new Vector3(0, -0.05, -0.03),
    new Vector3(0, -0.09, -0.025),
    new Vector3(0, -0.13, 0.0),
    new Vector3(0, -0.16, 0.05),
  ];
  b.tube(cable, 0.004, { seg: 6, c: dark, slot: 'gloss' });
  b.anchor('cable', 0, -0.09, -0.025);
  // the whip on its stand: a part, so that the yard can keep it upright on a tilted body
  const rod = b.part('rod', { at: [0, BODY.h / 2, ROD.z] });
  rod.cyl(0.008, 0.006, { seg: 8, c: col('steel'), slot: 'metal' });
  rod.cyl(0.0025, ROD.stand, { seg: 6, c: col('steel'), slot: 'metal', bevel: 0 });
  rod.cyl(0.004, ROD.whip, { seg: 8, c: dark, slot: 'gloss', at: [0, ROD.stand, 0] });
  rod.anchor('antenna', 0, CAMERA.antennaUp - BODY.h / 2, 0);
  return b.build();
}
