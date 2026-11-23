import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/resistor.manifest.json';

/**
 * Chapter 3 of the volume `electronics`: «Навіщо схемі деталь, яка лише заважає струму?»
 * (docs/volumes/electronics/chapters/resistor.md). Seven steps on the bench: a red LED straight on the battery burns,
 * a resistor in its loop saves it, the multimeter reads three resistors in ohms (only off a live circuit), the
 * magnifier dives into the resistor's carbon film, three resistors in turn show Ohm's law on the ammeter, the voltage
 * of the battery shares between the LED and the resistor, and the same law holds for the resistor of the amplifier's
 * LED. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'resistor',
  order: meta.order,
  group: meta.group,
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
