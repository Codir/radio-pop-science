/**
 * Inside a film capacitor (docs/volumes/electronics/VISUAL.md §7; batch E4, `capacitor-kinds/film`): the floor
 * `inside` of the door's dive into the dark cherry box, opened on its place by the door's `cut` — the roll of
 * metallised film. Never `film` by name: `film.ts` is the resistor's carbon film, and `shared/parts` has the film box.
 *
 * What is drawn, in the part's body frame (x from leg 0 to leg 1, the box over the board from `RADIAL_Y`): the box cut
 * in half along the axis of its winding — the body's x at the box's middle height, the legs' axis, as in a real film
 * capacitor — by the upright plane through that axis on the reader's side (`wedge.ts` about x, `ROLL.wedge` 180°,
 * `upright`: the front half taken away). Everything the plane meets has its face on it, one mesh:
 * - the roll along the axis, pressed flat to the box's shape (an oval): two strips of polyester film (`mist`), each
 *   with a thin layer of metal (`steel`) on it, wound together — on the section the film and the metal take turns,
 *   the first strip's metal reaching the end by leg 0 and stopping short of the other (a bare edge), the second's the
 *   other way round, so each plate meets its own leg only; its flattened core;
 * - the ends of the roll sprayed with metal (`steel`), and the leads (the legs' colour) from the box's bottom up
 *   against them — where the legs come in;
 * - the potting between the roll and the box (darker than the box), the box's shell in its own colour.
 * The view is static: the box is not in a circuit, so nothing moves and no charge is drawn. The turns are three
 * (`ROLL.turns`) and thick, for the layers to be seen; a real part's film is thinner than a hair, its turns hundreds.
 *
 * Draw calls while open: the inside's one — the section, both its faces (over the axis and under it) in one mesh; with
 * the part's box and legs three (the print on the half the cut takes goes with it, `printKeeper`). None of the inside
 * while the part is whole.
 */
import { Group, Mesh, Vector3, type Color, type Material, type Object3D } from 'three';
import { col, type KToonMaterial } from '@/style';
import { BOARD_SPEC } from '@electronics/sim/board';
import { FILM as BOX, FILM_BODY, RADIAL_Y, type PartModel } from '../parts';
import { LEG_COLOR, mix } from '../parts/part';
import {
  INSET,
  createSection,
  createWedge,
  pointOf,
  printKeeper,
  tangentOf,
  type Cutaway,
  type SectionLayer,
} from './wedge';

const P = BOARD_SPEC.pitch;

/** The numbers of the view, in the body frame's units (VISUAL §7, «Числа прольоту»). */
export const ROLL = {
  /** The cut at `cut` 1: half the box, the upright plane through the winding's axis on the reader's side. */
  wedge: Math.PI,
  /** The box's shell in the section. */
  wall: 0.02,
  /** The potting kept between the roll and the shell: across (z) and up and down (y). */
  potting: { across: 0.012, along: 0.045 },
  /** The turns of the pair of strips, the flattened core they are wound on (a share of the oval), the shares of a turn:
   * film, metal, film, metal. */
  turns: 3,
  core: 0.12,
  share: { film: 0.32, metal: 0.18 },
  /** The bare edge where a strip's metal stops short of the far end. */
  margin: 0.04,
  /** The sprayed metal ends: thick along the axis, standing out of the roll's oval by `proud`. */
  spray: { thick: 0.035, proud: 0.008 },
  /** The leads in the box: their radius; how far over the axis their tops reach (a share of the roll's half-height). */
  lead: { radius: 0.022, top: 0.1 },
} as const;

/** What the roll shows, for the checks. */
export interface RollState {
  readonly turns: number;
  readonly open: boolean;
  readonly amount: number;
  /** The texts of the print the cut has taken. */
  readonly printHidden: number;
  readonly drawCalls: number;
  readonly insideCalls: number;
}

/** The points a callout may point at: a layer of metal near leg 0, a layer of film near leg 1. */
export type RollAnchor = 'metal' | 'film';

