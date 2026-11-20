/**
 * The magnifier on the bench (docs/volumes/electronics/VISUAL.md §7), copied from
 * `circuit/shared/stage/tools/index.ts` (shared/README.md, «Копії»): the base ↔ world conversions, the holder's pose
 * and a pose over any point of the base stay; the gauge, the counter frame, the snail, the crawl and the enlarging
 * loupe of `circuit` are gone. A model with states only — where a step takes the magnifier is the chapter's business.
 */
import { Quaternion, Vector3, type Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { BOARD } from '../layout';
import { BOARD_Y } from '../base';
import { boardToWorld } from '../shots';
import { createLens, holderPose, type LensModel, type LensPose } from './lens';

export type { LensModel, LensPose };
export { holderPose } from './lens';

const unTilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -BOARD.tilt);

/** World point / direction → base frame (the bench group at the world origin). */
export function worldToBoard(p: Vector3, out = new Vector3()): Vector3 {
  return out
    .copy(p)
    .sub(new Vector3(0, BOARD_Y, 0))
    .applyQuaternion(unTilt);
}
export function worldDirToBoard(d: Vector3, out = new Vector3()): Vector3 {
  return out.copy(d).applyQuaternion(unTilt);
}

/**
 * The magnifier in use over a point of the base (base frame): on the line from that point to the camera `from`
 * (world), `lift` units toward the camera, facing it, the handle down to the right. Lifted toward the reader it is
 * drawn a little larger (`scale`), as in `circuit`, where the ring over the wire was 22 % of the frame height.
 */
export function overPose(at: Vector3, from: Vector3, lift = 2.2, scale = 1.12): LensPose {
  const spot = boardToWorld(at.x, at.y, at.z);
  const toCamera = from.clone().sub(spot).normalize();
  const facing = worldDirToBoard(toCamera);
  const handle = new Vector3(0.62, -0.5, 0.6);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  return { position: worldToBoard(spot.addScaledVector(toCamera, lift)), facing, handle, scale };
}

export interface ToolState {
  /** 0 = the magnifier in its holder … 1 = at `target`. */
  use: number;
  /** Where the magnifier goes when it is in use (base frame); null keeps it in its holder. */
  target: LensPose | null;
  /** 0…1 progress of the flight through the ring: the rim's arcs come in from 0.5 on. */
  dive: number;
  /** 0…1: the step asks the reader to take the magnifier — the resting ring turns full cyan and pulses. */
  call: number;
}

export interface BenchTools {
  lens: LensModel;
  /** The magnifier's standard pose: flat in its holder in the near left corner (base frame). */
  holder: LensPose;
  /** Apply the state (see `ToolState`); `t` = engine time. */
  set(state: ToolState, t: number): void;
}

export function createTools(ctx: ChapterContext, frameGroup: Group): BenchTools {
  const lens = createLens(ctx);
  frameGroup.add(lens.group);
  ctx.root.add(lens.rim);
  const holder = holderPose();
  const smooth = (x: number): number => x * x * (3 - 2 * x);
  const ramp = (x: number, a: number, b: number): number => Math.min(Math.max((x - a) / (b - a), 0), 1);
  return {
    lens,
    holder,
    set({ use, target, dive, call }, t) {
      const u = target ? Math.min(Math.max(use, 0), 1) : 0;
      lens.setPose(holder, target ?? holder, u);
      // "take me": the ring calls while the magnifier rests, and is full cyan in the reader's hand
      lens.setCall(Math.max(call, u), t);
      lens.setRim(smooth(ramp(dive, 0.5, 0.92)));
    },
  };
}
