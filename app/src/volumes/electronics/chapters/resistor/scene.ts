/**
 * Orchestrator only: the stand (`stand.ts`: the bench mounted once) → the seven step modules → `stage.define` +
 * `stepUi.define` → update routing. Every step puts its own board on entry (`bench.preset`: new parts under the
 * step's ids, whole), so a deep link and a way back land on the same state; what the reader did inside a step lives
 * in that step's module and starts again on entry. The magnifier's door of `inside` flies home before the next step's
 * shot takes the camera.
 */
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import type { BenchShot } from '@electronics/shared/bench';
import { SWITCH_ID } from '@electronics/shared/steps';
import { sessionGoals, STEP_IDS, type Chapter, type StepFactory, type StepId, type StepModule } from './chapter';
import { createResistorStand } from './stand';
import { flashStep } from './steps/01-flash';
import { limitStep } from './steps/02-limit';
import { ohmStep } from './steps/03-ohm';
import { insideStep } from './steps/04-inside';
import { lawStep } from './steps/05-law';
import { shareStep } from './steps/06-share';
import { ampStep } from './steps/07-amp';

const FACTORIES: Record<StepId, StepFactory> = {
  flash: flashStep,
  limit: limitStep,
  ohm: ohmStep,
  inside: insideStep,
  law: lawStep,
  share: shareStep,
  amp: ampStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const stand = createResistorStand(ctx);
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
  ctx.qa.expose('resistor', () => ({
    step: stage.current,
    flying: bench.flying,
    door: stand.door !== null,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));
  return {
    enterStep(id, info) {
      // leaving the dive: the rail flies back to the board's shot (the lens into its holder), then this step's shot
      if (id !== 'inside' && stand.door) stand.closeDoor(info, steps[id as StepId].spec.camera as BenchShot);
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
