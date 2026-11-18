/**
 * The magnifier away from the stand's own places: in the reader's hand, lying over the place where the balloon
 * touches the hair (`charge`), over the spare piece of wire (`shift`) — and back to its holder. The stage puts
 * the lens where its `lens` param says every frame; while the keeper holds it (`active`), it lays the lens over
 * that after the world's update. Every change is a glide (eased, lifted off the table on the way): the lens
 * never jumps, also when a step changes under it — the keeper lives for the whole chapter.
 */
import { Quaternion, Vector3 } from 'three';
import { damp } from '@/engine/api';
import { worldDirToBoard, worldToBoard, type CircuitStage, type LensPose } from '@circuit/shared/stage';

const pose = (): LensPose => ({
  position: new Vector3(),
  facing: new Vector3(0, 1, 0),
  handle: new Vector3(0, 0, 1),
  scale: 1,
  grip: 1,
});
const copyPose = (out: LensPose, p: LensPose): LensPose => {
  out.position.copy(p.position);
  out.facing.copy(p.facing);
  out.handle.copy(p.handle);
  out.scale = p.scale ?? 1;
  out.grip = p.grip ?? 1;
  return out;
};

export interface LensKeeper {
  /** The keeper has the lens (in the hand, on its way, or lying somewhere the stage does not know). */
  readonly active: boolean;
  /** The lens lies where it was sent and is not moving. */
  readonly settled: boolean;
  /** The lens is in the reader's hand. */
  held: boolean;
  /** A pose facing a world point (the camera) from a world centre; the handle down and toward the reader. */
  facingPose(centre: Vector3, eye: Vector3, scale?: number, out?: LensPose): LensPose;
  /** Glide to a pose (board frame) in `seconds`; `instant` for deep links. */
  send(to: LensPose, seconds?: number, instant?: boolean): void;
  /** Glide back to the holder; the stage takes the lens over there. */
  home(seconds?: number, instant?: boolean): void;
  /** Follow the hand: the ring's centre at a world point (eased a little), facing as `facing`. */
  follow(centre: Vector3, facing: LensPose): void;
  /** After the world's update, every frame. */
  update(dt: number): void;
}

export function createLensKeeper(stand: CircuitStage): LensKeeper {
  const { lens, poses } = stand.tools;
  const from = pose();
  const to = pose();
  const cur = pose();
  const hand = new Vector3();
  let t = 1;
  let span = 1;
  let active = false;
  let returning = false;
  let following = false;
  const grip = lens.group.getObjectByName('lens:handle');
  const q = new Quaternion();
  /** What the stage put on the lens this frame, as a pose (local +z = facing, local −y = handle). */
  const stagePose = (out: LensPose): LensPose => {
    out.position.copy(lens.group.position);
    q.copy(lens.group.quaternion);
    out.facing.set(0, 0, 1).applyQuaternion(q);
    out.handle.set(0, -1, 0).applyQuaternion(q);
    out.scale = lens.group.scale.x;
    out.grip = grip?.scale.x ?? 1;
    return out;
  };
  const lerp = (k: number): void => {
    const e = k * k * (3 - 2 * k);
    cur.position.copy(from.position).lerp(to.position, e);
    // off the table on the way: an arc, as a hand carries it
    cur.position.y += 0.55 * Math.sin(Math.PI * e) * Math.min(from.position.distanceTo(to.position), 1);
    cur.facing.copy(from.facing).lerp(to.facing, e).normalize();
    cur.handle.copy(from.handle).lerp(to.handle, e).normalize();
    cur.scale = (from.scale ?? 1) + ((to.scale ?? 1) - (from.scale ?? 1)) * e;
    cur.grip = (from.grip ?? 1) + ((to.grip ?? 1) - (from.grip ?? 1)) * e;
  };
  const keeper: LensKeeper = {
    get active() {
      return active;
    },
    get settled() {
      return active && !keeper.held && t >= 1;
    },
    held: false,
    facingPose(centre, eye, scale = 1, out = pose()) {
      out.position.copy(worldToBoard(centre));
      worldDirToBoard(hand.copy(eye).sub(centre).normalize(), out.facing);
      out.handle.set(0.5, -0.55, 0.65).addScaledVector(out.facing, -out.handle.dot(out.facing)).normalize();
      out.scale = scale;
      out.grip = 1 / Math.max(scale, 1);
      return out;
    },
    send(target, seconds = 0.9, instant = false) {
      following = false;
      copyPose(from, active ? cur : poses.holder);
      copyPose(to, target);
      active = true;
      returning = false;
      t = instant ? 1 : 0;
      span = Math.max(seconds, 1e-3);
      lerp(t);
    },
    home(seconds = 1.1, instant = false) {
      if (!active) return;
      keeper.held = false;
      following = false;
      copyPose(from, cur);
      copyPose(to, poses.holder);
      returning = true;
      t = instant ? 1 : 0;
      span = Math.max(seconds, 1e-3);
    },
    follow(centre, facing) {
      if (!active) copyPose(cur, poses.holder);
      active = true;
      returning = false;
      following = true;
      t = 1;
      copyPose(to, facing);
      worldToBoard(centre, to.position);
    },
    update(dt) {
      if (!active) return;
      // on the way back the goal is the pose the stage itself shows this frame (the holder, or the lens leg of a
      // flight that has already started): handing the lens back is then seamless whatever the stage does
      if (returning) stagePose(to);
      if (following && keeper.held) {
        // the ring follows the hand closely, with just enough lag to read as carried
        cur.position.x = damp(cur.position.x, to.position.x, 16, dt);
        cur.position.y = damp(cur.position.y, to.position.y, 16, dt);
        cur.position.z = damp(cur.position.z, to.position.z, 16, dt);
        const k = Math.min(dt * 8, 1);
        cur.facing.lerp(to.facing, k).normalize();
        cur.handle.lerp(to.handle, k).normalize();
        cur.scale = (cur.scale ?? 1) + ((to.scale ?? 1) - (cur.scale ?? 1)) * k;
        cur.grip = (cur.grip ?? 1) + ((to.grip ?? 1) - (cur.grip ?? 1)) * k;
      } else if (t < 1) {
        following = false;
        t = Math.min(t + dt / span, 1);
        lerp(t);
      } else following = false;
      lens.setPose(cur, cur, 1);
      if (returning && t >= 1) active = returning = false; // the stage's own pose is this very pose
    },
  };
  return keeper;
}
