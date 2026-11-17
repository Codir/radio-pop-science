/**
 * Orchestrator only: the world → the five step modules → `world.define` + `stepUi.define` → update routing.
 * Every step re-derives its state on entry (deep links = the frame a reader arrives at).
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import {
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import { caption } from './content';
import { switchControl } from './parts/switch';
import { hoursStep } from './steps/01-hours';
import { spentStep } from './steps/02-spent';
import { ghostStep, ghostSwitchLive } from './steps/03-ghost';
import { innerStep } from './steps/04-inner';
import { lifeStep } from './steps/05-life';
import { createDrainWorld } from './world';

const FACTORIES: Record<StepId, StepFactory> = {
  hours: hoursStep,
  spent: spentStep,
  ghost: ghostStep,
  inner: innerStep,
  life: lifeStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const world = createDrainWorld(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const switcher = switchControl(
    ctx,
    world.world,
    caption('ghost', 1),
    () => stage.current === 'ghost' && ghostSwitchLive(world),
  );
  const chapter: Chapter = {
    ctx,
    ui,
    world,
    switcher,
    here: (id) => stage.current === id,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
  };
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)])) as Record<
    StepId,
    StepModule
  >;
  world.world.define(
    Object.fromEntries(
      STEP_IDS.map((id) => {
        const m = steps[id];
        return [id, { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) }];
      }),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])));

  ctx.qa.expose('drain', () => ({
    step: stage.current,
    hours: world.hours.shown,
    life: world.life,
    volts: world.volts,
    amps: world.amps,
    glow: world.stand.glow,
    cut: world.cut.shown,
    closed: switcher.closed,
    touching: world.gauge.touching,
    meter: world.gauge.shown,
    frame: world.frame.shown,
    cradle: { ...world.cradle },
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 1000) / 1000),
    cameraRaw: ctx.camera.camera.position.toArray(),
    lens: world.stand.tools.lens.group.getWorldPosition(new Vector3()).toArray(),
    battery: world.stand.stand.battery.group.getWorldPosition(new Vector3()).toArray(),
    moving: ctx.camera.moving,
  }));

  return {
    enterStep(id, info) {
      world.world.enterStep(id, info);
    },
    update(dt, t) {
      steps[stage.current as StepId]?.update?.(dt, t);
      world.update(dt, t);
      for (const id of STEP_IDS) steps[id].late?.(dt, t);
      switcher.update(dt);
    },
  };
});
