/**
 * The bicycle by the house wall (B12): 1.7 m long, front wheel toward +X, standing on its kickstand (origin — the
 * middle of its footprint on the ground). Iron frame (VISUAL.md §4), dark tyres and saddle, a headlight whose glass
 * is in the `lamp` slot: dim by day, yellow-white with `night` (the yard sets it with the lantern; the headlight is
 * one of the three lights of the yard, VISUAL.md §4). Anchor `lamp` — the front of the headlight.
 */
import { Vector3 } from 'three';
import { Builder, type KitModel, type V3 } from '@/kit';
import { col } from '@/style';
import { SURFACE, mix } from './house';

const LENGTH = 1.7;
const TYRE = { R: 0.31, r: 0.025 } as const;
const WHEEL = TYRE.R + TYRE.r;
const AXLE = LENGTH / 2 - WHEEL;
const SPOKES = 12;

export function bicycle(): KitModel {
  const b = new Builder('bicycle');
  const iron = SURFACE.iron;
  const dark = col('ink');
  const steel = col('steel');
  const rear: V3 = [-AXLE, WHEEL, 0];
  const front: V3 = [AXLE, WHEEL, 0];
  // wheels: tyre, rim, hub, spokes
  for (const [x, y] of [rear, front]) {
    b.ring(TYRE.R, TYRE.r, { axis: 'z', seg: 28, tubeSeg: 6, c: dark, slot: 'toon', at: [x, y, 0] });
    b.ring(TYRE.R - 0.025, 0.008, { axis: 'z', seg: 28, tubeSeg: 4, c: steel, slot: 'metal', at: [x, y, 0] });
    b.cyl(0.022, 0.1, { axis: 'z', seg: 8, c: steel, slot: 'metal', at: [x, y, -0.05] });
    for (let k = 0; k < SPOKES; k++) {
      const a = (k / SPOKES) * Math.PI * 2;
      const z = k % 2 ? 0.03 : -0.03;
      b.rod([x, y, z], [x + Math.cos(a) * (TYRE.R - 0.03), y + Math.sin(a) * (TYRE.R - 0.03), 0], 0.0022, {
        seg: 3,
        c: steel,
        slot: 'metal',
      });
    }
  }
  // the frame: bottom bracket, seat tube, top tube, down tube, stays, head tube and fork
  const bb: V3 = [-0.1, 0.3, 0];
  const seatTop: V3 = [-0.24, 0.82, 0];
  const head0: V3 = [0.38, 0.7, 0];
  const head1: V3 = [0.34, 0.86, 0];
  const tube = (p: V3, q: V3, r = 0.017) => b.rod(p, q, r, { seg: 6, c: iron.c, slot: iron.slot });
  tube(bb, seatTop);
  tube([-0.22, 0.76, 0], [0.35, 0.82, 0]);
  tube(bb, head0, 0.02);
  tube(head0, head1, 0.022);
  for (const z of [-0.035, 0.035]) {
    tube([bb[0], bb[1], z * 0.6], [rear[0], rear[1], z], 0.011);
    tube([-0.23, 0.76, z * 0.4], [rear[0], rear[1], z], 0.01);
    tube([head0[0], head0[1], z * 0.5], [front[0], front[1], z], 0.012);
  }
  // seat post and saddle, stem and handlebar with grips
  b.rod(seatTop, [-0.26, 0.92, 0], 0.012, { seg: 6, c: steel, slot: 'metal' });
  b.box(0.24, 0.05, 0.13, { r: 0.02, seg: 1, c: dark, slot: 'gloss', at: [-0.27, 0.92, 0] });
  b.rod(head1, [0.31, 0.98, 0], 0.012, { seg: 6, c: steel, slot: 'metal' });
  b.rod([0.31, 0.98, -0.26], [0.31, 0.98, 0.26], 0.011, { seg: 6, c: steel, slot: 'metal' });
  for (const z of [-0.26, 0.26])
    b.cyl(0.016, 0.1, { axis: 'z', seg: 8, c: dark, slot: 'gloss', at: [0.31, 0.98, z > 0 ? z - 0.1 : z] });
  // crank, chainring, pedals, chain
  b.ring(0.09, 0.008, { axis: 'z', seg: 20, tubeSeg: 4, c: steel, slot: 'metal', at: [bb[0], bb[1], 0.05] });
  b.rod([bb[0], bb[1], 0.06], [bb[0] + 0.12, bb[1] - 0.12, 0.07], 0.01, { seg: 5, c: steel, slot: 'metal' });
  b.rod([bb[0], bb[1], -0.06], [bb[0] - 0.12, bb[1] + 0.12, -0.07], 0.01, {
    seg: 5,
    c: steel,
    slot: 'metal',
  });
  for (const [x, y, z] of [
    [bb[0] + 0.12, bb[1] - 0.12, 0.1],
    [bb[0] - 0.12, bb[1] + 0.12, -0.1],
  ] as const)
    b.box(0.09, 0.02, 0.06, { r: 0, c: dark, slot: 'toon', at: [x, y - 0.01, z] });
  b.tube([new Vector3(bb[0], bb[1] + 0.09, 0.05), new Vector3(rear[0], rear[1] + 0.04, 0.05)], 0.005, {
    seg: 4,
    c: dark,
    slot: 'toon',
  });
  b.tube([new Vector3(bb[0], bb[1] - 0.09, 0.05), new Vector3(rear[0], rear[1] - 0.04, 0.05)], 0.005, {
    seg: 4,
    c: dark,
    slot: 'toon',
  });
  // kickstand: the bicycle leans on it
  b.rod([bb[0] - 0.05, bb[1], 0.04], [bb[0] - 0.2, 0.01, 0.16], 0.009, { seg: 5, c: steel, slot: 'metal' });
  // headlight on the head tube
  const lamp: V3 = [0.43, 0.8, 0];
  b.cyl(0.032, 0.06, { axis: 'x', seg: 12, c: iron.c, slot: iron.slot, at: [lamp[0] - 0.06, lamp[1], 0] });
  b.cyl(0.026, 0.006, {
    axis: 'x',
    seg: 12,
    c: mix('yellow', 'white', 0.35),
    slot: 'lamp',
    at: [lamp[0] - 0.002, lamp[1], 0],
  });
  b.rod([head0[0], 0.78, 0], [lamp[0] - 0.06, lamp[1], 0], 0.008, { seg: 5, c: steel, slot: 'metal' });
  b.anchor('lamp', lamp[0] + 0.004, lamp[1], 0);
  return b.build();
}
