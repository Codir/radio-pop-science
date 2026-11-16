import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/prologue.manifest.json';

/**
 * Prologue of the volume `circuit` (docs/volumes/circuit/chapters/prologue.md): the flashlight clicks on, unfolds
 * into the stand, the lens dives into the wire, the snail's riddle, the map of seven questions. README.md.
 */
export default defineChapter({
  id: 'prologue',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
