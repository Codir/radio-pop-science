/**
 * The capacitors (docs/volumes/electronics/VISUAL.md §4.7) — the catalog gains them in E1-5; `buildPart` binds these
 * models to its keys by the spec's dielectric. Every body's bottom is 0.3 above the board.
 * - ceramic: a disc 0.58 across and 0.15 thick of muted ochre, standing face to the reader, its legs 2 P apart; the
 *   code «104» (`capacitorCode`) on its face;
 * - film: a dark cherry box 0.83 × 0.29 × 0.75, legs 2 P, the code on its front;
 * - electrolytic: a can in `ink` sleeve with a `mist` stripe over the minus leg (1) and a row of «−» on it; the sleeve
 *   is wrapped over the top's edge as a rim 0.05 wide and the stripe runs over the rim too, so it shows from above at
 *   any turn; inside the rim the aluminium top with its cross-shaped vent; value and voltage up its side
 *   («470 μF 16 V»). The size is the real can's three times over; legs 1 P, the same length.
 *
 * Draw calls: ceramic and film — the body, the legs, the print; electrolytic — the sleeve, the top, the legs, the print.
 */
import { Box3, Group, Vector3, type Mesh } from 'three';
import { NBSP, fmtNumber, fmtSI } from '@/content';
import { Builder, type G } from '@/kit';
import { BOARD_SPEC } from '@electronics/sim/board';
import { capacitorCode } from './code';
import { MM, Prints, RADIAL_Y, assemble, mix, radialLegs, slots, type PartModel } from './part';

const P = BOARD_SPEC.pitch;

export const CERAMIC = { diameter: 0.58, thickness: 0.15 } as const;
export const FILM = { width: 0.83, depth: 0.29, height: 0.75 } as const;

/** Muted ochre (tan): darker and greyer than `orange`, so a cold capacitor never reads as heat (VISUAL §4.7). */
export const CERAMIC_BODY = mix(mix('amber', 'wireBrown', 0.5), 'steel', 0.3);
/** Muted dark cherry: neither «alarm» nor «plus». */
export const FILM_BODY = mix(mix('red', 'wireBrown', 0.4), 'ink', 0.5);

/** Real cans of the catalog (E1-5): diameter × height in mm, by capacitance and rated voltage. */
export const ELECTROLYTIC_CANS: readonly { farads: number; volts: number; d: number; h: number }[] = [
  { farads: 1e-6, volts: 16, d: 5, h: 11 },
  { farads: 10e-6, volts: 16, d: 5, h: 11 },
  { farads: 100e-6, volts: 16, d: 6.3, h: 11 },
  { farads: 470e-6, volts: 16, d: 8, h: 11.5 },
  { farads: 1000e-6, volts: 16, d: 10, h: 16 },
  { farads: 100e-6, volts: 6.3, d: 5, h: 11 },
];

/** The can of a capacitance and voltage in mm: the catalog's own, or the one nearest in charge (C · V). */
export function electrolyticCan(farads: number, volts: number): { d: number; h: number } {
  const exact = ELECTROLYTIC_CANS.find(
    (c) => Math.abs(c.farads - farads) <= 1e-9 * farads && Math.abs(c.volts - volts) <= 1e-9 * volts,
  );
  if (exact) return exact;
  const q = Math.log(Math.max(farads * volts, 1e-12));
  let best = ELECTROLYTIC_CANS[0]!;
  for (const c of ELECTROLYTIC_CANS) {
    if (Math.abs(Math.log(c.farads * c.volts) - q) < Math.abs(Math.log(best.farads * best.volts) - q))
      best = c;
  }
  return best;
}

/** «470 μF 16 V», «6,3 V»: the value and the voltage as the can is printed (code: numbers and units only). */
export function electrolyticPrint(farads: number, volts: number): string {
  return `${fmtSI(farads, 'F')} ${fmtNumber(volts, { maxDigits: 1 })}${NBSP}V`;
}

/* -------------------------------------------------------------------------------------------- ceramic */

export function createCeramic(farads: number, key = 'ceramic'): PartModel {
  const { diameter, thickness: t } = CERAMIC;
  const R = diameter / 2;
  const cy = RADIAL_Y + R;
  // a pill-shaped disc: flat faces, a round rim (the dipped coating)
  const disc: G.Pt[] = [[0, -t / 2]];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    disc.push([R - t / 2 + (t / 2) * Math.cos(a), (t / 2) * Math.sin(a)]);
  }
  disc.push([0, t / 2]);
  const b = new Builder(key);
  b.lathe(disc, { axis: 'z', at: [0, cy, 0], seg: 36, crease: 70, c: CERAMIC_BODY });
  // the drop of coating where the legs go in
  b.sphere(0.1, { at: [0, RADIAL_Y + 0.03, 0], s: [1.3, 0.8, 0.75], seg: 14, c: CERAMIC_BODY });
  const model = b.build();
  const body = new Group();
  body.add(model.group);
  const prints = new Prints();
  prints.add(body, capacitorCode(farads), { size: 0.15, color: 'ink', at: [0, cy + 0.01, t / 2 + 0.003] });
  return assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-R, RADIAL_Y, -t / 2), new Vector3(R, RADIAL_Y + diameter, t / 2)),
    legX: [0, 2 * P],
    legPaths: radialLegs([-0.1, 0.1], RADIAL_Y + 0.02, 0.16),
    bodyMaterials: slots(model, 'toon'),
    prints,
  });
}

