/**
 * The iron garage (B12): walls from the plan, a flat iron roof at the top of its walls over their whole rectangle,
 * and the single gate leaf. Part `gate` turns about Y on `gate.hinge`; at angle 0 the leaf lies along +X from the
 * hinge (its ribs on +Z); the model leaves it at `closedYaw`, and the yard sets `rotation.y` between `closedYaw` and
 * `openYaw` (`AirState.gate`). The anchor `gate` is the middle of the leaf and turns with it.
 */
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';
import { GLASS, SURFACE, addWalls, wallBox } from './house';
import type { YardPlan } from './index';

const HALF = 0.1;
const ROOF = { thick: 0.06, over: 0.1 } as const;
const LEAF = { thick: 0.04, ribs: 0.2, clear: 0.1 } as const;

export function garage(plan: YardPlan['garage']): KitModel {
  const b = new Builder('garage', { glass: GLASS });
  const iron = SURFACE.iron;
  addWalls(b, plan.walls);
  const box = wallBox(plan.walls);
  const top = Math.max(...plan.walls.map((w) => w.y1));
  const x0 = box.x0 - HALF - ROOF.over;
  const x1 = box.x1 + HALF + ROOF.over;
  const z0 = box.z0 - HALF - ROOF.over;
  const z1 = box.z1 + HALF + ROOF.over;
  b.box(x1 - x0, ROOF.thick, z1 - z0, {
    r: 0,
    c: iron.c,
    slot: iron.slot,
    at: [(x0 + x1) / 2, top, (z0 + z1) / 2],
  });

  // the gate: a sheet with vertical ribs on +Z, a frame, a handle near the free end; it starts clear of the corner
  const g = plan.gate;
  const leaf = b.part('gate', { at: [g.hinge[0], 0, g.hinge[1]] });
  const long = g.width - LEAF.clear;
  const tall = g.y1 - g.y0;
  const mid = LEAF.clear + long / 2;
  const dark = iron.c.clone().multiplyScalar(0.8);
  leaf.box(long, tall, LEAF.thick, { r: 0, c: iron.c, slot: iron.slot, at: [mid, g.y0, 0] });
  for (let x = LEAF.clear + LEAF.ribs / 2; x < g.width - 0.05; x += LEAF.ribs)
    leaf.box(0.04, tall - 0.12, 0.012, {
      r: 0,
      c: iron.c,
      slot: iron.slot,
      at: [x, g.y0 + 0.06, LEAF.thick / 2 + 0.006],
    });
  for (const y of [g.y0, g.y1 - 0.06])
    leaf.box(long, 0.06, 0.016, { r: 0, c: dark, slot: iron.slot, at: [mid, y, LEAF.thick / 2 + 0.008] });
  for (const y of [g.y0 + 0.3, g.y1 - 0.4])
    leaf.cyl(0.025, 0.14, { seg: 8, c: dark, slot: iron.slot, at: [LEAF.clear - 0.02, y, 0] });
  leaf.box(0.03, 0.14, 0.03, {
    r: 0.008,
    seg: 1,
    c: col('steel'),
    slot: 'metal',
    at: [g.width - 0.15, 1.0, LEAF.thick / 2 + 0.015],
  });
  leaf.anchor('gate', g.width / 2, (g.y0 + g.y1) / 2, 0);
  const m = b.build();
  m.part('gate').rotation.y = g.closedYaw; // shut until the yard turns it
  return m;
}
