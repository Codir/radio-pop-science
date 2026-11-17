/**
 * The counter frame as the chapter uses it (`flow/count`, `same`, `loop`): it rests upright on the board right of
 * the loop's near corner; the reader drags it — off the wire it follows the hand a little above the board, near a
 * wire it snaps on and from then slides along the wire like a bead (`loop-track.ts`: over the switch, the lamp's
 * socket and the second seat it lifts; into the battery it never goes). Standing still on the wire it counts one
 * second: the number runs up from 0 to 1 872 000 000 000 000 000 (0.3 A) and stops; carried, the number is dim.
 * With the circuit open it shows 0 in that very frame. Board frame; the number is `count-display.ts`.
 */
import { Mesh, MeshBasicMaterial, BoxGeometry, Quaternion, Vector3 } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { LAMP, LOOP, boardToWorld, type CircuitStage } from '@circuit/shared/stage';
import { countAt, countDisplay, grouped } from './count-display';
import { glide } from './glide';
import { loopTrack, type Zone } from './loop-track';

/** Where the frame rests (board frame): upright on its shoe, right of the near right corner. */
const REST = new Vector3(2.92, LOOP.y, 1.12);
const REST_TANGENT = new Vector3(0, 0, -1);
/** Board distance from a wire at which the carried frame snaps on. */
const SNAP = 0.42;
/** Seconds of standing still before a new second starts. */
const SETTLE = 0.15;

export interface Counter {
  /** Presence 0…1 (travels). */
  shown: ReturnType<typeof glide>;
  /** On the wire (1) or resting / in the hand (0) — travels between the two poses. */
  readonly onWire: boolean;
  /** Track position on the wire. */
  readonly u: number;
  /** Seconds counted of the current second (0…1); 1 = the number stands. */
  readonly progress: number;
  /** The second just completed in this zone (read and cleared by the step). */
  done: Zone | null;
  readonly zone: Zone | null;
  /** May the reader handle it now. */
  enabled: () => boolean;
  /** Put it on the wire at `u`, sliding along the wire from where it is (or from the rest pose). */
  slideTo(u: number, seconds: number): void;
  /** The middle of a stretch of wire (track position). */
  middle(zone: Zone): number;
  /** Back to its rest on the board (and the count cleared). */
  park(instant: boolean): void;
  /** Where the number stands (world), for captions. */
  anchor(): Vector3;
  /** The number as text ('' when none) — on a phone the scene's own print would be under 14 px, so the
   *  interface shows it at `anchor()` instead (`phone`). */
  readonly text: string;
  readonly phone: boolean;
  update(dt: number, whole: boolean): void;
}

