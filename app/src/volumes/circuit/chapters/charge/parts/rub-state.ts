/**
 * What the balloon does to the things around it, shared by the steps that handle it (`rub`, `charge`, `shift`):
 * rubs counted while it touches the hair, its charge (0 … 1 after three rubs), the pull on the hair, the push on
 * the second balloon. A picture model, not physics: the pull falls off with distance so that the hair lifts
 * within about two balloon widths and drops beyond four; the second balloon leans ∝ 1 / d² (capped).
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { Props } from '../world';
import { BALLOON_R } from './balloon';
import { createBalloonHand, type BalloonHand } from './handle';

/** Rubs (there and back) that charge the balloon fully. */
export const FULL_RUBS = 3;
/** Travel along the hair between two turns that counts as one move (world units). */
const MOVE = 0.22;
/** The balloon is «in the hair» while its centre is this close to the head's centre (+ head radius). */
const IN_HAIR = BALLOON_R + 0.55;

export interface RubState {
  hand: BalloonHand;
  held(): boolean;
  /** Full rubs (there and back) since the step began. */
  readonly rubs: number;
  /** Moves (half rubs) since the step began. */
  readonly moves: number;
  /** 0…1: how charged the balloon is. */
  readonly charge: number;
  /** The balloon touches the hair. */
  readonly touching: boolean;
  /** Called once per move along the hair (the micro view hops electrons on it). */
  onMove: (() => void) | null;
  /** Step entry: `charged` = the balloon has been rubbed before (this session or by the step's state). */
  reset(instant: boolean, charged: boolean): void;
  plane(normal: Vector3, through: Vector3): void;
  /** Every frame, after the props moved: the head's world centre and radius. */
  update(dt: number, head: Vector3, headR: number): void;
}

export function createRubState(ctx: ChapterContext, props: Props): RubState {
  const { balloon, figure, hanger } = props;
  const hand = createBalloonHand(ctx, balloon, balloon.body);
  const along = new Vector3(1, 0, 0);
  const pos = new Vector3();
  const second = new Vector3();
  const away = new Vector3();
  const headObstacle = { centre: new Vector3(), radius: 0 };
  const secondObstacle = { centre: new Vector3(), radius: BALLOON_R * 2.05 };
  hand.obstacles = [headObstacle, secondObstacle];
  let moves = 0;
  let charge = 0;
  let touching = false;
  let ext = 0; // the farthest point of the current move (coordinate along the hair)
  let way = 0; // its direction (−1, 0, 1)
  let wasTouching = false;
  const state: RubState = {
    hand,
    held: () => hand.held,
    get rubs() {
      return Math.floor(moves / 2);
    },
    get moves() {
      return moves;
    },
    get charge() {
      return charge;
    },
    get touching() {
      return touching;
    },
    onMove: null,
    reset(_instant, charged) {
      moves = 0;
      way = 0;
      charge = charged ? 1 : 0;
      touching = false;
    },
    plane(normal, through) {
      hand.normal.copy(normal);
      hand.through.copy(through);
      along.set(0, 1, 0).cross(normal).normalize();
    },
    update(_dt, head, headR) {
      balloon.group.getWorldPosition(pos);
      headObstacle.centre.copy(head);
      headObstacle.radius = headR + BALLOON_R * 0.92;
      hanger.centre(secondObstacle.centre);
      const d = pos.distanceTo(head);
      touching = hand.held && d < headR + IN_HAIR;
      if (touching) {
        // a move = travel of at least MOVE one way; each new move (the first, then every turn back) counts
        const s = pos.dot(along);
        if (!wasTouching) {
          way = 0;
          ext = s;
        } else if (way === 0) {
          if (Math.abs(s - ext) > MOVE) {
            way = Math.sign(s - ext);
            ext = s;
            moves++;
            state.onMove?.();
          }
        } else if ((s - ext) * way > 0) ext = s;
        else if ((ext - s) * way > MOVE) {
          way = -way;
          ext = s;
          moves++;
          state.onMove?.();
        }
        // the charge grows with the rubs
        charge = Math.max(charge, Math.min(moves / (FULL_RUBS * 2), 1));
      }
      wasTouching = touching;
      // the hair reaches for a charged balloon within about two balloon widths
      const near = Math.min(Math.max(1 - (d - headR - BALLOON_R * 1.1) / 3.2, 0), 1);
      figure.attract.copy(pos);
      figure.pull = charge * near ** 0.8 * (touching ? 0.5 : 1);
      figure.pusher.copy(pos);
      figure.pushR = BALLOON_R * 1.08;
      // the second balloon (charged like this one) leans away ∝ 1 / d²
      hanger.centre(second);
      away.copy(second).sub(pos).setY(0);
      const dist = Math.max(second.distanceTo(pos), BALLOON_R * 2);
      const k = (1.4 * charge) / (dist * dist);
      hanger.push.copy(away.normalize()).multiplyScalar(Math.min(k, 0.8));
    },
  };
  return state;
}
