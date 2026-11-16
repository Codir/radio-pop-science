import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/wire.manifest.json';

/**
 * Chapter 1 of the pilot volume `circuit`: «З чого зроблений дріт?» (docs/volumes/circuit/chapters/wire.md).
 * Six steps on the lower floors of the copper world (`shared/copper`): rows of atoms → one atom → its outer
 * electron → shared electrons → restless motion → copper and plastic. Manifest only; the scene is lazy.
 */
export default defineChapter({
  id: 'wire',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
