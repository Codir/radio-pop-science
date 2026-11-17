/**
 * `lamp/hot-spot` — «Де найгарячіше». Back on the stand plan (the way out through the door, `scene.ts`), the switch
 * closes by itself and the magnifier in its holder turns into the heat lens (`stand.lamp.thermal`: inside its ring
 * cold is `blue`, hot `orange` → white). The reader carries it: a drag anywhere on the lens moves it along the loop
 * of wire under the pointer (`parts/loop-track.ts`) — over the copper, the battery, the switch — and near the lamp
 * it rises onto the lamp (`lampLensPose`), its ring holding the coil and the leads. A tap on the resting lens lays
 * it on the wire by the battery. Goal: the lens has been over the wire by the battery and over the lamp, and over
 * the lamp for 2 s.
 */
import { Vector3 } from 'three';
import type { InteractionHandlers } from '@/engine/api';
import {
  BATTERY,
  LAMP,
  LOOP,
  STAGE_POST,
  STAGE_SHOTS,
  boardToWorld,
  lampLensPose,
  worldDirToBoard,
  type LensPose,
} from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { emptyPose, mixPose } from '../parts/lens-keeper';
import { loopTrack } from '../parts/loop-track';

/** Seconds over the lamp the goal asks for. */
const STAY = 2;
/** The lens hangs this far above the wire, toward the camera, and this large. */
const LIFT = 1.25;
const SCALE = 1.15;
/** Board distance from the lamp's axis inside which the lens rises onto the lamp (fully within `NEAR`). */
const NEAR = 0.2;
const FAR = 0.95;

const HOT_SIDE = new Vector3(-0.62, 0.05, 0.1);

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const smooth = (x: number): number => x * x * (3 - 2 * x);

