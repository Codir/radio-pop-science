import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/charge.manifest.json';

/**
 * Chapter 2 of the pilot volume `circuit`: «Що тримає електрон біля ядра?» (docs/volumes/circuit/chapters/charge.md).
 * Six steps on the table in front of the stand and below it: a rubbed balloon and hair → what rubbing moved →
 * two kinds of charge → equal amounts → the field → the field shifts free electrons. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'charge',
  order: meta.order,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
