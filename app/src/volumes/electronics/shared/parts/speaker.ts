/**
 * The speaker (8 Ω) of the bench (docs/volumes/electronics/VISUAL.md §4.1), a permanent thing on the base: face up on
 * three low feet — an `ink` cone, a `slate` surround, a `steel` frame and magnet, «8 Ω» printed on the magnet; two
 * solder lugs on the frame's edge toward the board, where its two leads start (the leads and their plugs are the
 * hand's, E2-5), a `coral` dot by the plus lug. The cone does not move for show: the sound is heard, its shape is seen
 * on the oscilloscope.
 *
 * Origin: the middle of its footprint on the base's face.
 */
import { Group } from 'three';
import { Builder } from '@/kit';
import { PLACES } from '../bench/layout';
import { Prints, fixedView, slots, type PartView } from './part';

const STEEL = ['steel', 'mist'] as const;

export const SPEAKER = {
  radius: PLACES.speaker.radius,
  /** Height of the frame's rim above the base. */
  rim: 0.36,
} as const;

export function createSpeaker(): PartView {
  const R = SPEAKER.radius;
  const s = new Builder('speaker');
  for (const a of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6])
    s.cyl(0.07, 0.2, { at: [Math.cos(a) * R * 0.62, 0, Math.sin(a) * R * 0.62], seg: 12, c: 'ink' });
  const magnet = R * 0.42;
  s.cyl(magnet, 0.14, { at: [0, 0.06, 0], seg: 32, slot: 'metal', c: STEEL, bevel: 0.03 });
  s.lathe(
    [
      [R * 0.3, 0.2],
      [R, 0.3],
      [R, SPEAKER.rim],
      [R * 0.86, SPEAKER.rim],
      [R * 0.3, 0.24],
    ],
    { seg: 48, slot: 'metal', c: 'steel' },
  );
  s.lathe(
    [
      [0, 0.25],
      [R * 0.3, 0.25],
      [R * 0.78, 0.34],
      [R * 0.86, SPEAKER.rim],
      [R * 0.86, SPEAKER.rim + 0.005],
      [0, SPEAKER.rim + 0.005],
    ],
    { seg: 48, c: 'ink' },
  );
  s.ring(R * 0.85, 0.035, { at: [0, SPEAKER.rim + 0.01, 0], axis: 'y', seg: 48, tubeSeg: 8, c: 'slate' });
  s.dome(R * 0.22, 0.06, { at: [0, 0.27, 0], seg: 24, c: 'ink' });
  // the two lugs on the frame's edge toward the board (−x), and the plus mark
  for (const z of [-0.14, 0.14]) {
    s.box(0.12, 0.012, 0.06, { at: [-R + 0.02, SPEAKER.rim, z], r: 0, slot: 'metal', c: 'mist' });
  }
  s.cyl(0.025, 0.006, { at: [-R + 0.12, SPEAKER.rim, 0.14], seg: 12, c: 'coral', bevel: 0 });
  const model = s.build();
  const group = new Group();
  group.name = 'speaker';
  group.add(model.group);
  const prints = new Prints();
  prints.add(group, '8\u00a0Ω', { size: 0.09, color: 'ink', at: [0, 0.13, magnet + 0.004] });
  return fixedView('speaker', group, slots(model, 'toon'), prints);
}
