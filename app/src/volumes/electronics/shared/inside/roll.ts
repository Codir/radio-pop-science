/**
 * Inside a film capacitor (docs/volumes/electronics/VISUAL.md §7; batch E4, `capacitor-kinds/film`): the floor
 * `inside` of the door's dive into the dark cherry box, opened on its place by the door's `cut` — the roll of
 * metallised film. Never `film` by name: `film.ts` is the resistor's carbon film, and `shared/parts` has the film box.
 *
 * What is drawn, in the part's body frame (x from leg 0 to leg 1, the box over the board from `RADIAL_Y`): the box cut
 * in half along the axis of its winding — the body's x at the box's middle height, the legs' axis, as in a real film
 * capacitor — by the upright plane through that axis on the reader's side (`wedge.ts` about x, `ROLL.wedge` 180°,
 * `upright`: the front half taken away), all but one corner. Everything the plane meets has its face on it, one mesh:
 * - the roll along the axis, pressed flat to the box's shape (an oval): two strips of polyester film (`mist`), each
 *   with a thin layer of metal (`steel`) on it, wound together into a spiral (`windAt`) — on the section the film and
 *   the metal take turns, the first strip's metal reaching the end by leg 0 and stopping short of the other (a bare
 *   edge), the second's the other way round, so each plate meets its own leg only; its flattened core inside, a wrap
 *   of bare film outside;
 * - the ends of the roll sprayed with metal (`steel`), and the leads (the legs' colour) from the box's bottom up
 *   against them — where the legs come in;
 * - the potting between the roll and the box (darker than the box), the box's shell in its own colour.
 * The corner by leg 1 under the plane `ROLL.corner` — across the winding, rising toward leg 1 — stays standing on the
 * reader's side (`WedgeOptions.keep`); its face on that plane cuts the roll across, so the turns show there as the
 * spiral they are, the layers of the upright section bending round into them (the second mesh). Leg 0's end and lead
 * show whole; leg 1's lead rises over the corner's plane (`ROLL.lead.top`), so it shows going into its end above the
 * corner, and cut across on the corner's face (leg 1's leg under the box the corner hides from the door's camera).
 * The view is static: the box is not in a circuit, so nothing moves and no charge is drawn. The turns are three
 * (`ROLL.turns`) and thick, for the layers to be seen; a real part's film is thinner than a hair, its turns hundreds.
 *
 * Draw calls while open: the inside's two — the upright section, both its faces (over the axis and under it) in one
 * mesh, and the corner's face across the winding; with the part's box and legs four (the print on the half the cut
 * takes goes with it, `printKeeper`). None of the inside while the part is whole.
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3, type Color, type Material, type Object3D } from 'three';
import { col, type KToonMaterial } from '@/style';
import { BOARD_SPEC } from '@electronics/sim/board';
import { FILM as BOX, FILM_BODY, RADIAL_Y, type PartModel } from '../parts';
import { LEG_COLOR, mix } from '../parts/part';
import {
  INSET,
  SLIVER,
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
  /**
   * The turns of the pair of strips; the flattened core they are wound on (a share of the oval); the shares of a turn:
   * film, metal, film, metal. The spiral takes one turn more of room than its turns (`windAt`).
   */
  turns: 3,
  core: 0.12,
  share: { film: 0.32, metal: 0.18 },
  /** The bare edge where a strip's metal stops short of the far end. */
  margin: 0.04,
  /** The sprayed metal ends: thick along the axis, standing out of the roll's oval by `proud`. */
  spray: { thick: 0.035, proud: 0.008 },
  /**
   * The leads in the box: their radius; how far over the axis their tops reach (a share of the roll's half-height) —
   * welded up the sprayed end, leg 1's well over the corner's plane (`corner`), so the camera sees it go in there too.
   */
  lead: { radius: 0.022, top: 0.6 },
  /**
   * The corner kept by leg 1: the plane through the axis where the first strip's metal stops (`margin` in from the
   * roll's end), rising toward leg 1 by `slope` along the axis per unit of height; under it the reader's half stands.
   * Its face is a fan of `steps` about the axis.
   */
  corner: { slope: 0.8, steps: 72 },
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

