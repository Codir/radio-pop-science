/**
 * The magnifier in the reader's hand (`battery/poles`): from its holder onto either end of the battery and back,
 * or following the pointer while it is dragged. The chapter owns the lens pose while `active`; the stage's own
 * pose (`lens` param, 0 = holder) is overridden after the world's update every frame. Every move starts from where
 * the lens IS (never a jump), lifts in a low arc and lands eased.
 */
import { Quaternion, Vector3 } from 'three';
import { damp } from '@/engine/api';
import type { CircuitStage, LensPose } from '@circuit/shared/stage';
import { poleLensPose, type PoleId } from './poses';

export type LensSpot = 'holder' | PoleId;

export interface LensHand {
  /** Where the lens rests or is going; `null` while the hand holds it. */
  readonly spot: LensSpot | null;
  /** The spot it has landed on (null while travelling or held). */
  readonly landed: LensSpot | null;
  /** 0 … 1 progress of the current travel (1 = landed). */
  readonly progress: number;
  /** Glide there from wherever the lens is (seconds: default by the distance, 0.7 … 1.3 s). */
  goTo(spot: LensSpot, seconds?: number): void;
  /** Jump there (a deep link). */
  place(spot: LensSpot): void;
  /** The hand holds the lens: its centre follows this board-frame point (null = let go where it is). */
  hold(board: Vector3 | null): void;
  /** Where the lens centre is now (board frame). */
  readonly position: Vector3;
  update(dt: number): void;
}

const Z = new Vector3(0, 0, 1);
const NEG_Y = new Vector3(0, -1, 0);
const UP = new Vector3(0, 1, 0);
const ease = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const copyPose = (p: LensPose): Required<LensPose> => ({
  position: p.position.clone(),
  facing: p.facing.clone(),
  handle: p.handle.clone(),
  scale: p.scale ?? 1,
  grip: p.grip ?? 1,
});

/**
 * `size()`: how large the ring is drawn over an end (1 = as made). Phones draw it larger — the frame has room above
 * the bottom sheet — with a handle of the ordinary size (`grip`).
 */
export function createLensHand(stand: CircuitStage, size: () => number = () => 1): LensHand {
  const lens = stand.tools.lens;
  const poses: Record<LensSpot, Required<LensPose>> = {
    holder: copyPose(stand.tools.poses.holder),
    minus: copyPose(poleLensPose('minus')),
    plus: copyPose(poleLensPose('plus')),
  };
  const now = copyPose(poses.holder);
  const from = copyPose(poses.holder);
  let to: LensSpot | null = 'holder';
  let k = 1;
  let duration = 1;
  let lift = 0;
  let hand: Vector3 | null = null;
  const q = new Quaternion();

  /** The lens as it stands in the scene right now (whoever set it). */
  const snapshot = (): void => {
    lens.group.updateMatrix();
    from.position.copy(lens.group.position);
    q.copy(lens.group.quaternion);
    from.facing.copy(Z).applyQuaternion(q);
    from.handle.copy(NEG_Y).applyQuaternion(q);
    from.scale = lens.group.scale.x;
    from.grip = now.grip;
  };
  const apply = (): void => {
    lens.setPose(now, now, 0);
  };
  const out: LensHand = {
    get spot() {
      return hand ? null : to;
    },
    get landed() {
      return !hand && k >= 1 ? to : null;
    },
    get progress() {
      return k;
    },
    goTo(spot, seconds) {
      if (spot === to && !hand) return;
      snapshot();
      hand = null;
      to = spot;
      const d = from.position.distanceTo(poses[spot].position);
      duration = seconds ?? Math.min(1.3, 0.7 + 0.25 * d);
      // a low arc over what lies between; a hop from end to end barely lifts
      lift = Math.min(0.6, 0.12 + 0.18 * d);
      k = 0;
    },
    place(spot) {
      hand = null;
      to = spot;
      k = 1;
      Object.assign(now, copyPose(poses[spot]));
      apply();
    },
    hold(board) {
      if (board) {
        if (!hand) snapshot();
        hand = (hand ?? new Vector3()).copy(board);
        to = null;
      } else if (hand) {
        hand = null;
        to = null;
      }
    },
    get position() {
      return now.position;
    },
    update(dt) {
      const big = size();
      for (const pole of ['minus', 'plus'] as const) {
        poses[pole].scale = big;
        poses[pole].grip = 1 / big;
      }
      if (hand) {
        // the ring follows the hand closely, its face turns to the reader as over the battery
        now.position.set(
          damp(now.position.x, hand.x, 18, dt),
          damp(now.position.y, hand.y, 18, dt),
          damp(now.position.z, hand.z, 18, dt),
        );
        now.facing.lerp(poses.minus.facing, 1 - Math.exp(-8 * dt)).normalize();
        now.handle.lerp(poses.minus.handle, 1 - Math.exp(-8 * dt)).normalize();
        now.scale = damp(now.scale, big, 8, dt);
        now.grip = damp(now.grip, 1 / big, 8, dt);
      } else if (to && k < 1) {
        k = Math.min(1, k + dt / duration);
        const e = ease(k);
        const goal = poses[to];
        now.position
          .lerpVectors(from.position, goal.position, e)
          .addScaledVector(UP, lift * Math.sin(Math.PI * e));
        // facing and handle turn together (the handle kept square to the face)
        now.facing.copy(from.facing).lerp(goal.facing, e).normalize();
        now.handle.copy(from.handle).lerp(goal.handle, e);
        now.handle.addScaledVector(now.facing, -now.handle.dot(now.facing)).normalize();
        now.scale = from.scale + (goal.scale - from.scale) * e;
        now.grip = from.grip + (goal.grip - from.grip) * e;
      } else if (to && to !== 'holder') {
        // landed: the size follows the screen (a phone turned, a window resized) without a jump
        now.scale = damp(now.scale, poses[to].scale, 6, dt);
        now.grip = damp(now.grip, poses[to].grip, 6, dt);
      }
      apply();
    },
  };
  return out;
}
