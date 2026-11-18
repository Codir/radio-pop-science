/**
 * Orchestrator only: the composed world + the props on the table → the six step modules → `world.define` +
 * `stepUi.define` → update routing. Every step is a state of the world (random access, deep links); what the
 * reader did inside a step lives in that step's module and is re-derived on entry.
 */
import { Vector3 } from 'three';
import { defineScene, type StepInfo } from '@/engine/api';
import { stepUi, type StepUiApi } from '@/hud';
import { floorLadder } from '@/hud-dom/journey';
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
import { BALLOON_REST } from './layout';

export default defineScene((ctx) => {
  const { stage } = ctx;
  const world = createChargeWorld(ctx);
  const ui = stepUi(ctx) as StepUiApi<StepId>;
  const ladder = floorLadder(ctx, { floor: () => (world.world.deep > 0.01 ? world.world.floorId : null) });
  // the chapter on screen while this one loads: the reader arrives from its last frame, the stand (border.ts)
  const before = ctx.store.get();
  let from = before.volumeId === ctx.manifest.volume && before.chapterId !== ctx.manifest.id ? before.chapterId : null;
  /** The step entered on arrival, to be played again from the border frame on the first frame on screen. */
  let replay: { id: StepId; info: StepInfo } | null = null;
  let leaving = false;
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
      leaving = false;
      world.world.enterStep(id, info);
      // the lens leaves the chapter's own places for its holder when a step does not use it
      if (id !== 'charge') view.want = 0;
      if (id !== 'charge' && id !== 'shift') keeper.home(1.1, info.instant);
      // the neighbour ended on the border frame (the stand, the lens home): start there, then play the step's
      // own entry (the camera to the table, the lens to its place) as a reader arriving from the previous step
      const again = { id: id as StepId, info };
      const then = (): void => {
        replay = again;
        world.props.shown = 1;
      };
      if (info.from === null && world.world.border.arrive(id, from, { camera: false, then })) {
        keeper.home(0, true);
        view.want = 0;
        // the border frame has no props on the table: they grow into their places after the hold
        world.props.shown = 0;
        world.props.snapPresence();
      } else world.props.shown = 1;
      from = null;
    },
    leaveChapter(to) {
      const id = stage.current as StepId;
      steps[id]?.leave?.();
      leaving = true;
      // the lens to its holder, the balloon to its place on the table (outside the stand shot)
      view.want = 0;
      keeper.home(1.6);
      rub.hand.drive(null);
      rub.hand.home = BALLOON_REST;
      world.props.shown = 0;
      const there = world.world.border.leave(to.chapterId);
      return there ? () => there() && !keeper.active && world.props.presence <= 1e-3 : null;
    },
    update(dt, t) {
      world.update(dt, t);
      if (replay) {
        const { id, info } = replay;
        replay = null;
        const { camera, cameraMove } = steps[id].spec;
        if (camera !== undefined) ctx.camera.go(camera, { duration: cameraMove?.duration ?? 2.6, ease: 'sine.inOut' });
        steps[id].enter?.({ ...info, instant: false });
      }
      if (!leaving) steps[stage.current as StepId]?.update?.(dt, t);
      for (const id of STEP_IDS) steps[id].tick?.(dt, t);
      rub.hand.update(dt);
      view.update(dt, t);
      ladder.update();
    },
  };
});
