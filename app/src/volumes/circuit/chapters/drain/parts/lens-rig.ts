/**
 * The magnifier in `inner`: it rests on the lamp's glass and the reader carries it to the battery along one rail
 * (`rail` 0 lamp … 1 battery; the ring rises off the board on the way — the stand's own `setPose` arc), and it
 * comes from / goes back to its holder (`arrive` 0 holder … 1 on the rail). The rig lays the lens after the stand
 * did (`world.afterLens`), so nothing of the stage's own pose logic has to change. Both are scrubs: a hand moves
 * `rail` directly, a release glides it; no jumps either way.
 */
import { Vector3 } from 'three';
import {
  holderPose,
  lampLensPose,
  worldDirToBoard,
  worldToBoard,
  type LensModel,
  type LensPose,
} from '@circuit/shared/stage';
import { LENS_ON_BATTERY } from '../shots';
import { scrub, stepScrub, type Scrub } from './scrub';

export interface LensRig {
  /** 0 in its holder … 1 on the rail. */
  arrive: Scrub;
  /** 0 on the lamp's glass … 1 over the battery. */
  rail: Scrub;
  readonly lamp: LensPose;
  readonly battery: LensPose;
  /** Lay the lens (after the stand's own pose). */
  update(dt: number): void;
}

const lerpPose = (a: LensPose, b: LensPose, k: number, out: LensPose): LensPose => {
  out.position.copy(a.position).lerp(b.position, k);
  out.facing.copy(a.facing).lerp(b.facing, k).normalize();
  out.handle.copy(a.handle).lerp(b.handle, k).normalize();
  out.scale = (a.scale ?? 1) + ((b.scale ?? 1) - (a.scale ?? 1)) * k;
  out.grip = (a.grip ?? 1) + ((b.grip ?? 1) - (a.grip ?? 1)) * k;
  return out;
};

/**
 * `camera` = the camera position the lens faces (world). The lens over the battery hangs on the line to the
 * camera, `lift` units toward it, large enough to show the separator in it.
 */
export function lensRig(lens: LensModel, camera: readonly [number, number, number]): LensRig {
  const holder = holderPose();
  const lamp = lampLensPose(1.45, camera, 1.05);
  const centre = LENS_ON_BATTERY.clone();
  const toCamera = new Vector3(...camera).sub(centre).normalize();
  const facing = worldDirToBoard(toCamera.clone());
  const handle = new Vector3(0.6, -0.5, 0.62);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  const scale = 1.55;
  const battery: LensPose = {
    position: worldToBoard(centre.clone().addScaledVector(toCamera, 1.25)),
    facing,
    handle,
    scale,
    grip: 1 / scale,
  };
  const arrive = scrub(0, 0.42);
  const rail = scrub(0, 0.35);
  const mid: LensPose = {
    position: new Vector3(),
    facing: new Vector3(),
    handle: new Vector3(),
    scale: 1,
    grip: 1,
  };
  return {
    arrive,
    rail,
    lamp,
    battery,
    update(dt) {
      stepScrub(arrive, dt);
      stepScrub(rail, dt);
      const a = Math.min(Math.max(arrive.shown, 0), 1);
      const k = Math.min(Math.max(rail.shown, 0), 1);
      if (a <= 0) return; // the stage keeps it in its holder
      if (a >= 1) lens.setPose(lamp, battery, k);
      else lens.setPose(holder, lerpPose(lamp, battery, k, mid), a);
    },
  };
}