/* ----------------------------------------------------------------------------------------------- film */

export function createFilm(farads: number, key = 'film'): PartModel {
  const { width: W, depth: D, height: H } = FILM;
  const b = new Builder(key);
  b.box(W, H, D, { at: [0, RADIAL_Y, 0], r: 0.05, seg: 2, slot: 'gloss', c: FILM_BODY });
  const model = b.build();
  const body = new Group();
  body.add(model.group);
  const prints = new Prints();
  prints.add(body, capacitorCode(farads), {
    size: 0.17,
    color: 'mist',
    at: [0, RADIAL_Y + H * 0.55, D / 2 + 0.003],
  });
  return assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-W / 2, RADIAL_Y, -D / 2), new Vector3(W / 2, RADIAL_Y + H, D / 2)),
    legX: [0, 2 * P],
    legPaths: radialLegs([-P, P], RADIAL_Y),
    bodyMaterials: slots(model, 'gloss'),
    prints,
  });
}

/* --------------------------------------------------------------------------------------- electrolytic */

export interface ElectrolyticModel extends PartModel {
  /** The sleeve with its stripe and signs (one mesh). */
  readonly sleeve: Mesh;
  /** Diameter and height of the can (units). */
  readonly size: { readonly d: number; readonly h: number };
}

/** How far the sleeve is wrapped over the top's edge. */
const RIM = 0.05;

export function createElectrolytic(farads: number, volts: number, key = 'electrolytic'): ElectrolyticModel {
  const can = electrolyticCan(farads, volts);
  const d = can.d * MM;
  const h = can.h * MM;
  const r = d / 2;
  const y0 = RADIAL_Y;
  const y1 = y0 + h;
  // the sleeve from the bottom's edge, round the bead near the bottom, up the side and over the top's edge
  const sleeve: G.Pt[] = [
    [r - 0.04, y0],
    [r - 0.01, y0 + 0.006],
    [r, y0 + 0.03],
    [r, y0 + 0.1],
    [r - 0.018, y0 + 0.115],
    [r, y0 + 0.13],
    [r, y1 - 0.03],
    [r - 0.008, y1 - 0.006],
    [r - 0.025, y1],
    [r - RIM, y1],
    [r - RIM, y1 - 0.012],
  ];
  const b = new Builder(key);
  const quarter = Math.PI / 4;
  b.lathe(sleeve, {
    phiStart: quarter,
    phiLength: 6 * quarter,
    seg: 36,
    crease: 50,
    slot: 'gloss',
    c: 'ink',
  });
  // the stripe: the quarter of the sleeve over the minus leg (+x), over the rim as well
  b.lathe(sleeve, {
    phiStart: -quarter,
    phiLength: 2 * quarter,
    seg: 12,
    crease: 50,
    slot: 'gloss',
    c: 'mist',
  });
  // the rubber bung at the bottom
  b.cyl(r - 0.04, 0.012, { at: [0, y0 + 0.004, 0], seg: 28, c: 'ink', slot: 'gloss', bevel: 0 });
  // a row of «−» down the stripe
  for (let y = y0 + 0.24; y <= y1 - 0.2; y += 0.2) {
    b.box(0.004, 0.022, Math.min(0.12, r * 0.6), {
      at: [r + 0.002, y, 0],
      mid: true,
      r: 0,
      slot: 'gloss',
      c: 'ink',
    });
  }
  // the aluminium top inside the rim, with its cross-shaped vent
  b.cyl(r - RIM, 0.012, { at: [0, y1 - 0.014, 0], seg: 32, slot: 'metal', c: 'steel', bevel: 0 });
  for (const a of [0, Math.PI / 2]) {
    b.box(2 * (r - RIM - 0.03), 0.004, 0.018, {
      at: [0, y1 - 0.002, 0],
      mid: true,
      rot: [0, a, 0],
      r: 0,
      slot: 'gloss',
      c: 'ink',
    });
  }
  const model = b.build();
  const body = new Group();
  body.add(model.group);
  const sleeveMesh = model.group.getObjectByName(`${key}:gloss`) as Mesh;
  const prints = new Prints();
  // up the side facing the reader, reading from the bottom
  prints.add(body, electrolyticPrint(farads, volts), {
    size: Math.min(0.12, r * 0.42),
    color: 'mist',
    at: [0, y0 + h / 2, r + 0.004],
    rot: [0, 0, Math.PI / 2],
  });
  const m = assemble({
    key,
    name: key,
    body,
    hitBox: new Box3(new Vector3(-r, y0, -r), new Vector3(r, y1, r)),
    legX: [0, P],
    legPaths: radialLegs([-P / 2, P / 2], y0),
    bodyMaterials: slots(model, 'gloss'),
    prints,
  });
  return Object.assign(m, { sleeve: sleeveMesh, size: { d, h } });
}
