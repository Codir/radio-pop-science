import { defineChapter } from '@/engine/api';

/**
 * Showcase of the crawl of `@circuit/shared/stage` (DECISIONS §60 r–t): the snail scene as ONE slider of true
 * time — the snail creeps along the wire itself, the magnifier lies on the start of that wire with a scale as
 * long as one spark really gets in that time. Development only; `circuit/prologue/riddle` mounts the same scene.
 */
export const CRAWL_STEPS = {
  stand: {
    title: 'Стенд: до і після сцени',
    body: 'Звідси сцена з равликом приходить одним рухом і сюди ж іде: лупа злітає на початок дроту, проступають поділки, виповзає равлик.',
  },
  crawl: {
    title: 'Равлик уздовж дроту',
    body: 'Посунь час. Лампа світить одразу. Равлик повзе вздовж дроту, а іскорки в лупі метушаться і ледве посуваються шкалою.',
  },
} as const;

export default defineChapter({
  id: '_sandbox-circuit-crawl',
  order: 9011,
  group: 'em',
  title: 'Пісочниця: равлик уздовж дроту',
  subtitle: 'Один повзунок часу',
  axisLabel: '10⁻¹ m',
  axisValue: -1,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  steps: Object.entries(CRAWL_STEPS).map(([id, s]) => ({ id, title: s.title, blurb: s.body })),
  load: () => import('./scene'),
  dev: true,
});
