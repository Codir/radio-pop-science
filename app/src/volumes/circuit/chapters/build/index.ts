import { manifestText } from '@/content';
import { defineChapter } from '@/engine/api';
import meta from '../../content/generated/build.manifest.json';

/**
 * The practicum of the pilot volume `circuit`: «Зберіть коло самі» (docs/volumes/circuit/chapters/build.md). Four
 * tasks on the stand: assemble the circuit from loose wires, find three faults, see a short circuit, fold the stand
 * back into the flashlight — the volume's last frame is the prologue's first. Manifest only; lazy scene.
 */
export default defineChapter({
  id: 'build',
  order: meta.order,
  group: 'practicum',
  ...manifestText(meta),
  axisValue: meta.axisValue,
  theme: { accent: 'amber', sky: 'studio', mood: 'studio' },
  load: () => import('./scene'),
});
