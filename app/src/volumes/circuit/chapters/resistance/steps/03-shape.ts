/**
 * `shape` — «Довгий і тонкий». The lens goes back to its holder, the counter frame stands on the far wire and shows
 * «0,30 A». The reader pulls the cyan handle on the far wire toward the middle of the board: the wire hangs out
 * into a neat snake, longer and thinner (`parts/snake-path.ts`), the frame's number falls with
 * I = 1,5 V : (5 Ω + 0,0072 Ω × k²) and the lamp dims with it. The handle is the position of the stretch: dragged
 * both ways at any speed, the snake follows within a few frames, never jumping. Goal: the handle at its end (k = 40,
 * «0,09 A»). On leaving, the wire goes back to the ordinary piece in 1.5 s.
 */
import { Quaternion, Vector3 } from 'three';
import { LOOP, boardToWorld, worldToBoard } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { DEPTH_MAX, K_MAX, MIDDLE_X, depthOf, stretchOf } from '../parts/snake-path';

/** How quickly the snake follows the hand (s): a finger's first move past the touch slop must not jump it. */
const FOLLOW = 0.06;
/** The last bit of the handle's way counts as the end (a hand may stop a hair short). */
const END = K_MAX - 0.3;
/** Seconds the wire takes back to the ordinary piece when the step is left. */
export const SHAPE_BACK = 1.5;
/** Seconds the frame's caption stays on entry. */
const NAME_FOR = 3;

export const shapeStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { stage, snake } = stand;
  let held = false;
  let grabbed = false;
  /** Where the hand puts the stretch (the snake follows it, eased). */
  let want = 1;
  let shownFor = 0;
  const up = new Vector3();
  const through = new Vector3();
  const hit = new Vector3();
  const p = new Vector3();
  const q = new Quaternion();
  const gripWorld = new Vector3();
  const ready = (): boolean => here('shape') && stand.frameShown.value > 0.95 && !stand.world.flying;

  ctx.input.register(snake.grip, {
    cursor: 'grab',
    enabled: () => ready() && snake.active,
    dragStart: () => {
      held = true;
      grabbed = true;
    },
    drag: (e) => {
      if (!held) return;
      up.set(0, 1, 0).applyQuaternion(stage.base.frame.getWorldQuaternion(q));
      boardToWorld(0, LOOP.y, 0, through);
      if (!e.planePoint(up, through, hit)) return;
      worldToBoard(hit, p);
      // the handle runs straight toward the reader from the far line: its depth is the stretch
      want = stretchOf(p.z - LOOP.far);
    },
    dragEnd: () => {
      held = false;
    },
  });
  // QA: the far end of the handle's way (the middle of the board, the snake at its deepest)
  ctx.qa.probe('grip-end', () =>
    stage.base.frame.localToWorld(new Vector3(MIDDLE_X, LOOP.y, LOOP.far + DEPTH_MAX + 0.12)),
  );
  ctx.qa.expose('shape', () => ({
    k: Math.round(stand.stretch.value * 100) / 100,
    want: Math.round(want * 100) / 100,
    amps: Math.round(stand.amps * 1000) / 1000,
    glow: Math.round(stage.glow * 1000) / 1000,
    held,
    depth: Math.round(depthOf(stand.stretch.value) * 1000) / 1000,
  }));

  return {
    spec: { camera: 'stand', params: { deep: 0, closed: 1, lens: 0, window: 0, poles: 1 } },
    ui: {
      goal: () => reached('shape'),
      callouts: [
        {
          anchor: () => snake.grip.getWorldPosition(gripWorld),
          text: caption('shape', 0),
          side: 'down',
          visible: () => here('shape') && ready() && !grabbed && !reached('shape'),
        },
        {
          anchor: () => stand.frameTop(new Vector3()),
          text: caption('shape', 1),
          side: 'up',
          visible: () => here('shape') && ready() && shownFor < NAME_FOR,
        },
        {
          // on a phone the frame's own print would be under 14 px: the number stands in the interface instead
          anchor: () => stand.frameTop(new Vector3()),
          text: () => stand.frameText,
          side: 'up',
          visible: () => here('shape') && ctx.device.formFactor === 'phone' && shownFor >= NAME_FOR,
        },
      ],
    },
    enter(info) {
      held = false;
      grabbed = false;
      want = 1;
      shownFor = 0;
      stand.thermoShown.go(0, info.instant ? 0 : 0.5);
      stand.heat.target = 0;
      stand.hits.flashRate = 0;
      stand.world.lensPose = null;
      stand.frameShown.go(1, info.instant ? 0 : 0.8);
      stand.stretch.go(1, info.instant ? 0 : 0.8);
    },
    leave() {
      held = false;
      snake.call = 0;
      stand.stretch.go(1, SHAPE_BACK);
    },
    update(dt) {
      if (ready()) shownFor += dt;
      snake.call = ready() && !grabbed ? 1 : 0;
      if (grabbed || held) {
        // the snake follows the hand closely, both ways, from wherever it is
        const k = stand.stretch.value;
        stand.stretch.set(k + (want - k) * (1 - Math.exp(-dt / FOLLOW)));
      }
      if (stand.stretch.value >= END && !reached('shape')) reach('shape');
    },
  };
};
