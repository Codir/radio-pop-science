/**
 * The magnifier is the chapter's in every step (laid on the lamp's glass, dragged along the wire, back in its
 * holder): one keeper owns its pose after the stand's own update, so nothing of it ever jumps at a step change.
 * A step names where the lens belongs (`to`, a pose or a live function of the frame); the keeper glides there
 * from wherever it is shown (eased, with a small lift proportional to the way), or follows exactly (`hold`).
 * The ring's call (full cyan) and the rim arcs in the frame's corners are the keeper's too.
 */
import { Vector3, type ShaderMaterial } from 'three';
import type { CircuitStage, LensPose } from '@circuit/shared/stage';

type PoseFn = () => LensPose;

export interface LensKeeper {
  /** The pose shown now (board frame; do not mutate). */
  readonly shown: LensPose;
  /** True while a glide runs. */
  readonly gliding: boolean;
  /** Follow `pose` exactly from this frame on (a hand, a rail). */
  hold(pose: LensPose | PoseFn): void;
  /** Glide from the pose shown to `pose` in `seconds`, then follow it. */
  to(pose: LensPose | PoseFn, seconds?: number): void;
  /** Jump (deep links). */
  snap(pose: LensPose | PoseFn): void;
  /** The ring's call 0 quiet … 1 full cyan (damped); the rim arcs 0…1 (as given). */
  call: number;
  rim: number;
  /** How much of the glass disc shows 0…1 (1 = as built): it thins out while the ring passes the camera. */
  glass: number;
  /** After `stand.update`: lay the lens. */
  late(dt: number, t: number): void;
}

const copyPose = (p: LensPose, out: LensPose): LensPose => {
  out.position.copy(p.position);
  out.facing.copy(p.facing);
  out.handle.copy(p.handle);
  out.scale = p.scale ?? 1;
  out.grip = p.grip ?? 1;
  return out;
};
const blank = (): LensPose => ({
  position: new Vector3(),
  facing: new Vector3(0, 1, 0),
  handle: new Vector3(0, 0, 1),
  scale: 1,
  grip: 1,
});
const UP = new Vector3(0, 1, 0);

/** A pose between two (`e` eased share), lifted by `lift` at the middle of the way; written into `out`. */
export function mixPose(a: LensPose, b: LensPose, e: number, lift: number, out: LensPose): LensPose {
  out.position.copy(a.position).lerp(b.position, e);
  out.position.addScaledVector(UP, lift * Math.sin(Math.PI * e));
  out.facing.copy(a.facing).lerp(b.facing, e).normalize();
  out.handle.copy(a.handle).lerp(b.handle, e).normalize();
  out.scale = (a.scale ?? 1) + ((b.scale ?? 1) - (a.scale ?? 1)) * e;
  out.grip = (a.grip ?? 1) + ((b.grip ?? 1) - (a.grip ?? 1)) * e;
  return out;
}
export const emptyPose = blank;

export function lensKeeper(stand: CircuitStage): LensKeeper {
  const lens = stand.tools.lens;
  const holder = stand.tools.poses.holder;
  let target: PoseFn = () => holder;
  const from = blank();
  const shown = copyPose(holder, blank());
  let glide: { seconds: number; t: number; lift: number } | null = null;
  let callShown = 0;
  const glassMat = lens.glass.material as ShaderMaterial;
  const alpha = glassMat.uniforms.opacity!.value as number;
  const edge = glassMat.uniforms.uEdgeAlpha!.value as number;
  const fn = (p: LensPose | PoseFn): PoseFn => (typeof p === 'function' ? p : () => p);
  const keeper: LensKeeper = {
    shown,
    get gliding() {
      return glide !== null;
    },
    call: 0,
    rim: 0,
    glass: 1,
    hold(p) {
      target = fn(p);
      glide = null;
    },
    to(p, seconds = 1.2) {
      target = fn(p);
      copyPose(shown, from);
      const way = from.position.distanceTo(target().position);
      glide = way < 1e-4 ? null : { seconds, t: 0, lift: Math.min(0.7, way * 0.3) };
    },
    snap(p) {
      target = fn(p);
      glide = null;
      callShown = keeper.call;
      copyPose(target(), shown);
    },
    late(dt, t) {
      const to = target();
      if (glide) {
        glide.t = Math.min(glide.t + dt, glide.seconds);
        const k = glide.t / glide.seconds;
        mixPose(from, to, k * k * (3 - 2 * k), glide.lift, shown);
        if (k >= 1) glide = null;
      } else copyPose(to, shown);
      lens.setPose(shown, shown, 0);
      callShown += (keeper.call - callShown) * (1 - Math.exp(-dt * 5));
      lens.setCall(callShown, t);
      lens.setRim(keeper.rim);
      glassMat.uniforms.opacity!.value = alpha * keeper.glass;
      glassMat.uniforms.uEdgeAlpha!.value = edge * keeper.glass;
      lens.glass.visible = keeper.glass > 0.004;
    },
  };
  return keeper;
}