export const hotSpotStep: StepFactory = ({ ctx, world, lens, door, reached, reach }) => {
  const { stand, lamp } = world;
  const here = (): boolean => ctx.stage.current === 'hot-spot';
  const track = loopTrack();
  const camWorld = new Vector3(...STAGE_SHOTS.stand.position);
  const onLamp = lampLensPose(1.9, STAGE_SHOTS.stand.position, 1.2);
  const wirePose = emptyPose();
  const pose = emptyPose();
  const p = new Vector3();
  const pw = new Vector3();
  let s = track.shareOf(BATTERY.plusX + 0.1, LOOP.near);
  let goal = s;
  let taken = false;
  let held = false;
  let nearBattery = false;
  let overLamp = 0;
  let thermal = 0;
  /** The switch closes and the lens turns thermal once the camera is back on the stand. */
  let arrived = false;

  const lampWeight = (share: number): number => {
    track.at(share, p);
    const d = Math.hypot(p.x - LAMP.x, p.z - LAMP.z);
    return smooth(clamp01((FAR - d) / (FAR - NEAR)));
  };
  const poseAt = (share: number): LensPose => {
    track.at(share, p);
    boardToWorld(p.x, p.y, p.z, pw);
    const toCam = worldDirToBoard(camWorld.clone().sub(pw).normalize());
    wirePose.position.copy(p).addScaledVector(toCam, LIFT);
    wirePose.facing.copy(toCam);
    wirePose.handle.set(0.62, -0.5, 0.6);
    wirePose.handle.addScaledVector(toCam, -wirePose.handle.dot(toCam)).normalize();
    wirePose.scale = SCALE;
    wirePose.grip = 1 / SCALE;
    return mixPose(wirePose, onLamp, lampWeight(share), 0, pose);
  };
  const along = (): LensPose => poseAt(s);
  const take = (to: number): void => {
    goal = to;
    if (!taken) {
      taken = true;
      s = to;
      lens.to(along, 0.5);
    }
  };
  const live = (): boolean => here() && arrived && !door.rail.engaged;
  const lensInput: InteractionHandlers = {
    enabled: live,
    click: () => {
      if (!taken) take(track.shareOf(BATTERY.plusX + 0.15, LOOP.near));
    },
    dragStart: () => {
      held = true;
    },
    drag: (e) => take(track.nearest(e.ndc.x, e.ndc.y, ctx.viewport.aspect, ctx.camera.camera)),
    dragEnd: () => {
      held = false;
    },
  };
  const anchor = new Vector3();
  ctx.qa.probe('lens', stand.tools.lens.group);
  ctx.qa.probe('wire-by-battery', () => {
    track.at(track.shareOf(BATTERY.plusX + 0.15, LOOP.near), anchor);
    return boardToWorld(anchor.x, anchor.y, anchor.z, anchor);
  });
  ctx.qa.probe('wire-by-lamp', () => boardToWorld(LAMP.x, LOOP.y, LAMP.z + 0.1, anchor));
  ctx.qa.expose('hot-spot', () => ({ s, taken, nearBattery, overLamp, thermal, arrived }));
  // «гаряче» beside the ring, level with the coil: the label must not cover the cold base it is compared with
  const hot = new Vector3();
  const hotAt = (): Vector3 => lamp.anchors.coil.getWorldPosition(hot).add(HOT_SIDE);
  const wireAt = (): Vector3 => {
    track.at(s, anchor);
    return boardToWorld(anchor.x, anchor.y + 0.08, anchor.z, anchor);
  };

  return {
    lensInput,
    spec: {
      camera: 'standTight',
      params: { closed: 1, lens: 0, lensCall: 0, window: 0, poles: 1 },
      post: STAGE_POST.stand,
    },
    ui: {
      goal: () => reached('hot-spot'),
      callouts: [
        {
          anchor: stand.tools.lens.group,
          text: caption('hot-spot', 0),
          side: 'up',
          visible: () => live() && !taken,
        },
        {
          anchor: wireAt,
          text: caption('hot-spot', 1),
          side: 'down',
          visible: () => live() && taken && !lens.gliding && lampWeight(s) < 0.2,
        },
        {
          anchor: hotAt,
          text: caption('hot-spot', 2),
          side: 'left',
          visible: () => live() && taken && lampWeight(s) > 0.95,
        },
      ],
    },
    enter(info) {
      taken = held = nearBattery = false;
      overLamp = 0;
      s = goal = track.shareOf(BATTERY.plusX + 0.1, LOOP.near);
      lens.rim = 0;
      lens.glass = 1;
      lens.call = 1;
      arrived = info.instant || !door.rail.engaged;
      if (!arrived) {
        // the way out through the door first: the lens rides the door back into its holder, the lamp dark
        ctx.stage.setParam('closed', 0, { instant: true });
        lens.hold(() => door.lens(door.rail.position));
      } else if (info.instant) lens.snap(stand.tools.poses.holder);
      else lens.to(stand.tools.poses.holder, 1.4);
      thermal = info.instant ? 1 : thermal;
    },
    update(dt) {
      if (!here()) return;
      if (!arrived && !door.rail.engaged) {
        arrived = true;
        lens.hold(stand.tools.poses.holder);
        ctx.stage.setParam('closed', 1, { instant: true });
      }
      if (taken) {
        // the lens follows the hand along the loop, a little behind it (never a jump across the board)
        const d = track.delta(s, goal);
        s += d * (1 - Math.exp(-dt * (held ? 14 : 8)));
        s -= Math.floor(s);
      }
      if (!taken) return;
      track.at(s, p);
      if (Math.abs(p.z - LOOP.near) < 0.3 && p.x > BATTERY.minusX - 0.5 && p.x < BATTERY.plusX + 0.5)
        nearBattery = true;
      if (lens.gliding) return;
      overLamp = lampWeight(s) > 0.9 ? overLamp + dt : 0;
      if (nearBattery && overLamp >= STAY && !reached('hot-spot')) reach('hot-spot');
    },
    late(dt) {
      // the heat view fades in once on the stand, and out with any other step
      const want = here() && arrived ? 1 : 0;
      thermal += (want - thermal) * (1 - Math.exp(-dt * 3.5));
      if (Math.abs(thermal - want) < 1e-3) thermal = want;
      lamp.thermal = thermal;
    },
  };
};