export interface Roll extends Cutaway {
  /** Which inner view this is (`asRoll`). */
  readonly what: 'roll';
  readonly group: Group;
  /** Opens by `t` 0 … 1 on the side last given to `set` (the door's `cut`). */
  cut(t: number): void;
  /** A world point for a callout, on the section over the axis. */
  anchor(name: RollAnchor, out: Vector3): Vector3;
  state(): RollState;
}

/** The geometry of the view (body frame): the box, the roll, the sprayed ends, the leads. */
export function rollLayout() {
  const { wall, potting, spray, lead } = ROLL;
  const hy = BOX.height / 2;
  const hz = BOX.depth / 2;
  const axisY = RADIAL_Y + hy;
  const inner = { x: BOX.width / 2 - wall, y: hy - wall, z: hz - wall };
  const roll = { y: inner.y - potting.along, z: inner.z - potting.across };
  const sprayOut = P - lead.radius;
  return {
    axisY,
    /** The box's half-extents outside and inside its shell, its corners' rounding. */
    box: { x: BOX.width / 2, y: hy, z: hz, corner: BOX.corner },
    inner: { ...inner, corner: Math.max(BOX.corner - wall, 0.005) },
    /** The roll's oval (half-height, half-depth) and its ends; the sprayed ends' oval and their outer faces. */
    roll: { ...roll, end: sprayOut - spray.thick },
    spray: { y: roll.y + spray.proud, z: roll.z + spray.proud, end: sprayOut },
    /** Leg 0's lead at −`x`, leg 1's at +`x`: from the box's bottom up against its sprayed end, over the axis. */
    lead: { x: P, radius: lead.radius, bottom: RADIAL_Y, top: axisY + lead.top * roll.y },
  };
}

/** How far from the axis an oval of half-height `a` and half-depth `b` reaches at the angle `theta` (from +y to +z). */
export function ovalReach(a: number, b: number, theta: number): number {
  const c = Math.cos(theta) / a;
  const s = Math.sin(theta) / b;
  return 1 / Math.sqrt(c * c + s * s);
}

/** How far from the axis a box of half-height `a`, half-depth `b`, its edges rounded by `k`, reaches at `theta`. */
export function boxReach(a: number, b: number, k: number, theta: number): number {
  const c = Math.abs(Math.cos(theta));
  const s = Math.abs(Math.sin(theta));
  const t = Math.min(c > 1e-12 ? a / c : Infinity, s > 1e-12 ? b / s : Infinity);
  const py = t * c;
  const pz = t * s;
  if (py <= a - k || pz <= b - k) return t;
  // the rounded edge: the far crossing of the ray with the corner's circle
  const cy = a - k;
  const cz = b - k;
  const along = c * cy + s * cz;
  const d = along * along - (cy * cy + cz * cz - k * k);
  return along + Math.sqrt(Math.max(d, 0));
}

/**
 * Where an upright round bar — |z| ≤ `radius`, from height `bottom` to `top` (body frame) — meets the face at `theta`
 * about the axis at `axisY`: its radii there, or none ([r, r] with r its start, empty).
 */
export function uprightOnFace(
  axisY: number,
  radius: number,
  bottom: number,
  top: number,
  theta: number,
): [number, number] {
  const c = Math.cos(theta);
  const s = Math.abs(Math.sin(theta));
  const reach = s > 1e-12 ? radius / s : Infinity;
  let r0: number;
  let r1: number;
  if (Math.abs(c) < 1e-12) return [0, 0];
  if (c > 0) [r0, r1] = [(bottom - axisY) / c, (top - axisY) / c];
  else [r0, r1] = [(axisY - top) / -c, (axisY - bottom) / -c];
  r0 = Math.max(r0, 0);
  r1 = Math.min(r1, reach);
  return r1 > r0 ? [r0, r1] : [r0, r0];
}

