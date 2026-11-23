/**
 * The step `amps`'s own shot (`parts/shots.ts` `AMPS_SHOT`). The script's «Бачимо»: the eye falls on the supply
 * jumper J10 (`+1` → `a1`) and on the LED «on»; the reader takes J10 out and puts the probes where its ends stood. In
 * the bench's `meter`, seen from the front, the reservoir's tall can C3 (in e2/d2, by column 1) stands before J10, the
 * + rail's first sockets and the row 1ae (review of E3-8). From `AMPS_SHOT` the sight lines to them pass beside the
 * can; and its `fit` sphere (tablets) holds what the step is about: the multimeter with its probes at rest, J10's ends,
 * the gap's sockets and the LED. How the engine frames it is measured in the browser (the chapter's README, the
 * E3-8 report); chapters do not reach the engine's director.
 */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createLayout, presetState } from '@electronics/sim/board';
import { BOARD, BOARD_Y, PLACES, STAGE_SHOTS, boardToWorld } from '@electronics/shared/bench';
import { PROBE_LENGTH } from '@electronics/shared/instruments';
import { MM, RADIAL_Y, electrolyticCan } from '@electronics/shared/parts';
import { AMP, SUPPLY } from '../parts/boards';
import { AMPS_SHOT } from '../parts/shots';

const layout = createLayout();
const board = presetState(layout, AMP);
const B = PLACES.breadboard;
const at = (id: string, lift = 0): Vector3 => {
  const s = layout.socket(id)!;
  return boardToWorld(B.x + s.x, B.height + lift, B.z + s.z);
};
const COS = Math.cos(BOARD.tilt);
const SIN = Math.sin(BOARD.tilt);
/** World → the base's frame (the inverse of `boardToWorld`). */
const toBase = (w: Vector3): Vector3 => {
  const y = w.y - BOARD_Y;
  return new Vector3(w.x, y * COS + w.z * SIN, -y * SIN + w.z * COS);
};

/** C3's can in the base's frame: over the middle of its legs, from `RADIAL_Y` above the sockets, its real size × 3. */
const CAN = (() => {
  const legs = board.parts.get('C3')!.legs.map((s) => layout.socket(s!)!);
  const { d, h } = electrolyticCan(470e-6, 16);
  const y0 = B.height + RADIAL_Y;
  return {
    x: B.x + (legs[0]!.x + legs[1]!.x) / 2,
    z: B.z + (legs[0]!.z + legs[1]!.z) / 2,
    y0,
    y1: y0 + h * MM,
    r: (d * MM) / 2,
  };
})();
/** The straight line from the eye to a point passes through C3's can. */
function hidden(eye: Vector3, point: Vector3): boolean {
  const p = toBase(eye);
  const q = toBase(point);
  for (let k = 1; k < 1000; k++) {
    const t = k / 1000;
    const x = p.x + (q.x - p.x) * t;
    const y = p.y + (q.y - p.y) * t;
    const z = p.z + (q.z - p.z) * t;
    if (y >= CAN.y0 && y <= CAN.y1 && Math.hypot(x - CAN.x, z - CAN.z) <= CAN.r) return true;
  }
  return false;
}
/** A shot's eye (its `position`, an array in every shot of the bench). */
const eye = (shot: { position: unknown }): Vector3 => new Vector3(...(shot.position as [number, number, number]));

/** What the reader works with: J10's ends and its middle (a little above the sockets), the + rail's first three
 * sockets and the gap's row 1ae but e1 (under the can's rim, beside its leg). */
const J10 = (() => {
  const [a, b] = board.parts.get(SUPPLY)!.legs as string[];
  return [at(a!), at(b!), at(a!).add(at(b!)).multiplyScalar(0.5).add(new Vector3(0, 0.1, 0))];
})();
const GAP = ['+1', '+2', '+3', 'a1', 'b1', 'c1', 'd1'].map((s) => at(s));

/** The multimeter's case on the table: its eight corners. */
const METER = (() => {
  const { x, z, width, depth, height } = PLACES.meter;
  return [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sz) => [0, height].map((y) => new Vector3(x + (sx * width) / 2, y, z + (sz * depth) / 2))),
  );
})();
/** The probes at rest right of the case (`shared/instruments/meter.ts` `REST`): tips and handles. */
const PROBES = (() => {
  const { x, z, width } = PLACES.meter;
  return [0.2, 0.45].flatMap((dx) => [0, PROBE_LENGTH].map((dz) => new Vector3(x + width / 2 + dx, 0.05, z - 0.85 + dz)));
})();
/** The LED «on» (LED1 in j5/i5), its dome. */
const LED = [at('j5', 0.6), at('i5', 0.6)];

describe('the step `amps`’s shot', () => {
  it('sees J10, the + rail’s first sockets and the row 1ae beside the reservoir’s can', () => {
    const from = eye(AMPS_SHOT);
    for (const p of [...J10, ...GAP]) expect(hidden(from, p)).toBe(false);
  });

  it('(the bench’s `meter`, seen from the front, has the can before J10 and the row 1ae: why the step has its own)', () => {
    const from = eye(STAGE_SHOTS.meter);
    expect(hidden(from, J10[2]!)).toBe(true);
    expect(['a1', 'c1', 'd1'].every((s) => hidden(from, at(s)))).toBe(true);
  });

  it('has a `fit` sphere that holds the multimeter, its probes, J10, the gap’s sockets and the LED', () => {
    const fit = AMPS_SHOT.fit as { center: readonly number[]; radius: number };
    const center = new Vector3(fit.center[0], fit.center[1], fit.center[2]);
    for (const p of [...METER, ...PROBES, ...J10, ...GAP, ...LED])
      expect(p.distanceTo(center)).toBeLessThanOrEqual(fit.radius);
  });
});
