/**
 * The contract between `scene.ts` and the step modules (`steps/NN-<id>.ts`), as in `lamp`.
 *
 * A step factory gets the chapter, registers what it needs (input handlers, probes) and returns its stage state
 * (`spec`), its step UI and its per-frame hooks. Steps share the world (`world.ts`: the hours of the battery, the
 * meter, the counter frame, the section, the spare battery), the switch and the memory of reached goals.
 * `update` runs before the world's update (set the world's wants there); `late` after it.
 */
import type { ChapterContext, StepInfo, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { SwitchControl } from './parts/switch';
import type { DrainWorld } from './world';

/** Step ids in script order; `__tests__/manifest.test.ts` keeps them equal to the generated manifest. */
export const STEP_IDS = ['hours', 'spent', 'ghost', 'inner', 'life'] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;
  world: DrainWorld;
  /** The stand's switch as a direct control (inert unless a step allows it). */
  switcher: SwitchControl;
  /** The step on screen is `id`. */
  here(id: StepId): boolean;
  /** The goal of the step is reached (this session): the panel shows the takeaway. */
  reached(step: StepId): boolean;
  /** Record that the goal of the step holds now. */
  reach(step: StepId): void;
}

export interface StepModule {
  /** The declarative stage state of the step (camera, params, post). */
  spec: StepSpec;
  /** Controls, callouts and the goal of the step. */
  ui: StepUiSpec;
  /** After the world applied the step (also on deep links: honour `info.instant`). */
  enter?(info: StepInfo): void;
  leave?(): void;
  /** Every frame while the step is on screen, before the world's update. */
  update?(dt: number, t: number): void;
  /** Every frame after the world's update, for EVERY step (check `here`): what a step left fades out. */
  late?(dt: number, t: number): void;
  /** Leaving the chapter from this step: bring it to the chapter's end state; returns «there» (`leaveChapter`). */
  finish?(): () => boolean;
  /** Arriving from the next chapter into this step: start from the chapter's end state and play back to the step. */
  rewind?(play: boolean): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();
export const sessionGoals = {
  has: (s: StepId): boolean => REACHED.has(s),
  add: (s: StepId): void => void REACHED.add(s),
};
