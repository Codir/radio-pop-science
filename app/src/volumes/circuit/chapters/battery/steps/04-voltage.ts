/**
 * `battery/voltage` — «Напруга». The cut closes by itself (the same «Розріз» going back), the camera returns to the
 * stand plan and the meter slides onto the table. The reader drags its two probes to the battery's clamps; each
 * sticks only to its own (`blue` to «−», `coral` to «+»), a probe let go elsewhere glides back to the table. With
 * both on, the needle settles a little past «1,5» and the number reads «1,6 V» (`meterVoltage`, fresh and open).
 * Goal: both probes on their clamps, the needle at 1,6 for 1 s. A while after the takeaway the probes go back,
 * the meter leaves, and the chapter ends on the stand plan it started from.
 */
import { Vector3 } from 'three';
import { meterVoltage, type ProbeId } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { createCue } from '../parts/cue';

/**
 * A probe snaps to its clamp when the pointer's ray passes this close to the clamp (world units): measured along the
 * line of sight, so it does not matter that the hand carries the tip at the table's depth, nearer to the camera.
 */
const SNAP = 0.3;
/** Seconds the needle must stand on the number. */
const HOLD = 1;
/** Seconds after the takeaway before the instrument is put away. */
const PUT_AWAY = 6;

interface Glide {
  /** The point the held tip glides to (world), then `on` = `to`. */
  goal: Vector3 | null;
  to: number;
  hand: Vector3 | null;
  /** The pointer is over its own clamp. */
  near: boolean;
  at: Vector3;
}

