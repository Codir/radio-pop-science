/**
 * `find-fault` — «Три несправності». The stand from `first-light`, assembled and lit. Then three faults in turn,
 * from the one the eye sees to the one only the lens shows; each arrives as the stand «resets» (every end lifts out
 * of its clamp and goes back in, the lamp dark meanwhile — so the motion itself does not give the place away):
 *  1. the plus wire's end is in the «−» clamp beside the minus wire's end (the «+» clamp empty, the wire over the
 *     battery) — a touch on that clamp: the end jumps to the free «+» clamp;
 *  2. the lamp wire's end is clamped with its sheath on (`contact` false, no bare copper) — with the lens over it, a
 *     touch: the end comes out, the sheath is stripped back, it goes in again;
 *  3. the far wire's copper is broken under the intact sheath (`whole.c` false, a gap in `m` at `C_GAP`) — with the lens over
 *     it, a touch: the old wire rolls off behind the board, a whole one comes down onto the staples.
 * The lamp lights after each repair (that is the check) and 1.5 s later the next fault comes. Touches elsewhere do
 * nothing. The lens: in its holder; a drag carries it along the loop (`loop-track`), and inside its ring the stand
 * is seen enlarged (`parts/magnifier.ts`).
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { InteractionHandlers } from '@/engine/api';
import {
  BATTERY,
  LAMP,
  LOOP,
  STAGE_SHOTS,
  boardToWorld,
  worldDirToBoard,
  type LensPose,
} from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { AMBIENT } from '../bench';
import { CLAMPS } from '../parts/clamps';
import { END_KEYS } from '../parts/ends';
import { emptyPose } from '../parts/lens-keeper';
import { loopTrack } from '../parts/loop-track';
import { C_GAP } from '../parts/wiring';

/** Seconds of the stand's reset (every end out and back in), of light after a repair, before the first fault. */
const RESET = 1.0;
const SHINE = 1.5;
const FIRST = 1.2;
/** The lens over the wire: lifted toward the camera, a little larger (as `lamp/hot-spot`). */
const LIFT = 1.25;
const SCALE = 1.15;
/** World distance from the ring's focus within which the lens is «over» a fault. */
const OVER = 0.3;

type Phase = 'arrive' | 'reset' | 'fault' | 'fixing' | 'shine' | 'done';

/** The three places (board frame). */
const PLACES = [
  CLAMPS.minus.mouth.clone(),
  CLAMPS.lampB.mouth.clone(),
  C_GAP.clone(),
] as const;

