/**
 * Orchestrator only: the world → the six step modules → `world.define` + `stepUi.define` → update routing.
 * Every step re-derives its state on entry (deep links = the frame a reader arrives at). The magnifier (`lens`)
 * and `inside`'s depth rail (`door`) are the chapter's across steps: a step that follows `inside` first rewinds
 * the rail to the stand plan (the way back through the door), then the step's own camera takes over.
 */
import { Vector3 } from 'three';
import { defineScene, type Shot } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { floorLadder } from '@/hud-dom/journey';
import { LENS_LEG } from '@circuit/shared/world/dive';
import {
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import { caption } from './content';
import { createDoor } from './parts/door';
import { cameraRail, type CameraRail } from './parts/rail';
import { lensKeeper } from './parts/lens-keeper';
import { switchControl } from './parts/switch';
import { insideStep } from './steps/01-inside';
import { hotSpotStep } from './steps/02-hot-spot';
import { glowStep } from './steps/03-glow';
import { energyStep } from './steps/04-energy';
import { handoverStep } from './steps/05-handover';
import { storyStep } from './steps/06-story';
import { createLampWorld } from './world';

type V = [number, number, number];

const FACTORIES: Record<StepId, StepFactory> = {
  inside: insideStep,
  'hot-spot': hotSpotStep,
  glow: glowStep,
  energy: energyStep,
  handover: handoverStep,
  story: storyStep,
};
/** Steps where the reader flips the switch by hand. */
const SWITCHING: readonly StepId[] = ['energy', 'handover'];
/** The way back out through the door: seconds for a span of rail positions. */
const homeSeconds = (span: number): number => Math.min(2.2, 0.7 + 1.0 * span);

export default defineScene((ctx) => {
  const { stage } = ctx;
  const world = createLampWorld(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const lens = lensKeeper(world.stand);
  // the close-up lamp all through the chapter: the camera passes the band where the stand's coarse coil would
  // cross-fade into the fine one (4.1 … 3.5 units) in almost every step; at the stand's distance both read alike
  world.lamp.detail = 1;
  const door = createDoor(ctx, world, world.stand);
  const switcher = switchControl(ctx, world.world, caption('energy', 2), () =>
    SWITCHING.includes(stage.current as StepId),
  );
  /** «де ми»: the lamp close-up is the floor «деталь»; the filament's atoms (`story`) are «ряди». */
  const ladder = floorLadder(ctx, {
    floor: () =>
      world.world.deep > 0.01 ? world.world.floorId : door.rail.engaged && door.rail.position > 0.5 ? 'part' : null,
  });
  /** The rail rewinds to the stand plan, then hands the camera to this shot (null: none). */
  let homeTo: string | null | undefined;
  /** A step's own flight (`chapter.fly`) and the shot it ends on. */
  let flight: { rail: CameraRail; to: string; step: string | null } | null = null;

  const chapter: Chapter = {
    ctx,
    ui,
    world,
    switcher,
    lens,
    door,
    fly(to, seconds) {
      const cam = ctx.camera.camera;
      const from: Shot = {
        position: cam.position.toArray() as [number, number, number],
        target: ctx.camera.target.toArray() as [number, number, number],
        fov: cam.fov,
        fit: { center: ctx.camera.target.toArray() as V, radius: cam.position.distanceTo(ctx.camera.target) * 0.24 },
      };
      // to a close-up the last leg is a straight push-in along the shot's own line of sight, from three times its
      // distance: the camera comes from in front, never through the glass or the parts around it
      const end = world.shot(to);
      const aim = new Vector3(...(end.target as [number, number, number]));
      const line = new Vector3(...(end.position as [number, number, number])).sub(aim);
      const close = line.length() < 2.5;
      const back = Math.max(line.length() * 3, 2.4);
      const mid: Shot = {
        ...end,
        position: aim.clone().addScaledVector(line.normalize(), back).toArray() as V,
        fit: { center: aim.toArray() as V, radius: back * 0.24 },
      };
      const rail = cameraRail(ctx, close ? [from, mid, end] : [from, end]);
      rail.snap(0);
      rail.travelTo(close ? 2 : 1, seconds);
      flight = { rail, to, step: stage.current };
    },
    flying: () => flight !== null,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
  };
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)])) as Record<
    StepId,
    StepModule
  >;
  // the magnifier is registered once; the step on screen says what it does
  const lensUse = (): StepModule['lensInput'] => steps[stage.current as StepId]?.lensInput;
  ctx.input.register(world.stand.tools.lens.group, {
    cursor: 'grab',
    tooltip: () => {
      const t = lensUse()?.tooltip;
      return typeof t === 'function' ? t() : (t ?? '');
    },
    enabled: () => !!lensUse() && (lensUse()?.enabled?.() ?? true),
    click: (e) => lensUse()?.click?.(e),
    dragStart: (e) => lensUse()?.dragStart?.(e),
    drag: (e) => lensUse()?.drag?.(e),
    dragEnd: (e) => lensUse()?.dragEnd?.(e),
  });
  world.world.define(
    Object.fromEntries(
      STEP_IDS.map((id) => {
        const m = steps[id];
        return [id, { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) }];
      }),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])));

  ctx.qa.expose('lamp', () => ({
    step: stage.current,
    deep: world.world.deep,
    rail: door.rail.position,
    railEngaged: door.rail.engaged,
    glow: world.stand.glow,
    celsius: world.lamp.celsius,
    closed: switcher.closed,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    cameraRaw: ctx.camera.camera.position.toArray(),
    lens: lens.shown.position.toArray(),
    flight: flight ? { to: flight.to, at: flight.rail.position, step: flight.step } : null,
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));

  return {
    enterStep(id, info) {
      world.world.enterStep(id, info);
      homeTo = undefined;
      if (id !== 'inside' && door.rail.engaged) {
        const camera = steps[id as StepId].spec.camera;
        if (info.instant) door.rail.release();
        else {
          door.rail.travelTo(-LENS_LEG, homeSeconds(door.rail.position + LENS_LEG));
          homeTo = typeof camera === 'string' && camera !== 'stand' ? camera : null;
        }
      }
    },
    update(dt, t) {
      const current = stage.current as StepId;
      steps[current]?.update?.(dt, t);
      world.update(dt, t);
      door.rail.update(dt);
      if (homeTo !== undefined && !door.rail.moving) {
        door.rail.release();
        if (homeTo) ctx.camera.go(homeTo, { duration: 1.6, ease: 'sine.inOut' });
        homeTo = undefined;
      }
      if (flight && flight.step !== stage.current) flight = null;
      if (flight) {
        flight.rail.update(dt);
        // at its end the rail's frame IS the shot (framing carried along): the camera simply stays
        if (!flight.rail.moving) flight = null;
      }
      if (door.rail.engaged) {
        const p = door.rail.position;
        lens.rim = door.rim(p);
        lens.glass = door.glass(p);
        world.lamp.cut = door.cut(p);
      }
      for (const id of STEP_IDS) steps[id].late?.(dt, t);
      lens.late(dt, t);
      world.glow.update(t);
      // the lens window (copper inside the resting lens) follows the pose the keeper has just laid
      if (world.world.window.amount > 0.002) world.world.window.place(world.world.copper.group);
      switcher.update(dt);
      ladder.update();
    },
  };
});
