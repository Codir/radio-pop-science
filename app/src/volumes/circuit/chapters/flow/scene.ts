/**
 * Orchestrator only: the stand (`stand.ts`) → the eight step modules → `world.define` + `stepUi.define` → update
 * routing. Every step is a state of the stand reached by travel (random access, deep links); what the reader did
 * inside a step lives in that step's module and is re-derived on entry.
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
import { createFlowStand } from './stand';
import { connectStep } from './steps/01-connect';
import { countStep } from './steps/02-count';
import { sameStep } from './steps/03-same';
import { loopStep } from './steps/04-loop';
import { pumpStep } from './steps/05-pump';
import { snailStep } from './steps/06-snail';
import { togetherStep } from './steps/07-together';
import { pushStep } from './steps/08-push';

const FACTORIES: Record<StepId, StepFactory> = {
  connect: connectStep,
  count: countStep,
  same: sameStep,
  loop: loopStep,
  pump: pumpStep,
  snail: snailStep,
  together: togetherStep,
  push: pushStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const stand = createFlowStand(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const chapter: Chapter = {
    ctx,
    ui,
    stand,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
    here: (s) => stage.current === s,
  };
  const steps = Object.fromEntries(STEP_IDS.map((id) => [id, FACTORIES[id](chapter)])) as Record<
    StepId,
    StepModule
  >;
  stand.world.define(
    Object.fromEntries(
      STEP_IDS.map((id) => {
        const m = steps[id];
        return [id, { ...m.spec, enter: m.enter?.bind(m), leave: m.leave?.bind(m) }];
      }),
    ),
  );
  ui.define(Object.fromEntries(STEP_IDS.map((id) => [id, steps[id].ui])));
  // QA: every number that must travel, never jump (continuity checks sample it frame by frame)
  ctx.qa.expose('motion', () => ({
    camera: ctx.camera.camera.position.toArray(),
    end: stand.endOut.value,
    counter: stand.counter.shown.value,
    seat: stand.swSeat.value,
    jumper: stand.jumperSeat.value,
    lenses: stand.lenses.presence.value,
    water: stand.waterMorph.value,
    crawl: stand.stage.crawlScene.presence,
    lensUse: stand.world.value('lens'),
    window: stand.world.value('window'),
  }));
  ctx.qa.expose('flow', () => ({
    step: stage.current,
    glow: stand.stage.glow,
    whole: stand.whole,
    flying: stand.world.flying,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));
  return {
    enterStep(id, info) {
      stand.world.enterStep(id, info);
      if (info.instant) stand.snap();
    },
    update(dt, t) {
      steps[stage.current as StepId]?.update?.(dt, t);
      stand.update(dt, t);
    },
  };
});
