/**
 * The camera pole (B12): a steel pipe 0.09 m thick on a small concrete footing, capped at the top, with two clamps
 * where the cameras' brackets hold. Its origin is on the ground on its axis. Anchors `mount1`, `mount2` — on the
 * pipe's surface on its +X side, 0.4 and 0.9 m below the top.
 */
import { Builder, type KitModel } from '@/kit';
import { SURFACE } from './house';

const R = 0.045;

export function pole(o: { height?: number } = {}): KitModel {
  const h = o.height ?? 3.2;
  const b = new Builder('pole');
  const iron = SURFACE.iron;
  b.cyl(0.12, 0.06, { rTop: 0.1, seg: 12, c: SURFACE.slab.c, slot: 'matte' });
  b.cyl(R, h - 0.02, { seg: 12, c: iron.c, slot: iron.slot, bevel: 0 });
  b.dome(R + 0.006, 0.03, { seg: 12, c: iron.c, slot: iron.slot, at: [0, h - 0.02, 0] });
  for (const [name, down] of [
    ['mount1', 0.4],
    ['mount2', 0.9],
  ] as const) {
    const y = h - down;
    b.cyl(R + 0.008, 0.05, {
      seg: 12,
      c: iron.c.clone().multiplyScalar(0.8),
      slot: iron.slot,
      at: [0, y - 0.025, 0],
    });
    b.anchor(name, R, y, 0);
  }
  return b.build();
}
