/**
 * The contract between `scene.ts` and the step modules (`steps/NN-<id>.ts`).
 *
 * A step factory gets the chapter, registers what it needs (probes, readers for the checks) and returns its stage
 * state (`spec`), its step UI and its per-frame hooks. Steps share the stand (`stand.ts`: the bench of the volume, the
 * magnifier's door, the names under the pointer) and the session memory of reached goals.
 */
import type { ChapterContext, StepInfo, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { PickStand } from './stand';

/** Step ids in script order; `__tests__/manifest.test.ts` keeps them equal to the generated manifest. */
export const STEP_IDS = ['bands', 'series', 'calc', 'power', 'burn', 'on'] as const;
export type StepId = (typeof STEP_IDS)[number];

/** The steps that look at a part through the magnifier's door: between them the door stays open. */
export const DIVE_STEPS: ReadonlySet<StepId> = new Set<StepId>(['bands', 'series']);
/**
 * Where the dive of `bands` ends and `series` keeps the camera: the door's rail on the floor `part` (from 0.5), short
 * of the cut (`CUT_OPENS` 0.78) — the resistor whole and large, its bands easy to tell (VISUAL §7; the chapter's README
 * gives the sizes measured on its snapshots).
 */
export const DIVE_END = 0.75;

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;
  stand: PickStand;
  /** The goal of the step is reached (this session): the panel shows the takeaway; captions «→ X» appear. */
  reached(step: StepId): boolean;
  reach(step: StepId): void;
  /** The step on screen now is `step`. */
  here(step: StepId): boolean;
}

export interface StepModule {
  /** The declarative stage state of the step (camera, the instruments' params). */
  spec: StepSpec;
  /** Controls, callouts and the goal of the step. */
  ui: StepUiSpec;
  /** After the stage applied the step (also on deep links: honour `info.instant`). Puts the step's own board. */
  enter?(info: StepInfo): void;
  leave?(): void;
  /** Every frame while the step is on screen, before the bench updates. */
  update?(dt: number, t: number): void;
  /** Every frame while the step is on screen, after the bench updated (its model synced, its meter read). */
  late?(dt: number, t: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();
export const sessionGoals = {
  has: (s: StepId): boolean => REACHED.has(s),
  add: (s: StepId): void => void REACHED.add(s),
};
