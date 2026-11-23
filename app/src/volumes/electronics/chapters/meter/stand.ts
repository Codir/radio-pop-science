/**
 * The chapter's facade over the bench of the volume: the step stand of `@electronics/shared/steps` (`createStepStand`)
 * with sound — the bench mounted once with its speaker in sound (the amplifier on the board plays what the player
 * gives it), the player under a tap where a step lets it (its level is the model's setting of the bench's `PLAYER`: 0
 * stopped), the names under the pointer of the instruments' cases and of the player, a step's own board. Steps put
 * their own board, set the switch and the player and say what the hand may take.
 */
import type { ChapterContext } from '@/engine/api';
import { createStepStand, type StepStand } from '@electronics/shared/steps';

export type MeterStand = StepStand;

export function createMeterStand(ctx: ChapterContext): MeterStand {
  return createStepStand(ctx, { sound: true });
}
