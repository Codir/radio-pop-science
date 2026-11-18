/**
 * `short` — «Повз лампочку». The stand assembled and lit; the counter frame sits on the wire between the plus and
 * the switch reading «0,3 A», the heat lens lies on the battery (cold `blue`). One grip calls: the end of the wire
 * that goes from the switch to the lamp. The reader moves it onto the «−» clamp (which takes a second end here):
 * the model says `short` — the lamp goes dark in that frame (it hangs on one side only), the frame runs up to
 * «≈ 6 A» within a moment, and in the lens the battery warms blue → orange over 2–3 s, the wire barely; the battery
 * runs down meanwhile (`battery.inside.life`, the stand's `charge`). Goal: the end in «−», the switch closed, 2.5 s
 * of that. Leaving, the end goes back to the lamp, the lens and the frame go home, the battery cools and is fresh.
 */
import { Vector3 } from 'three';
import {
  BATTERY,
  LOOP,
  STAGE_SHOTS,
  boardToWorld,
  worldDirToBoard,
  type LensPose,
} from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMBIENT } from '../bench';
import { END_KEYS } from '../parts/ends';
import { glide } from '../parts/glide';
import type { HandPolicy } from '../parts/hands';
import { emptyPose } from '../parts/lens-keeper';
import { createWarmth } from '../parts/thermal-warm';

/** Seconds of short circuit the goal asks for (the battery is orange in the lens by then). */
const HOLD = 2.5;
/** The battery's warming and cooling (time constants, s) and its shade on the false-colour scale when hot. */
const WARM_UP = 1.5;
const COOL = 2.6;
const HOT = 0.72;
const WIRE_HOT = 0.14;
/** Amperes: through the lamp, and a fresh AA in a short circuit (script, «Докладніше»). */
const LAMP_A = 0.3;
const SHORT_A = 6;
/** How fast the battery runs down while shorted (share of its life per second — a time-lapse of minutes). */
const DRAIN = 0.02;
/** Where the frame stands: the middle of the wire between the plus and the switch (board frame). */
const FRAME_AT = new Vector3(0.96, LOOP.y, LOOP.near);
const FRAME_DIR = new Vector3(1, 0, 0);

/** The frame's number: one decimal under 1 A, «≈ N A» above. */
export function amps(a: number): string {
  if (a < 0.05) return '0 A';
  if (a < 1) return `${a.toFixed(1).replace('.', ',')} A`;
  return `≈ ${Math.round(a)} A`;
}

