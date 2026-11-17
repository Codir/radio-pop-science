/**
 * `lamp/handover` — «Хто приносить енергію». The stand plan from a little higher (`standHigh`); the magnifier lies on
 * the first centimetre of wire past the minus as a plain magnifier — a window onto the copper (`window: 1`), where
 * free electrons roam and one is marked. The reader taps the switch: a soft yellow sleeve of light runs from the
 * battery along BOTH wires to the lamp in 0.7 s and keeps flowing while the circuit is closed; opened, it melts.
 * The marked electron has hardly moved meanwhile. Goal: closed, the glow at the lamp, 2 s watched after the tap.
 *
 * The glow is chapter 4's loop glow (`world.glow`) from the battery to the lamp, stripes running; the electrons
 * dart on a leash about homes that the common shift carries (`copper.sim.leash`, as `flow/connect`).
 */
import { Vector3 } from 'three';
import { BATTERY, LAMP, LOOP, STAGE_POST, boardToWorld } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { col } from '@/style';
import { electronMark } from '../parts/electron-mark';

/** Seconds the glow takes from the battery to the lamp (script), and to melt when the circuit opens. */
const RUN = 0.7;
const MELT = 0.6;
/** Seconds watched after the tap that the goal asks for. */
const WATCH = 2;
/** The window onto the copper (as `flow/connect`): the darting cage and the copper units across the glass. */
const LEASH = 1.7;
const SPAN = 8.5;

export const handoverStep: StepFactory = ({ ctx, world, lens, switcher, fly, flying, reached, reach }) => {
  const { stand } = world;
  const copper = world.world.copper;
  const here = (): boolean => ctx.stage.current === 'handover';
  const { glow } = world;
  const origin = glow.at(BATTERY.x, LOOP.near);
  const meet = glow.at(LAMP.x, LAMP.z);
  const yellow = col('yellow');
  let front = 0;
  let strength = 0;
  let landed = false;
  const far = new Vector3();
  const farWire = (): Vector3 => boardToWorld(-0.9, LOOP.y + 0.12, LOOP.far, far);
  const markedAt = new Vector3();
  const sim = copper.sim;
  /** The marked electron (world), as the lens window shows it. */
  const marked = (): Vector3 => {
    const e = Math.max(copper.marked, 0);
    markedAt.set(sim.pos[3 * e]!, sim.pos[3 * e + 1]!, sim.pos[3 * e + 2]!);
    return copper.space.localToWorld(markedAt);
  };
  ctx.qa.probe('marked-electron', marked);
  // the marked one must be found at a glance in the small lens window: a bright ring and a short trail
  const mark = electronMark(ctx);
  mark.radius = 0.085;
  ctx.qa.probe('far-wire', farWire);
  ctx.qa.expose('handover', () => ({
    front,
    strength,
    closed: switcher.closed,
    since: switcher.since,
    mark: { shown: mark.shown, visible: mark.group.visible },
  }));

  return {
    spec: {
      camera: 'standHigh',
      params: { closed: 0, lens: 0, lensCall: 0, window: 1, poles: 1 },
      post: STAGE_POST.stand,
    },
    ui: {
      goal: () => reached('handover'),
      callouts: [
        {
          anchor: mark.ring,
          text: caption('handover', 0),
          side: 'up',
          visible: () => here() && landed && !lens.gliding,
        },
        {
          anchor: farWire,
          text: caption('handover', 1),
          side: 'up',
          visible: () => here() && front > 0.6 && strength > 0.5,
        },
      ],
    },
    enter(info) {
      landed = info.instant;
      front = strength = 0;
      switcher.reset();
      lens.call = 0.6;
      lens.rim = 0;
      lens.glass = 1;
      world.lamp.cut = 0;
      copper.markNearest(0, 0);
      copper.sim.leash = LEASH;
      copper.sim.box.x = copper.sim.box.y = SPAN / 2 + LEASH + 0.3;
      world.world.window.span = SPAN;
      glow.origin = origin;
      glow.meet = meet;
      glow.color.copy(yellow);
      // a soft continuous flow: few long stripes, shallow gaps, running away from the battery along both wires
      glow.wake = 0.6;
      glow.peak = 0.45;
      glow.edge = 0.03;
      glow.flow = 1.1;
      glow.stripes = 8;
      glow.stripeDepth = 0.32;
      glow.outward = true;
      mark.reset();
      const pose = stand.tools.poses.overStart;
      if (info.instant) lens.snap(pose);
      else lens.to(pose, 1.6);
      if (!info.instant) fly('standHigh', 2.2);
    },
    leave() {
      copper.marked = -1;
      glow.stripes = 90;
      glow.stripeDepth = 0.5;
      glow.outward = false;
    },
    update(dt) {
      if (!here()) return;
      landed ||= !flying() && !ctx.camera.moving;
      if (switcher.closed) {
        front = Math.min(1, front + dt / RUN);
        strength = Math.min(1, strength + dt / 0.15);
      } else {
        strength = Math.max(0, strength - dt / MELT);
        if (strength === 0) front = 0;
      }
      if (!reached('handover') && switcher.closed && front >= 1 && switcher.since >= WATCH) reach('handover');
    },
    late(dt) {
      const want = here() && landed && !lens.gliding ? 1 : 0;
      mark.shown += (want - mark.shown) * (1 - Math.exp(-dt * 5));
      if (mark.shown < 0.01 && want === 0) mark.shown = 0;
      if (mark.shown > 0 || want) mark.update(marked(), ctx.camera.camera, dt);
      else mark.group.visible = false;
      if (here()) {
        glow.front = front;
        glow.intensity = strength;
      } else if (strength > 0) {
        strength = Math.max(0, strength - dt / MELT);
        glow.intensity = strength;
      }
    },
  };
};
