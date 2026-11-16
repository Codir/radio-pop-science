/**
 * The mounts of the stand (VISUAL.md §2): everything that is fixed to the board and that, in the unfolding,
 * grows out of it in a wave from left to right — battery clamps on insulating blocks, the cradle, the switch
 * block with its two contacts and the visible air gap, the lamp's post and socket, five staples, the second
 * (empty) switch seat with its jumper, the magnifier's holder. `steel` mounts on `ink` blocks; the collar of
 * the plus clamp is `coral`, of the minus clamp `blue`.
 *
 * Every mount is a `part` whose origin lies on the face, so it can grow by scale from the board.
 */
import type { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { BATTERY, LAMP, LENS, LOOP, SEAT, STAPLES, SWITCH } from './layout';

const STEEL = ['steel', 'mist'] as const;
const INK = ['ink', 'slate'] as const;

/** Screw terminal: a steel barrel lying along the wire with a slotted screw on top and a coloured collar. */
function terminal(p: Builder, x: number, dir: 1 | -1, collar?: string, axis: 'x' | 'z' = 'x'): void {
  const y = LOOP.y;
  const len = 0.17;
  const at = (d: number): [number, number, number] =>
    axis === 'x' ? [x + dir * d, y, 0] : [0, y, x + dir * d];
  const rot: [number, number, number] =
    axis === 'x' ? [0, 0, (-dir * Math.PI) / 2] : [(dir * Math.PI) / 2, 0, 0];
  // barrel: from the block toward the wire
  p.cyl(0.105, len, { at: at(-len), rot, seg: 20, slot: 'metal', c: STEEL, bevel: 0.02 });
  if (collar)
    p.cyl(0.13, 0.06, { at: at(-len - 0.005), rot, seg: 24, slot: 'gloss', c: collar, bevel: 0.015 });
  // screw head with a slot
  const [sx, , sz] = at(-len / 2);
  p.cyl(0.07, 0.07, { at: [sx, y + 0.09, sz], seg: 16, slot: 'metal', c: 'mist', bevel: 0.015 });
  p.box(0.11, 0.012, 0.022, { at: [sx, y + 0.16, sz], r: 0, c: 'ink', rot: [0, 0.6, 0] });
}

function addClamp(b: Builder, name: string, sign: 1 | -1, order: string[]): void {
  const R = BATTERY.radius;
  // minus: the leaf stands a spring's length from the can; plus: it touches the nub
  const leafX = sign < 0 ? BATTERY.x - BATTERY.length / 2 - 0.2 : BATTERY.x + BATTERY.length / 2 + 0.105;
  const termX = sign < 0 ? BATTERY.minusX : BATTERY.plusX;
  const blockX = (leafX + termX) / 2 + sign * 0.02;
  const p = b.part(name, { at: [blockX, 0, BATTERY.z] });
  order.push(name);
  const lx = leafX - blockX;
  p.box(Math.abs(termX - leafX) + 0.1, 0.13, 0.72, { r: 0.045, c: INK });
  // spring leaf: an upright strip of spring steel with a rolled top, leaning a little toward the can
  p.box(0.05, 0.74, 0.4, { at: [lx, 0.1, 0], r: 0.02, slot: 'metal', c: STEEL, rot: [0, 0, sign * 0.05] });
  p.cyl(0.042, 0.4, {
    at: [lx - sign * 0.03, BATTERY.y + R + 0.1, -0.2],
    rot: [Math.PI / 2, 0, 0],
    seg: 12,
    slot: 'metal',
    c: 'mist',
  });
  // contact dimple facing the can
  p.sphere(0.07, {
    at: [lx - sign * 0.035, BATTERY.y, 0],
    seg: 12,
    slot: 'metal',
    c: 'mist',
    s: [0.6, 1, 1],
  });
  // foot of the leaf, bolted to the block, and the strap to the terminal
  p.box(0.3, 0.035, 0.34, { at: [lx + sign * 0.1, 0.125, 0], r: 0.012, slot: 'metal', c: STEEL });
  terminal(p, termX - blockX, sign, sign > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus);
  // the board's only lettering besides the ruler: «+» / «−» pressed into the face behind the clamp
  const mx = lx + sign * 0.02;
  const mark = sign > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus;
  p.box(0.2, 0.006, 0.05, { at: [mx, 0, -0.62], r: 0, slot: 'matte', c: mark });
  if (sign > 0) p.box(0.05, 0.006, 0.2, { at: [mx, 0, -0.62], r: 0, slot: 'matte', c: mark });
  // collar cap on top of the leaf — the pole's colour where the eye looks first
  p.box(0.075, 0.1, 0.42, {
    at: [lx, BATTERY.y + R + 0.04, 0],
    r: 0.03,
    slot: 'gloss',
    c: sign > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus,
  });
}

/** Adds the mounts; returns the names of their parts in the order of the wave (left → right by x). */
export function addMounts(b: Builder): string[] {
  const order: string[] = [];
  addClamp(b, 'clampMinus', -1, order);

  // cradle: a low insulating tray with two saddles, for exactly one battery
  const cradle = b.part('cradle', { at: [BATTERY.x, 0, BATTERY.z] });
  order.push('cradle');
  cradle.box(BATTERY.length * 0.86, 0.09, 0.56, { r: 0.04, c: INK });
  for (const s of [-1, 1] as const) {
    for (const k of [-1, 1] as const) {
      cradle.box(0.2, BATTERY.y - BATTERY.radius * 0.72, 0.1, {
        at: [s * 0.52, 0.05, k * 0.24],
        r: 0.035,
        c: 'slate',
        rot: [k * -0.35, 0, 0],
      });
    }
  }
  addClamp(b, 'clampPlus', 1, order);

  // switch block: two contacts with an air gap between them (≥ 12 px on screen); the wires enter steel
  // ferrules in the block's ends, so the slider has the whole top to travel on
  const sw = b.part('switchBlock', { at: [SWITCH.x, 0, SWITCH.z] });
  order.push('switchBlock');
  const W = SWITCH.width - 0.16;
  sw.box(W, 0.15, 0.6, { r: 0.05, c: INK });
  for (const s of [-1, 1] as const) {
    const cw = W / 2 - SWITCH.gap / 2 - 0.05;
    // contact: a steel land on the block with a raised stud the slider's bridge rides on
    sw.box(cw, 0.05, 0.26, {
      at: [s * (SWITCH.gap / 2 + cw / 2), 0.15, 0],
      r: 0.015,
      slot: 'metal',
      c: STEEL,
    });
    sw.cyl(0.06, 0.07, {
      at: [s * (SWITCH.gap / 2 + 0.075), 0.19, 0],
      seg: 14,
      slot: 'metal',
      c: 'mist',
      bevel: 0.02,
    });
    sw.cyl(0.1, 0.1, {
      at: [s * (W / 2 - 0.02), LOOP.y, 0],
      rot: [0, 0, (-s * Math.PI) / 2],
      seg: 20,
      slot: 'metal',
      c: STEEL,
      bevel: 0.02,
    });
  }
  // guide rails of the slider
  for (const k of [-1, 1] as const)
    sw.box(W - 0.06, 0.09, 0.045, { at: [0, 0.15, k * 0.255], r: 0.02, c: 'slate' });

  // lamp post and socket: two screw terminals — one goes to the thread, the other to the bottom contact
  const post = b.part('lampPost', { at: [LAMP.x, 0, LAMP.z] });
  order.push('lampPost');
  post.cyl(0.3, 0.11, { seg: 36, c: INK, bevel: 0.035 });
  post.cyl(0.1, LAMP.socketY - 0.34, { at: [0, 0.1, 0], seg: 20, slot: 'metal', c: STEEL });
  post.lathe(
    [
      [0, LAMP.socketY - 0.3],
      [0.2, LAMP.socketY - 0.3],
      [0.27, LAMP.socketY - 0.22],
      [0.27, LAMP.socketY - 0.03],
      [0.25, LAMP.socketY],
      [0.19, LAMP.socketY],
      [0.19, LAMP.socketY - 0.2],
      [0, LAMP.socketY - 0.2],
    ],
    { seg: 36, c: INK },
  );
  post.cyl(0.275, 0.035, { at: [0, LAMP.socketY - 0.085, 0], seg: 36, slot: 'metal', c: STEEL, bevel: 0.01 });
  terminal(post, -LAMP.term, -1); // far wire (from the minus) — to the thread
  terminal(post, LAMP.term, 1, undefined, 'z'); // right wire (from the plus, through the switch) — to the bottom contact

  // second, empty switch seat on the far side, closed by a short jumper (`flow/loop` moves the switch here)
  const seat = b.part('seat', { at: [SEAT.x, 0, SEAT.z] });
  order.push('seat');
  seat.box(SEAT.width - 0.3, 0.15, 0.6, { r: 0.05, c: INK });
  seat.box(SEAT.width - 0.36, 0.045, 0.2, { at: [0, 0.15, 0], r: 0.015, slot: 'metal', c: STEEL });
  for (const s of [-1, 1] as const) {
    seat.cyl(0.055, 0.06, { at: [s * 0.1, 0.18, 0], seg: 12, slot: 'metal', c: 'mist', bevel: 0.015 });
    terminal(seat, s * (SEAT.width / 2), s);
  }

  // staples: a small pedestal with an arch that holds the wire one wire thickness above the face
  STAPLES.forEach(([x, z, along], i) => {
    const st = b.part(`staple${i}`, { at: [x, 0, z], rot: [0, along === 'x' ? 0 : Math.PI / 2, 0] });
    order.push(`staple${i}`);
    st.box(0.2, LOOP.y - 0.075, 0.26, { r: 0.03, c: INK });
    st.ring(0.1, 0.022, {
      at: [0, LOOP.y - 0.02, 0],
      axis: 'x',
      seg: 20,
      tubeSeg: 8,
      slot: 'metal',
      c: STEEL,
      s: [1.6, 1, 1],
    });
  });

  // magnifier rest in the near left corner: three low pegs under the ring and a small fork for the ferrule at
  // the front edge (the handle points at the reader, over the edge)
  const holder = b.part('lensHolder', { at: [LENS.holder.x, 0, LENS.holder.z] });
  order.push('lensHolder');
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
  return order.sort((p, q) => mountX(p) - mountX(q));
}

/** x of a mount on the board — the wave of the unfolding runs along it. */
export function mountX(name: string): number {
  if (name.startsWith('staple')) return STAPLES[Number(name.slice(6))]![0];
  const xs: Record<string, number> = {
    clampMinus: BATTERY.minusX,
    cradle: BATTERY.x,
    clampPlus: BATTERY.plusX,
    switchBlock: SWITCH.x,
    lampPost: LAMP.x,
    seat: SEAT.x,
    lensHolder: LENS.holder.x,
  };
  return xs[name] ?? 0;
}
