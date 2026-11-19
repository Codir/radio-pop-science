/**
 * Picket fences from a plan (B12): every `FenceRun` of the yard in one model, in scene axes. A run follows its route
 * with sharp corners; pickets of the plan's width and gap stand on its line (pointed unless the run has a top board;
 * gap 0 — boards side by side, a solid fence), two rails run along its left side (looking along the route; reverse
 * the route to put them on the other side), square posts stand at its ends, corners and on both sides of every
 * `open` stretch, and `board` lays a flat board 0.10 m wide along the whole run with its top at `height` — the cat
 * walks on it. Inside `open` there are no pickets, rails or board (the wicket hangs there). Nothing reaches past the
 * ends of the route or above `height`. White (VISUAL.md §4). The kit's `fence` has one picket size, rounded routes
 * and no board (`kit/env/props.ts:24-35`).
 */
import { type BufferGeometry } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { col } from '@/style';
import type { FenceRun, P2 } from './index';

const PICKET_THICK = 0.02;
const RAIL = { thick: 0.03, tall: 0.08, low: 0.25, high: 0.3 } as const;
const POST = 0.09;
const BOARD = { wide: 0.1, thick: 0.025 } as const;
/** Pickets stop this far above the ground. */
const CLEAR = 0.03;

/**
 * A picket in the XY plane (x along the fence, y up), `thick` along Z, its base centred on the origin; pointed with a
 * 45° tip when `pointed`.
 */
export function picketGeometry(wide: number, tall: number, thick: number, pointed: boolean): BufferGeometry {
  const tip = pointed ? Math.min(wide / 2, tall / 2) : 0;
  const outline: G.Pt[] = pointed
    ? [
        [-wide / 2, 0],
        [wide / 2, 0],
        [wide / 2, tall - tip],
        [0, tall],
        [-wide / 2, tall - tip],
      ]
    : [
        [-wide / 2, 0],
        [wide / 2, 0],
        [wide / 2, tall],
        [-wide / 2, tall],
      ];
  return G.extrude(outline, thick);
}

interface Segment {
  a: P2;
  /** Unit direction. */
  u: P2;
  /** Distance of `a` and of the end from the start of the route. */
  s0: number;
  s1: number;
}

/** `[from, to]` minus the given stretches. */
function minus(from: number, to: number, cuts: readonly (readonly [number, number])[]): [number, number][] {
  let parts: [number, number][] = [[from, to]];
  for (const [c0, c1] of cuts) {
    const next: [number, number][] = [];
    for (const [p0, p1] of parts) {
      if (c1 <= p0 || c0 >= p1) next.push([p0, p1]);
      else {
        if (c0 > p0) next.push([p0, c0]);
        if (c1 < p1) next.push([c1, p1]);
      }
    }
    parts = next;
  }
  return parts.filter(([p0, p1]) => p1 - p0 > 1e-6);
}

