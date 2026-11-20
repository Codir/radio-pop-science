/**
 * The player, the source of the music (docs/volumes/electronics/VISUAL.md §4.1), a permanent thing on the base: a flat
 * `slate` box with a dark `ink` window that never lights and a «play» triangle (geometry, not text); its lead leaves
 * through a grommet on the side toward the board (the lead and its two plugs are the hand's, E2-5). No light of its own
 * (VISUAL §1, principle 5).
 *
 * Origin: the middle of its footprint on the base's face.
 */
import { Group } from 'three';
import { Builder } from '@/kit';
import { PLACES } from '../bench/layout';
import { Prints, fixedView, slots, type PartView } from './part';

export function createPlayer(): PartView {
  const { width: W, depth: D, height: H } = PLACES.player;
  const p = new Builder('player');
  p.box(W, H, D, { r: 0.08, seg: 2, c: 'slate' });
  p.box(W * 0.72, 0.012, D * 0.4, { at: [0, H, -D * 0.16], r: 0.004, slot: 'gloss', c: 'ink' });
  // «play»: a triangle pointing right (a three-sided cylinder has a corner at +x)
  p.cyl(0.13, 0.014, { at: [0, H, D * 0.24], seg: 3, c: 'mist', bevel: 0 });
  // two small round keys beside the triangle
  for (const s of [-1, 1] as const)
    p.cyl(0.06, 0.014, { at: [s * 0.3, H, D * 0.24], seg: 16, c: 'ink', bevel: 0.004 });
  // the grommet the lead leaves through, toward the board
  p.cyl(0.06, 0.06, { axis: 'x', at: [-W / 2 - 0.05, H / 2, D * 0.28], seg: 14, c: 'ink', bevel: 0.015 });
  const model = p.build();
  const group = new Group();
  group.name = 'player';
  group.add(model.group);
  return fixedView('player', group, slots(model, 'toon'), new Prints());
}
