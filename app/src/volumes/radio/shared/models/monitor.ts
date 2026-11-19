/**
 * The monitor (B12): a grey case `MONITOR_CASE` round an empty frame `MONITOR_SCREEN` in its middle — the world puts
 * the screen there (B14) — with the 6 cm whip on a 0.01 m leg on the top of the case. The monitor looks along +Z of
 * its anchor `screen` (the middle of the frame, on the front plane; +X — to the right of a viewer in front of the
 * screen). Its origin is the middle of the case's bottom, so the case stands on whatever is under it. Anchors:
 * `screen`; `antenna` — the middle of the whip, where the model computes the field: `screen + MONITOR_ANTENNA`.
 */
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';
import type { V3 } from './index';

/** The screen, m (4 : 3). */
export const MONITOR_SCREEN = { width: 0.32, height: 0.24 } as const;
/** The anchor `antenna` relative to the anchor `screen`, in the monitor's axes. */
export const MONITOR_ANTENNA: V3 = [0.17, 0.2, -0.05];
/** The case round the frame of `MONITOR_SCREEN`, the frame in its middle. */
export const MONITOR_CASE = { width: 0.4, height: 0.32, depth: 0.1 } as const;

const W = MONITOR_CASE.width;
const H = MONITOR_CASE.height;
const D = MONITOR_CASE.depth;
const SW = MONITOR_SCREEN.width;
const SH = MONITOR_SCREEN.height;
/** The bezel round the frame is this deep; the body behind it. */
const BEZEL = 0.025;
const LEG = 0.01;
const WHIP = 0.06;

export function monitor(): KitModel {
  const b = new Builder('monitor');
  const shell = col('slate').lerp(col('steel'), 0.5);
  const dark = col('ink');
  const front = D / 2;
  const cy = H / 2;
  // body behind the bezel, the four bars of the bezel, the dark back of the empty frame
  b.box(W, H, D - BEZEL, { r: 0.012, seg: 1, c: shell, slot: 'gloss', at: [0, 0, -BEZEL / 2] });
  const bar = (w: number, h: number, x: number, y: number) =>
    b.box(w, h, BEZEL, { r: 0, c: shell, slot: 'gloss', at: [x, y, front - BEZEL / 2] });
  const side = (W - SW) / 2;
  const rim = (H - SH) / 2;
  bar(W, rim, 0, 0);
  bar(W, rim, 0, H - rim);
  bar(side, SH, -(SW + side) / 2, rim);
  bar(side, SH, (SW + side) / 2, rim);
  b.box(SW, SH, 0.004, { r: 0, c: dark, slot: 'gloss', at: [0, rim, front - BEZEL + 0.002] });
  // two buttons on the bottom bar
  for (const x of [0.13, 0.16])
    b.cyl(0.006, 0.004, { axis: 'z', seg: 8, c: dark, slot: 'gloss', at: [x, rim / 2, front] });
  b.anchor('screen', 0, cy, front);
  // the whip on its leg
  const [ax, ay, az] = MONITOR_ANTENNA;
  b.cyl(0.007, 0.004, { seg: 8, c: col('steel'), slot: 'metal', at: [ax, H, front + az] });
  b.cyl(0.0035, LEG, { seg: 6, c: col('steel'), slot: 'metal', at: [ax, H, front + az], bevel: 0 });
  b.cyl(0.004, WHIP, { seg: 8, c: dark, slot: 'gloss', at: [ax, H + LEG, front + az] });
  b.anchor('antenna', ax, cy + ay, front + az);
  return b.build();
}
