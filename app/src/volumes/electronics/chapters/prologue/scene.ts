/**
 * Orchestrator only: the stand (`stand.ts`: the bench mounted once, its speaker in sound) → the five step modules →
 * `stage.define` + `stepUi.define` → update routing. Every step puts the amplifier on the board on entry
 * (`stand.board`: new parts under the preset's ids, whole; the model from its operating point) and sets the plugs, the
 * switch, the player, the knob and what the hand may take, so a deep link and a way back land on the same state; what
 * the reader did inside a step lives in that step's module and starts again on entry. The oscilloscope slides in and
 * out with `riddle`'s param (0.6 s).
 */
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { SWITCH_ID } from '@electronics/shared/steps';
import { sessionGoals, STEP_IDS, type Chapter, type StepFactory, type StepId, type StepModule } from './chapter';
import { createPrologueStand } from './stand';
import { quietStep } from './steps/01-quiet';
import { loudStep } from './steps/02-loud';
import { standStep } from './steps/03-stand';
import { riddleStep } from './steps/04-riddle';
import { mapStep } from './steps/05-map';

const FACTORIES: Record<StepId, StepFactory> = {
  quiet: quietStep,
  loud: loudStep,
  stand: standStep,
  riddle: riddleStep,
  map: mapStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const stand = createPrologueStand(ctx);
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
  // the instruments slide in and out with the steps that take them (VISUAL §2: 0.6 s); the multimeter never comes here
  stage.param('meter', 0, { duration: 0.6, onChange: (v: number) => (bench.meter = v) });
  stage.param('scope', 0, { duration: 0.6, onChange: (v: number) => (bench.scope = v) });
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
  ctx.qa.expose('prologue', () => ({
    step: stage.current,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    instruments: { meter: bench.meter, scope: bench.scope },
    playing: stand.playing(),
    taps: stand.taps,
    closed: bench.closed,
    knob: stand.knob(),
    crest: stand.crest(),
    from: stand.from,
    soundOff: stand.soundOff(),
    call: stand.call.id,
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
  }));
  return {
    enterStep(_id, info) {
      if (info.instant) stand.snap();
    },
    update(dt, t) {
      current()?.update?.(dt, t);
      stand.update(dt, t);
      current()?.late?.(dt, t);
      // the dock's toggle shows the switch as it is (a step sets it, a tap on the slider flips it)
      const closed = bench.closed >= 0.5;
      if (stage.current === 'loud' && ui.value<boolean>(SWITCH_ID) !== closed) ui.set(SWITCH_ID, closed);
    },
  };
});
