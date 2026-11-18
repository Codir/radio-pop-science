/**
 * The magnifier as a window onto the rubber and the hair (`charge/charge`): the same stencil portal as the
 * composed world's copper window (`shared/world/window.ts`, reused, not changed), but showing this chapter's own
 * scene (`banks.ts`). It opens like an iris once the lens lies still on the spot and closes when it leaves.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { LENS, type CircuitStage } from '@circuit/shared/stage';
import { createLensWindow } from '@circuit/shared/world/window';
import { createBanks, type Banks } from './banks';

/** Units of the banks' scene across the window. */
const SPAN = 11.5;

export interface LensView {
  banks: Banks;
  /** 0 closed … 1 open (what is drawn now). */
  readonly open: number;
  /** What the step asks for: 1 open, 0 closed. */
  want: number;
  /** A point on the lens in its own plane: (u, v) in ring radii (u right, v up as the reader sees it), world. */
  rim(u: number, v: number, out: Vector3): Vector3;
  update(dt: number, t: number): void;
}

export function createLensView(ctx: ChapterContext, stand: CircuitStage): LensView {
  const lens = stand.tools.lens;
  const win = createLensWindow(lens);
  const banks = createBanks();
  ctx.root.add(banks.group);
  win.clip(banks.group, true);
  banks.group.visible = false;
  let open = 0;
  const centre = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const facing = new Vector3();
  const view: LensView = {
    banks,
    get open() {
      return open;
    },
    want: 0,
    rim(u, v, out) {
      lens.glass.updateWorldMatrix(true, false);
      lens.glass.getWorldPosition(centre);
      facing.set(0, 0, 1).transformDirection(lens.glass.matrixWorld);
      right.set(1, 0, 0).addScaledVector(facing, -facing.x).normalize();
      up.crossVectors(facing, right).normalize();
      const r = LENS.radius * lens.group.scale.x;
      return out
        .copy(centre)
        .addScaledVector(right, u * r)
        .addScaledVector(up, v * r);
    },
    update(dt, t) {
      // opens over ≈ 0.6 s, closes over ≈ 0.3 s: never a pop
      open = view.want > open ? Math.min(open + dt / 0.6, view.want) : Math.max(open - dt / 0.3, view.want);
      banks.group.visible = open > 0.002;
      if (banks.group.visible) {
        // the window's own radius does not know the ring's pose scale: the same picture fills a bigger ring
        win.span = SPAN / Math.max(lens.group.scale.x, 1e-3);
        win.place(banks.group);
        banks.update(dt, t);
      }
      win.amount = open;
      win.update();
    },
  };
  return view;
}
