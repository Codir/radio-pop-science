/**
 * The three lenses of `flow/together` and `flow/push` (VISUAL §5.5): the stand's own magnifier, taken from its
 * holder, and two more like it that come down from above, laid one after another over the loop — near the minus
 * (the left side), in the middle of the far wire, on the wire by the lamp's socket (the right side). Each is a
 * window onto «усередині міді» (`lens-picture.ts`), its picture turned so the wire runs as the reader sees it:
 * up the left side, right along the far side, down the right side — the electrons' way round the loop.
 * `presence` 0 away … 1 on the loop (travels); `drifting[i]` starts and stops the common shift in lens i.
 */
import { Quaternion, Vector2, Vector3, type Mesh } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  LOOP,
  STAGE_SHOTS,
  boardToWorld,
  holderPose,
  tameAll,
  worldDirToBoard,
  type CircuitStage,
  type LensModel,
  type LensPose,
} from '@circuit/shared/stage';
import { LENS } from '@circuit/shared/stage';
import { createLens } from '@circuit/shared/stage/tools/lens';
import { glide, type Glide } from './glide';
import { lensPicture, type LensPicture } from './lens-picture';

/** Where the three lie (board frame, on the wire) and the electrons' direction there. */
export const LENS_SPOTS = [
  { at: new Vector3(LOOP.left, LOOP.y, 0.62), way: new Vector3(0, 0, -1) },
  { at: new Vector3(0.38, LOOP.y, LOOP.far), way: new Vector3(1, 0, 0) },
  { at: new Vector3(LOOP.right, LOOP.y, -1.02), way: new Vector3(0, 0, 1) },
] as const;
/** Common shift in atom spacings per second while a lens drifts (exaggerated, as the script says). */
const SHIFT_RATE = 0.22;
const SCALE = 0.92;

export interface Lenses {
  presence: Glide;
  /** The common shift is on in lens i (it starts and stops in the frame it is set). */
  drifting: [boolean, boolean, boolean];
  /** The three glasses (hover targets). */
  glasses: readonly Mesh[];
  /** Ring centres (world) for captions and QA. */
  centre(i: number, out?: Vector3): Vector3;
  /** After the world's update. */
  update(dt: number, t: number, warm: number): void;
}

export function lenses(ctx: ChapterContext, stage: CircuitStage): Lenses {
  const stageLens = stage.tools.lens;
  const extra = [createLens(ctx), createLens(ctx)];
  for (const l of extra) {
    stage.base.frame.add(l.group);
    tameAll(l.group);
    l.group.visible = false;
  }
  const all: LensModel[] = [stageLens, ...extra];
  const cam = new Vector3(...STAGE_SHOTS.stand.position);
  const poses: LensPose[] = LENS_SPOTS.map(({ at }, i) => {
    const w = boardToWorld(at.x, at.y, at.z);
    const toCamera = cam.clone().sub(w).normalize();
    const facing = worldDirToBoard(toCamera)
      .lerp(new Vector3(0, 1, 0), 0.25)
      .normalize();
    // the handle hangs toward the outside of the loop and the reader
    const handle = new Vector3(i === 0 ? -0.7 : 0.6, -0.4, 0.6);
    handle.addScaledVector(facing, -handle.dot(facing)).normalize();
    const position = worldDirToBoard(toCamera).multiplyScalar(0.55).add(at);
    return { position, facing, handle, scale: SCALE };
  });
  // the two extra lenses wait above the stand, out of the frame
  const above: LensPose[] = poses.map((p) => ({
    ...p,
    position: p.position.clone().add(new Vector3(0, 4.5, -1.5)),
  }));
  const holder = holderPose();
  const pictures: LensPicture[] = all.map((l, i) => {
    const pic = lensPicture(LENS.radius - 0.062, 1.7 + i * 2.3);
    l.group.add(pic.mesh);
    pic.mesh.visible = false;
    return pic;
  });
  const shifts = [0, 0, 0];
  const axis = new Vector2();
  const local = new Vector3();
  const inv = new Quaternion();
  const presence = glide(0);
  const out: Lenses = {
    presence,
    drifting: [false, false, false],
    glasses: all.map((l) => l.glass),
    centre(i, o = new Vector3()) {
      return all[i]!.ring.getWorldPosition(o);
    },
    update(dt, t, warm) {
      const p = presence.update(dt);
      all.forEach((l, i) => {
        // one after another: each takes 60 % of the way, starting 20 % after the one before
        const k = Math.min(Math.max((p - 0.2 * i) / 0.6, 0), 1);
        const pic = pictures[i]!;
        if (i > 0) l.group.visible = k > 0.002;
        if (k <= 0.002) {
          pic.mesh.visible = false;
          return;
        }
        l.setPose(i === 0 ? holder : above[i]!, poses[i]!, k);
        l.setCall(0.55, t);
        if (out.drifting[i]) shifts[i] = shifts[i]! + SHIFT_RATE * dt;
        // the wire's way in the ring's plane (the picture's x)
        local.copy(LENS_SPOTS[i]!.way).applyQuaternion(inv.copy(l.group.quaternion).invert());
        axis.set(local.x, local.y).normalize();
        pic.mesh.visible = true;
        pic.mesh.scale.setScalar(Math.max(Math.min(k * 1.6 - 0.6, 1), 1e-3));
        pic.set(shifts[i]!, t, warm, axis);
      });
    },
  };
  return out;
}
