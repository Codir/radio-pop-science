/**
 * The shed with its woodshed (B12): walls from the plan, each by its own `look`, a flat sheet-iron roof over the whole
 * rectangle of the walls at `roofY`, and the woodshed's dark corner: its open side is where the plan has no wall
 * round `nook`, and its back and side walls are `ink` inside (thin liners just off the walls; a low stack of dark logs
 * at the back). The anchors lie on the plan's points: `wall` — the middle of the white wall toward the camera (all the
 * shed's walls may be white, so it is not found by `look`), `nook`.
 */
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';
import { GLASS, SURFACE, addWalls, mix, wallBox } from './house';
import type { P2, WallPlan, YardPlan } from './index';

const HALF = 0.1;
const ROOF = { thick: 0.05, over: 0.12, ribs: 0.3 } as const;
const LINER = { off: 0.005, thick: 0.01 } as const;

/** The nearest wall straight from `p` along `dir` (axis-aligned, scene x/z), and how far its line is. */
function hit(p: P2, dir: P2, walls: readonly WallPlan[]): { w: WallPlan; d: number } | null {
  let best: { w: WallPlan; d: number } | null = null;
  for (const w of walls) {
    const ex = w.b[0] - w.a[0];
    const ez = w.b[1] - w.a[1];
    const den = dir[0] * ez - dir[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const qx = w.a[0] - p[0];
    const qz = w.a[1] - p[1];
    const d = (qx * ez - qz * ex) / den;
    const mu = (qx * dir[1] - qz * dir[0]) / den;
    if (d > 0 && mu >= -1e-9 && mu <= 1 + 1e-9 && (!best || d < best.d)) best = { w, d };
  }
  return best;
}

export function shed(plan: YardPlan['shed']): KitModel {
  const b = new Builder('shed', { glass: GLASS });
  addWalls(b, plan.walls);
  const box = wallBox(plan.walls);
  const top = Math.max(...plan.walls.map((w) => w.y1));
  const ground = Math.min(...plan.walls.map((w) => w.y0));

  // the flat roof of sheet iron with a few ribs
  const iron = SURFACE.iron;
  const rx0 = box.x0 - HALF - ROOF.over;
  const rx1 = box.x1 + HALF + ROOF.over;
  const rz0 = box.z0 - HALF - ROOF.over;
  const rz1 = box.z1 + HALF + ROOF.over;
  const cx = (rx0 + rx1) / 2;
  b.box(rx1 - rx0, ROOF.thick, rz1 - rz0, {
    r: 0,
    c: iron.c,
    slot: iron.slot,
    at: [cx, plan.roofY, (rz0 + rz1) / 2],
  });
  for (let z = rz0 + ROOF.ribs / 2; z < rz1; z += ROOF.ribs)
    b.box(rx1 - rx0, 0.015, 0.03, { r: 0, c: iron.c, slot: iron.slot, at: [cx, plan.roofY + ROOF.thick, z] });

  // the woodshed: from `nook`, the walls left, right and behind; the side without a wall is open
  const n: P2 = [plan.nook[0], plan.nook[2]];
  const dirs: P2[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const hits = dirs.map((d) => hit(n, d, plan.walls));
  const reach = (k: number, wall: number) => {
    const h = hits[k];
    return h ? h.d - HALF - LINER.off : wall;
  };
  // the inner box of the woodshed (open sides reach the outer rectangle of the walls)
  const inner = {
    x1: n[0] + reach(0, box.x1 - n[0]),
    x0: n[0] - reach(1, n[0] - box.x0),
    z1: n[1] + reach(2, box.z1 - n[1]),
    z0: n[1] - reach(3, n[1] - box.z0),
  };
  const ink = col('ink');
  const tall = top - ground;
  const liner = (x0: number, x1: number, z0: number, z1: number) =>
    b.box(x1 - x0, tall, z1 - z0, {
      r: 0,
      c: ink,
      slot: 'matte',
      at: [(x0 + x1) / 2, ground, (z0 + z1) / 2],
    });
  const behind: number[] = [];
  hits.forEach((h, k) => {
    if (!h) return;
    const t = LINER.thick;
    if (k === 0) liner(inner.x1 - t, inner.x1, inner.z0, inner.z1);
    if (k === 1) liner(inner.x0, inner.x0 + t, inner.z0, inner.z1);
    if (k === 2) liner(inner.x0, inner.x1, inner.z1 - t, inner.z1);
    if (k === 3) liner(inner.x0, inner.x1, inner.z0, inner.z0 + t);
    behind.push(k);
  });
  // logs stacked against the back wall (the one facing the open side), ends toward the opening
  const open = [0, 1, 2, 3].find((k) => !hits[k]);
  if (open !== undefined) {
    const back = open ^ 1; // 0 ↔ 1, 2 ↔ 3: the direction opposite the opening
    if (behind.includes(back)) addLogs(b, inner, back, ground);
  }
  b.anchor('wall', ...plan.wall);
  b.anchor('nook', ...plan.nook);
  return b.build();
}

/** A low stack of dark logs against the side `back` of the woodshed's inner box. */
function addLogs(
  b: Builder,
  box: { x0: number; x1: number; z0: number; z1: number },
  back: number,
  ground: number,
): void {
  const r = 0.055;
  const deep = 0.36;
  const along = back < 2; // the back wall faces ±X: logs lie along X, rows run along Z
  const span = along ? box.z1 - box.z0 : box.x1 - box.x0;
  const count = Math.floor((span - 0.1) / (2 * r));
  const wood = mix('wireBrown', 'ink', 0.7);
  for (let row = 0; row < 4; row++)
    for (let k = 0; k < count - (row % 2); k++) {
      const u = (along ? box.z0 : box.x0) + 0.05 + r + (row % 2 ? r : 0) + 2 * r * k;
      const y = ground + r + row * r * 1.75;
      const end = back === 0 ? box.x1 : back === 1 ? box.x0 : back === 2 ? box.z1 : box.z0;
      const sign = back % 2 === 0 ? -1 : 1; // from the back wall toward the opening
      const start = end + sign * 0.02;
      const stop = start + sign * deep;
      const a = Math.min(start, stop);
      b.cyl(r, deep, {
        axis: along ? 'x' : 'z',
        seg: 7,
        bevel: 0,
        c: wood,
        slot: 'toon',
        at: along ? [a, y, u] : [u, y, a],
      });
    }
}