export function counter(ctx: ChapterContext, stage: CircuitStage, name: string, unit: string): Counter {
  const { frame } = stage.tools;
  const track = loopTrack();
  const display = countDisplay(unit);
  ctx.root.add(display.group);
  const hit = new Mesh(
    new BoxGeometry(0.34, 0.8, 0.8),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'flow-counter-hit';
  frame.group.add(hit);
  const pose = glide(0); // 0 rest / hand · 1 on the wire
  const slide = glide(0);
  const hand = new Vector3().copy(REST);
  const handFrom = new Vector3().copy(REST);
  const back = glide(1);
  let held = false;
  let u = track.middle('plus');
  let slideFrom = u;
  let target = u;
  let sliding = false;
  let progress = 0;
  let still = 0;
  let last = -1;
  let wasWhole = false;
  const p = new Vector3();
  const t = new Vector3();
  const a = new Vector3();
  const qa = new Quaternion();
  const up = new Vector3();
  const through = new Vector3();
  const hitPoint = new Vector3();
  const world = new Vector3();
  const q = new Quaternion();
  let text = '';
  let side = 0;
  const phone = (): boolean => ctx.device.formFactor === 'phone';
  const restart = (): void => {
    progress = 0;
    still = 0;
  };

  const c: Counter = {
    shown: glide(0),
    get onWire() {
      return pose.target === 1;
    },
    get u() {
      return u;
    },
    get progress() {
      return progress;
    },
    done: null,
    get zone() {
      return pose.target === 1 && !pose.moving ? track.zone(u) : null;
    },
    enabled: () => false,
    slideTo(to, seconds) {
      held = false;
      if (pose.value < 0.5) {
        // from the board: onto the wire where it is nearest, then along
        u = track.nearest(hand).u;
        pose.go(1, Math.min(seconds, 0.6));
      }
      slideFrom = u;
      sliding = true;
      slide.set(0);
      slide.go(1, seconds);
      restart();
      target = to;
    },
    middle: (zone) => track.middle(zone),
    park(instant) {
      held = false;
      sliding = false;
      hand.copy(REST);
      pose.go(0, instant ? 0 : 0.6);
      restart();
    },
    anchor: () => display.group.position,
    get text() {
      return text;
    },
    get phone() {
      return phone();
    },
    update(dt, whole) {
      c.shown.update(dt);
      pose.update(dt);
      back.update(dt);
      if (sliding) {
        slide.update(dt);
        u = slideFrom + (target - slideFrom) * slide.value;
        if (!slide.moving) sliding = false;
      }
      if (!held && pose.value < 1 && back.moving) hand.lerpVectors(handFrom, REST, back.value);
      // the pose: on the wire at u (lifted over the hops), or upright at the hand / rest a little above the board
      track.at(u, p, t);
      p.y += 0.42 * track.lift(u);
      frame.setAt(p, t);
      qa.copy(frame.group.quaternion);
      a.copy(p);
      frame.setAt(hand, REST_TANGENT);
      const k = pose.value;
      const e = k * k * (3 - 2 * k);
      frame.group.position.lerp(a, e);
      frame.group.position.y += (held && pose.target === 0 ? 0.18 : 0) + 0.25 * Math.sin(Math.PI * e);
      frame.group.quaternion.slerp(qa, e);
      frame.shown = c.shown.value;
      frame.setNumber('');
      // the count: a new second each time the frame stands still on the wire with the circuit whole
      const moving = held || sliding || pose.moving || Math.abs(u - last) > 1e-5;
      last = u;
      const counting = pose.target === 1 && !moving && whole;
      if (!whole || moving) restart();
      if (whole && !wasWhole) restart();
      wasWhole = whole;
      if (counting) {
        still += dt;
        if (still >= SETTLE && progress < 1) {
          progress = Math.min(progress + dt, 1);
          if (progress >= 1) c.done = track.zone(u);
        }
      }
      frame.group.getWorldPosition(world);
      // near the lamp the number moves, gliding, to the free side (left of the frame), clear of the globe
      const nearLamp = Math.hypot(frame.group.position.x - LAMP.x, frame.group.position.z - LAMP.z) < 1.5;
      side = damp(side, nearLamp ? -1 : 0, 5, dt);
      display.place(world, ctx.camera.camera, 0.5 + 0.2 * (1 - e), side);
      const shownCount = pose.target === 1 || pose.value > 0.5 ? (whole ? countAt(progress) : 0n) : null;
      text = shownCount === null || c.shown.value * e < 0.5 ? '' : grouped(shownCount);
      display.set(
        shownCount,
        moving ? 0.4 : 1,
        progress,
        phone() ? 0 : c.shown.value * e,
        stage.tools.frame.light,
      );
    },
  };

  ctx.input.register(hit, {
    cursor: 'grab',
    tooltip: name,
    enabled: () => c.enabled() && c.shown.value > 0.9,
    dragStart: () => {
      held = true;
      sliding = false;
    },
    drag: (ev) => {
      up.set(0, 1, 0).applyQuaternion(stage.base.frame.getWorldQuaternion(q));
      boardToWorld(0, LOOP.y, 0, through);
      if (!ev.planePoint(up, through, hitPoint)) return;
      stage.base.frame.worldToLocal(p.copy(hitPoint));
      if (pose.target === 1) {
        // a bead: it slides to the nearest place within reach of where it is, never jumping across the board
        u = track.nearest(p, u, 0.05).u;
        return;
      }
      hand.copy(p).setY(LOOP.y);
      const near = track.nearest(p);
      if (near.distance < SNAP) {
        u = near.u;
        pose.go(1, 0.22);
      }
    },
    dragEnd: () => {
      held = false;
      if (pose.target === 0) {
        handFrom.copy(hand);
        back.set(0);
        back.go(1, 0.45);
      }
    },
  });
  ctx.qa.probe('counter', frame.group);
  // QA: eleven points along the track (u = k / 10), for drags that follow the wire
  for (let k = 0; k <= 10; k++) {
    const q = new Vector3();
    ctx.qa.probe(`track-${k}`, () =>
      stage.base.frame.localToWorld(track.at(track.min + ((track.max - track.min) * k) / 10, q)),
    );
  }
  return c;
}
