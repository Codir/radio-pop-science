/**
 * A transistor in TO-92 (docs/volumes/electronics/VISUAL.md §4.7) — the catalog gains them in E1-6; `buildPart` binds
 * this model to their keys. A black half cylinder 0.52 wide, 0.42 deep and 0.52 high, its bottom 0.3 above the board,
 * three legs 1 P apart. At the orientation 0 the flat side faces the reader (+z) and carries the model's name; leg 0 is
 * the leftmost seen on the flat side with the legs down, then 1 and 2 to the right (+x). Which lead is in which leg is
 * the board's own table (`sim/board` `TO92_LEGS`): the board and the model never part.
 *
 * Draw calls: the case, the legs, the print.
 */
import { Box3, Group, Mesh, Shape, Vector3 } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { BOARD_SPEC, TO92_LEGS } from '@electronics/sim/board';
import { Prints, RADIAL_Y, assemble, radialLegs, type PartModel } from './part';

export const TO92 = {
  width: 0.52,
  depth: 0.42,
  height: 0.52,
  /** The flat side lies this far in front of the legs' line (+z); the round back as far behind it. */
  front: 0.21,
} as const;

/** What is printed on the flat side, and the type, by catalog key (VISUAL §4.7). */
export const TRANSISTORS: Readonly<Record<string, { readonly print: string; readonly type: 'NPN' | 'PNP' }>> =
  {
    'transistor-bc547b': { print: 'BC547B', type: 'NPN' },
    'transistor-bc557b': { print: 'BC557B', type: 'PNP' },
    'transistor-2n3904': { print: '2N3904', type: 'NPN' },
    'transistor-2n3906': { print: '2N3906', type: 'PNP' },
    'transistor-bc337-25': { print: 'BC337-25', type: 'NPN' },
    'transistor-bc327-25': { print: 'BC327-25', type: 'PNP' },
  };

export interface TransistorModel extends PartModel {
  /** The model's name on the flat side. */
  readonly print: string;
  /** The lead in every leg, from leg 0. */
  readonly legNames: readonly string[];
  /** The black case. */
  readonly case: Mesh;
  /** Where the print lies (body frame). */
  readonly printAt: Vector3;
}

/** The case's outline seen from above (x, and −z as the shape's y): a circle cut flat in front. */
function outline(): Shape {
  const r = TO92.width / 2;
  const front = TO92.front;
  // the circle's centre lies behind the flat side so that the case is `depth` deep: front − (depth − r) … − front
  const cz = front - (TO92.depth - r);
  const half = Math.sqrt(r * r - (front - cz) ** 2);
  const a = Math.atan2(-(front - cz), half); // the flat's right end, seen from the circle's centre (shape y = −z)
  const s = new Shape();
  s.moveTo(half, -front);
  s.absarc(0, -cz, r, a, Math.PI - a, false);
  s.lineTo(half, -front);
  return s;
}

export function createTransistor(key: string): TransistorModel {
  const look = Object.hasOwn(TRANSISTORS, key) ? TRANSISTORS[key] : undefined;
  const legNames = Object.hasOwn(TO92_LEGS, key) ? TO92_LEGS[key] : undefined;
  if (!look || !legNames) throw new RangeError(`no TO-92 transistor '${key}'`);
  const geo = G.extrude(outline(), TO92.height, { bevel: 0.02, curveSeg: 24 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, RADIAL_Y + TO92.height / 2, 0);
  const caseMesh = new Mesh(geo, K.toon({ color: 'ink', gloss: 0.35, highlight: 0.35 }));
  caseMesh.name = `${key}:case`;
  const body = new Group();
  body.add(caseMesh);

  const prints = new Prints();
  const printAt = new Vector3(0, RADIAL_Y + TO92.height * 0.55, TO92.front + 0.003);
  prints.add(body, look.print, {
    // the name fits the flat side (0.41 wide) with a margin
    size: Math.min(0.11, 0.4 / (0.62 * look.print.length)),
    color: 'mist',
    at: [printAt.x, printAt.y, printAt.z],
  });

  const P = BOARD_SPEC.pitch;
  const w = TO92.width / 2;
  const m = assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(
      new Vector3(-w, RADIAL_Y, -TO92.front),
      new Vector3(w, RADIAL_Y + TO92.height, TO92.front),
    ),
    legX: [0, P, 2 * P],
    legPaths: radialLegs([-P, 0, P], RADIAL_Y),
    bodyMaterials: [caseMesh.material],
    prints,
  });
  return Object.assign(m, { print: look.print, legNames, case: caseMesh, printAt });
}
