/**
 * Orchestrator only: the stand (`stand.ts`: the bench mounted once) → the six step modules → `stage.define` +
 * `stepUi.define` → update routing. Every step puts its own board on entry (`bench.preset`: new parts under the
 * step's ids, whole), so a deep link and a way back land on the same state; what the reader did inside a step lives
 * in that step's module and starts again on entry. The magnifier's door of `bands` and `series` stays open between
 * the two and flies home before the next step's shot takes the camera.
 */
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import type { BenchShot } from '@electronics/shared/bench';
import {
  DIVE_STEPS,
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import { SWITCH_ID } from './parts/dock';
import { createPickStand } from './stand';
import { bandsStep } from './steps/01-bands';
import { seriesStep } from './steps/02-series';
import { calcStep } from './steps/03-calc';
import { powerStep } from './steps/04-power';
import { burnStep } from './steps/05-burn';
import { onStep } from './steps/06-on';

const FACTORIES: Record<StepId, StepFactory> = {
  bands: bandsStep,
  series: seriesStep,
  calc: calcStep,
  power: powerStep,
  burn: burnStep,
  on: onStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const stand = createPickStand(ctx);
  const { bench } = stand;
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const chapter: Chapter = {
    ctx,
    ui,
    stand,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
    here: (s) => stage.current === s,
  };
  // the multimeter slides in and out with the steps that take it (VISUAL §2: 0.6 s)
  stage.param('meter', 0, { duration: 0.6, onChange: (v: number) => (bench.meter = v) });
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)])) as Record<StepId, StepModule>;
  stage.define(
    Object.fromEntries(
      STEP_IDS.map((id) => {
        const m = steps[id];
        return [id, { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) }];
      }),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])));
  const current = (): StepModule | undefined => steps[stage.current as StepId];
  ctx.qa.expose('motion', () => ({ camera: ctx.camera.camera.position.toArray() }));
  ctx.qa.expose('resistor-pick', () => ({
    step: stage.current,
    flying: bench.flying,
    door: stand.door !== null,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));
  return {
    enterStep(id, info) {
      // leaving the dive: the rail flies back to the board's shot (the lens into its holder), then this step's shot
      if (!DIVE_STEPS.has(id as StepId) && stand.door)
        stand.closeDoor(info, steps[id as StepId].spec.camera as BenchShot);
      if (info.instant) stand.snap();
    },
    update(dt, t) {
      current()?.update?.(dt, t);
      stand.update(dt, t);
      current()?.late?.(dt, t);
      // the dock's toggle shows the battery's switch as it is (a step sets it, a tap on the slider flips it)
      const on = bench.closed >= 0.5;
      if (ui.value<boolean>(SWITCH_ID) !== on) ui.set(SWITCH_ID, on);
    },
  };
});
