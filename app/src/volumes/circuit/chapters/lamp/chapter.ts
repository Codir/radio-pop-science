/**
 * The contract between `scene.ts` and the step modules (`steps/NN-<id>.ts`), as in `wire`.
 *
 * A step factory gets the chapter, registers what it needs (input handlers, probes) and returns its stage state
 * (`spec`), its step UI and its per-frame hooks. Steps share the world (`world.ts`), the switch and the memory of
 * reached goals. `update` runs before the world's update (set the stand's numbers there); `late` runs after it
 * (poses that must win over the stand's own — the magnifier laid somewhere, the camera on a rail).
 */
import type { ChapterContext, InteractionHandlers, StepInfo, StepSpec } from '@/engine/api';
import type { StepUiApi, StepUiSpec } from '@/hud';
import type { Door } from './parts/door';
import type { LensKeeper } from './parts/lens-keeper';
import type { SwitchControl } from './parts/switch';
import type { LampWorld } from './world';

/** Step ids in script order; `__tests__/manifest.test.ts` keeps them equal to the generated manifest. */
export const STEP_IDS = ['inside', 'hot-spot', 'glow', 'energy', 'handover', 'story'] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUiApi<StepId>;
  world: LampWorld;
  /** The stand's switch as a direct control (inert unless a step allows it). */
  switcher: SwitchControl;
  /** The magnifier's pose, call, rim and glass — the chapter's in every step. */
  lens: LensKeeper;
  /** `inside`'s depth rail (the lens leg and the door); later steps rewind it. */
  door: Door;
  /**
   * Fly the camera from where it is to a shot in `seconds` on an arc around the targets (direction slerped,
   * distance log-lerped — never straight through the lamp's glass); the shot is the step's again at the end.
   */
  fly(shot: string, seconds: number): void;
  /** True while such a flight runs. */
  flying(): boolean;
  /** The goal of the step is reached (this session): the panel shows the takeaway; captions «→ X» appear. */
  reached(step: StepId): boolean;
  /** Record that the goal of the step holds now. */
  reach(step: StepId): void;
}

export interface StepModule {
  /** The declarative stage state of the step (camera, params, post). */
  spec: StepSpec;
  /** Controls, callouts and the goal of the step. */
  ui: StepUiSpec;
  /** What the magnifier does under the hand in this step (it is registered once, by the scene). */
  lensInput?: InteractionHandlers;
  /** After the world applied the step (also on deep links: honour `info.instant`). */
  enter?(info: StepInfo): void;
  leave?(): void;
  /** Every frame while the step is on screen, before the world's update. */
  update?(dt: number, t: number): void;
  /** Every frame after the world's update — for EVERY step, on screen or not (check `stage.current`): what a
   *  step left on the stand fades out with the next step's motion. */
  late?(dt: number, t: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

/** Goals reached in this session (module state survives a rebuild of the scene). */
const REACHED = new Set<StepId>();
export const sessionGoals = {
  has: (s: StepId): boolean => REACHED.has(s),
  add: (s: StepId): void => void REACHED.add(s),
};
