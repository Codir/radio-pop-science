/**
 * The bench's named shot `amp` (`shots.ts`, moved from `resistor/steps/07-amp.ts` `AMP_SHOT`, E4-B): the amplifier's
 * left part with the multimeter, seen steeper than `stand`. The reservoir's tall can C3 (`e2`/`f2`, by column 2) stands
 * in `stand` and `meter` before R5's leg in a2 or before the right half of the gap's jumper J8 (`d2` → `d5`); from
 * `amp` the sight lines to R5's legs and J8's right half pass by it. Its `fit` (tablets: the engine re-frames a shot
 * to the area the step's sheet leaves free and pulls the picture back until the sphere fits; without one it crops
 * around the target, and the multimeter, 4.9 to the left of it, left the frame — review of E3-6, fix round 3) holds
 * the multimeter with its probes at rest, R5 with both legs, J8 with both ends and the tray's left slot. On a phone
 * the bench's `phone`. Chapters: `resistor/amp`; `capacitor-kinds/amp`, `capacitor/reservoir`, `filter/coupling` next.
 */
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { AMPLIFIER_PRESET, createLayout, presetState } from '@electronics/sim/board';
import { PROBE_LENGTH } from '../../instruments';
import { MM, RADIAL_Y, electrolyticCan } from '../../parts';
import { BOARD_Y } from '../base';
import { BOARD, PLACES } from '../layout';
import { STAGE_SHOTS, benchShots, boardToWorld } from '../shots';

const layout = createLayout();
const board = presetState(layout, AMPLIFIER_PRESET);
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
const eye = (shot: { position: unknown }): Vector3 => new Vector3(...(shot.position as [number, number, number]));

/** R5's legs and J8's ends on the amplifier (`AMPLIFIER_PRESET`): the step's two measurements. */
const R5 = board.parts.get('R5')!.legs as string[];
const J8 = board.parts.get('J8')!.legs as string[];
/**
 * What the reader works with, a little above the sockets (a probe's tip, a capsule): R5's legs, J8's right half — its
 * end in d5 and the points a half and three quarters along it from d2 (its end in d2 stands right before the can's
 * leg in e2: seen from the front, any shot has the can over it).
 */
const along = (k: number): Vector3 => at(J8[0]!, 0.1).lerp(at(J8[1]!, 0.1), k);
const TARGETS: readonly [string, Vector3][] = [
  ...R5.map((s) => [s, at(s, 0.1)] as [string, Vector3]),
  [J8[1]!, at(J8[1]!, 0.1)],
  ['J8 ½', along(0.5)],
  ['J8 ¾', along(0.75)],
];

/** The multimeter's case on the table: its eight corners. */
const METER = (() => {
  const { x, z, width, depth, height } = PLACES.meter;
  return [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sz) => [0, height].map((y) => new Vector3(x + (sx * width) / 2, y, z + (sz * depth) / 2))),
  );
})();
/** The probes at rest on the table right of the case (`instruments/meter.ts` `REST`): tips and handles. */
const PROBES = (() => {
  const { x, z, width } = PLACES.meter;
  return [0.2, 0.45].flatMap((dx) =>
    [0, PROBE_LENGTH].map((dz) => new Vector3(x + width / 2 + dx, 0.05, z - 0.85 + dz)),
  );
})();
/** The tray's left slot, up to the back row's top. */
const SLOT = (() => {
  const { x, z, width, depth, slots, back } = PLACES.tray;
  const x0 = x - width / 2;
  return [x0, x0 + width / slots].flatMap((sx) => [-1, 1].map((sz) => new Vector3(sx, back.top, z + (sz * depth) / 2)));
})();

describe('the bench’s shot `amp`', () => {
  it('stands where `resistor/amp` measured it (E3-6): steeper than `stand`, its orbit', () => {
    expect(STAGE_SHOTS.amp).toMatchObject({
      position: [-0.2, 13.85, 9.67],
      target: [-0.7, 1.0, 1.0],
      fov: 27,
      fit: { center: [-3.3, 1.1, 1.1], radius: 3.5 },
    });
    expect(STAGE_SHOTS.amp.orbit).toBe(STAGE_SHOTS.stand.orbit);
    expect([...R5, ...J8]).toEqual(['a2', 'a6', 'd2', 'd5']);
  });

  it('sees R5’s legs and J8’s right half beside the reservoir’s can', () => {
    const from = eye(STAGE_SHOTS.amp);
    for (const [name, p] of TARGETS) expect(hidden(from, p), name).toBe(false);
  });

  it('(the bench’s `stand` and `meter` have the can before R5’s leg in a2 or J8: why the step has its own)', () => {
    for (const shot of [STAGE_SHOTS.stand, STAGE_SHOTS.meter])
      expect(TARGETS.some(([, p]) => hidden(eye(shot), p))).toBe(true);
  });

  it('has a `fit` sphere that holds the multimeter, its probes, R5, J8 and the tray’s left slot', () => {
    const fit = STAGE_SHOTS.amp.fit;
    const center = new Vector3(...fit.center);
    for (const p of [...METER, ...PROBES, ...[...R5, ...J8].map((s) => at(s)), ...SLOT])
      expect(p.distanceTo(center)).toBeLessThanOrEqual(fit.radius);
  });

  it('is the `phone` shot on a phone, as every name of the bench', () => {
    expect(benchShots(true).amp).toBe(STAGE_SHOTS.phone);
    expect(benchShots(false).amp).toBe(STAGE_SHOTS.amp);
  });
});
