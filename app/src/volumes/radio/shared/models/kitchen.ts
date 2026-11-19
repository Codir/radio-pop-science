/**
 * The volume's kitchen block (B12): base cabinets 0.60 m deep with the worktop at 0.86, the oven at the −X end with
 * its door toward +Z and the middle of the door 1.00 m above the floor (where the model puts the oven, VISUAL.md
 * §2), then the hob and the sink further toward +X. Steel, as VISUAL.md §4 asks instead of the kit's teal; no glowing
 * rings on the hob. The kit's `addKitchen` does not fit: its oven stands 1.85 m from the end of the run and its anchor
 * sits on the oven's top (`kit/home/appliances.ts:46-54`).
 */
import type { Builder } from '@/kit';
import { col } from '@/style';

const steel = col('steel');
const top = col('steel').lerp(col('mist'), 0.4);
const light = col('steel').lerp(col('white'), 0.5);

/** Sizes the house uses to place the block. */
export const KITCHEN = {
  depth: 0.6,
  top: 0.86,
  oven: { width: 0.48, height: 0.28, depth: 0.36, door: 0.2 },
  /** The anchor `microwave` (the middle of the oven door) in the frame of a block of this length. */
  microwave: (length: number): readonly [number, number, number] => [-length / 2 + 0.24, 1.0, 0.2],
} as const;

/**
 * Add the kitchen block in the current frame of `b`, centred: x from −length/2 to +length/2, back at z = −0.30, front
 * at +0.30 (like the kit's `addKitchen`); the oven at the −X end. Anchor: `microwave`.
 */
export function addKitchenBlock(b: Builder, o: { length: number }): void {
  const L = o.length;
  const { oven } = KITCHEN;
  // toe kick, carcass, doors with handles, worktop
  b.box(L, 0.08, 0.5, { r: 0, c: col('slate'), slot: 'matte', at: [0, 0, -0.05] });
  b.box(L, 0.74, 0.58, { r: 0.01, seg: 1, c: steel, slot: 'gloss', at: [0, 0.08, -0.01] });
  const doors = Math.max(1, Math.round(L / 0.6));
  for (let i = 0; i < doors; i++) {
    const x = ((i + 0.5) / doors - 0.5) * L;
    b.box(L / doors - 0.012, 0.7, 0.02, { r: 0.006, seg: 1, c: steel, slot: 'gloss', at: [x, 0.1, 0.29] });
    b.box(0.12, 0.016, 0.02, { r: 0, c: col('mist'), slot: 'metal', at: [x, 0.74, 0.31] });
  }
  b.box(L, 0.04, 0.62, { r: 0.008, seg: 1, c: top, slot: 'gloss', at: [0, 0.82, 0.01] });

  // the oven on the worktop: body, door with a dark window, handle on the door's +X edge
  const ox = -L / 2 + oven.width / 2;
  const back = oven.door - oven.depth;
  b.box(oven.width, oven.height, oven.depth - 0.012, {
    r: 0.02,
    seg: 1,
    c: light,
    slot: 'gloss',
    at: [ox, KITCHEN.top, back + (oven.depth - 0.012) / 2],
  });
  b.box(oven.width - 0.02, oven.height - 0.02, 0.012, {
    r: 0.006,
    seg: 1,
    c: light,
    slot: 'gloss',
    at: [ox, KITCHEN.top + 0.01, oven.door - 0.006],
  });
  b.box(0.3, 0.16, 0.004, { r: 0, c: col('ink'), slot: 'gloss', at: [ox - 0.04, 1.0 - 0.08, oven.door] });
  b.box(0.02, 0.18, 0.02, {
    r: 0.005,
    seg: 1,
    c: col('mist'),
    slot: 'metal',
    at: [ox + 0.19, 0.91, oven.door + 0.01],
  });
  b.anchor('microwave', ...KITCHEN.microwave(L));

  // the hob (dark glass, four dark rings) and the sink with a tap
  const hx = ox + oven.width / 2 + 0.45;
  b.box(0.58, 0.01, 0.5, { r: 0, c: col('ink'), slot: 'gloss', at: [hx, KITCHEN.top, 0] });
  for (const dx of [-0.14, 0.14])
    for (const dz of [-0.12, 0.12])
      b.ring(0.08, 0.005, {
        seg: 14,
        tubeSeg: 3,
        c: col('slate'),
        slot: 'gloss',
        at: [hx + dx, KITCHEN.top + 0.012, dz],
      });
  const sx = L / 2 - 0.5;
  if (sx - 0.25 > hx + 0.3) {
    b.box(0.5, 0.012, 0.4, { r: 0, c: col('slate'), slot: 'metal', at: [sx, KITCHEN.top, 0] });
    b.rod([sx, KITCHEN.top, -0.22], [sx, KITCHEN.top + 0.24, -0.22], 0.015, {
      slot: 'metal',
      c: col('mist'),
    });
    b.rod([sx, KITCHEN.top + 0.24, -0.22], [sx, KITCHEN.top + 0.21, -0.06], 0.013, {
      slot: 'metal',
      c: col('mist'),
    });
  }
}
