/**
 * Orchestrator only: the battery world → the four step modules → `world.define` + `stepUi.define` → update routing.
 * Every step is a state of the world (random access, deep links); what the reader did inside a step lives in that
 * step's module and is re-derived on entry.
 */
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
import { polesStep } from './steps/01-poles';
import { insideStep } from './steps/02-inside';
import { balanceStep } from './steps/03-balance';
import { voltageStep } from './steps/04-voltage';
import { createBatteryWorld } from './world';

const FACTORIES: Record<StepId, StepFactory> = {
  poles: polesStep,
  inside: insideStep,
  balance: balanceStep,
  voltage: voltageStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const bw = createBatteryWorld(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const chapter: Chapter = {
    ctx,
    ui,
    world: bw,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
  };
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)])) as Record<
    StepId,
    StepModule
  >;
  bw.world.define(
    Object.fromEntries(
      STEP_IDS.map((id) => {
        const m = steps[id];
        return [id, { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) }];
      }),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])));

  ctx.qa.expose('battery', () => ({
    step: stage.current,
    cut: bw.cut.shown,
    surplus: bw.cell.surplus,
    lack: bw.cell.lack,
    activity: bw.cell.activity,
    lens: bw.lens.landed,
    gauge: bw.gauge.value,
    touching: bw.gauge.touching,
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 1000) / 1000),
    pointer: bw.scale.pointer,
    meter: bw.gauge.shown,
    moving: ctx.camera.moving,
  }));

  return {
    enterStep(id, info) {
      bw.world.enterStep(id, info);
      if (info.instant) {
        bw.cut.shown = bw.cut.target;
        bw.scale.snap();
      }
    },
    update(dt, t) {
      steps[stage.current as StepId]?.update?.(dt, t);
      bw.update(dt, t);
      bw.late(dt);
    },
  };
});
