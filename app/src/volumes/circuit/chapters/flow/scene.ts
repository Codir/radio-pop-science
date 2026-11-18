/**
 * Orchestrator only: the stand (`stand.ts`) → the eight step modules → `world.define` + `stepUi.define` → update
 * routing. Every step is a state of the stand reached by travel (random access, deep links); what the reader did
 * inside a step lives in that step's module and is re-derived on entry.
 */
import { damp, defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import {
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import { borderOf } from '@circuit/shared/world';
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
  // the neighbour the reader comes from (null: a deep link): the first frame is the border frame (shared/world/border.ts)
  const before = ctx.store.get();
  let from = before.volumeId === ctx.manifest.volume && before.chapterId !== ctx.manifest.id ? before.chapterId : null;
  let leaving = false;
  /** The chapter's own things off the stand (the border frame): every wire end in, no frame, lens or water. */
  const tidy = (seconds: number): void => {
    for (const g of [stand.endOut, stand.counter.shown, stand.lenses.presence, stand.waterMorph, stand.swSeat, stand.jumperSeat])
      if (seconds > 0) g.go(0, seconds);
      else g.set(0);
    stand.world.lensPose = null;
    stand.glow.intensity = 0;
  };
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
      leaving = false;
      stand.world.enterStep(id, info);
      if (info.instant) stand.snap();
      // arriving across a border: the stand as the neighbour left it, then the step's own entry plays from there
      const again = { ...info, instant: false };
      const border = from === null ? null : borderOf(ctx.manifest.id, from);
      if (info.from === null && stand.world.border.arrive(id, from, { then: () => steps[id as StepId].enter?.(again) })) {
        tidy(0);
        // the slider is this chapter's own part: on the border it stands as the switch does there
        stand.sw.closed = border?.closed === 1;
        stand.sw.snap();
      }
      from = null;
    },
    leaveChapter(to) {
      steps[stage.current as StepId]?.leave?.();
      leaving = true;
      tidy(1.2);
      // the slider goes where the border's switch is (to `resistance`: closed — the lamp lights as the reader goes on)
      stand.sw.closed = borderOf(ctx.manifest.id, to.chapterId)?.closed === 1;
      const there = stand.world.border.leave(to.chapterId);
      const off = [stand.endOut, stand.counter.shown, stand.lenses.presence, stand.waterMorph];
      return there ? () => there() && off.every((g) => g.value < 0.005) : null;
    },
    update(dt, t) {
      if (!leaving) steps[stage.current as StepId]?.update?.(dt, t);
      stand.update(dt, t);
      // «0,3 A» on the lamp's base lights up faintly at the takeaway of `count` (VISUAL §5.5) and fades elsewhere
      const print = stand.stage.stand.bulb.print;
      const lit = stage.current === 'count' && sessionGoals.has('count') ? 1 : 0;
      if (print) print.glow = Math.abs(lit - print.glow) < 0.01 ? lit : damp(print.glow, lit, 2.5, dt);
    },
  };
});
