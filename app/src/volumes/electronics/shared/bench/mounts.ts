/**
 * The mounts of the bench (docs/volumes/electronics/VISUAL.md §2, §4.1), pieces copied from
 * `circuit/shared/stage/mounts.ts` (shared/README.md, «Копії»): the screw terminal, the lamp's post with its socket
 * and the magnifier's holder. The circuit's battery clamps, cradle, switch block, staples and second switch seat are
 * not on this bench. `steel` mounts on `ink` blocks.
 *
 * Every mount is a `part` whose origin lies on the face of the base.
 */
import type { Builder } from '@/kit';
import { LAMP, LENS } from './layout';

const STEEL = ['steel', 'mist'] as const;
const INK = ['ink', 'slate'] as const;

/**
 * Screw terminal: a steel barrel lying along `axis` at height `y`, with a slotted screw on top and an optional
 * coloured collar; `x` is where the barrel ends (toward `dir`), measured along the axis.
 */
export function terminal(
  p: Builder,
  x: number,
  dir: 1 | -1,
  y: number,
  collar?: string,
  axis: 'x' | 'z' = 'x',
): void {
  const len = 0.17;
  const at = (d: number): [number, number, number] =>
    axis === 'x' ? [x + dir * d, y, 0] : [0, y, x + dir * d];
  const rot: [number, number, number] =
    axis === 'x' ? [0, 0, (-dir * Math.PI) / 2] : [(dir * Math.PI) / 2, 0, 0];
  // barrel: from the block toward the wire
  p.cyl(0.085, len, { at: at(-len), rot, seg: 20, slot: 'metal', c: STEEL, bevel: 0.02 });
  if (collar)
    p.cyl(0.105, 0.05, { at: at(-len - 0.005), rot, seg: 24, slot: 'gloss', c: collar, bevel: 0.015 });
  // screw head with a slot
  const [sx, , sz] = at(-len / 2);
  p.cyl(0.06, 0.06, { at: [sx, y + 0.075, sz], seg: 16, slot: 'metal', c: 'mist', bevel: 0.015 });
  p.box(0.095, 0.012, 0.02, { at: [sx, y + 0.135, sz], r: 0, c: 'ink', rot: [0, 0.6, 0] });
}

/**
 * The lamp's post in the far left corner — the highest thing on the base: a foot, a steel post, the socket the
 * lamp's thread goes into and two screw terminals where the lamp's leads start.
 */
export function addLampPost(b: Builder): void {
  const post = b.part('lampPost', { at: [LAMP.x, 0, LAMP.z] });
  const top = LAMP.socketY;
  post.cyl(0.26, 0.1, { seg: 36, c: INK, bevel: 0.03 });
  post.cyl(0.08, top - 0.26, { at: [0, 0.09, 0], seg: 20, slot: 'metal', c: STEEL });
  post.lathe(
    [
      [0, top - 0.26],
      [0.15, top - 0.26],
      [0.21, top - 0.19],
      [0.21, top - 0.03],
      [0.195, top],
      [0.15, top],
      [0.15, top - 0.17],
      [0, top - 0.17],
    ],
    { seg: 36, c: INK },
  );
  post.cyl(0.212, 0.03, { at: [0, top - 0.075, 0], seg: 36, slot: 'metal', c: STEEL, bevel: 0.01 });
  // the two leads leave from the foot, to the left and toward the reader
  terminal(post, -LAMP.term, -1, LAMP.termY);
  terminal(post, LAMP.term, 1, LAMP.termY, undefined, 'z');
}

/**
 * The magnifier's rest in the near left corner: three low pegs under the ring and a small fork for the ferrule at the
 * front edge (the handle points at the reader, over the edge).
 */
export function addLensHolder(b: Builder): void {
  const holder = b.part('lensHolder', { at: [LENS.holder.x, 0, LENS.holder.z] });
  for (const a of [0.5, 2.6, 4.0]) {
    holder.cyl(0.05, 0.13, {
      at: [Math.cos(a) * (LENS.radius - 0.03), 0, -Math.sin(a) * (LENS.radius - 0.03)],
      seg: 12,
      c: INK,
      bevel: 0.02,
    });
  }
  for (const k of [-1, 1] as const) {
    holder.capsule(0.03, 0.2, {
      at: [-0.1 + k * 0.1, 0.1, LENS.radius + 0.03],
      seg: 8,
      slot: 'metal',
      c: STEEL,
    });
  }
}
