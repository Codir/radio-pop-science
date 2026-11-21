/**
 * The diodes (docs/volumes/electronics/VISUAL.md §4.5), axial, 4 P, the cathode (leg 1) by the band:
 * - 1N4148: a small glass body 0.40 × 0.22 of dark amber, translucent (lit, `sheath()`), with the black cathode band;
 *   through the glass the two metal slugs that hold the crystal; no print;
 * - 1N4007: black epoxy 0.60 × 0.31 with a `steel` cathode band and «1N4007» printed in `mist`.
 *
 * Draw calls: 1N4148 — the glass, its depth shell, the band, the slugs, the legs; 1N4007 — the body, the legs, the print;
 * burnt, the crack round the darkened body (VISUAL §4.8).
 */
import { Box3, Group, Mesh, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import type { KToonMaterial } from '@/style';
import { BOARD_SPEC } from '@electronics/sim/board';
import { sheath } from '../bench/materials';
import { depthShell } from './bulb';
import {
  AXIAL_Y,
  CRACK_COLOR,
  Prints,
  assemble,
  axialLegs,
  crackPath,
  mix,
  slots,
  type PartModel,
} from './part';

export type DiodeModelName = '1N4148' | '1N4007';

/** The diodes of the catalog by key. */
export const DIODES: Readonly<Record<string, DiodeModelName>> = {
  'diode-1n4148': '1N4148',
  'diode-1n4007': '1N4007',
};

/** Size of the body (length along the legs, diameter) and where its cathode band lies from the end by leg 0. */
export const DIODE_LOOK: Readonly<
  Record<DiodeModelName, { length: number; diameter: number; band: [number, number] }>
> = {
  '1N4148': { length: 0.4, diameter: 0.22, band: [0.29, 0.35] },
  '1N4007': { length: 0.6, diameter: 0.31, band: [0.46, 0.53] },
};

/** A pill along x: a cylinder with rounded ends, `length` long, radius `r`, centred on the origin. */
function pill(length: number, r: number, round: number): G.Pt[] {
  const pts: G.Pt[] = [[0, 0]];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push([r - round + round * Math.sin(a), round - round * Math.cos(a)]);
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push([r - round + round * Math.cos(a), length - round + round * Math.sin(a)]);
  }
  pts.push([0, length]);
  return pts.map(([x, y]) => [x, y - length / 2]);
}

/** Lathe geometry of a profile along +x (the profile's y runs along the axis). */
function alongX(profile: readonly G.Pt[], seg: number): ReturnType<typeof G.lathe> {
  const g = G.lathe(profile, { seg, crease: 60 });
  g.rotateZ(-Math.PI / 2);
  return g;
}

export function createDiode(name: DiodeModelName, key = `diode-${name.toLowerCase()}`): PartModel {
  const look = DIODE_LOOK[name];
  const L = look.length;
  const R = look.diameter / 2;
  const [b0, b1] = look.band;
  const body = new Group();
  const prints = new Prints();
  const b = new Builder(key);
  let bodyMaterials: KToonMaterial[] = [];
  if (name === '1N4148') {
    // the glass: translucent dark amber, lit like the LEDs' epoxy, so it never glows in the dark room
    const glassGeo = alongX(pill(L, R, 0.06), 28);
    glassGeo.translate(0, AXIAL_Y, 0);
    const glass = new Mesh(
      glassGeo,
      sheath({ color: mix('orange', 'ink', 0.4), opacity: 0.6, edgeOpacity: 0.95, gloss: 0.9 }),
    );
    glass.name = `${key}:glass`;
    glass.renderOrder = 3;
    glass.add(depthShell(glass, AXIAL_Y));
    body.add(glass);
    // the black band of the cathode on the glass, by leg 1
    b.lathe(
      [
        [0, b0],
        [R + 0.004, b0],
        [R + 0.004, b1],
        [0, b1],
      ],
      { axis: 'x', at: [-L / 2, AXIAL_Y, 0], seg: 24, c: 'ink' },
    );
    // inside: the two slugs the leads end in and the crystal between them
    for (const s of [-1, 1] as const) {
      b.cyl(R * 0.55, L * 0.32, {
        axis: 'x',
        at: [s > 0 ? L * 0.04 : -L * 0.36, AXIAL_Y, 0],
        seg: 14,
        slot: 'metal',
        c: 'steel',
      });
    }
    b.box(0.05, 0.05, 0.05, { at: [0, AXIAL_Y, 0], mid: true, r: 0, slot: 'metal', c: 'slate' });
    bodyMaterials = [glass.material];
  } else {
    // black epoxy with a grey band at the cathode
    const epoxy = pill(L, R, 0.07);
    b.add(alongX(epoxy, 28), { at: [0, AXIAL_Y, 0], slot: 'gloss', c: 'ink' });
    b.lathe(
      [
        [0, b0],
        [R + 0.003, b0],
        [R + 0.003, b1],
        [0, b1],
      ],
      { axis: 'x', at: [-L / 2, AXIAL_Y, 0], seg: 28, slot: 'gloss', c: 'steel' },
    );
    // «1N4007» on the front of the body, tipped to face the camera above the bench (45°)
    const a = Math.PI / 4;
    prints.add(body, name, {
      size: 0.085,
      color: 'mist',
      at: [-L / 2 + b0 / 2 + 0.01, AXIAL_Y + (R + 0.003) * Math.sin(a), (R + 0.003) * Math.cos(a)],
      rot: [-a, 0, 0],
    });
  }
  const model = b.build();
  body.add(model.group);
  if (name === '1N4007') bodyMaterials = slots(model, 'gloss');
  // burnt (VISUAL §4.8): dark, with a crack round the middle of the body
  const burnt = new Builder(`${key}:burnt`);
  burnt.tube(crackPath(-L * 0.08, R + 0.006, 0.022), 0.015, { seg: 6, c: CRACK_COLOR });
  const marks = burnt.build().group;
  marks.name = `${key}:burnt`;
  body.add(marks);
  return assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-L / 2, AXIAL_Y - R, -R), new Vector3(L / 2, AXIAL_Y + R, R)),
    legX: [0, 4 * BOARD_SPEC.pitch],
    legPaths: axialLegs(AXIAL_Y, L / 2 - 0.03),
    bodyMaterials,
    marks,
    prints,
  });
}
