/**
 * `loop` — «Замкнена дорога». On entry the counter frame slides by itself onto the near wire between the plus and
 * the switch. The reader carries the yellow slider to the second seat on the far side: the moment it leaves the
 * first seat the gap there opens the circuit (lamp dark, the frame «0»); laid into the second seat (closed) it sends
 * the jumper hopping into the first, and the lamp lights again. Clicked there, it opens and closes the circuit from
 * the far side — the frame on the near side answers in the same frame. Goal: in the second seat, opened at least
 * once and closed again. Leaving, slider and jumper go back to their seats.
 */
import { Quaternion, Vector3 } from 'three';
import type { DragInfo } from '@/engine/api';
import { col } from '@/style';
import { LOOP, boardToWorld } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { SEATS } from '../parts/switch';

/** Board distance from the second seat at which the carried slider is laid in. */
const SNAP = 0.5;
/** Height the slider is carried at (board frame). */
const CARRY = 0.62;
/** Seconds of the loop's glow at the takeaway, and its colour (a cool light: not energy, not the field). */
const FLASH = 1.8;
const LIGHT = col('sky').lerp(col('white'), 0.5);

export const loopStep: StepFactory = ({ ctx, stand, reached, reach, here }) => {
  const { sw, swSeat, jumperSeat, counter } = stand;
  let held = false;
  let frameDue = false;
  /** Seconds into the brief glow of the whole loop at the takeaway (−1 = none). */
  let flash = -1;
  let opened = false;
  const hand = new Vector3();
  const back = new Vector3();
  const p = new Vector3();
  const q = new Quaternion();
  /** The slider was let go away from the second seat: it glides back to the first from `back`. */
  let returning = 0;
  const seated = (): boolean => !held && returning <= 0 && !swSeat.moving && !jumperSeat.moving;
  const whole = (): boolean => seated() && sw.closed;
  const atSecond = (): boolean => swSeat.target === 1;
  const seatAnchor = (): Vector3 => boardToWorld(SEATS.second.x, 0.5, SEATS.second.z);
  ctx.qa.probe('seat-second', seatAnchor);
  ctx.qa.expose('loop', () => ({
    held,
    opened,
    seat: swSeat.value,
    jumper: jumperSeat.value,
    whole: whole(),
  }));

  const use = {
    enabled: () => here('loop') && !swSeat.moving && !jumperSeat.moving,
    click: () => {
      if (!atSecond() || held) return;
      sw.closed = !sw.closed;
      if (!sw.closed) opened = true;
      else if (opened && !reached('loop')) {
        reach('loop');
        flash = 0;
      }
    },
    dragStart: () => {
      if (atSecond()) return;
      held = true;
      sw.hand = hand.copy(sw.seat > 0.5 ? SEATS.second : SEATS.first);
    },
    drag: (e: DragInfo) => {
      if (!held) return;
      const frame = stand.stage.base.frame;
      const up = new Vector3(0, 1, 0).applyQuaternion(frame.getWorldQuaternion(q));
      const hit = e.planePoint(up, boardToWorld(0, CARRY, 0), p);
      if (!hit) return;
      frame.worldToLocal(hit);
      hand.set(hit.x, CARRY, hit.z);
      if (Math.hypot(hand.x - SEATS.second.x, hand.z - SEATS.second.z) < SNAP) {
        // laid in: the slider settles from the hand into the seat, the jumper hops into the first
        held = false;
        sw.hand = null;
        sw.closed = true;
        swSeat.set(0.82);
        swSeat.go(1, 0.25);
        jumperSeat.go(1, 0.5);
      }
    },
    dragEnd: () => {
      if (!held) return;
      held = false;
      back.copy(hand);
      returning = 1;
    },
  };

  return {
    spec: { camera: 'stand', params: { closed: 1, poles: 1 } },
    ui: {
      goal: () => reached('loop'),
      callouts: [
        // on a phone the number stands in the interface (the scene's print would be under 14 px)
        {
          anchor: () => stand.counter.anchor(),
          text: () => stand.counter.text,
          side: 'up',
          visible: () => here('loop') && stand.counter.phone && stand.counter.text !== '',
          priority: 0,
        },
        {
          anchor: seatAnchor,
          text: caption('loop', 0),
          side: 'up',
          visible: () => here('loop') && !atSecond() && stand.waterMorph.value < 0.01,
        },
        {
          anchor: () => stand.stage.stand.mounts.seatJumper!.getWorldPosition(new Vector3()),
          text: caption('loop', 1),
          side: 'down',
          visible: () => here('loop') && !atSecond() && !held && stand.waterMorph.value < 0.01,
        },
        {
          anchor: () => boardToWorld(0, 0.9, LOOP.far - 0.25),
          text: caption('loop', 2),
          side: 'up',
          visible: () => here('loop') && reached('loop'),
        },
      ],
    },
    enter(info) {
      held = false;
      opened = false;
      flash = -1;
      returning = 0;
      sw.hand = null;
      sw.closed = true;
      swSeat.go(0, info.instant ? 0 : 0.9);
      jumperSeat.go(0, info.instant ? 0 : 0.6);
      stand.endOut.go(0, info.instant ? 0 : 0.5);
      // back from the water picture the frame comes once the stand is back (one motion after the other)
      frameDue = !info.instant && stand.waterMorph.value > 0.02;
      if (!frameDue) counter.shown.go(1, info.instant ? 0 : 0.6);
      stand.lenses.presence.go(0, info.instant ? 0 : 1.4);
      stand.glow.intensity = 0;
      counter.enabled = () => false;
      if (!frameDue) counter.slideTo(counter.middle('plus'), info.instant ? 0 : 1.6);
      stand.switchUse = use;
    },
    leave() {
      // the slider and the jumper go home as the next step starts (the next step sets their targets)
      held = false;
      sw.hand = null;
      returning = 0;
      sw.closed = true;
    },
    update(dt) {
      if (frameDue && stand.waterMorph.value < 0.05) {
        frameDue = false;
        counter.shown.go(1, 0.6);
        counter.slideTo(counter.middle('plus'), 1.2);
      }
      if (returning > 0) {
        returning = Math.max(returning - dt / 0.45, 0);
        const k = 1 - returning;
        const e = k * k * (3 - 2 * k);
        sw.hand = hand.lerpVectors(back, SEATS.first, e);
        if (returning === 0) sw.hand = null;
      }
      stand.light(whole());
      // at the takeaway the loop itself glows, faintly and once, all round its perimeter (VISUAL §8)
      if (flash >= 0) {
        flash += dt;
        const k = Math.min(flash / FLASH, 1);
        const g = stand.glow;
        g.front = 1;
        g.wake = 1;
        g.peak = 0;
        g.flow = 0;
        g.color.copy(LIGHT);
        g.intensity = 0.3 * Math.sin(Math.PI * k) ** 2;
        if (k >= 1) {
          flash = -1;
          g.intensity = 0;
        }
      }
    },
  };
};
