import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/drain.manifest.json';

/**
 * Chapter 7 of the pilot volume `circuit`: «Чому батарейка сідає?» (docs/volumes/circuit/chapters/drain.md).
 * Five steps on the stand: the hours of a battery under one slider → what is spent inside → the dead battery's
 * open-circuit voltage → its own resistance under the lens → a new battery in the cradle. Manifest only; the
 * scene is lazy. README.md.
 */
export default defineChapter({
  id: 'drain',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
