/**
 * The speaker (8 Ω) of the bench (docs/volumes/electronics/VISUAL.md §4.1), a permanent thing on the base: face up on
 * three low feet — a `steel` frame and magnet; the cone an open bowl whose faces look up, `ink` lifted toward `slate` so
 * that its depth reads under the moon, with an `ink` dust cap standing in its middle; a `slate` surround on its edge;
 * «8 Ω» printed flat on the frame's rim on the reader's side, where the bench's shots see it; two solder lugs on the
 * frame's edge toward the board, where its two leads start (the leads and their plugs are the hand's, E2-5), and a
 * `coral` dot on the rim beside the plus lug. The cone does not move for show: the sound is heard, its shape is seen on
 * the oscilloscope.
 *
 * Origin: the middle of its footprint on the base's face.
 */
import { Group, Vector3 } from 'three';
import { Builder } from '@/kit';
import { PLACES } from '../bench/layout';
import { Prints, fixedView, mix, slots, type PartView } from './part';

const STEEL = ['steel', 'mist'] as const;

export const SPEAKER = {
  radius: PLACES.speaker.radius,
  /** Height of the frame's rim above the base. */
  rim: 0.36,
  /** The surround: a ring on the cone's edge — its middle from the axis and the radius of its tube. */
  surround: { r: PLACES.speaker.radius * 0.85, tube: 0.035 },
  /** One em of «8 Ω»: its figures fit the rim that shows outside the surround. */
  printSize: 0.07,
} as const;

export interface SpeakerView extends PartView {
  /** Where «8 Ω» lies (the speaker's frame): flat on the rim, on the reader's side (+z), facing up. */
  readonly printAt: Vector3;
  /** The middle of the coral dot beside the plus lug (the speaker's frame). */
  readonly plusAt: Vector3;
}

export function createSpeaker(): SpeakerView {
  const R = SPEAKER.radius;
  const { rim, surround } = SPEAKER;
  const s = new Builder('speaker');
  for (const a of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6])
    s.cyl(0.07, 0.2, { at: [Math.cos(a) * R * 0.62, 0, Math.sin(a) * R * 0.62], seg: 12, c: 'ink' });
  const magnet = R * 0.42;
  s.cyl(magnet, 0.14, { at: [0, 0.06, 0], seg: 32, slot: 'metal', c: STEEL, bevel: 0.03 });
  // the frame: out and up from the magnet, the rim's flat top, and its inner face back down under the cone
  s.lathe(
    [
      [R * 0.3, 0.2],
      [R, 0.3],
      [R, rim],
      [R * 0.86, rim],
      [R * 0.3, 0.22],
    ],
    { seg: 48, slot: 'metal', c: 'steel' },
  );
  // the cone: an open bowl from under the surround down to the voice coil, then flat to the axis. The profile runs
  // inward and down, so its faces look up at the bench's cameras; no lid closes it, and it stays above the frame's
  // inner face everywhere
  s.lathe(
    [
      [R * 0.83, rim],
      [R * 0.55, 0.32],
      [R * 0.3, 0.26],
      [0, 0.26],
    ],
    { seg: 48, c: mix('ink', 'slate', 0.3) },
  );
  s.ring(surround.r, surround.tube, { at: [0, rim + 0.01, 0], axis: 'y', seg: 48, tubeSeg: 8, c: 'slate' });
  // the dust cap on the cone's floor
  s.dome(R * 0.22, 0.06, { at: [0, 0.262, 0], seg: 24, c: 'ink' });
  // the two lugs on the frame's edge toward the board (−x)
  for (const z of [-0.14, 0.14]) {
    s.box(0.12, 0.012, 0.06, { at: [-R + 0.02, rim, z], r: 0, slot: 'metal', c: 'mist' });
  }
  // the middle of the rim that shows outside the surround: the plus dot and the print lie on it
  const band = (surround.r + surround.tube + R) / 2;
  // the plus dot beside the plus lug (z 0.14), on its side away from the minus lug
  const plusZ = 0.215;
  const plusAt = new Vector3(-Math.sqrt(band * band - plusZ * plusZ), rim, plusZ);
  s.cyl(0.025, 0.006, { at: [plusAt.x, rim, plusAt.z], seg: 12, c: 'coral', bevel: 0 });
  const model = s.build();
  const group = new Group();
  group.name = 'speaker';
  group.add(model.group);
  const prints = new Prints();
  const printAt = new Vector3(0, rim + 0.004, band);
  prints.add(group, '8 Ω', {
    size: SPEAKER.printSize,
    color: 'ink',
    at: [printAt.x, printAt.y, printAt.z],
    // flat on the rim, read from the reader's side
    rot: [-Math.PI / 2, 0, 0],
  });
  return Object.assign(fixedView('speaker', group, slots(model, 'toon'), prints), { printAt, plusAt });
}
