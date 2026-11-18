/**
 * The reader's hand on the balloon: drag on a plane, keep out of solid things, fall softly to the table when
 * let go. Pure motion — what the steps make of it (rubs, pulls) lives in the steps. One instance for the
 * chapter; each step turns it on with its own plane and obstacles.
 */
import { Vector3, type Object3D } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { BALLOON_R, BALLOON_TALL, type Balloon } from './balloon';

export interface Obstacle {
  centre: Vector3;
  radius: number;
}

export interface BalloonHand {
  /** The balloon is in the reader's hand. */
  readonly held: boolean;
  /** The drag may start (the step is on screen and not in transition). */
  enabled: () => boolean;
  /** The drag plane: normal and a point on it (world). */
  normal: Vector3;
  through: Vector3;
  /** Solid spheres the balloon's centre keeps `radius` away from (written by the step each frame). */
  obstacles: Obstacle[];
  /** Where the balloon goes when not held: null = it falls to the table where it is. */
  home: Vector3 | null;
  /** Limits where the hand may take it (a step's rule, e.g. «along the hair only»); null = anywhere. */
  constrain: ((p: Vector3) => void) | null;
  /** Hold the balloon by another handle (a drag on the lens): a world point on the drag plane, null = let go. */
  drive(point: Vector3 | null): void;
  /** The motion of the hand this frame (world, units/s) — for rubs. */
  readonly velocity: Vector3;
  /** Put the balloon somewhere at once (deep link) or let it glide there. */
  place(p: Vector3, tilt: number, instant?: boolean): void;
  update(dt: number): void;
}

const LIE = 1.45;

export function createBalloonHand(ctx: ChapterContext, balloon: Balloon, pick: Object3D): BalloonHand {
  const target = new Vector3().copy(balloon.group.position);
  const last = new Vector3().copy(target);
  const hit = new Vector3();
  let held = false;
  let tilt = balloon.tilt;
  /** A glide the step asked for (`place`, `home`): eased, on an arc, about as long as a hand would take. */
  const glide = { from: new Vector3(), to: new Vector3(), t: 1, span: 1 };
  const start = (to: Vector3): void => {
    glide.from.copy(balloon.group.position);
    glide.to.copy(to);
    glide.t = 0;
    glide.span = Math.min(Math.max(0.6 + glide.from.distanceTo(to) * 0.3, 0.8), 1.6);
  };
  const keepOut = (p: Vector3): void => {
    for (const o of hand.obstacles) {
      const d = p.distanceTo(o.centre);
      if (d < o.radius)
        p.sub(o.centre)
          .multiplyScalar(o.radius / Math.max(d, 1e-4))
          .add(o.centre);
    }
    p.y = Math.max(p.y, BALLOON_R);
    hand.constrain?.(p);
  };
  const grab = (): void => {
    held = true;
    glide.t = 1;
    tilt = 0;
  };
  const drop = (): void => {
    held = false;
    balloon.hover = 0;
    tilt = LIE;
  };
  const toward = (p: Vector3): void => {
    // the pointer holds the balloon by its middle, a little below the top of the body
    target.copy(p);
    target.y -= BALLOON_R * BALLOON_TALL * 0.15;
    keepOut(target);
  };
  const hand: BalloonHand = {
    get held() {
      return held;
    },
    enabled: () => false,
    normal: new Vector3(0, 0, 1),
    through: new Vector3(),
    obstacles: [],
    home: null,
    constrain: null,
    drive(point) {
      if (point) {
        if (!held) grab();
        toward(point);
      } else if (held) drop();
    },
    velocity: new Vector3(),
    place(p, t, instant = false) {
      target.copy(p);
      tilt = t;
      if (instant) {
        balloon.group.position.copy(p);
        balloon.tilt = t;
        last.copy(p);
        glide.t = 1;
      } else start(p);
    },
    update(dt) {
      const pos = balloon.group.position;
      if (!held) {
        if (hand.home) {
          target.copy(hand.home);
          // sent somewhere by the step: carried there along a low arc, never snapped
          if (glide.t >= 1 && pos.distanceTo(target) > 0.08 && !glide.to.equals(target)) start(target);
        } else target.y = Math.max(BALLOON_R, target.y - dt * 2.4); // a light balloon sinks, it does not drop
        keepOut(target);
      }
      if (!held && glide.t < 1) {
        glide.t = Math.min(glide.t + dt / glide.span, 1);
        const e = glide.t * glide.t * (3 - 2 * glide.t);
        pos.lerpVectors(glide.from, glide.to, e);
        pos.y += Math.sin(Math.PI * e) * Math.min(glide.from.distanceTo(glide.to) * 0.35, 0.6);
        balloon.tilt = damp(balloon.tilt, tilt, 4, dt);
        hand.velocity.copy(pos).sub(last).divideScalar(Math.max(dt, 1e-4));
        last.copy(pos);
        return;
      }
      const k = held ? 22 : 7;
      pos.x = damp(pos.x, target.x, k, dt);
      pos.y = damp(pos.y, target.y, k, dt);
      pos.z = damp(pos.z, target.z, k, dt);
      // in the hand it hangs knot down; on the table it lies on its side
      const want = held ? 0.25 * Math.max(Math.min(hand.velocity.x * -0.08, 0.5), -0.5) : tilt;
      balloon.tilt = damp(balloon.tilt, want, 6, dt);
      hand.velocity.copy(pos).sub(last).divideScalar(Math.max(dt, 1e-4));
      last.copy(pos);
      balloon.hover = held ? 1 : balloon.hover;
    },
  };
  ctx.input.register(pick, {
    cursor: 'grab',
    enabled: () => hand.enabled() || held,
    hover: (over) => (balloon.hover = over ? 1 : 0),
    dragStart: grab,
    drag: (e) => {
      const p = e.planePoint(hand.normal, hand.through, hit);
      if (p) toward(p);
    },
    dragEnd: drop,
  });
  return hand;
}
