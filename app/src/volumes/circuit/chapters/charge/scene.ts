/**
 * Orchestrator only: the composed world + the props on the table → the six step modules → `world.define` +
 * `stepUi.define` → update routing. Every step is a state of the world (random access, deep links); what the
 * reader did inside a step lives in that step's module and is re-derived on entry.
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { floorLadder } from '@/hud-dom/journey';
import { setWhere } from '@/hud/where';
import {
  sessionGoals,
  STEP_IDS,
  type Chapter,
  type StepFactory,
  type StepId,
  type StepModule,
} from './chapter';
import { createLensKeeper } from './parts/lens-keeper';
import { createLensView } from './parts/lens-view';
import { createRubState } from './parts/rub-state';
import { rubStep } from './steps/01-rub';
import { chargeStep } from './steps/02-charge';
import { signsStep } from './steps/03-signs';
import { neutralStep } from './steps/04-neutral';
import { fieldStep } from './steps/05-field';
import { shiftStep } from './steps/06-shift';
import { createChargeWorld } from './world';

/** Seconds of the move from the stand shot (where chapter 1 ended) to the table. */
const ARRIVE = 2.6;

export default defineScene((ctx) => {
  const { stage } = ctx;
  const world = createChargeWorld(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const ladder = floorLadder(ctx, { floor: () => (world.world.deep > 0.01 ? world.world.floorId : null) });
  // the chapter on screen while this one loads: from chapter 1 the reader arrives from its last frame, the stand
  const before = ctx.store.get();
  let fromWire = before.volumeId === ctx.manifest.volume && before.chapterId === 'wire';
  const where = `${ctx.manifest.volume}/${ctx.manifest.id}`;
  const rub = createRubState(ctx, world.props);
  const keeper = createLensKeeper(world.world.stand);
  const view = createLensView(ctx, world.world.stand);
  // the chapter carries the lens itself: laid right after the stand's own pose, so the copper window follows it
  world.world.afterLens = (dt) => keeper.update(dt);

  const chapter: Chapter = {
    ctx,
    ui,
    world,
    reached: (s) => sessionGoals.has(s),
    reach: (s) => sessionGoals.add(s),
  };
  const FACTORIES: Record<StepId, StepFactory> = {
    rub: rubStep(rub),
    charge: chargeStep(rub, keeper, view),
    signs: signsStep(rub),
    neutral: neutralStep,
    field: fieldStep(rub),
    shift: shiftStep(rub, keeper),
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

  ctx.qa.expose('charge', () => ({
    step: stage.current,
    deep: world.world.deep,
    flying: world.world.flying,
    moving: ctx.camera.moving,
    reached: STEP_IDS.filter((s) => sessionGoals.has(s)),
    // for the continuity checks of the QA (per-frame steps of the camera and of the things that move)
    cam: ctx.camera.camera.position.toArray(),
    balloon: world.props.balloon.group.position.toArray(),
    lens: world.world.stand.tools.lens.group.getWorldPosition(new Vector3()).toArray(),
    keeper: keeper.active,
  }));

  return {
    enterStep(id, info) {
      world.world.enterStep(id, info);
      // the lens leaves the chapter's own places for its holder when a step does not use it
      if (id !== 'charge') view.want = 0;
      if (id !== 'charge' && id !== 'shift') keeper.home(1.1, info.instant);
      // chapter 1 ends on the stand shot: the first frame here is that frame, then the camera comes to the table
      if (fromWire && id === 'rub' && info.from === null) {
        ctx.camera.go('stand', { instant: true });
        ctx.camera.go('charge-table', { duration: ARRIVE, ease: 'sine.inOut' });
      }
      fromWire = false;
    },
    update(dt, t) {
      world.update(dt, t);
      steps[stage.current as StepId]?.update?.(dt, t);
      for (const id of STEP_IDS) steps[id].tick?.(dt, t);
      rub.hand.update(dt);
      view.update(dt, t);
      ladder.update();
      // on the table the header's floor chip says «стенд» (the ladder itself shows only below the stand)
      if (world.world.deep <= 0.01) setWhere(where, 'stand');
    },
  };
});
