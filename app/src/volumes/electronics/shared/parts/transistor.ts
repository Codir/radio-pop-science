/**
 * A transistor in TO-92 (docs/volumes/electronics/VISUAL.md §4.7): every transistor of the catalog (E1-6) takes this
 * model by its key (`buildPart`). A black half cylinder 0.52 wide, 0.42 deep and 0.52 high, its bottom 0.3 above the
 * board, three legs 1 P apart in the board that leave the case's bottom 1.27 mm apart (the outer two bend in at a knee
 * and meet the case under it). At the orientation 0 the flat side faces the reader (+z) and carries the model's name;
 * leg 0 is the leftmost seen on the flat side with the legs down, then 1 and 2 to the right (+x). Which lead is in which
 * leg is the board's own table (`sim/board` `TO92_LEGS`): the board and the model never part.
 *
 * Draw calls: the case, the legs, the print.
 */
import { Box3, Group, Mesh, Shape, Vector3 } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { PARTS } from '@electronics/sim/core';
import { BOARD_SPEC, TO92_LEGS } from '@electronics/sim/board';
import { MM, Prints, RADIAL_Y, assemble, radialLegs, type PartModel } from './part';

export const TO92 = {
  width: 0.52,
  depth: 0.42,
  height: 0.52,
  /** The flat side lies this far in front of the legs' line (+z); the round back as far behind it. */
  front: 0.21,
  /** Where the legs leave the case's bottom, from the middle: a real TO-92's leads are 1.27 mm apart there, bent out
   * to the 2.54 mm of the board below it. */
  lead: 1.27 * MM,
} as const;

const KEY_PREFIX = 'transistor-';

/** What a transistor shows: the model's name on its flat side, and its type. */
export interface TransistorLook {
  readonly print: string;
  readonly type: 'NPN' | 'PNP';
}

/**
 * The look of every transistor of the catalog whose pinout the board knows (VISUAL §4.7), read off the catalog: the
 * model's name is its key's after `transistor-` in capitals (`transistor-bc337-25` → «BC337-25»), the type its
 * `polarity`.
 */
export const TRANSISTORS: Readonly<Record<string, TransistorLook>> = Object.freeze(transistorLooks());

function transistorLooks(): Record<string, TransistorLook> {
  const out: Record<string, TransistorLook> = {};
  for (const [key, spec] of Object.entries(PARTS)) {
    if (spec.kind !== 'transistor' || !key.startsWith(KEY_PREFIX) || !Object.hasOwn(TO92_LEGS, key)) continue;
    out[key] = {
      print: key.slice(KEY_PREFIX.length).toUpperCase(),
      type: spec.polarity === 'npn' ? 'NPN' : 'PNP',
    };
  }
  return out;
}

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
    // the outer legs bend in at a knee and meet the case under it, as a real TO-92's formed leads do
    legPaths: radialLegs([-TO92.lead, 0, TO92.lead], RADIAL_Y),
    bodyMaterials: [caseMesh.material],
    prints,
  });
  return Object.assign(m, { print: look.print, legNames, case: caseMesh, printAt });
}
