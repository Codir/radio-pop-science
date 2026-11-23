import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/prologue.manifest.json';

/**
 * The prologue of the volume `electronics`: «Музика з плеєра ледь чути. Що поставити між ним і динаміком?»
 * (docs/volumes/electronics/chapters/prologue.md). Five steps on the bench with the volume's amplifier on the board:
 * the player straight on the speaker barely whispers; the same player on the amplifier's input, the switch closed and
 * the knob up — loud music; parts taken out one by one — without most the speaker falls silent, without the LED «on»
 * only its light goes; a probe of an instrument with a screen on the battery, the player and the speaker — a flat
 * line, a small wave and a bigger one: where does the bigger wave come from?; and the map of the eleven questions.
 * Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'prologue',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