export const findFaultStep: StepFactory = ({ ctx, bench, lens, magnifier, reached, reach, here }) => {
  const { wiring, stage, swap } = bench;
  const track = loopTrack();
  const camWorld = new Vector3(...STAGE_SHOTS.stand.position);
  const pose = emptyPose();
  const p = new Vector3();
  const pw = new Vector3();
  let phase: Phase = 'arrive';
  let fault = 0;
  let fixed = 0;
  let timer = 0;
  /** The repair's own clock (fault 2's three moves). */
  let fixT = 0;
  let s = track.shareOf(BATTERY.plusX + 0.1, LOOP.near);
  let goal = s;
  let taken = false;
  let held = false;
  let magnify = 0;

  const poseAt = (share: number): LensPose => {
    track.at(share, p);
    boardToWorld(p.x, p.y, p.z, pw);
    const toCam = worldDirToBoard(camWorld.clone().sub(pw).normalize());
    pose.position.copy(p).addScaledVector(toCam, LIFT);
    pose.facing.copy(toCam);
    pose.handle.set(0.62, -0.5, 0.6);
    pose.handle.addScaledVector(toCam, -pose.handle.dot(toCam)).normalize();
    pose.scale = SCALE;
    pose.grip = 1 / SCALE;
    return pose;
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
  const placeWorld = (i: number, out = new Vector3()): Vector3 =>
    boardToWorld(PLACES[i]!.x, PLACES[i]!.y, PLACES[i]!.z, out);
  /** The ring looks at fault `n` (1-based) now. */
  const over = (n: number): boolean =>
    taken && !lens.gliding && magnify > 0.9 && magnifier.focus.distanceTo(placeWorld(n - 1, pw)) < OVER;
  const live = (): boolean => here('find-fault') && !bench.world.flying;

  /** The stand resets into fault `n`: every end lifts out and goes back in, the change made while they are up. */
  const resetInto = (n: number, instant: boolean): void => {
    fault = n;
    phase = instant ? 'fault' : 'reset';
    timer = 0;
    bench.follow = false;
    ctx.stage.setParam('closed', 0, { instant: true });
    const sec = instant ? 0 : RESET;
    wiring.home(sec, !instant);
    if (n === 1) {
      wiring.hop('c0', 'minus', sec, { slot: 0 });
      wiring.hop('a0', 'minus', sec, { slot: 1 });
    }
    if (n === 2) {
      wiring.ends.b1.contact = false;
      wiring.bare.b1.go(0, instant ? 0 : RESET * 0.5);
    }
    if (n === 3) wiring.whole.c = false;
    if (instant) {
      wiring.snap();
      bench.follow = true;
    }
  };
  const repaired = (): void => {
    fixed++;
    phase = 'shine';
    timer = 0;
    bench.follow = true;
    if (fixed >= 3) reach('find-fault');
  };
  const fix = (n: number): void => {
    if (phase !== 'fault' || fault !== n) return;
    phase = 'fixing';
    fixT = 0;
    if (n === 1) wiring.plug('a0', 'plus', 0.5);
    if (n === 3) {
      // the lamp waits for the new wire to lie in its clamps
      bench.follow = false;
      swap.start();
    }
  };

  // fault 1 is seen without the lens: a touch on the «−» clamp (or the end in it) mends it
  const hit = new Mesh(new SphereGeometry(0.36, 14, 10), new MeshBasicMaterial({ visible: false }));
  hit.name = 'build-fault-1';
  hit.position.copy(PLACES[0]!);
  stage.base.frame.add(hit);
  ctx.input.register(hit, {
    cursor: 'pointer',
    enabled: () => live() && phase === 'fault' && fault === 1,
    click: () => fix(1),
  });

  const lensInput: InteractionHandlers = {
    enabled: live,
    click: () => {
      if (!taken) return take(track.shareOf(BATTERY.plusX + 0.15, LOOP.near));
      if (over(2)) fix(2);
      else if (over(3)) fix(3);
    },
    dragStart: () => void (held = true),
    drag: (e) => take(track.nearest(e.ndc.x, e.ndc.y, ctx.viewport.aspect, ctx.camera.camera)),
    dragEnd: () => void (held = false),
  };
  ctx.qa.probe('fault-1', () => placeWorld(0));
  ctx.qa.probe('fault-2', () => placeWorld(1));
  ctx.qa.probe('fault-3', () => placeWorld(2));
  ctx.qa.probe('lens', stage.tools.lens.group);
  ctx.qa.expose('find-fault', () => ({
    phase,
    fault,
    fixed,
    taken,
    s,
    over2: over(2),
    over3: over(3),
    magnify,
  }));
  const counter = (): string => caption('find-fault', 0).replace('0', String(fixed));
  const lampSide = (): Vector3 => boardToWorld(LAMP.x - LAMP.glass * 0.85, LAMP.filamentY + 0.2, LAMP.z);

  return {
    lensInput,
    spec: {
      camera: 'stand',
      params: { lens: 0, lensCall: 0, window: 0, poles: 1, moon: 1, unfold: 1, charge: 1 },
    },
    ui: {
      goal: () => reached('find-fault'),
      callouts: [
        {
          anchor: lampSide,
          text: counter,
          side: 'left',
          visible: () => here('find-fault') && fixed < 3 && phase !== 'arrive',
        },
        {
          anchor: lampSide,
          text: caption('find-fault', 1),
          side: 'left',
          visible: () => here('find-fault') && fixed >= 3,
        },
      ],
    },
    enter(info) {
      bench.ambient = AMBIENT;
      fixed = 0;
      fault = 0;
      taken = held = false;
      s = goal = track.shareOf(BATTERY.plusX + 0.1, LOOP.near);
      wiring.active = true;
      bench.hands.policy = null;
      bench.switchLive = () => false;
      bench.sw.closed = true;
      bench.follow = true;
      for (const k of END_KEYS) wiring.grips.of[k].shown.go(0, info.instant ? 0 : 0.45);
      lens.call = 1;
      if (info.instant) {
        bench.restore(0);
        lens.snap(stage.tools.poses.holder);
        resetInto(1, true);
        return;
      }
      // from `first-light`: whatever the reader built, the ends go to the stand's clamps; the lamp lights
      bench.restore(0.9);
      lens.to(stage.tools.poses.holder, 1.0);
      phase = 'arrive';
      timer = 0;
    },
    leave() {
      bench.follow = true;
      lens.call = 0;
    },
    update(dt) {
      timer += dt;
      if (taken) {
        const d = track.delta(s, goal);
        s += d * (1 - Math.exp(-dt * (held ? 14 : 8)));
        s -= Math.floor(s);
      }
      lens.call = taken ? 0 : 1;
      // the reader's circuit, now the stand's, shines a moment before the first fault comes
      if (phase === 'arrive' && (wiring.moving || !bench.lit)) timer = 0;
      if (phase === 'arrive' && timer > FIRST) resetInto(1, false);
      if (phase === 'reset' && timer >= RESET) {
        phase = 'fault';
        bench.follow = true;
      }
      if (phase === 'fixing') {
        fixT += dt;
        if (fault === 1 && !wiring.ends.a0.moving && wiring.ends.a0.seated === 'plus') repaired();
        if (fault === 2) {
          const b1 = wiring.ends.b1;
          const mouth = CLAMPS.lampB;
          if (fixT - dt <= 0)
            b1.go(
              {
                kind: 'lie',
                at: mouth.mouth.clone().addScaledVector(mouth.out, 0.42),
                out: mouth.out.clone(),
              },
              0.45,
              0.3,
              true,
            );
          if (fixT >= 0.45 && fixT - dt < 0.45) wiring.bare.b1.go(1, 0.35);
          if (fixT >= 0.85 && fixT - dt < 0.85) {
            b1.contact = true;
            wiring.plug('b1', 'lampB', 0.35);
          }
          if (fixT > 1.25 && !b1.moving) repaired();
        }
        if (fault === 3) {
          // the new wire is whole from the moment it appears (behind the board)
          if (swap.t >= 0.5) wiring.whole.c = true;
          if (!swap.running) repaired();
        }
      }
      if (phase === 'shine' && timer >= SHINE) {
        if (fixed < 3) resetInto(fixed + 1, false);
        else phase = 'done';
      }
    },
    late(dt) {
      const want = here('find-fault') && taken ? 1 : 0;
      magnify += (want - magnify) * (1 - Math.exp(-dt * 2.6));
      if (Math.abs(magnify - want) < 1e-3) magnify = want;
      magnifier.amount = magnify;
      if (here('find-fault') && taken && !lens.gliding) lens.hold(along);
    },
  };
};
