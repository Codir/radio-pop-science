/**
 * `drain/inner` — «Опір у самій батарейці». The magnifier with the hit strip (`shared/copper/hit-lens.ts`, as in
 * `resistance/balance`) comes out of its holder and lies on the lamp's glass: frosted there (chapter 6 looked
 * inside), the strip half full — the dead battery's current is small. The reader carries it to the battery along
 * one rail (`parts/lens-rig.ts`): over the battery the glass clears into the separator enlarged
 * (`parts/paste-view.ts`), the paste's particles squeezing through the deposit and sticking, and the strip runs
 * full and pulses `orange`; the camera pushes in. Goal: the lens over the battery for 2 s.
 */
import { CircleGeometry, Mesh, MeshBasicMaterial, Vector2, Vector3 } from 'three';
import { createHitLens } from '@circuit/shared/copper/hit-lens';
import { loadCurrent, LAMP_WORK } from '@circuit/shared/stage';
import { caption } from '../content';
import type { StepFactory } from '../chapter';
import { phoneMeter } from '../world';
import { lensRig } from '../parts/lens-rig';
import { createPasteView } from '../parts/paste-view';
import { stepScrub, scrub } from '../parts/scrub';

/** Seconds over the battery for the goal. */
const DWELL = 2;
/** The strip over the lamp: the hits there go as the current squared, and the dead battery's is a third of
 *  the working one — the script's «середня» (VISUAL §5.8); over the dead battery it is full. */
const LAMP_FILL = Math.min(1, 0.3 + 0.7 * (loadCurrent(1) / LAMP_WORK.amps));
/** The rail counts as «over the battery» from here. */
const ON_BATTERY = 0.93;

export const innerStep: StepFactory = ({ ctx, world: dw, here, reached, reach }) => {
  const { stand } = dw;
  const lens = stand.tools.lens;
  const rig = lensRig(lens, dw.shot('innerWide').position as [number, number, number]);
  dw.world.afterLens = (dt) => rig.update(dt);
  const strip = createHitLens();
  lens.group.add(strip.group);
  const paste = createPasteView();
  lens.group.add(paste.group);
  const stripShown = scrub(0, 0.3);
  const on = (): boolean => here('inner');
  let held = false;
  let dwell = 0;
  let pushed = false;
  let k0 = 0;
  let p0 = 0;
  const a = new Vector3();
  const b = new Vector3();
  const sa = new Vector2();
  const sb = new Vector2();
  const top = new Vector3();
  const tmp = new Vector3();
  const hit = new Mesh(
    new CircleGeometry(0.62, 32),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = 'drain-lens-hit';
  lens.group.add(hit);
  const ready = (): boolean => on() && rig.arrive.shown > 0.98 && stripShown.shown > 0.9;
  /** The hand's place on the rail: its projection on the screen segment lamp → battery. */
  const along = (ndc: Vector2): number => {
    stand.base.frame.localToWorld(a.copy(rig.lamp.position)).project(ctx.camera.camera);
    stand.base.frame.localToWorld(b.copy(rig.battery.position)).project(ctx.camera.camera);
    sa.set(a.x, a.y);
    sb.set(b.x, b.y);
    const d = sb.clone().sub(sa);
    return ndc.clone().sub(sa).dot(d) / Math.max(d.lengthSq(), 1e-6);
  };
  ctx.input.register(hit, {
    cursor: 'grab',
    enabled: ready,
    dragStart: (e) => {
      held = true;
      k0 = rig.rail.shown;
      p0 = along(e.ndc);
      rig.rail.drag = true;
    },
    drag: (e) => {
      if (held) rig.rail.target = Math.min(Math.max(k0 + along(e.ndc) - p0, 0), 1);
    },
    dragEnd: () => {
      held = false;
      rig.rail.drag = false;
      rig.rail.target = rig.rail.shown > 0.5 ? 1 : 0;
    },
  });
  ctx.qa.probe('lens-hit', hit);
  ctx.qa.probe('battery-spot', () => stand.base.frame.localToWorld(tmp.copy(rig.battery.position)));
  ctx.qa.expose('inner', () => ({
    rail: rig.rail.shown,
    arrive: rig.arrive.shown,
    dwell,
    held,
    stuck: paste.stuck,
  }));

  return {
    spec: { ...dw.state('innerWide'), cameraMove: { duration: 1.8 } },
    ui: {
      goal: () => reached('inner'),
      callouts: [
        phoneMeter(ctx, dw, () => here('inner')),
        {
          anchor: () => lens.group.localToWorld(top.set(0, 0.6, 0)),
          text: caption('inner', 0),
          side: 'up',
          visible: () => ready() && !held && (rig.rail.shown < 0.05 || rig.rail.shown > ON_BATTERY),
        },
        {
          anchor: paste.anchors.particles,
          text: caption('inner', 1),
          side: 'right',
          visible: () => ready() && rig.rail.shown > ON_BATTERY && !held,
        },
        {
          anchor: paste.anchors.deposit,
          text: caption('inner', 2),
          side: 'left',
          visible: () => ready() && rig.rail.shown > ON_BATTERY && !held,
        },
      ],
    },
    enter(info) {
      dw.meter.want = 1;
      dw.meter.probes = 1;
      dw.meter.needle = 'battery';
      dw.counter.want = 0;
      dw.hours.target = 8;
      dw.cut.target = 0;
      held = false;
      dwell = 0;
      pushed = false;
      rig.arrive.target = 1;
      rig.rail.drag = false;
      rig.rail.target = 0;
      stripShown.target = 1;
      if (info.instant) {
        rig.arrive.shown = 1;
        rig.rail.shown = 0;
        stripShown.shown = 1;
      }
    },
    leave() {
      held = false;
      rig.rail.drag = false;
      // the lens goes home from wherever it is; the strip and the view fade (`late`)
      rig.arrive.target = 0;
      stripShown.target = 0;
    },
    update(dt) {
      if (!on()) return;
      const over = rig.rail.shown > ON_BATTERY;
      dwell = over ? dwell + dt : 0;
      if (dwell >= DWELL && !reached('inner')) reach('inner');
      if (over && !held && !pushed) {
        pushed = true;
        ctx.camera.go('inner', { duration: 1.6, ease: 'sine.inOut' });
      } else if (pushed && rig.rail.shown < 0.6) {
        pushed = false;
        ctx.camera.go('innerWide', { duration: 1.4, ease: 'sine.inOut' });
      }
    },
    late(dt, t) {
      stepScrub(stripShown, dt);
      const k = Math.min(Math.max(rig.rail.shown, 0), 1);
      const nearBattery = Math.min(Math.max((k - 0.55) / 0.4, 0), 1);
      const e = nearBattery * nearBattery * (3 - 2 * nearBattery);
      strip.shown = stripShown.shown * Math.min(rig.arrive.shown * 1.5, 1);
      strip.fill = LAMP_FILL + (1 - LAMP_FILL) * e;
      // the lamp's glass stays frosted (chapter 6 looked inside); over the battery it clears into the view
      strip.frost = (1 - e) * Math.min(1, Math.max(0, 1 - k / 0.5)) * strip.shown;
      strip.light = 0.55 + 0.45 * stand.glow;
      strip.update(dt, t);
      paste.shown = e * strip.shown;
      paste.light = 0.75;
      paste.update(dt, t);
    },
  };
};
