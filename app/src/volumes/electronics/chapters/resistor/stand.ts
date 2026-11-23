/**
 * The chapter's facade over the bench of the volume: the step stand of `@electronics/shared/steps` (`createStepStand`)
 * — the bench mounted once, the magnifier's door into a part (step `inside`), its lens keeper and the ladder «де ми»,
 * the names under the pointer of the things a step keeps in place, a step's own board. Every visit of `inside` makes
 * its door anew. Steps put their own boards and say what the hand may take.
 */
import type { ChapterContext } from '@/engine/api';
import { createStepStand, type StepStand } from '@electronics/shared/steps';

export type ResistorStand = StepStand;

export function createResistorStand(ctx: ChapterContext): ResistorStand {
  return createStepStand(ctx);
}
