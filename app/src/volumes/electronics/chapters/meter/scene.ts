/**
 * Orchestrator only: the stand (`stand.ts`: the bench mounted once, its speaker in sound) → the six step modules →
 * `stage.define` + `stepUi.define` → update routing. Every step puts the amplifier on the board on entry
 * (`bench.preset`: new parts under the preset's ids, whole) and sets the switch, the player and the instruments, so a
 * deep link and a way back land on the same state; what the reader did inside a step lives in that step's module and
 * starts again on entry. The instruments slide in and out with the steps' params (0.6 s).
 */
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { PLAYER_ID, SWITCH_ID } from '@electronics/shared/steps';
import { sessionGoals, STEP_IDS, type Chapter, type StepFactory, type StepId, type StepModule } from './chapter';
import { createMeterStand } from './stand';
import { voltsStep } from './steps/01-volts';
import { ampsStep } from './steps/02-amps';
import { flatStep } from './steps/03-flat';
import { waveStep } from './steps/04-wave';
import { notesStep } from './steps/05-notes';
import { twiceStep } from './steps/06-twice';

const FACTORIES: Record<StepId, StepFactory> = {
  volts: voltsStep,
  amps: ampsStep,
  flat: flatStep,
  wave: waveStep,
  notes: notesStep,
  twice: twiceStep,
};

export default defineScene((ctx) => {
  const { stage } = ctx;
  const stand = createMeterStand(ctx);
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
  // the instruments slide in and out with the steps that take them (VISUAL §2: 0.6 s)
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
  ctx.qa.expose('meter', () => ({
    step: stage.current,
    camera: ctx.camera.camera.position.toArray().map((v) => Math.round(v * 100) / 100),
    instruments: { meter: bench.meter, scope: bench.scope },
    playing: stand.playing(),
    closed: bench.closed,
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
      // the dock's toggles show the switch and the player as they are (a step sets them, a tap flips them)
      const closed = bench.closed >= 0.5;
      if (ui.value<boolean>(SWITCH_ID) !== closed) ui.set(SWITCH_ID, closed);
      const playing = stand.playing();
      if (ui.value<boolean>(PLAYER_ID) !== playing) ui.set(PLAYER_ID, playing);
    },
  };
});
