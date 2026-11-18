/**
 * `push` — «Поштовх біжить колом». The three lenses stay from `together`; the lamp is dark and the switch open. ONE
 * slider «Час», 0 … 1 billionth of a second of true time: every frame is a function of it, both ways (DECISIONS
 * §60 p, w; no «slowed» mode, no ×N). Above 0 the switch is closed; from its contacts an amber wave runs round the
 * loop both ways, wrapped round the wire on the outside (`shared/stage/loop-glow.ts`), and meets itself on the far
 * side at 0.8 of the slider (half the loop ≈ 21 cm at ≈ 0.85 of the speed of light). The electrons in a lens start
 * their common shift in the frame the wave passes it. The lamp does not light within the slider (it needs
 * hundredths of a second to heat). Goal: the slider at its end for a second. 3.5 s after the takeaway the scene
 * returns to ordinary time: the lenses leave, the wave fades, the lamp lights — the stand shot the next chapter
 * starts from.
 */
import { Vector3 } from 'three';
import { col } from '@/style';
import { BATTERY, LOOP, SWITCH } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { holdFor } from '../parts/clock';
import { LENS_SPOTS } from '../parts/lenses';

/** Share of the slider at which the two fronts meet (script: «≈ 0,8 повзунка»). */
const MEET = 0.8;
const HOLD = 1;
const GLIDE = 0.35;
const CROSS = 2.5;
const FOLLOW = 0.05;
const BACK_AFTER = 3.5;

export const pushStep: StepFactory = ({ ctx, stand, ui, reached, reach, here }) => {
  const { lenses, glow, sw } = stand;
  const goal = holdFor(HOLD);
  const time = { target: 0, shown: 0, drag: false, told: -1 };
  let home = -1;
  let returned = false;
  const origin = glow.at(SWITCH.x, LOOP.near);
  // shares of the loop covered by the battery (clamp to clamp) and by the switch block (the path runs −x there)
  const span = (a: number, b: number): [number, number] => {
    const [p, q] = [glow.at(a, LOOP.near), glow.at(b, LOOP.near)];
    return [Math.min(p, q), Math.max(p, q)];
  };
  const HIDE = [
    span(BATTERY.minusX - 0.12, BATTERY.plusX + 0.12),
    span(SWITCH.inX - 0.04, SWITCH.outX + 0.04),
  ];
  // how far round the loop (as a front's share) each lens lies from the switch, the shorter way
  const reachOf = LENS_SPOTS.map(({ at }) => {
    const s = glow.at(at.x, at.z);
    const f = (((s - origin) % 1) + 1) % 1;
    return Math.min(f, 1 - f) / 0.5;
  });
  const meetAt = new Vector3();
  const amber = col('amber');
  const fmt = (v: number): string =>
    v <= 0 ? caption('push', 1) : v >= 0.98 ? '1' : v.toFixed(2).replace('.', ',');
  ctx.qa.expose('push', () => ({
    time: time.shown,
    front: glow.front,
    drifting: [...lenses.drifting],
    returned,
  }));
  return {
    spec: { camera: 'stand', params: { closed: 0, poles: 1 } },
    ui: {
      reset: true,
      goal: () => reached('push'),
      controls: [
        {
          type: 'slider',
          id: 'push-time',
          label: caption('push', 0),
          min: 0,
          max: 1,
          value: 0,
          step: 0.005,
          format: fmt,
          marks: [
            { value: 0, label: caption('push', 1) },
            { value: 1, label: caption('push', 2) },
          ],
          disabled: () => lenses.presence.value < 0.999 || returned,
          // the track's last few thousandths are the end (a thumb dragged to the end may stop a hair short)
          onChange: (v) => (time.target = v >= 0.98 ? 1 : v),
          onInput: (_v, how) => (time.drag = how === 'drag'),
        },
      ],
      callouts: [
        {
          anchor: () =>
            stand.stage.base.frame.localToWorld(glow.pointAt(origin + 0.5, meetAt).setY(LOOP.y + 0.35)),
          text: caption('push', 3),
          side: 'up',
          visible: () => here('push') && reached('push') && !returned,
        },
      ],
    },
    enter(info) {
      time.target = time.shown = 0;
      time.drag = false;
      time.told = -1;
      home = -1;
      returned = false;
      goal.reset();
      sw.closed = false;
      stand.light(false);
      lenses.presence.go(1, info.instant ? 0 : 1.6);
      lenses.drifting = [false, false, false];
      stand.counter.shown.go(0, 0);
      stand.endOut.go(0, 0);
      stand.swSeat.go(0, 0.6);
      stand.jumperSeat.go(0, 0.5);
      stand.switchUse = { enabled: () => false };
      glow.origin = origin;
      glow.meet = origin + 0.5;
      glow.color.copy(amber);
      glow.wake = 0.22;
      glow.peak = 1.6;
      glow.edge = 0.018;
      glow.flow = 0;
      // the push runs along the wires; through the battery's body and the switch's block it passes unseen
      glow.hide = HIDE;
    },
    leave() {
      glow.intensity = 0;
      glow.hide = [];
    },
    update(dt) {
      if (!returned) {
        const gap = time.target - time.shown;
        // a drag follows the thumb within a few frames (a finger's first move past the touch slop arrives as
        // one big step: the wave must not jump with it); a click on the track or a key glides, speed-limited
        const step = gap * (1 - Math.exp(-dt / (time.drag ? FOLLOW : GLIDE)));
        const most = dt / CROSS;
        time.shown += time.drag ? step : Math.max(-most, Math.min(most, step));
        if (Math.abs(time.shown - time.target) < 0.002) time.shown = time.target;
        const t = time.target > 0 && time.shown === 0 ? Math.min(time.target, 0.002) : time.shown;
        sw.closed = t > 0;
        const front = Math.min(t / MEET, 1);
        glow.front = front;
        glow.intensity = t > 0 ? 1 : 0;
        lenses.drifting = reachOf.map((r) => t > 0 && front >= r) as [boolean, boolean, boolean];
        if (Math.abs(time.shown - time.told) > 0.002)
          ui.patch('push-time', { current: (time.told = time.shown) });
        if (goal.update(lenses.presence.value > 0.999 && t >= 1 - 1e-4, dt)) reach('push');
        if (reached('push') && home < 0 && t >= 1 - 1e-4) home = BACK_AFTER;
      }
      // after the takeaway: back to ordinary time — the lenses leave, the wave fades, the lamp lights
      if (home > 0 && (home -= dt) <= 0) {
        returned = true;
        lenses.presence.go(0, 1.8);
        stand.light(true);
      }
      if (returned) glow.intensity = Math.max(glow.intensity - dt / 1.2, 0);
    },
  };
};
