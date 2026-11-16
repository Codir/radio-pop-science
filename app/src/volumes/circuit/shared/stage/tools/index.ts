/**
 * The tools that live on the stand (VISUAL.md §2, §3, §5.6, §5.7): the magnifier in its holder, the counter
 * frame, the voltage gauge, the snail of the crawl. Models with states only — what a step does with them is
 * the chapter's business.
 */
import { Quaternion, Vector3, type Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { BOARD, LENS, LOOP } from '../layout';
import { HANDOVER, LENS_OVER_WIRE, STAGE_SHOTS, boardToWorld } from '../shots';
import { BOARD_Y } from '../base';
import { createFrame, type FrameModel } from './frame';
import { createGauge, type GaugeModel } from './gauge';
import { createLens, holderPose, type LensModel, type LensPose } from './lens';
import { CRAWL_BEATS, createCrawl, type CrawlModel } from './crawl';
import { CRAWL_SPEED, MM, crawlPath } from './crawl-lane';
import { createLoupe, type LoupeModel } from './loupe';
import { createSnail, type SnailModel } from './snail';

export type { FrameModel, GaugeModel, LensModel, LensPose, SnailModel };
export { holderPose } from './lens';
export { loopPath } from './frame';
export { CRAWL_BEATS, CRAWL_SPEED, crawlPath };
export type { CrawlModel, LoupeModel };
export type { Lane } from './crawl-lane';

const unTilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -BOARD.tilt);

/** World point / direction → board frame (the stage group at the world origin). */
export function worldToBoard(p: Vector3, out = new Vector3()): Vector3 {
  return out
    .copy(p)
    .sub(new Vector3(0, BOARD_Y, 0))
    .applyQuaternion(unTilt);
}
export function worldDirToBoard(d: Vector3, out = new Vector3()): Vector3 {
  return out.copy(d).applyQuaternion(unTilt);
}

/** The magnifier in use over the near wire: on the dive's axis, facing the camera, handle down to the right. */
export function overWirePose(): LensPose {
  const facing = worldDirToBoard(HANDOVER.direction.clone().multiplyScalar(-1));
  const handle = new Vector3(0.62, -0.5, 0.6);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  // lifted toward the reader it is drawn a little larger: in the main shot the ring is 22 % of the frame height
  return { position: worldToBoard(LENS_OVER_WIRE), facing, handle, scale: 1.12 };
}

/**
 * The magnifier lying on the START of the run — the wire's bend just past the battery's minus clamp (the crawl).
 * It hangs a little above the board on the line from the crawl shot's camera to its spot, so in the frame it
 * sits where it lies. `scale` is its size (1.9: large enough to read millimetres in it); its right rim stays
 * at the clamp's screw whatever the size, so the battery stays in view and the snail's lane passes it on the
 * right; `z` is the board depth of its centre. The ring grows, the handle does not (`grip`): at 1.9× a handle
 * of full length would leave the frame at the lower left.
 */
export function overStartPose(scale = 1.9, z = LOOP.near - 0.2): LensPose {
  const spot = boardToWorld(-2.07 - LENS.radius * scale, LOOP.y, z);
  const toCamera = new Vector3(...STAGE_SHOTS.crawl.position).sub(spot).normalize();
  const facing = worldDirToBoard(toCamera)
    .lerp(new Vector3(0, 1, 0), 0.45)
    .normalize();
  const handle = new Vector3(-0.66, -0.3, 0.7);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  return {
    position: worldToBoard(spot.addScaledVector(toCamera, 0.62)),
    facing,
    handle,
    scale,
    grip: 1 / scale,
  };
}

/** How loud the ring is while the crawl has the lens (0 quiet … 1 full cyan): the reader does not take it there. */
const CRAWL_RING = 0.22;

export interface ToolState {
  /** 0…1: beat 6 of the unfolding — the magnifier settles into its holder. */
  arrive: number;
  /** 0 = the magnifier in its holder … 1 = over the near wire. */
  lensUse: number;
  /** 0…1 progress of the flight through the ring to the hand-over pose. */
  dive: number;
  /** 0…1 how bright the room is (the unlit numbers follow it). */
  light: number;
  /** 0…1: the step asks the reader to take the magnifier — the resting ring turns full cyan and pulses. */
  call: number;
  /** Seconds of true time of the crawl, and 0…1 its presence (`stand.crawlScene` writes both). */
  crawl: number;
  crawlShown: number;
  /** 0…1: the magnifier shows the enlarged first centimetre of the wire. */
  loupe: number;
  /** 0…1 the filament's glow (the enlarged picture is lit by the lamp). */
  glow: number;
}

