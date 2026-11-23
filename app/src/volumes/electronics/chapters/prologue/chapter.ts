/**
 * The contract between `scene.ts` and the step modules (`steps/NN-<id>.ts`).
 *
 * A step factory gets the chapter, registers what it needs (probes, readers for the checks) and returns its stage
 * state (`spec`), its step UI and its per-frame hooks. Steps share the stand (`stand.ts`: the bench of the volume with
 * its speaker in sound, the player under a tap, the names under the pointer, the wave on the speaker) and the session
 * memory of reached goals.
 */
import type { ChapterContext, StepInfo, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { PrologueStand } from './stand';

/** Step ids in script order; `__tests__/manifest.test.ts` keeps them equal to the generated manifest. */
export const STEP_IDS = ['quiet', 'loud', 'stand', 'riddle', 'map'] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;
  stand: PrologueStand;
  /** The goal of the step is reached (this session): the panel shows the takeaway; captions «→ X» appear. */
  reached(step: StepId): boolean;
  reach(step: StepId): void;
  /** The step on screen now is `step`. */
  here(step: StepId): boolean;
}

export interface StepModule {
  /** The declarative stage state of the step (camera, the instruments' params, the step's post). */
  spec: StepSpec;
  /** Controls, callouts, the board and the goal of the step. */
  ui: StepUiSpec;
  /** After the stage applied the step (also on deep links: honour `info.instant`). Puts the step's own board. */
  enter?(info: StepInfo): void;
  leave?(): void;
  /** Every frame while the step is on screen, before the bench updates. */
  update?(dt: number, t: number): void;
  /** Every frame while the step is on screen, after the bench updated (its model synced, its sound fed). */
  late?(dt: number, t: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();
export const sessionGoals = {
  has: (s: StepId): boolean => REACHED.has(s),
  add: (s: StepId): void => void REACHED.add(s),
};
