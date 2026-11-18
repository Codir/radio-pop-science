/**
 * Chapter-wide contract of `lab`. Step ids = the quests of the model plus the free lab, in the order of the
 * document; `__tests__/manifest.test.ts` keeps them identical to the generated export.
 */
import { QUEST_IDS } from '@alchemy/sim/lab';

export const STEP_IDS = [...QUEST_IDS, 'free'] as const;
export type StepId = (typeof STEP_IDS)[number];
