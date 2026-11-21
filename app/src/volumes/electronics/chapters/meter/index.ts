import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/meter.manifest.json';

/**
 * Chapter 2 of the volume `electronics`: «Як побачити напругу, струм і форму сигналу?»
 * (docs/volumes/electronics/chapters/meter.md). Six steps on the bench with the prologue's amplifier on the board: the
 * multimeter reads the battery's voltage between the rails (and minus it with the probes the other way round), then
 * the amplifier's current in the gap of its supply jumper; the oscilloscope draws the rail as a flat line once the
 * switch closes, the player's music as a wave around zero the multimeter cannot tell by one number, slow and quick
 * waves at three times a division, and the amplifier's input against its speaker — the same wave, upside down and
 * sixteen times higher. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'meter',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