/** The geometry of the view (body frame): the box, the roll, the sprayed ends, the leads, the corner kept. */
export function rollLayout() {
  const { wall, potting, spray, lead, margin, corner } = ROLL;
  const hy = BOX.height / 2;
  const hz = BOX.depth / 2;
  const axisY = RADIAL_Y + hy;
  const inner = { x: BOX.width / 2 - wall, y: hy - wall, z: hz - wall };
  const roll = { y: inner.y - potting.along, z: inner.z - potting.across };
  const sprayOut = P - lead.radius;
  const end = sprayOut - spray.thick;
  return {
    axisY,
    /** The box's half-extents outside and inside its shell, its corners' rounding. */
    box: { x: BOX.width / 2, y: hy, z: hz, corner: BOX.corner },
    inner: { ...inner, corner: Math.max(BOX.corner - wall, 0.005) },
    /** The roll's oval (half-height, half-depth) and its ends; the sprayed ends' oval and their outer faces. */
    roll: { ...roll, end },
    spray: { y: roll.y + spray.proud, z: roll.z + spray.proud, end: sprayOut },
    /** Leg 0's lead at −`x`, leg 1's at +`x`: from the box's bottom up against its sprayed end, over the axis. */
    lead: { x: P, radius: lead.radius, bottom: RADIAL_Y, top: axisY + lead.top * roll.y },
    /**
     * The plane of the corner kept: x = `x` + `slope` · (y − axisY); the corner (toward +x, down) is where
     * x − slope · (y − axisY) > `x`.
     */
    corner: { x: end - margin, slope: corner.slope },
  };
}

/**
 * The winding at the angle `theta` about the axis (as `radialOf` measures it about x: from +y toward +z), as shares of
 * the roll's oval: the bundle of the two strips starts at the core straight behind the cut (−z) and winds out as
 * `theta` grows, so turn `k` begins `core + turn · (k + f)`, `f` the share of a turn from there. `core` — the core and
 * the empty start of the spiral; `layers(k)` — where turn k's film, metal (the first strip's), film, metal (the
 * second's) begin and where the turn ends; `wrap` — where the bare film round the outside begins.
 */