function addRun(b: Builder, run: FenceRun): void {
  const segs: Segment[] = [];
  let total = 0;
  for (let i = 1; i < run.route.length; i++) {
    const a = run.route[i - 1]!;
    const e = run.route[i]!;
    const len = Math.hypot(e[0] - a[0], e[1] - a[1]);
    if (len < 1e-6) continue;
    segs.push({ a, u: [(e[0] - a[0]) / len, (e[1] - a[1]) / len], s0: total, s1: total + len });
    total += len;
  }
  if (segs.length === 0) return;
  const h = run.height;
  const white = col('white');
  const shade = white.clone().multiplyScalar(0.9);
  const toned = white.clone().multiplyScalar(0.94);
  const open = (run.open ?? []).map(([o0, o1]) => [Math.max(0, o0), Math.min(total, o1)] as const);
  const topOfPosts = run.board ? h - BOARD.thick : h;

  // posts: at the ends, at the corners, on both sides of every open stretch
  const posts: [number, number][] = [
    [0, POST],
    [total - POST, total],
  ];
  for (const s of segs.slice(1)) posts.push([s.s0 - POST / 2, s.s0 + POST / 2]);
  for (const [o0, o1] of open) posts.push([o0 - POST, o0], [o1, o1 + POST]);
  const kept = posts
    .map(([p0, p1]) => [Math.max(0, p0), Math.min(total, p1)] as [number, number])
    .filter(([p0, p1]) => p1 - p0 > 1e-6 && !open.some(([o0, o1]) => p0 < o1 - 1e-6 && p1 > o0 + 1e-6));

  for (const seg of segs) {
    const rot = [0, Math.atan2(-seg.u[1], seg.u[0]), 0] as const;
    const point = (s: number, side = 0): readonly [number, number] => [
      seg.a[0] + seg.u[0] * (s - seg.s0) + seg.u[1] * side,
      seg.a[1] + seg.u[1] * (s - seg.s0) - seg.u[0] * side,
    ];
    const box = (s0: number, s1: number, y0: number, tall: number, deep: number, side: number, c = white) => {
      const [x, z] = point((s0 + s1) / 2, side);
      b.box(s1 - s0, tall, deep, { r: 0, c, slot: 'toon', at: [x, y0, z], rot });
    };
    const solid = minus(seg.s0, seg.s1, open);
    // posts whose middle lies on this segment (a corner post belongs to the segment it starts)
    for (const [p0, p1] of kept) {
      const m = (p0 + p1) / 2;
      if (m >= seg.s0 - 1e-9 && (m < seg.s1 - 1e-9 || seg === segs[segs.length - 1]))
        box(p0, p1, 0, topOfPosts, POST, 0, shade);
    }
    // rails on the left side and the board on top
    const side = PICKET_THICK / 2 + RAIL.thick / 2;
    for (const [r0, r1] of solid) {
      for (const y of [RAIL.low, h - RAIL.high])
        box(r0, r1, y - RAIL.tall / 2, RAIL.tall, RAIL.thick, side, shade);
      if (run.board) {
        const atStart = Math.abs(r0 - seg.s0) < 1e-6 && seg !== segs[0];
        const atEnd = Math.abs(r1 - seg.s1) < 1e-6 && seg !== segs[segs.length - 1];
        box(
          r0 - (atStart ? BOARD.wide / 2 : 0),
          r1 + (atEnd ? BOARD.wide / 2 : 0),
          h - BOARD.thick,
          BOARD.thick,
          BOARD.wide,
          0,
        );
      }
    }
    // pickets between the posts
    const pointed = !run.board && run.gap > 0;
    const tall = topOfPosts - CLEAR;
    for (const [f0, f1] of minus(seg.s0, seg.s1, [...open, ...kept])) {
      const len = f1 - f0;
      let n: number;
      let wide: number;
      let step: number;
      if (run.gap > 0) {
        n = Math.floor((len + run.gap) / (run.picket + run.gap) + 1e-9);
        wide = run.picket;
        step = run.picket + run.gap;
      } else {
        n = Math.max(1, Math.round(len / run.picket));
        wide = len / n;
        step = wide;
      }
      if (n < 1) continue;
      const start = f0 + (len - (n * wide + (n - 1) * (step - wide))) / 2 + wide / 2;
      const geo = picketGeometry(wide, tall, PICKET_THICK, pointed);
      for (let k = 0; k < n; k++) {
        const [x, z] = point(start + k * step);
        // boards of a solid fence alternate a touch in tone, so that it reads as boards and not as a panel
        b.add(geo, { c: run.gap > 0 || k % 2 === 0 ? white : toned, slot: 'toon', at: [x, CLEAR, z], rot });
      }
    }
  }
}

/** Every run of the plan in one model (key `fence` of the yard). */
export function picketFence(runs: readonly FenceRun[]): KitModel {
  const b = new Builder('fence');
  for (const run of runs) addRun(b, run);
  return b.build();
}