export const voltageStep: StepFactory = ({ ctx, world: bw, reached, reach }) => {
  const { gauge, cut, lens, cell } = bw;
  const here = (): boolean => ctx.stage.current === 'voltage';
  const ids: ProbeId[] = ['minus', 'plus'];
  const glide: Record<ProbeId, Glide> = {
    minus: { goal: null, to: 0, hand: null, near: false, at: new Vector3() },
    plus: { goal: null, to: 0, hand: null, near: false, at: new Vector3() },
  };
  let needle = 0;
  let shown = 0;
  let steady = 0;
  let after = -1;
  let hovered: ProbeId | null = null;
  const cue = createCue(ctx.root);
  // where each probe belongs: a ring on its clamp while the probe is in the hand (or hovered, not yet on)
  const targets = { minus: createCue(ctx.root), plus: createCue(ctx.root) };
  const ready = (): boolean => here() && shown > 0.95 && after < PUT_AWAY;

  const plane = new Vector3();
  const hit = new Vector3();
  for (const id of ids) {
    const probe = gauge.probes[id];
    const g = glide[id];
    ctx.input.register(probe.handle, {
      cursor: 'grab',
      enabled: ready,
      hover: (over) => (hovered = over ? id : hovered === id ? null : hovered),
      dragStart: () => {
        g.goal = null;
        g.at.copy(probe.tip);
        g.hand = g.at.clone();
        probe.hold(g.at);
      },
      drag: (e) => {
        ctx.camera.camera.getWorldDirection(plane).negate();
        if (!e.planePoint(plane, g.hand ?? probe.tip, hit)) return;
        g.hand = hit.clone();
        g.near = e.ray.distanceToPoint(probe.pole) < SNAP;
      },
      dragEnd: () => {
        const near = g.near;
        g.near = false;
        g.hand = null;
        g.goal = near ? probe.pole : probe.rest;
        g.to = near ? 1 : 0;
      },
    });
  }
  const meterAt = new Vector3();
  ctx.qa.probe('meter', () => gauge.anchor.getWorldPosition(meterAt));
  for (const id of ids) {
    ctx.qa.probe(`probe-${id}`, () => gauge.probes[id].tip);
    ctx.qa.probe(`clamp-${id}`, () => gauge.probes[id].pole);
  }
  ctx.qa.expose('voltage', () => ({ needle, touching: gauge.touching, steady, shown }));
  const phone = (): boolean => ctx.device.formFactor === 'phone';

  return {
    spec: { ...bw.state('meter'), cameraMove: { duration: 2.2 } },
    ui: {
      goal: () => reached('voltage'),
      callouts: [
        {
          // the meter's name stands off its upper left corner, never over the number
          anchor: () => gauge.anchor.getWorldPosition(meterAt).add(new Vector3(-0.85, 0.62, 0)),
          text: caption('voltage', 0),
          side: 'left',
          visible: () => here() && shown > 0.95 && !gauge.touching && after < 0,
        },
        {
          anchor: () => gauge.anchor.getWorldPosition(meterAt).add(new Vector3(0.3, 0.05, 0)),
          text: caption('voltage', 1),
          side: 'right',
          visible: () => here() && phone() && gauge.touching && needle > 1.5 && after < PUT_AWAY,
        },
        {
          anchor: () => gauge.anchor.getWorldPosition(meterAt).add(new Vector3(-0.35, 0.72, 0)),
          text: caption('voltage', 2),
          visible: () => here() && after > 0.4 && after < PUT_AWAY,
        },
      ],
    },
    enter(info) {
      lens.goTo('holder');
      bw.metal.active = false;
      ctx.stage.setParam('window', 0, { instant: true });
      cut.target = 0;
      cut.tau = 0.3;
      cell.hold = true;
      cell.highlight = null;
      if (info.instant) {
        cut.shown = 0;
        cell.surplus = cell.lack = cell.mark;
      }
      for (const id of ids) {
        const g = glide[id];
        g.goal = g.hand = null;
        g.near = false;
        g.to = 0;
        gauge.probes[id].hold(null);
        gauge.probes[id].on = 0;
      }
      steady = 0;
      after = reached('voltage') ? PUT_AWAY : -1;
      bw.meter.want = 0;
      bw.meter.volts = 0;
      if (info.instant) gauge.shown = 1;
    },
    leave() {
      cue.hide();
      targets.minus.hide();
      targets.plus.hide();
      for (const id of ids) {
        const g = glide[id];
        if (g.hand || g.goal) gauge.probes[id].on = g.to;
        g.hand = g.goal = null;
        gauge.probes[id].hold(null);
      }
      // the meter slides off with its probes and the needle falls back (the world eases both)
      bw.meter.want = 0;
      bw.meter.volts = 0;
    },
    update(dt) {
      if (!here()) return;
      bw.scale.shown = 0;
      // the meter comes once the battery is closed and the camera has landed; it leaves after the takeaway
      if (after >= PUT_AWAY + 0.9) bw.meter.want = 0;
      else if (cut.shown < 0.04 && !ctx.camera.moving) bw.meter.want = 1;
      shown = gauge.shown;
      for (const id of ids) {
        const probe = gauge.probes[id];
        const g = glide[id];
        if (g.hand) {
          // the tip follows the hand; near its own clamp it is drawn onto it
          const pull = g.near ? probe.pole : g.hand;
          g.at.lerp(pull, 1 - Math.exp(-dt * 20));
          probe.hold(g.at);
        } else if (g.goal) {
          g.at.lerp(g.goal, 1 - Math.exp(-dt * 9));
          probe.hold(g.at);
          if (g.at.distanceTo(g.goal) < 0.004) {
            probe.on = g.to;
            probe.hold(null);
            g.goal = null;
          }
        }
      }
      bw.meter.volts = gauge.touching ? meterVoltage(0, 0) : 0;
      needle = gauge.value;
      steady = gauge.touching && Math.abs(needle - meterVoltage(0, 0)) < 0.05 ? steady + dt : 0;
      if (steady >= HOLD && !reached('voltage')) {
        reach('voltage');
        after = 0;
      }
      if (after >= 0) after += dt;
      if (after >= PUT_AWAY && after - dt < PUT_AWAY) {
        // put away: both probes back on the table, then the meter slides off (the chapter's last frame = stand)
        for (const id of ids) {
          const g = glide[id];
          g.at.copy(gauge.probes[id].tip);
          g.goal = gauge.probes[id].rest;
          g.to = 0;
        }
      }
      // the chapter's last frame is the stand plan the next chapter starts from: the camera settles there as the
      // meter leaves
      if (after >= PUT_AWAY + 0.9 && after - dt < PUT_AWAY + 0.9) ctx.camera.go('stand', { duration: 2.4 });
      const cueAt = hovered && !glide[hovered].hand ? gauge.probes[hovered].tip.clone() : null;
      cue.update(dt, ready() ? cueAt : null, 0.09, ctx.camera.camera);
      for (const id of ids) {
        const probe = gauge.probes[id];
        const g = glide[id];
        const wanted = ready() && probe.on < 0.5 && (g.hand !== null || (hovered === id && !g.goal));
        targets[id].update(dt, wanted ? probe.pole : null, 0.13, ctx.camera.camera);
      }
    },
  };
};
