import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/flow.manifest.json';

/**
 * Chapter 4 of the pilot volume `circuit`: «Що тече в дроті?» (docs/volumes/circuit/chapters/flow.md). Eight
 * steps on the stand: the current as a common drift, counted in amperes, the same everywhere, only in a closed
 * loop, the water picture, slower than a snail, all at once, the push of the field. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'flow',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