export function windAt(theta: number): {
  core: number;
  wrap: number;
  turn: number;
  layers(k: number): [number, number, number, number, number];
} {
  const { core, turns, share } = ROLL;
  const turn = (1 - core) / (turns + 1);
  const a = (theta + Math.PI / 2) / (2 * Math.PI);
  const f = a - Math.floor(a);
  const start = core + turn * f;
  return {
    core: start,
    wrap: start + turn * turns,
    turn,
    layers(k) {
      const b0 = start + k * turn;
      const film = share.film * turn;
      const metal = share.metal * turn;
      return [b0, b0 + film, b0 + film + metal, b0 + 2 * film + metal, b0 + turn];
    },
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

const LAYOUT = rollLayout();

/** The point at `rho` from the axis at the angle `theta`, on the corner's plane (body frame). */
export function cornerPoint(rho: number, theta: number, out = new Vector3()): Vector3 {
  const up = rho * Math.cos(theta);
  return out.set(LAYOUT.corner.x + LAYOUT.corner.slope * up, LAYOUT.axisY + up, rho * Math.sin(theta));
}

/** Whether a point of the body frame is in the rounded box, `inset` in from its surface. */
function inBox(L: ReturnType<typeof rollLayout>, p: Vector3, inset: number): boolean {
  const k = L.box.corner;
  const qx = Math.abs(p.x) - (L.box.x - k);
  const qy = Math.abs(p.y - L.axisY) - (L.box.y - k);
  const qz = Math.abs(p.z) - (L.box.z - k);
  const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return out + Math.min(Math.max(qx, qy, qz), 0) - k <= -inset;
}

/**
 * The corner's face on its plane, as one mesh's geometry: the section's own layers (`layers`, each a stretch along the
 * axis and two radii at each angle) where the plane meets them — the plane runs along the axis as it rises, so each
 * layer's stretch is a band of radii at each angle — laid as a fan about the axis between the wedge's bounds, where the
 * wedge clips the corner (`SLIVER` into it), facing out of it, out to the box's surface. A fixed number of vertices; a
 * band that ends between two angles ends at the angle where it does.
 */
function createCornerFace(layers: readonly SectionLayer[]): {
  geometry: BufferGeometry;
  pose(b1: number, b2: number): void;
} {
  const L = LAYOUT;
  const { x: cx, slope } = L.corner;
  const steps = ROLL.corner.steps;
  // only the layers whose stretch the plane can reach: from where it meets the box's bottom to the box's end
  const reach = Math.hypot(L.box.y, L.box.z);
  const near = layers.filter((l) => l.u1 >= cx - slope * reach && l.u0 <= L.box.x);
  const count = near.length * steps * 6;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new BufferAttribute(nor, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  // the face looks out of the corner, up and toward leg 0; it stands where the wedge's plane clips the box, its hair
  // (`SLIVER`) into the corner, out to the box's surface: the box's own faces end at its edge, with no seam between
  const outward = new Vector3(-1, slope, 0).normalize();
  const inset = outward.clone().multiplyScalar(-SLIVER);
  const probe = new Vector3();
  /** How far the face reaches in the box at `theta`: to its surface (bisection: the box is convex, the axis inside). */
  const boxAt = (theta: number): number => {
    let lo = 0;
    let hi = 2 * reach;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (inBox(L, cornerPoint(mid, theta, probe).add(inset), 0)) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  /** The band of radii of layer `l` on the plane at `theta`: where its stretch along the axis meets the plane. */
  const band = (l: SectionLayer, theta: number, box: number): [number, number] => {
    const g = slope * Math.cos(theta);
    let a = 0;
    let b = Infinity;
    if (Math.abs(g) < 1e-12) {
      if (cx < l.u0 || cx > l.u1) return [0, 0];
    } else {
      const r0 = (l.u0 - cx) / g;
      const r1 = (l.u1 - cx) / g;
      a = Math.min(r0, r1);
      b = Math.max(r0, r1);
    }
    const u = (l.u0 + l.u1) / 2;
    // (a layer out to the box's surface — kept a hair in on the upright section — goes out to it here)
    const r1 = l.r1(u, theta);
    return [Math.max(a, l.r0(u, theta), 0), Math.min(b, r1 >= box - 3 * INSET ? box : r1, box)];
  };
  const corners = [new Vector3(), new Vector3(), new Vector3(), new Vector3()] as const;
  return {
    geometry,
    pose(b1, b2) {
      const thetas = Array.from({ length: steps + 1 }, (_, j) => b1 + ((b2 - b1) * j) / steps);
      const boxes = thetas.map(boxAt);
      let k = 0;
      for (const l of near) {
        const c = typeof l.color === 'function' ? l.color((b1 + b2) / 2) : l.color;
        for (let j = 0; j < steps; j++) {
          let ta = thetas[j]!;
          let tb = thetas[j + 1]!;
          let [a0, a1] = band(l, ta, boxes[j]!);
          let [b0, b1r] = band(l, tb, boxes[j + 1]!);
          const fullA = a1 > a0;
          const fullB = b1r > b0;
          const [p, q, r, s] = corners;
          if (!fullA && !fullB) {
            // none of it here: a point on the axis, in the box
            cornerPoint(0, ta, p).add(inset);
            q.copy(p);
            r.copy(p);
            s.copy(p);
          } else {
            if (fullA !== fullB) {
              // the band ends between the two angles: find where, and end it there in a point
              // (the box's reach between the two angles: as good as straight)
              const boxIn = (t: number): number =>
                boxes[j]! + ((boxes[j + 1]! - boxes[j]!) * (t - thetas[j]!)) / (thetas[j + 1]! - thetas[j]!);
              let lo = fullA ? ta : tb;
              let hi = fullA ? tb : ta;
              for (let i = 0; i < 24; i++) {
                const mid = (lo + hi) / 2;
                const [m0, m1] = band(l, mid, boxIn(mid));
                if (m1 > m0) lo = mid;
                else hi = mid;
              }
              const edge = boxAt(lo);
              const [e0, e1] = band(l, lo, Math.min(boxIn(lo), edge));
              const e = Math.min((e0 + Math.max(e1, e0)) / 2, edge);
              if (fullA) {
                tb = lo;
                [b0, b1r] = [e, e];
              } else {
                ta = lo;
                [a0, a1] = [e, e];
              }
            }
            cornerPoint(a0, ta, p).add(inset);
            cornerPoint(b0, tb, q).add(inset);
            cornerPoint(Math.max(b1r, b0), tb, r).add(inset);
            cornerPoint(Math.max(a1, a0), ta, s).add(inset);
          }
          // (q − p) × (r − p) points out of the corner while the angle grows: wound so
          for (const v of [p, q, r, p, r, s]) {
            pos[3 * k] = v.x;
            pos[3 * k + 1] = v.y;
            pos[3 * k + 2] = v.z;
            nor[3 * k] = outward.x;
            nor[3 * k + 1] = outward.y;
            nor[3 * k + 2] = outward.z;
            colors[3 * k] = c.r;
            colors[3 * k + 1] = c.g;
            colors[3 * k + 2] = c.b;
            k++;
          }
        }
      }
      for (const name of ['position', 'normal', 'color']) geometry.getAttribute(name).needsUpdate = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    },
  };
}

/** The view inside the film capacitor `part` (its model from `shared/parts`, the film box), closed. */
export function createRoll(part: PartModel): Roll {
  const L = rollLayout();
  const group = new Group();
  group.name = `${part.key}:roll`;
  group.visible = false;

  const keep = {
    normal: new Vector3(1, -L.corner.slope, 0).normalize(),
    point: new Vector3(L.corner.x, L.axisY, 0),
  };
  const wedge = createWedge(part, ROLL.wedge, L.axisY, new Set(part.prints), { axis: 'x', upright: true, keep });
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
  /** A layer of the roll between the shares `s0` and `s1` of its oval at each angle (`windAt`). */
  const ring = (
    u0: number,
    u1: number,
    s0: (th: number) => number,
    s1: (th: number) => number,
    color: Color,
  ): SectionLayer =>
    layer(
      u0,
      u1,
      (_u, th) => s0(th) * rollR(th),
      (_u, th) => s1(th) * rollR(th),
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
  // the roll: its flattened core and the spiral's empty start, then each turn's film, metal (the first strip's, bare by
  // leg 1), film, metal (the second's, bare by leg 0), and the bare film wrapped round the outside
  const { turns, margin } = ROLL;
  const wound = (pick: (w: ReturnType<typeof windAt>) => number) => (th: number) => pick(windAt(th));
  layers.push(ring(-E, E, at(0), wound((w) => w.core), coreColor));
  for (let k = 0; k < turns; k++) {
    const edge = (i: number) => wound((w) => w.layers(k)[i]!);
    layers.push(ring(-E, E, edge(0), edge(1), filmColor));
    layers.push(ring(-E, E - margin, edge(1), edge(2), metalColor));
    layers.push(ring(E - margin, E, edge(1), edge(2), filmColor));
    layers.push(ring(-E, E, edge(2), edge(3), filmColor));
    layers.push(ring(-E + margin, E, edge(3), edge(4), metalColor));
    layers.push(ring(-E, -E + margin, edge(3), edge(4), filmColor));
  }
  layers.push(ring(-E, E, wound((w) => w.wrap), at(1), filmColor));
  const section = createSection('x', L.axisY, layers);
  const corner = createCornerFace(layers);
  // the faces take the box's own material (its heat with it), clipping nothing
  const skinFrom = part.body[0] as KToonMaterial;
  const skin = skinFrom.clone();
  skin.name = 'roll.section';
  if (skinFrom.uniforms.uKHeat) skin.uniforms.uKHeat = skinFrom.uniforms.uKHeat;
  skin.clippingPlanes = [];
  const faces = new Mesh(section.geometry, skin);
  faces.name = 'roll:faces';
  const across = new Mesh(corner.geometry, skin);
  across.name = 'roll:corner';
  for (const m of [faces, across]) {
    m.castShadow = false;
    m.receiveShadow = true;
  }
  group.add(faces, across);
  part.bodyGroup.add(group);

  let view = new Vector3(0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3));
  const open = (): boolean => wedge.open;
  const n = new Vector3();
  let posed: [number, number] | null = null;
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
      if (!open()) return;
      const b1 = wedge.alpha - wedge.half;
      const b2 = wedge.alpha + wedge.half;
      section.pose(b1, b2);
      if (!posed || posed[0] !== b1 || posed[1] !== b2) {
        posed = [b1, b2];
        corner.pose(b1, b2);
      }
    },
    cut(t) {
      roll.set(t, view);
    },
    anchor(name, out) {
      // on face 0 (over the axis as the camera sees it): a metal layer of the middle turn near leg 0, where the first
      // strip's metal is; a film layer of the same turn near leg 1
      const theta = wedge.alpha - wedge.half;
      const [, b, c, d] = windAt(theta).layers(1);
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
      across.geometry.dispose();
      skin.dispose();
    },
  };
  return roll;
}

/** The roll of a door's cutaway, when the part's inside is a film capacitor's. */
export function asRoll(c: Cutaway | null): Roll | null {
  return c !== null && 'what' in c && (c as Roll).what === 'roll' ? (c as Roll) : null;
}
