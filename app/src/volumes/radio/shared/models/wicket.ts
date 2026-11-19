/**
 * The wicket in the west fence (B12): a leaf 1.0 × 1.8 m in the YZ plane, its face toward +X (like every small prop),
 * pickets 14 / 14 cm like the fence round the yard on an iron frame — two rails and a brace — two hinges and a latch.
 * The frame is on the leaf's face, the yard's side (B13): in the camera's frame of 128 × 96 cells the white pickets of
 * the leaf are those of the fence on either side, and only the dark rails and brace across them, with the dark posts
 * the fence puts on both sides of the opening (`fence.ts`), tell the leaf from the fence while it is shut. Its origin
 * is the middle of the leaf's bottom; the hinge is at z = +0.5 and the leaf runs from it toward −Z. Part `leaf` turns
 * about Y on the hinge; anchor `latch`.
 */
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';
import { picketGeometry } from './fence';
import { SURFACE } from './house';

const WIDE = 1.0;
const TALL = 1.8;
const PICKET = 0.14;
const THICK = 0.02;
const CLEAR = 0.02;
/**
 * The frame: rails at 0.25 m and 0.65 of the leaf's height (the upper one under the row of the cat's body in the
 * camera's frame, which crosses the leaf above 1.27 m and must see pickets against the grass there), a brace from
 * the hinge's low end to the free edge's high end, as thick as the rails.
 */
const RAIL = { thick: 0.03, tall: 0.08, low: 0.25, high: 0.65 * TALL } as const;

export function wicket(): KitModel {
  const b = new Builder('wicket');
  const white = col('white');
  const iron = SURFACE.iron;
  const metal = col('slate');
  const leaf = b.part('leaf', { at: [0, 0, WIDE / 2] });
  // in the leaf's frame the hinge is at z = 0 and the free edge at z = −1.0; pickets as on the west fence
  const n = Math.floor((WIDE + PICKET) / (2 * PICKET));
  const offset = (WIDE - (2 * n - 1) * PICKET) / 2;
  const geo = picketGeometry(PICKET, TALL - CLEAR, THICK, true);
  const along = [0, Math.PI / 2, 0] as const; // local X of a shape → −Z
  for (let k = 0; k < n; k++)
    leaf.add(geo, {
      c: white,
      slot: 'toon',
      at: [0, CLEAR, -(offset + PICKET / 2 + 2 * k * PICKET)],
      rot: along,
    });
  // the frame on the face (+X), the hinges behind it on the back (−X), the latch at the free edge
  const front = THICK / 2 + RAIL.thick / 2;
  const back = -(THICK / 2 + 0.003);
  for (const y of [RAIL.low, RAIL.high])
    leaf.box(WIDE - 0.02, RAIL.tall, RAIL.thick, {
      r: 0,
      c: iron.c,
      slot: iron.slot,
      at: [front, y - RAIL.tall / 2, -WIDE / 2],
      rot: along,
    });
  leaf.beam([front, RAIL.low + 0.04, -0.04], [front, RAIL.high - 0.04, -WIDE + 0.04], RAIL.thick, {
    h: RAIL.tall,
    c: iron.c,
    slot: iron.slot,
  });
  for (const y of [RAIL.low, RAIL.high])
    leaf.box(0.16, 0.03, 0.006, {
      r: 0,
      c: metal,
      slot: 'metal',
      at: [back, y - 0.015, -0.06],
      rot: along,
    });
  leaf.box(0.02, 0.03, 0.09, {
    r: 0.004,
    seg: 1,
    c: metal,
    slot: 'metal',
    at: [front + RAIL.thick / 2 + 0.01, 1.04, -WIDE + 0.05],
  });
  leaf.anchor('latch', front + RAIL.thick / 2 + 0.02, 1.055, -WIDE + 0.05);
  return b.build();
}
