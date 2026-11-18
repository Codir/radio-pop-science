import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '@alchemy/content/generated/lab.manifest.json';

/**
 * The only chapter of the volume «Ядерна алхімія» (docs/volumes/alchemy/chapters/lab.md).
 *
 * The manifest is eager and must stay tiny: title, axis label, step ids, titles and blurbs come from the
 * generated `lab.manifest.json` — never from `lab.json` or the model, which load with the scene.
 */
export default defineChapter({
  id: 'lab',
  order: meta.order,
  group: 'nucleus',
  ...manifestText(meta),
  axisValue: -14,
  theme: { accent: 'violet', sky: 'micro', mood: 'micro' },
  load: () => import('./scene'),
});
