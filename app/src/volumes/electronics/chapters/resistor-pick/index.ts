import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/resistor-pick.manifest.json';

/**
 * Chapter 5 of the volume `electronics`: «Як підібрати резистор?» (docs/volumes/electronics/chapters/resistor-pick.md).
 * Six steps on the bench: the magnifier brings the 330 Ω close and the reader reads its colour bands, a slider runs
 * through the series of values with the span each value's tolerance allows, the two nearest values of the LED's
 * resistor go into its gap on the ammeter, the panel shows the voltage, the power and the state of a warm 330 Ω and a
 * cold 1 kΩ, a 100 Ω beyond its limit burns, and the amplifier's LED «on» shares its supply with its 2,2 kΩ. Manifest
 * only; lazy scene.
 */
export default defineChapter({
  id: 'resistor-pick',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
