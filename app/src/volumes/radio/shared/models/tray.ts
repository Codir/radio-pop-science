/**
 * The baking tray (B12): 0.40 × 0.02 × 0.30 m of steel sheet with a low rim. It faces its own +X; origin — the middle
 * of its bottom. The yard slides it up to the monitor's whip (the shadow the model computes, `AirState.tray`).
 */
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';

const W = 0.4;
const H = 0.02;
const D = 0.3;
const SHEET = 0.004;

export function tray(): KitModel {
  const b = new Builder('tray');
  const c = col('steel').lerp(col('mist'), 0.4);
  b.box(W, SHEET, D, { r: 0, c, slot: 'metal' });
  for (const z of [-(D - SHEET) / 2, (D - SHEET) / 2])
    b.box(W, H, SHEET, { r: 0, c, slot: 'metal', at: [0, 0, z] });
  for (const x of [-(W - SHEET) / 2, (W - SHEET) / 2])
    b.box(SHEET, H, D - 2 * SHEET, { r: 0, c, slot: 'metal', at: [x, 0, 0] });
  return b.build();
}