export const shortStep: StepFactory = ({ ctx, bench, lens, reached, reach, here }) => {
  const { wiring, stage } = bench;
  const cell = stage.stand.battery.inside;
  const frame = stage.tools.frame;
  const frameShown = glide(0);
  const thermal = glide(0);
  const battery = createWarmth(
    [stage.stand.battery.group],
    stage.tools.lens.glass,
    /^battery:(gloss|metal|toon|band)$/,
  );
  const wire = createWarmth([stage.stand.wires.group], stage.tools.lens.glass, /^wire-/);
  const camWorld = new Vector3(...STAGE_SHOTS.stand.position);
  const pose: LensPose = emptyPose();
  let heat = 0;
  let shownA = LAMP_A;
  let shortFor = 0;
  let life = 0;
  const phone = (): boolean => ctx.device.formFactor === 'phone';
  const shorted = (): boolean => bench.verdict === 'short' && wiring.ends.b1.seated === 'minus';
  // the heat lens on the battery's middle, lifted toward the camera, its ring the battery's height
  const onBattery = (): LensPose => {
    const at = boardToWorld(BATTERY.x + 0.1, BATTERY.y, BATTERY.z);
    const toCam = worldDirToBoard(camWorld.clone().sub(at).normalize());
    pose.position.set(BATTERY.x + 0.1, BATTERY.y, BATTERY.z).addScaledVector(toCam, 1.1);
    pose.facing.copy(toCam);
    pose.handle.set(-0.5, -0.5, 0.7);
    pose.handle.addScaledVector(toCam, -pose.handle.dot(toCam)).normalize();
    pose.scale = 1.45;
    pose.grip = 1 / 1.45;
    return pose;
  };
  const policy: HandPolicy = {
    take: (k) => k === 'b1' && here('short'),
    plug: () => true,
  };
  const frameAt = (): Vector3 => boardToWorld(FRAME_AT.x, FRAME_AT.y + 0.32, FRAME_AT.z);
  const lensTop = (): Vector3 =>
    stage.tools.lens.ring.getWorldPosition(new Vector3()).add(new Vector3(0, 0.75, 0));
  const batteryTop = (): Vector3 =>
    boardToWorld(BATTERY.x - 0.4, BATTERY.y + BATTERY.radius + 0.1, BATTERY.z);
  ctx.qa.expose('short', () => ({
    shorted: shorted(),
    shortFor,
    heat,
    amps: shownA,
    life,
    verdict: bench.verdict,
    warm: battery.count,
    shade: battery.shade,
    amount: battery.amount,
  }));
  ctx.qa.probe('frame', frame.group);

  return {
    spec: { camera: 'stand', params: { lens: 0, lensCall: 0, window: 0, poles: 1, moon: 1, unfold: 1 } },
    ui: {
      goal: () => reached('short'),
      callouts: [
        {
          anchor: frameAt,
          // on a phone the frame's own number would be under 14 px: the callout carries it there
          text: () => (phone() ? `${caption('short', 0)} · ${amps(shownA)}` : caption('short', 0)),
          side: 'down',
          visible: () => here('short') && frameShown.value > 0.9 && (phone() || !reached('short')),
        },
        {
          anchor: lensTop,
          text: caption('short', 1),
          side: 'up',
          visible: () => here('short') && thermal.value > 0.9 && !reached('short') && !lens.gliding,
        },
        {
          anchor: batteryTop,
          text: caption('short', 2),
          side: 'up',
          visible: () => here('short') && reached('short') && shorted(),
        },
      ],
    },
    enter(info) {
      bench.ambient = AMBIENT;
      shortFor = 0;
      wiring.active = true;
      bench.follow = true;
      bench.sw.closed = true;
      bench.switchLive = () => false;
      bench.hands.policy = policy;
      bench.restore(info.instant ? 0 : 0.9, false);
      for (const k of END_KEYS) wiring.grips.of[k].shown.go(k === 'b1' ? 1 : 0, info.instant ? 0 : 0.5);
      wiring.grips.of.b1.call = 1;
      frameShown.go(1, info.instant ? 0 : 0.7);
      thermal.go(1, info.instant ? 0 : 1.2);
      if (info.instant) lens.snap(onBattery);
      else lens.to(onBattery, 1.3);
    },
    leave() {
      wiring.grips.of.b1.call = 0;
      bench.hands.policy = null;
    },
    update(dt) {
      shortFor = shorted() && bench.sw.closed ? shortFor + dt : 0;
      if (shortFor >= HOLD) reach('short');
      wiring.grips.of.b1.call = wiring.ends.b1.seated === 'minus' || wiring.ends.b1.held ? 0 : 1;
    },
    late(dt) {
      const on = here('short');
      if (!on && frameShown.target !== 0) frameShown.go(0, 0.5);
      if (!on && thermal.target !== 0) thermal.go(0, 0.8);
      frameShown.update(dt);
      thermal.update(dt);
      // heat and the battery's run-down follow the circuit, whatever step is on screen (they settle away after)
      const hot = on && shorted();
      heat += ((hot ? 1 : 0) - heat) * (1 - Math.exp(-dt / (hot ? WARM_UP : COOL)));
      if (heat < 1e-3) heat = 0;
      life = hot ? Math.min(life + DRAIN * dt, 0.5) : Math.max(life - dt * 0.12, 0);
      if (on || life > 0) {
        cell.life = life;
        stage.charge = 1 - life;
      }
      // the frame: the current through it now (the lamp's 0,3 A, a short's ≈ 6 A within a moment, 0 when open)
      const want = bench.verdict === 'short' ? SHORT_A : bench.verdict === 'lit' ? LAMP_A : 0;
      shownA += (want - shownA) * (1 - Math.exp(-dt * (want > shownA ? 7 : 12)));
      if (Math.abs(want - shownA) < 0.02) shownA = want;
      frame.shown = frameShown.value;
      if (frameShown.value > 0.002) {
        frame.setAt(FRAME_AT, FRAME_DIR);
        frame.setNumber(phone() ? '' : amps(shownA));
        frame.light = 0.75 + 0.25 * stage.glow;
      }
      if (on || thermal.value > 0) stage.lamp.thermal = thermal.value;
      battery.amount = wire.amount = thermal.value;
      battery.shade = HOT * heat;
      wire.shade = WIRE_HOT * heat;
      battery.update();
      wire.update();
    },
  };
};
