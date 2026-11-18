/**
 * The second balloon, already rubbed, hanging on a thin thread from a small stand (VISUAL §5, chapter 2): a
 * round `ink` foot, a `steel` post and arm, a `mist` thread. The balloon is a pendulum about the arm's tip:
 * `push` (a horizontal world vector, length = how hard, ≈ radians of lean it asks for) swings it; it settles
 * with a little overshoot, as a light balloon on a thread does. Local frame: origin on the table under the post.
 */
import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';
import { Builder } from '@/kit';
import { col } from '@/style';
import { BALLOON_R, BALLOON_TALL, createBalloon, type Balloon } from './balloon';

const POST_H = 3.05;
const ARM = 2.75;
/** Thread from the arm's tip to the knot. */
const THREAD = 1.42;
/** Largest lean of the thread, radians. */
const MAX_LEAN = 0.85;
/** Height of the arm (the thread's top), table = 0. */
export const HANG_Y = POST_H + 0.05;

export interface Hanger {
  group: Group;
  balloon: Balloon;
  /** Horizontal push on the balloon, world space (length ≈ the lean it asks for, radians). */
  push: Vector3;
  /** Current lean of the thread from the vertical (radians). */
  readonly lean: number;
  /** World centre of the hanging balloon. */
  centre(out: Vector3): Vector3;
  /** Forget the swing (deep link). */
  snap(): void;
  update(dt: number, t: number): void;
}

export function createHanger(): Hanger {
  const group = new Group();
  group.name = 'charge-hanger';
  const b = new Builder('charge-hanger');
  b.cyl(0.42, 0.1, { seg: 32, bevel: 0.035, c: ['ink', 'slate'] });
  b.cyl(0.045, POST_H, { seg: 14, c: ['slate', 'steel'], at: [0, 0.08, 0] });
  b.sphere(0.07, { at: [0, POST_H + 0.08, 0], seg: 14, c: 'steel' });
  b.rod([0, POST_H + 0.08, 0], [ARM, POST_H + 0.08, 0], 0.035, { seg: 12, c: 'steel' });
  b.sphere(0.05, { at: [ARM, POST_H + 0.08, 0], seg: 12, c: 'steel' });
  const stand = b.build().group;
  const balloon = createBalloon('charge-second-balloon');
  const swing = new Group();
  const pivot = new Vector3(ARM, POST_H + 0.05, 0);
  swing.position.copy(pivot);
  // the balloon hangs knot up: its body below the thread's end
  balloon.group.position.set(0, -THREAD - BALLOON_R * BALLOON_TALL - 0.07, 0);
  balloon.group.rotation.z = Math.PI;
  swing.add(balloon.group);
  const thread = new Line(
    new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, -THREAD, 0)]),
    new LineBasicMaterial({ color: col('mist'), transparent: true, opacity: 0.85 }),
  );
  swing.add(thread);
  group.add(stand, swing);

  const ang = { x: 0, z: 0, vx: 0, vz: 0 };
  const local = new Vector3();
  const origin = new Vector3();
  const hanger: Hanger = {
    group,
    balloon,
    push: new Vector3(),
    get lean() {
      return Math.hypot(ang.x, ang.z);
    },
    centre: (out) => balloon.group.getWorldPosition(out),
    snap() {
      ang.vx = ang.vz = 0;
    },
    update(dt, t) {
      // the push, in the hanger's frame (the group may be turned)
      group.getWorldPosition(origin);
      group.worldToLocal(local.copy(hanger.push).add(origin));
      let tx = local.x;
      let tz = local.z;
      const m = Math.hypot(tx, tz);
      if (m > MAX_LEAN) {
        tx *= MAX_LEAN / m;
        tz *= MAX_LEAN / m;
      }
      // a lightly damped pendulum (≈ 0.9 Hz, settles in about two seconds)
      const h = Math.min(dt, 1 / 30);
      ang.vx += ((tx - ang.x) * 34 - ang.vx * 4.2) * h;
      ang.vz += ((tz - ang.z) * 34 - ang.vz * 4.2) * h;
      ang.x += ang.vx * h;
      ang.z += ang.vz * h;
      // a breath of air keeps it alive
      swing.rotation.set(-ang.z + 0.012 * Math.sin(t * 0.8), 0, ang.x + 0.015 * Math.sin(t * 0.63));
      balloon.update(dt, t);
    },
  };
  return hanger;
}
