/**
 * The step `amp`'s own shot (`steps/07-amp.ts` `AMP_SHOT`): on a tablet the engine re-frames a shot to the area the
 * step's sheet leaves free, and with a `fit` sphere it pulls the picture back until the sphere fits there; without one
 * it crops around the target, and the multimeter, 4.9 to the left of it, left the frame (review of E3-6, fix round 3).
 * So the sphere must hold what the step is about: the multimeter with its probes at rest, R5 with both legs, J8 with
 * both ends and the tray's left slot (the step's jumper). On a desk `fit` is not read; a phone takes the bench's
 * `phone` shot. How the engine frames it on 820 × 1180 and 1180 × 820 is measured in the browser (the chapter's
 * README, the E3-6 report); chapters do not reach the engine's director.
 */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createLayout } from '@electronics/sim/board';
import { PLACES, boardToWorld } from '@electronics/shared/bench';
import { PROBE_LENGTH } from '@electronics/shared/instruments';
import { AMP_SHOT } from '../steps/07-amp';

const layout = createLayout();
const socketWorld = (id: string): Vector3 => {
  const s = layout.socket(id)!;
  const B = PLACES.breadboard;
  return boardToWorld(B.x + s.x, B.height, B.z + s.z);
};

/** The multimeter's case on the table: its eight corners. */
const METER = (() => {
  const { x, z, width, depth, height } = PLACES.meter;
  return [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sz) =>
      [0, height].map((y) => new Vector3(x + (sx * width) / 2, y, z + (sz * depth) / 2)),
    ),
  );
})();
/**
 * The probes at rest on the table right of the case (`shared/instruments/meter.ts` `REST`): the tips 0.85 behind the
 * case's middle, 0.2 … 0.45 beyond its right side, the handles toward the reader, a probe's length long.
 */
const PROBES = (() => {
  const { x, z, width } = PLACES.meter;
  return [0.2, 0.45].flatMap((dx) =>
    [0, PROBE_LENGTH].map((dz) => new Vector3(x + width / 2 + dx, 0.05, z - 0.85 + dz)),
  );
})();
/** R5's legs (a2, a6) and J8's ends (d2, d5): the step's two measurements. */
const R5_J8 = ['a2', 'a6', 'd2', 'd5'].map(socketWorld);
/** The tray's left slot, up to the back row's top. */
const SLOT = (() => {
  const { x, z, width, depth, slots, back } = PLACES.tray;
  const x0 = x - width / 2;
  return [x0, x0 + width / slots].flatMap((sx) =>
    [-1, 1].map((sz) => new Vector3(sx, back.top, z + (sz * depth) / 2)),
  );
})();

const sphere = (shot: { fit?: unknown }) => {
  const fit = shot.fit as { center: readonly number[]; radius: number } | undefined;
  return fit && { center: new Vector3(fit.center[0], fit.center[1], fit.center[2]), radius: fit.radius };
};

describe('the step `amp`’s shot', () => {
  it('has a `fit` sphere that holds the multimeter, its probes, R5, J8 and the tray’s left slot', () => {
    const s = sphere(AMP_SHOT);
    expect(s).toBeDefined();
    for (const p of [...METER, ...PROBES, ...R5_J8, ...SLOT])
      expect(p.distanceTo(s!.center)).toBeLessThanOrEqual(s!.radius);
  });
});
