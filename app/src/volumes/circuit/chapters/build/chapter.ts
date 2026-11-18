/**
 * The contract between `scene.ts` and the step modules (`steps/NN-<id>.ts`), as in `lamp`.
 *
 * A step factory gets the chapter, registers what it needs (input handlers, probes) and returns its stage state
 * (`spec`), its step UI and its per-frame hooks. Steps share the bench (`bench.ts`: world, wiring, switch, lamp)
 * and the memory of reached goals. `update` runs before the world's update; `late` after it, for EVERY step (what
 * a step left on the stand travels away with the next step's motion).
 */
import type { ChapterContext, InteractionHandlers, StepInfo, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { Bench } from './bench';
import type { LensKeeper } from './parts/lens-keeper';
import type { Magnifier } from './parts/magnifier';

/** Step ids in script order; `__tests__/manifest.test.ts` keeps them equal to the generated manifest. */
export const STEP_IDS = ['first-light', 'find-fault', 'short', 'flashlight'] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;
  bench: Bench;
  /** The magnifier's pose and call — the chapter's in every step. */
  lens: LensKeeper;
  /** The enlarged picture inside the ring (`find-fault`). */
  magnifier: Magnifier;
  /** The goal of the step is reached (this session). */
  reached(step: StepId): boolean;
  reach(step: StepId): void;
  /** The step on screen now is `step`. */
  here(step: StepId): boolean;
}

export interface StepModule {
  spec: StepSpec;
  ui: StepUiSpec;
  /** What the magnifier does under the hand in this step (registered once, by the scene). */
  lensInput?: InteractionHandlers;
  enter?(info: StepInfo): void;
  leave?(): void;
  update?(dt: number, t: number): void;
  late?(dt: number, t: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();
export const sessionGoals = {
  has: (s: StepId): boolean => REACHED.has(s),
  add: (s: StepId): void => void REACHED.add(s),
};