/** The view inside the film capacitor `part` (its model from `shared/parts`, the film box), closed. */
export function createRoll(part: PartModel): Roll {
  const L = rollLayout();
  const group = new Group();
  group.name = `${part.key}:roll`;
  group.visible = false;

  const wedge = createWedge(part, ROLL.wedge, L.axisY, new Set(part.prints), { axis: 'x', upright: true });
  const prints = printKeeper(part, wedge);

  /* ----------------------------------------------------------------------------------- the section */

  const shell = col(FILM_BODY);
  const potting = mix(FILM_BODY, 'ink', 0.4);
  const filmColor = col('mist');
  const metalColor = col('steel');
  const coreColor = mix('ink', 'slate', 0.2);
  // (the faces stand INSET off the cut's plane: kept a hair in from the box's surface, so they never stand out of it)
  const outer = (_u: number, th: number): number => boxReach(L.box.y, L.box.z, L.box.corner, th) - 2 * INSET;
  const inner = (_u: number, th: number): number => boxReach(L.inner.y, L.inner.z, L.inner.corner, th);
  const rollR = (th: number): number => ovalReach(L.roll.y, L.roll.z, th);
  const sprayR = (_u: number, th: number): number => ovalReach(L.spray.y, L.spray.z, th);
  const lead = (th: number): [number, number] => {
    const [a, b] = uprightOnFace(L.axisY, L.lead.radius, L.lead.bottom, L.lead.top, th);
    if (!(b > a)) return [inner(0, th), inner(0, th)];
    // where the lead runs down to the box's bottom it goes out through the shell to its leg
    return [a, b >= inner(0, th) ? Math.max(b, outer(0, th)) : b];
  };
  const at = (v: number) => () => v;
  /** A layer from `u0` to `u1` along the axis. */
  const layer = (
    u0: number,
    u1: number,
    r0: SectionLayer['r0'],
    r1: SectionLayer['r1'],
    color: Color,
  ): SectionLayer => ({ u0, u1, r0, r1, color, steps: 1 });
  /** A layer of the roll between the shares `s0` and `s1` of its oval. */
  const ring = (u0: number, u1: number, s0: number, s1: number, color: Color): SectionLayer =>
    layer(
      u0,
      u1,
      (_u, th) => s0 * rollR(th),
      (_u, th) => s1 * rollR(th),
      color,
    );
  const layers: SectionLayer[] = [];
  const { x: X } = L.box;
  const Xi = L.inner.x;
  const S = L.spray.end;
  const E = L.roll.end;
  const R = L.lead.radius;
  for (const sign of [-1, 1]) {
    const span = (a: number, b: number): [number, number] => (sign < 0 ? [-b, -a] : [a, b]);
    // the box's end wall; the potting and the shell beyond the lead
    layers.push(layer(...span(Xi, X), at(0), outer, shell));
    layers.push(layer(...span(L.lead.x + R, Xi), at(0), inner, potting));
    layers.push(layer(...span(L.lead.x + R, Xi), inner, outer, shell));
    // the lead's column: potting under the lead's top, the lead (out through the shell), what of the shell it leaves
    const [l0, l1] = span(L.lead.x - R, L.lead.x + R);
    layers.push(layer(l0, l1, at(0), (_u, th) => Math.min(lead(th)[0], inner(0, th)), potting));
    layers.push(layer(l0, l1, (_u, th) => lead(th)[0], (_u, th) => lead(th)[1], LEG_COLOR));
    layers.push(layer(l0, l1, (_u, th) => lead(th)[1], inner, potting));
    layers.push(layer(l0, l1, (_u, th) => Math.max(lead(th)[1], inner(0, th)), outer, shell));
    // the sprayed end, the potting round it, the shell
    layers.push(layer(...span(E, S), at(0), sprayR, metalColor));
    layers.push(layer(...span(E, S), sprayR, inner, potting));
    layers.push(layer(...span(E, S), inner, outer, shell));
  }
  // the roll, the potting round it, the shell
  layers.push(layer(-E, E, (_u, th) => rollR(th), inner, potting));
  layers.push(layer(-E, E, inner, outer, shell));
  // the roll: its flattened core, then each turn's film, metal (the first strip's, bare by leg 1), film, metal (the
  // second's, bare by leg 0)
  const { turns, core, share, margin } = ROLL;
  layers.push(ring(-E, E, 0, core, coreColor));
  const turn = (1 - core) / turns;
  /** The shares of the oval where each layer of turn `k` begins: film, metal, film, metal, and where the turn ends. */
  const bounds = (k: number): [number, number, number, number, number] => {
    const b0 = core + k * turn;
    const f = share.film * turn;
    const m = share.metal * turn;
    return [b0, b0 + f, b0 + f + m, b0 + 2 * f + m, b0 + turn];
  };
  for (let k = 0; k < turns; k++) {
    const [a, b, c, d, e] = bounds(k);
    layers.push(ring(-E, E, a, b, filmColor));
    layers.push(ring(-E, E - margin, b, c, metalColor));
    layers.push(ring(E - margin, E, b, c, filmColor));
    layers.push(ring(-E, E, c, d, filmColor));
    layers.push(ring(-E + margin, E, d, e, metalColor));
    layers.push(ring(-E, -E + margin, d, e, filmColor));
  }
  const section = createSection('x', L.axisY, layers);
  // the faces take the box's own material (its heat with it), clipping nothing
  const skinFrom = part.body[0] as KToonMaterial;
  const skin = skinFrom.clone();
  skin.name = 'roll.section';
  if (skinFrom.uniforms.uKHeat) skin.uniforms.uKHeat = skinFrom.uniforms.uKHeat;
  skin.clippingPlanes = [];
  const faces = new Mesh(section.geometry, skin);
  faces.name = 'roll:faces';
  faces.castShadow = false;
  faces.receiveShadow = true;
  group.add(faces);
  part.bodyGroup.add(group);

  let view = new Vector3(0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3));
  const open = (): boolean => wedge.open;
  const n = new Vector3();
  const roll: Roll = {
    what: 'roll',
    group,
    get amount() {
      return wedge.amount;
    },
    get open() {
      return open();
    },
    set(cut, v) {
      if (v.lengthSq() > 0) view = v.clone().normalize();
      wedge.set(cut, view);
      prints.update();
      group.visible = open();
      if (open()) section.pose(wedge.alpha - wedge.half, wedge.alpha + wedge.half);
    },
    cut(t) {
      roll.set(t, view);
    },
    anchor(name, out) {
      // on face 0 (over the axis as the camera sees it): a metal layer of the middle turn near leg 0, where the first
      // strip's metal is; a film layer of the same turn near leg 1
      const theta = wedge.alpha - wedge.half;
      const [, b, c, d] = bounds(1);
      const s = name === 'metal' ? (b + c) / 2 : (c + d) / 2;
      pointOf('x', L.axisY, name === 'metal' ? -0.09 : 0.09, s * rollR(theta), theta, out);
      out.addScaledVector(tangentOf('x', theta, n), -INSET);
      part.bodyGroup.updateWorldMatrix(true, false);
      return part.bodyGroup.localToWorld(out);
    },
    state() {
      let calls = 0;
      let insideCalls = 0;
      part.bodyGroup.traverseVisible((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const mat = m.material as Material | Material[];
        if (!(Array.isArray(mat) ? mat : [mat]).some((x) => x.visible)) return;
        calls++;
        for (let p: Object3D | null = m; p; p = p.parent) if (p === group) insideCalls++;
      });
      return {
        turns: ROLL.turns,
        open: open(),
        amount: wedge.amount,
        printHidden: prints.hidden(),
        drawCalls: calls,
        insideCalls,
      };
    },
    dispose() {
      wedge.dispose();
      prints.dispose();
      group.removeFromParent();
      faces.geometry.dispose();
      skin.dispose();
    },
  };
  return roll;
}

/** The roll of a door's cutaway, when the part's inside is a film capacitor's. */
export function asRoll(c: Cutaway | null): Roll | null {
  return c !== null && 'what' in c && (c as Roll).what === 'roll' ? (c as Roll) : null;
}
