/**
 * The garden swing (B12): an iron A-frame with its top beam 2.2 m high along Z and a wooden seat on two ropes that
 * swings along X (the swing faces its own +X; origin — the middle of its footprint on the ground). Part `seat` — the
 * seat with its ropes, turning about Z at the beam; `update(dt, t)` rocks it a little as a function of `t`: an empty
 * swing in the evening air, something alive in the frame (VISUAL.md §9).
 */
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';
import { SURFACE } from './house';

const H = 2.2;
const SPREAD = 0.7;
const HALF = 0.8;
const DROP = 1.75;
/** The seat's pendulum: ω = √(g / DROP), a small swing. */
const OMEGA = Math.sqrt(9.81 / DROP);
const SWAY = 0.06;

export function swing(): KitModel {
  const b = new Builder('swing');
  const iron = SURFACE.iron;
  for (const z of [-HALF, HALF])
    for (const x of [-SPREAD, SPREAD])
      b.rod([x, 0, z], [0, H, z], 0.03, { seg: 8, c: iron.c, slot: iron.slot });
  b.cyl(0.04, 2 * HALF + 0.16, { axis: 'z', seg: 10, c: iron.c, slot: iron.slot, at: [0, H, -HALF - 0.08] });
  const seat = b.part('seat', { at: [0, H, 0] });
  for (const z of [-0.22, 0.22]) {
    seat.cyl(0.05, 0.03, { axis: 'z', seg: 8, c: iron.c, slot: iron.slot, at: [0, 0, z - 0.015] });
    seat.rod([0, 0, z], [0, -DROP, z], 0.008, { seg: 5, c: col('mist'), slot: 'toon' });
  }
  seat.box(0.24, 0.035, 0.52, {
    r: 0.008,
    seg: 1,
    c: SURFACE.wood.c,
    slot: SURFACE.wood.slot,
    at: [0, -DROP - 0.035, 0],
  });
  const m = b.build();
  const pivot = m.part('seat');
  m.update = (_dt, t) => {
    pivot.rotation.z = SWAY * Math.sin(OMEGA * t);
  };
  return m;
}
