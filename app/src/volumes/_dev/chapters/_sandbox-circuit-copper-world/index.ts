import { defineChapter } from '@/engine/api';

/**
 * The copper world as the chapters of `circuit` really show it: inside the composed world
 * (`volumes/circuit/shared/world` — the stand above, the flight through the lens, the stand's light). One step
 * per floor and lamp state; walking the steps in order flies the real legs. Development only: the place to
 * judge the hand-over dissolve, the dive and the floor «один атом» without a chapter's step logic.
 */
export const WORLD_STEPS = {
  stand: { title: 'Стенд', blurb: 'Стенд, лампа світить.', deep: 0, closed: 1 },
  'part-stand': {
    title: 'Жила дроту — лише стенд',
    blurb: 'Жила стенда без мідного світу: еталон для порівняння.',
    deep: 1,
    closed: 1,
    standOnly: true,
  },
  'part-stand-off': {
    title: 'Жила дроту — лише стенд, розімкнено',
    blurb: 'Те саме в холодному світлі.',
    deep: 1,
    closed: 0,
    standOnly: true,
  },
  part: { title: 'Жила дроту', blurb: 'Кадр передачі: мідна жила стенда.', deep: 1, closed: 1 },
  'part-off': {
    title: 'Жила дроту, коло розімкнене',
    blurb: 'Той самий кадр у холодному світлі.',
    deep: 1,
    closed: 0,
  },
  rows: { title: 'Ряди атомів', blurb: 'Лампа світить.', deep: 2, closed: 1 },
  'rows-off': { title: 'Ряди атомів, коло розімкнене', blurb: 'Холодне світло.', deep: 2, closed: 0 },
  atom: { title: 'Один атом', blurb: 'Лампа світить.', deep: 3, closed: 1 },
  'atom-off': { title: 'Один атом, коло розімкнене', blurb: 'Холодне світло.', deep: 3, closed: 0 },
  count: {
    title: 'Рамка-лічильник',
    blurb: 'Коло розімкнене: ліворуч і праворуч порівну.',
    deep: 2,
    closed: 0,
    gate: true,
  },
  'count-on': {
    title: 'Рамка-лічильник, лампа світить',
    blurb: 'Спільний зсув справа наліво.',
    deep: 2,
    closed: 1,
    gate: true,
  },
} as const;

export default defineChapter({
  id: '_sandbox-circuit-copper-world',
  order: 9102,
  group: 'micro',
  title: 'Пісочниця: мідь у складеному світі',
  subtitle: 'Стенд → жила → ряди → один атом',
  axisLabel: '10⁻⁹ m',
  axisValue: -9,
  theme: { accent: 'cyan', sky: 'studio', mood: 'studio' },
  steps: Object.entries(WORLD_STEPS).map(([id, s]) => ({ id, title: s.title, blurb: s.blurb })),
  load: () => import('./scene'),
  dev: true,
});
