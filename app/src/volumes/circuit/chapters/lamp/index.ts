import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/lamp.manifest.json';

/**
 * Chapter 6 of the pilot volume `circuit`: «Чому лампочка світиться?» (docs/volumes/circuit/chapters/lamp.md).
 * Six steps on the stand and inside the lamp: the filament → where it is hottest → glowing heat → energy from the
 * battery's reaction → the field brings it → the first moment after the click. Manifest only; the scene is lazy.
 */
export default defineChapter({
  id: 'lamp',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
