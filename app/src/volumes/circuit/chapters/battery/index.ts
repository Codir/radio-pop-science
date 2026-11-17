import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/battery.manifest.json';

/**
 * Chapter 3 of the pilot volume `circuit`: «Що робить батарейка?» (docs/volumes/circuit/chapters/battery.md).
 * Four steps on the stand: the poles under the lens → the battery cut open → the reaction that waits → the voltage
 * on the meter. Manifest only; the scene is lazy. README.md.
 */
export default defineChapter({
  id: 'battery',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
