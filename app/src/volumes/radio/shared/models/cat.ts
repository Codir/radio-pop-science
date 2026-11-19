/**
 * The cat on the fence (B12): a dark `slate` cat, its body `CAT.length` long without the tail along its own +X (with
 * yaw 0 it walks east), its head held up on a short neck and turned 90° toward its −Z — toward the camera when it
 * walks the cross fence side-on (VISUAL.md §2, `places.cat`) — and a white spot `CAT.spot` across on its forehead,
 * just above the eyes, facing the same way: the camera's eye sees it as ≈ 1.9 cells, with the dark of the head round
 * it, four rows above the middle of the body (the body's row of C5 is the spot's row + 4; B13). Origin — the middle
 * of the cat's footprint, under its paws; the spot is ≈ 0.29 m above it. Parts `head` (turns about Y at the neck),
 * `tail` (at its root) and `spot` (on the head, a part of its own so that the frame's checks can find it).
 * `update(dt, t)` rocks the head and the tail round that pose as functions of `t`.
 */
import { Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';

/** The body without the tail and the white spot on the forehead, m. */
export const CAT = { length: 0.45, spot: 0.06 } as const;

/** Where the head turns: held 0.09 m above the chest (B13: the spot's row is then four rows above the body's). */
const NECK = [0.2, 0.24, 0] as const;
const TAIL = [-0.2, 0.14, 0] as const;
/** The skull in the head's frame (the neck at its origin, the muzzle toward +X). */
const SKULL = { x: 0.04, y: 0.03, r: 0.05 } as const;
/** The rest turn of the head: its +X (the muzzle) toward the cat's −Z. */
const LOOK = Math.PI / 2;

export function cat(): KitModel {
  const b = new Builder('cat');
  const fur = col('slate');
  const dark = col('ink');
  // body, chest and haunch, legs
  b.capsule(0.058, 0.4, { axis: 'x', seg: 12, c: fur, slot: 'soft', at: [0, 0.13, 0], s: [1, 1, 0.85] });
  b.sphere(0.06, { seg: 12, c: fur, slot: 'soft', at: [0.13, 0.135, 0], s: [1, 1.05, 0.85] });
  b.sphere(0.064, { seg: 12, c: fur, slot: 'soft', at: [-0.12, 0.135, 0], s: [1, 1, 0.9] });
  for (const x of [-0.13, 0.13])
    for (const z of [-0.03, 0.03])
      b.capsule(0.017, 0.12, { seg: 8, c: fur, slot: 'soft', at: [x + (z > 0 ? 0.015 : -0.015), 0.06, z] });
  // the neck, from the chest up and forward to the head
  b.capsule(0.036, 0.17, {
    seg: 10,
    c: fur,
    slot: 'soft',
    at: [0.175, 0.195, 0],
    rot: [0, 0, -0.5],
    s: [1, 1, 0.9],
  });
  // head: skull, muzzle, ears, eyes; the white spot on the forehead
  const head = b.part('head', { at: NECK, rot: [0, LOOK, 0] });
  head.sphere(SKULL.r, { seg: 14, c: fur, slot: 'soft', at: [SKULL.x, SKULL.y, 0] });
  head.sphere(0.024, { seg: 10, c: fur, slot: 'soft', at: [0.085, 0.012, 0], s: [1, 0.8, 1.15] });
  for (const z of [-0.026, 0.026]) {
    head.cone(0.018, 0.042, {
      seg: 6,
      c: fur,
      slot: 'soft',
      at: [0.03, 0.068, z],
      rot: [z > 0 ? 0.25 : -0.25, 0, -0.15],
    });
    head.sphere(0.006, { seg: 6, c: dark, slot: 'gloss', at: [0.084, 0.032, z * 0.85] });
  }
  head.sphere(0.005, { seg: 6, c: dark, slot: 'gloss', at: [0.108, 0.016, 0] });
  // a flattened ball across the forehead, 30° up from the muzzle: flush with the skull at its rim, just above the eyes,
  // with the dark skull round it on every side as the camera sees it
  const up = (30 * Math.PI) / 180;
  const spot = head.part('spot', {
    at: [SKULL.x + 0.8 * SKULL.r * Math.cos(up), SKULL.y + 0.8 * SKULL.r * Math.sin(up), 0],
    rot: [0, 0, up],
  });
  spot.sphere(CAT.spot / 2, { seg: 12, c: col('white'), slot: 'toon', s: [0.35, 1, 1] });
  spot.anchor('spot', 0, 0, 0);
  // tail: up and back from the root, a soft curl at the tip
  const tail = b.part('tail', { at: TAIL });
  const curve = [
    new Vector3(0.02, 0, 0),
    new Vector3(-0.06, 0.03, 0),
    new Vector3(-0.13, 0.09, 0),
    new Vector3(-0.17, 0.17, 0),
    new Vector3(-0.16, 0.24, 0),
    new Vector3(-0.12, 0.27, 0),
  ];
  tail.tube(curve, 0.015, { seg: 7, c: fur, slot: 'soft' });
  const m = b.build();
  const h = m.part('head');
  const t0 = m.part('tail');
  m.update = (_dt, t) => {
    h.rotation.set(
      0.05 * Math.sin(0.9 * t + 1),
      LOOK + 0.12 * Math.sin(0.45 * t) + 0.04 * Math.sin(1.3 * t),
      0,
    );
    t0.rotation.set(0.22 * Math.sin(1.1 * t), 0.18 * Math.sin(0.6 * t + 0.5), 0);
  };
  return m;
}
