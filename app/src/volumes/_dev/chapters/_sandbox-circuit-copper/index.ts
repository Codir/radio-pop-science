import { defineChapter } from '@/engine/api';
import { STATES } from './states';

/**
 * Showcase of «усередині міді» — the lower floors of the volume `circuit` (library
 * `volumes/circuit/shared/copper`): one step per state the chapters need. Development only.
 */
export default defineChapter({
  id: '_sandbox-circuit-copper',
  order: 9101,
  group: 'micro',
  title: 'Пісочниця: усередині міді',
  subtitle: 'Жила дроту, ряди атомів, один атом',
  axisLabel: '10⁻⁹ m',
  axisValue: -9,
  theme: { accent: 'cyan', sky: 'micro', mood: 'micro' },
  steps: Object.entries(STATES).map(([id, s]) => ({ id, title: s.title, blurb: s.blurb })),
  load: () => import('./scene'),
  dev: true,
});
