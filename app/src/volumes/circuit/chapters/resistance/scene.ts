/**
 * Orchestrator only: the stand (`stand.ts`) → the four step modules → `world.define` + `stepUi.define` → update
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
import { createResistanceStand } from './stand';
import { bumpsStep } from './steps/01-bumps';
import { heatStep } from './steps/02-heat';
import { shapeStep } from './steps/03-shape';
import { balanceStep } from './steps/04-balance';

const FACTORIES: Record<StepId, StepFactory> = {
  bumps: bumpsStep,
  heat: heatStep,
  shape: shapeStep,
  balance: balanceStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const stand = createResistanceStand(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const chapter: Chapter = {
    ctx,
    ui,
    stand,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
    here: (s) => stage.current === s,
  };
  // the chapter on screen while this one loads: from a neighbour the reader arrives by the dive from the stand
  const before = ctx.store.get();
  let diveIn = before.volumeId === ctx.manifest.volume && before.chapterId !== ctx.manifest.id;
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
  ctx.qa.expose('motion', () => ({
    camera: ctx.camera.camera.position.toArray(),
    lensUse: stand.world.value('lens'),
    window: stand.world.value('window'),
    deep: stand.world.deep,
    stretch: stand.stretch.value / 40,
    thermo: stand.thermoShown.value,
    frame: stand.frameShown.value,
    heat: stand.copper.lattice.heat,
  }));
  ctx.qa.expose('resistance', () => ({
    step: stage.current,
    glow: stand.stage.glow,
    flying: stand.world.flying,
    deep: Math.round(stand.world.deep * 1000) / 1000,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));
  return {
    enterStep(id, info) {
      stand.world.enterStep(id, info);
      if (info.instant) stand.snap();
      if (diveIn && id === 'bumps' && info.from === null) stand.diveIn();
      diveIn = false;
    },
    update(dt, t) {
      steps[stage.current as StepId]?.update?.(dt, t);
      stand.update(dt, t);
    },
  };
});
