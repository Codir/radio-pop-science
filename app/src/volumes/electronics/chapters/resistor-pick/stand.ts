/**
 * The chapter's facade over the bench of the volume: the step stand of `@electronics/shared/steps` (`createStepStand`)
 * — the bench mounted once, the magnifier's door into a part (steps `bands` and `series`, one door for both: going
 * from one to the other the camera stays where it is, `keepDoor`), its lens keeper and the ladder «де ми», the names
 * under the pointer of the things a step keeps in place, a step's own board. Steps put their own boards and say what
 * the hand may take.
 */
import type { ChapterContext } from '@/engine/api';
import { createStepStand, type StepStand } from '@electronics/shared/steps';

export type PickStand = StepStand;

export function createPickStand(ctx: ChapterContext): PickStand {
  return createStepStand(ctx, { keepDoor: true });
}
