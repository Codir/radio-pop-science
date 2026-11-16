import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/_sandbox-flow.manifest.json';

/** Path-format sandbox chapter (docs/volumes/_path/chapters/_sandbox-flow.md, docs/PATH_FORMAT.md). */
export default defineChapter({
  id: '_sandbox-flow',
  order: 3,
  group: 'path',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'cyan', sky: 'day', mood: 'diorama' },
  load: () => import('./scene'),
});
