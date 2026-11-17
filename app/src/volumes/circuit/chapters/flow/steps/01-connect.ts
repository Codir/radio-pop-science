/**
 * `connect` — «Дорога для електронів». The minus wire's end lies on the board beside its clamp (big cyan grip);
 * the lens rests over the near wire as a window onto «ряди» (free electrons darting, no common shift). The reader
 * drags the end into the clamp: it clicks in, the lamp lights in that frame and in the lens the whole crowd starts
 * to slide toward the plus (the copper's `sim.leash` + the world's drift). Goal: in the clamp, lamp lit, 2 s since.
 */
import { Quaternion, Vector3 } from 'three';
import { BOARD, WIRE, boardToWorld, worldToBoard } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { glide } from '../parts/glide';
import { MOUTH, REST } from '../parts/loose-end';

/** Seconds of light the goal asks for (the reader looks into the lens). */
const WATCH = 2;
/** Board distance from the terminal's mouth at which the carried end clicks in. */
const SNAP = 0.34;
/** The darting cage of each electron in the lens (copper units; the window is 14 across). */
export const LEASH = 1.7;
/** Copper units across the window: about three atoms, so the electrons read at the lens's size. */
export const SPAN = 8.5;
/** The lens in use, a little larger than the stage's pose (the ring ≈ 24 % of the frame height). */
export const LENS_SCALE = 1.3;

export const connectStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { end, stage } = stand;
  const out = stand.endOut;
  /** Where the hand let the end go: it glides back to its rest from there (0 = at the hand, 1 = at rest). */
  const back = glide(1);
  const dropped = new Vector3();
  let held = false;
  let inClamp = false;
  let litFor = 0;
  const up = new Vector3();
  const through = new Vector3();
  const hit = new Vector3();
  const p = new Vector3();
  const q = new Quaternion();

  const clickIn = (): void => {
    held = false;
    inClamp = true;
    // from wherever the hand is, the end goes the last bit into the mouth (the board frame's shortest way)
    out.set(1);
    out.go(0, 0.22);
    stand.light(true);
  };
  ctx.input.register(end.grip, {
    cursor: 'grab',
    tooltip: () => caption('connect', 0),
    enabled: () => here('connect') && !inClamp && !stand.world.flying && end.out > 0.9,
    dragStart: () => {
      held = true;
      end.hand = (end.hand ?? new Vector3()).copy(end.tip);
    },
    drag: (e) => {
      if (!held) return;
      up.set(0, 1, 0).applyQuaternion(stage.base.frame.getWorldQuaternion(q));
      boardToWorld(0, WIRE.sheath + 0.12, 0, through);
      if (!e.planePoint(up, through, hit)) return;
      worldToBoard(hit, p);
      p.x = Math.min(Math.max(p.x, -BOARD.width / 2 + 0.2), BOARD.width / 2 - 0.2);
      p.z = Math.min(Math.max(p.z, -BOARD.depth / 2 + 0.2), BOARD.depth / 2 - 0.15);
      p.y = WIRE.sheath + 0.12;
      end.hand!.copy(p);
      if (Math.hypot(p.x - MOUTH.x, p.z - MOUTH.z) < SNAP) clickIn();
    },
    dragEnd: () => {
      if (!held) return;
      held = false;
      dropped.copy(end.hand!);
      back.set(0);
      back.go(1, 0.45);
    },
  });
  ctx.qa.probe('loose-end', end.grip);
  ctx.qa.probe('minus-mouth', () => boardToWorld(MOUTH.x, MOUTH.y, MOUTH.z));
  ctx.qa.expose('connect', () => ({ out: end.out, inClamp, litFor, held }));
  const lensTop = (): Vector3 =>
    stage.tools.lens.ring.getWorldPosition(new Vector3()).add(new Vector3(0, 0.62, 0));

  return {
    spec: { camera: 'stand', params: { closed: 0, lens: 1, window: 1, poles: 1 } },
    ui: {
      goal: () => reached('connect'),
      callouts: [
        {
          anchor: () => end.grip.getWorldPosition(new Vector3()),
          text: caption('connect', 0),
          side: 'down',
          visible: () => here('connect') && !inClamp && end.out > 0.95 && !held,
        },
        {
          anchor: lensTop,
          text: caption('connect', 1),
          side: 'up',
          visible: () => here('connect') && !reached('connect'),
        },
        {
          anchor: lensTop,
          text: caption('connect', 2),
          side: 'up',
          visible: () => here('connect') && reached('connect'),
        },
      ],
    },
    enter(info) {
      held = false;
      inClamp = false;
      litFor = 0;
      end.hand = null;
      back.set(1);
      // the end comes out of the clamp and lies down (from a lit `count`: the lamp goes dark as it leaves)
      if (info.instant) out.set(1);
      else out.go(1, 0.9);
      stand.light(false);
      stand.counter.shown.go(0, info.instant ? 0 : 0.5);
      stand.lenses.presence.go(0, info.instant ? 0 : 1.4);
      stand.glow.intensity = 0;
      stand.copper.sim.leash = LEASH;
      // the crowd's box just beyond the window plus the leash: the 32 electrons crowd the glass
      stand.copper.sim.box.x = stand.copper.sim.box.y = SPAN / 2 + LEASH + 0.3;
      stand.world.window.span = SPAN;
      stand.world.lensPose = { ...stage.tools.poses.overWire, scale: LENS_SCALE };
    },
    leave() {
      end.call = 0;
      held = false;
    },
    update(dt) {
      back.update(dt);
      end.call = here('connect') && !inClamp ? 1 : 0;
      if (end.hand && !held && !inClamp) {
        end.hand.lerpVectors(dropped, REST, back.value);
        if (!back.moving) end.hand = null;
      }
      if (inClamp && !out.moving) end.hand = null;
      litFor = inClamp && stand.lit ? litFor + dt : 0;
      if (litFor >= WATCH) reach('connect');
    },
  };
};
