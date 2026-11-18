import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/resistance.manifest.json';

/**
 * Chapter 5 of the pilot volume `circuit`: «Що заважає струму?» (docs/volumes/circuit/chapters/resistance.md).
 * Four steps: the run and the hit of one electron among the rows (resistance), the current warms the wire, a long
 * thin wire holds the current back, and the balance of the battery's push with the circuit's resistance — most of
 * it in the lamp. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'resistance',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
