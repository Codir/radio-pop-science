/**
 * The phone on the window board (B12): 0.07 × 0.15 × 0.01 m, lying flat with its dark screen up and its top end
 * toward +X (it faces its own +X; origin — the middle of its bottom), so the yard lays it on the anchor `phone` of the
 * house with nothing but `rotation.y`. The screen is off: no light, no text.
 */
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';

const LONG = 0.15;
const WIDE = 0.07;
const THICK = 0.01;

export function phone(): KitModel {
  const b = new Builder('phone');
  b.box(LONG, THICK, WIDE, { r: 0.004, seg: 1, c: col('slate'), slot: 'gloss' });
  b.box(LONG - 0.012, 0.001, WIDE - 0.008, {
    r: 0,
    c: col('ink'),
    slot: 'gloss',
    at: [0, THICK - 0.0004, 0],
  });
  b.cyl(0.004, 0.0012, { seg: 8, c: col('ink'), slot: 'gloss', at: [LONG / 2 - 0.012, THICK - 0.0002, 0] });
  return b.build();
}
