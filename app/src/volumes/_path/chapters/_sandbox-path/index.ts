import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/_sandbox-path.manifest.json';

/** Path-format sandbox chapter (docs/volumes/_path/chapters/_sandbox-path.md, docs/PATH_FORMAT.md). */
export default defineChapter({
  id: '_sandbox-path',
  order: 2,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'day', mood: 'diorama' },
  load: () => import('./scene'),
});