export interface Tools {
  lens: LensModel;
  gauge: GaugeModel;
  frame: FrameModel;
  snail: SnailModel;
  /** The crawl: the snail on its lane beside the wire, ticks and trail, placed by seconds of true time. */
  crawl: CrawlModel;
  /** The enlarged picture inside the magnifier (the crawl); `loupe.magnification`. */
  loupe: LoupeModel;
  /** The standard poses of the magnifier (board frame); chapters may build others (`LensPose`). */
  poses: { holder: LensPose; overWire: LensPose; overStart: LensPose };
  /** Apply the tools' part of the state (see `ToolState`). */
  set(state: ToolState, t: number): void;
  update(dt: number, t: number): void;
}

export function createTools(ctx: ChapterContext, frameGroup: Group): Tools {
  const lens = createLens(ctx);
  const gauge = createGauge();
  const frame = createFrame();
  const snail = createSnail();
  const crawl = createCrawl(snail);
  const loupe = createLoupe(crawl.scaleMm, MM);
  lens.group.add(loupe.group);
  frameGroup.add(crawl.group, lens.group, gauge.group, frame.group, snail.group);
  ctx.root.add(lens.rim);
  gauge.shown = 0;
  frame.shown = 0;
  const poses = { holder: holderPose(), overWire: overWirePose(), overStart: overStartPose() };
  // before it arrives the magnifier waits above its holder, out of the lamp's reach
  const above: LensPose = {
    position: poses.holder.position.clone().add(new Vector3(-0.4, 2.6, 0.6)),
    facing: poses.holder.facing,
    handle: poses.holder.handle,
  };
  const inUse: LensPose = {
    position: new Vector3(),
    facing: new Vector3(),
    handle: new Vector3(),
    scale: 1,
    grip: 1,
  };
  const smooth = (x: number): number => x * x * (3 - 2 * x);
  const ramp = (x: number, a: number, b: number): number => Math.min(Math.max((x - a) / (b - a), 0), 1);
  return {
    lens,
    gauge,
    frame,
    snail,
    crawl,
    loupe,
    poses,
    set({ arrive, lensUse, dive, light, call, crawl: seconds, crawlShown, loupe: enlarged, glow }, t) {
      const landed = smooth(ramp(arrive, 0, 0.92));
      // the crawl lays the magnifier on the start of the run, and takes it there by itself — from the holder
      // or from over the wire, whatever `lensUse` says
      const c = smooth(ramp(crawlShown, ...CRAWL_BEATS.lens));
      if (landed < 1) lens.setPose(above, poses.holder, landed);
      else {
        const mix = c > 0 ? 1 - (1 - c) * Math.min(Math.max(lensUse, 0), 1) : 0;
        inUse.position.copy(poses.overWire.position).lerp(poses.overStart.position, mix);
        inUse.facing.copy(poses.overWire.facing).lerp(poses.overStart.facing, mix).normalize();
        inUse.handle.copy(poses.overWire.handle).lerp(poses.overStart.handle, mix).normalize();
        const scale = poses.overWire.scale ?? 1;
        inUse.scale = scale + ((poses.overStart.scale ?? 1) - scale) * mix;
        const grip = poses.overWire.grip ?? 1;
        inUse.grip = grip + ((poses.overStart.grip ?? 1) - grip) * mix;
        lens.setPose(poses.holder, inUse, Math.max(lensUse, c));
      }
      lens.group.visible = arrive > 0.004;
      lens.group.scale.multiplyScalar(Math.max(smooth(ramp(arrive, 0, 0.5)), 1e-3));
      // "take me": the rim calls while the magnifier rests, and is full cyan in the reader's hand; on the crawl
      // nobody takes it, so the ring stays calm — in the dark frame of time 0 it must not outshine the lamp
      const loud = Math.max(call, lensUse);
      lens.setCall(landed * (loud + (CRAWL_RING - loud) * c), t);
      lens.setRim(smooth(ramp(dive, 0.5, 0.92)));
      // on a phone the printed numbers would be under 14 px: left out, as the battery's print is
      crawl.labels = loupe.labels = ctx.device.formFactor !== 'phone';
      const crawling = crawlShown * smooth(ramp(arrive, 0.45, 1));
      crawl.set(seconds, crawling, light, t);
      loupe.shown = enlarged * smooth(ramp(crawling, ...CRAWL_BEATS.picture));
      loupe.set(crawl.sparkMmAt(seconds), glow, t, lens.group.quaternion);
      gauge.light = light;
      frame.light = light;
    },
    update(dt, t) {
      snail.update(dt, t);
    },
  };
}
