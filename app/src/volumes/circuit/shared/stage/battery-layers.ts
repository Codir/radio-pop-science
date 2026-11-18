/**
 * The drawing of the section (where each layer lies) and its colours as functions of `life` and of the
 * highlighted layer. Geometry helpers are in `battery-section.ts`.
 */
import { type Color } from 'three';
import { col } from '@/style';
import { BATTERY } from './layout';
import { METAL, Relief, SEC, type BatteryLayer, type Cell, type Stuff } from './battery-section';

const R = BATTERY.radius;
/** Strips across the zinc gel (each side) and across the oxide ring: the spent front moves strip by strip. */
const PASTE_STRIPS = 12;
const OXIDE_STRIPS = 7;

export interface Drawing {
  soft: Relief;
  hard: Relief;
}

/** Lay out every layer of the section (see the numbers in `SEC`). */
export function drawSection(): Drawing {
  const soft = new Relief();
  const hard = new Relief();
  const add = (stuff: Stuff, x0: number, x1: number, y0: number, y1: number, s = 0, both = true): void => {
    const r = METAL.has(stuff) ? hard : soft;
    if (both) r.pair(stuff, x0, x1, y0, y1, s);
    else r.box(stuff, x0, x1, y0, y1, s);
  };
  const { film, canIn, cathodeIn, sepIn, pin, coreFrom, coreTo, canEnd, nub, nubTop, capX, capR } = SEC;
  const half = BATTERY.length / 2;
  // printed jacket: dark film, the amber band toward the plus (the outside, seen edge-on)
  add('film', -half + 0.015, 0.278, film, R);
  add('band', 0.278, 0.895, film, R);
  // steel can: side wall, the shoulder and end wall at the plus, the pressed nub (hollow), the crimp at the minus
  add('steel', -0.94, 0.9, canIn, film);
  add('steel', 0.885, 0.95, 0.236, film - 0.004);
  add('steel', canEnd, 0.95, -0.24, 0.24, 0, false);
  add('steel', 0.95, nubTop, nub - 0.018, nub);
  add('steel', nubTop - 0.018, nubTop, -nub + 0.018, nub - 0.018, 0, false);
  add('air', 0.95, nubTop - 0.018, -nub + 0.018, nub - 0.018, 0, false);
  add('steel', -0.94, -0.905, 0.222, canIn);
  // manganese oxide: three pressed rings against the can, seams between them
  for (const [x0, x1] of SEC.pellets) {
    for (let i = 0; i < OXIDE_STRIPS; i++) {
      const y0 = cathodeIn + ((canIn - cathodeIn) * i) / OXIDE_STRIPS;
      const y1 = cathodeIn + ((canIn - cathodeIn) * (i + 1)) / OXIDE_STRIPS;
      add('cathode', x0, x1, y0, y1, (i + 0.5) / OXIDE_STRIPS);
    }
  }
  for (let k = 0; k < 2; k++) add('seam', SEC.pellets[k]![1], SEC.pellets[k + 1]![0], cathodeIn, canIn);
  // separator: a thin sleeve with its bottom toward the plus
  add('separator', coreFrom - 0.005, coreTo, sepIn, cathodeIn);
  add('separator', coreTo, canEnd, -cathodeIn, cathodeIn, 0, false);
  // zinc gel: strips across, so the spent front can move from the separator toward the axis
  for (let i = 0; i < PASTE_STRIPS; i++) {
    const y0 = (sepIn * i) / PASTE_STRIPS;
    const y1 = (sepIn * (i + 1)) / PASTE_STRIPS;
    add('paste', coreFrom, coreTo, y0, y1, (i + 0.5) / PASTE_STRIPS);
  }
  // the seal under the minus cap, with a hub around the pin; the minus cap; the brass pin welded to it
  add('seal', -0.935, coreFrom, -canIn, canIn, 0, false);
  add('seal', coreFrom, coreFrom + 0.04, -0.055, 0.055, 0, false);
  add('cap', capX, -0.935, -capR, capR, 0, false);
  add('pin', -0.935, SEC.pinTip - 0.02, -pin, pin, 0, false);
  add('pin', SEC.pinTip - 0.02, SEC.pinTip, -pin * 0.6, pin * 0.6, 0, false);
  return { soft, hard };
}

/** Spent share of a zinc strip / grain at `s` (0 axis … 1 separator): the front moves inward with life. */
export function zincSpent(s: number, life: number): number {
  const front = 1 - 0.94 * Math.min(Math.max(life, 0), 1) ** 1.5;
  return Math.min(Math.max((s - front) / 0.16 + 0.5, 0), 1);
}

/** Spent share of the oxide at `s` (0 separator … 1 can): the front moves outward with life. */
export function oxideSpent(s: number, life: number): number {
  const front = 1.12 * Math.min(Math.max(life, 0), 1) ** 1.25;
  return Math.min(Math.max((front - s) / 0.22 + 0.5, 0), 1);
}

const C = {
  film: col('ink'),
  band: col('amber'),
  steel: col('steel'),
  cathode: col('ink').lerp(col('bg.void'), 0.2),
  cathodeSpent: col('slate').lerp(col('steel'), 0.35),
  seam: col('ink').multiplyScalar(0.6),
  separator: col('sky').lerp(col('white'), 0.35),
  paste: col('ink').lerp(col('slate'), 0.22).lerp(col('sky'), 0.1),
  pasteSpent: col('ink').lerp(col('mist'), 0.62),
  pin: col('amber.dark'),
  seal: col('white'),
  cap: col('steel'),
  air: col('bg.deep'),
  lift: col('white'),
};

/**
 * Colour of a cell for this life and highlight: `hi` = how much each layer is highlighted 0…1, `focus` = the
 * largest of them (the other layers step back by up to 40 %).
 */
export function cellColor(
  cell: Cell,
  life: number,
  hi: Readonly<Record<BatteryLayer, number>>,
  focus: number,
  out: Color,
): Color {
  switch (cell.stuff) {
    case 'cathode':
      out.copy(C.cathode).lerp(C.cathodeSpent, oxideSpent(cell.s, life));
      break;
    case 'paste':
      out.copy(C.paste).lerp(C.pasteSpent, zincSpent(cell.s, life));
      break;
    default:
      out.copy(C[cell.stuff]);
  }
  const h = hi[cell.layer];
  if (cell.stuff !== 'air') out.lerp(C.lift, 0.22 * h);
  return out.multiplyScalar(1 - 0.4 * focus * (1 - h));
}
