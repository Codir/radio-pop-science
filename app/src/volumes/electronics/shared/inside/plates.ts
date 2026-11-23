/**
 * Inside an electrolytic capacitor (docs/volumes/electronics/VISUAL.md §7; plan decision 11 of batch E4): the floor
 * `inside` of the door's dive into a can, opened on its place by the door's `cut` — two plates with the charges the
 * circuit model puts on them.
 *
 * What is drawn, in the part's body frame (the can's axis the vertical y through the origin, leg 0 — the plus — at
 * −P/2 along x, leg 1 — the minus, under the sleeve's stripe — at +P/2):
 * - the can cut in half along its axis (`wedge.ts` with the axis 'y', `PLATES.wedge` 180° on the camera's side), and
 *   everything in it: two steel plates along the legs, the plus one over leg 0, the minus one over leg 1, a thin
 *   insulator between them (`mist`, the lit translucent `sheath()`, never `K.glass`, which shines in the dark), the
 *   leads from the legs up through the bung to the bottom of their plates, the can's inner wall and bottom;
 * - the section faces of all of it, as one mesh (`createSection`): the sleeve (`ink`, `mist` on the stripe's side) over
 *   the aluminium wall, the bung, the aluminium top (a bulged one domed), the plates, the leads, the insulator;
 * - the charges (the library's orbs, no glow, VISUAL §1.5): «+» (`coral`, the proton's look) on the inner side of the
 *   plus plate and electrons (`cyan`) on the minus plate's, pair facing pair — as many as `chargeCount` of the
 *   voltage across the capacitance (`InsideState.volts`, the model's `PartMemory.volts`, never the voltage between the
 *   legs), on the half of the plates the cut leaves; charged the other way round, the «+» sit on the minus plate and the
 *   electrons on the plus one;
 * - electrons in the legs — on the leg under the can and on the cut lead inside — drifting at `electronSpeed` of the
 *   model's current into leg 0, the resistor's own rule: charging, out of the plus plate down leg 0 and up leg 1 into
 *   the minus plate; giving the charge back, the other way.
 * Bulged (`bulged`), the insulator is broken through — a dark crack — and there are no charges (the model's bulged can
 * holds none: its voltage is 0). No halos, no field lines: three hue families with the room (blue, `cyan`, `coral`).
 *
 * Honest drawing (`docs/volumes/electronics/chapters/capacitor.md`, «Докладніше» of `inside`): a real can's plates are
 * long foils rolled up; the picture is two plates, and the number of charges follows the voltage of this one part (the
 * same N for every size: two cans are not compared by it). The electrons' speed says only what current flows.
 *
 * Draw calls while open: the inside's six at most — the plates with the leads (one mesh), the inner wall and bottom
 * (and, bulged, the crack) in one, the insulator, the section faces, the «+», the electrons; with the part's own sleeve,
 * top (or its bulged dome) and legs nine at most (`state().drawCalls`). The print on the half the cut takes goes with
 * it (`printKeeper`). None of the inside while the part is whole.
 */
import { BufferGeometry, Group, Matrix4, Mesh, Vector3, type Color, type Material, type Object3D } from 'three';
import { Builder, G } from '@/kit';
import { K, col, type KToonMaterial } from '@/style';
import { ORB_STYLES, createOrbs, type Orbs } from '@/fx';
import { PARTS } from '@electronics/sim/core';
import { BOARD_SPEC } from '@electronics/sim/board';
import { sheath, tame } from '../bench/materials';
import { CAN, MM, RADIAL_Y, electrolyticCan, sleeveProfile, type PartModel } from '../parts';
import { CRACK_COLOR, LEG, LEG_COLOR, mix, radialLegs } from '../parts/part';
import { electronSpeed } from './film';
import {
  INSET,
  createSection,
  createWedge,
  printKeeper,
  type Cutaway,
  type InsideState,
  type SectionLayer,
} from './wedge';

const P = BOARD_SPEC.pitch;

/** The numbers of the view, in the body frame's units (VISUAL §7, «Числа прольоту»). */
export const PLATES = {
  /** The cut at `cut` 1: half the can, the plane through its axis across the line of sight. */
  wedge: Math.PI,
  /** The can's wall in the section (the sleeve over the aluminium): the inside starts this far in from the side. */
  wall: 0.045,
  /** The sleeve's own share of it. */
  sleeve: 0.01,
  /**
   * The plates: their thickness; their bottom over the bung and their top under the top's underside, shares of the
   * can's height (the leads run up to the bottom; under the top the camera sees down along the plates); how far in
   * from the wall they keep.
   */
  plate: { thick: 0.03, low: 0.18, high: 0.2, margin: 0.03 },
  /** The insulator: its thickness; how far past the plates it stands, up and down; how far in from the wall. */
  insulator: { thick: 0.04, over: 0.03, margin: 0.02 },
  /** The charges on each plate at `volts` (`chargeCount`), their radius, how far their middles stand off the plate (a
   * share of the radius: the rest of the ball sinks into it), how far from the plate's edges and the cut. */
  charges: { count: 60, volts: 9, radius: 0.024, off: 0.35, margin: 1.3 },
  /** The electrons in each leg, their size as a share of the charges'. */
  electrons: { perLeg: 12, scale: 0.7 },
  /** The crack of a bulged can's insulator: its tube's radius, its bends. */
  crack: { radius: 0.007, bends: 9 },
} as const;

/** The charges on each plate for the voltage across the capacitance: round(N · |V| / 9), held to 0 … N. */
export function chargeCount(volts: number): number {
  if (!Number.isFinite(volts)) return 0;
  const { count, volts: full } = PLATES.charges;
  return Math.min(count, Math.round((count * Math.abs(volts)) / full));
}

/** What the plates show, for the checks. */
export interface PlatesState {
  /** The voltage across the capacitance (V) and the charges on each plate for it (`chargeCount`), of `count`. */
  readonly volts: number;
  readonly charges: number;
  readonly count: number;
  /** The plate the «+» are on: the plus one, or (charged the other way round) the minus one. */
  readonly positive: 'plus' | 'minus';
  /** The current into leg 0 (A) and the electrons' speed in the legs (units / s, `electronSpeed`). */
  readonly amps: number;
  readonly speed: number;
  /** Electrons drawn now in the legs. */
  readonly legElectrons: number;
  readonly bulged: boolean;
  readonly open: boolean;
  readonly amount: number;
  /** The texts of the print the cut has taken. */
  readonly printHidden: number;
  /** Meshes of the whole view drawn now (the part's own and the inside's), and of those the inside's. */
  readonly drawCalls: number;
  readonly insideCalls: number;
}

/** The points a callout may point at: each plate's inner side, the insulator's section. */
export type PlatesAnchor = 'plus' | 'minus' | 'insulator';

export interface Plates extends Cutaway {
  /** Which inner view this is (`asPlates`). */
  readonly what: 'plates';
  /** The view, a child of the part's body frame. */
  readonly group: Group;
  /** Opens by `t` 0 … 1 on the side last given to `set` (the door's `cut`). */
  cut(t: number): void;
  /** The voltage across the capacitance (V): the charges on the plates. */
  volts(v: number): void;
  /** The current into leg 0 (A): the electrons' drift in the legs. */
  flow(amps: number): void;
  /** Bulged: the insulator broken through. */
  bulged(on: boolean): void;
  /** Every frame after `set`: the model's state of the part (the door's feed), then `update`. */
  follow(state: InsideState | null, dt: number, t: number): void;
  /** Every frame: the electrons move by the frame's time (a held frame, `dt` 0, moves nothing). */
  update(dt: number, t: number): void;
  /** A world point for a callout, on the half the cut leaves, facing the camera. */
  anchor(name: PlatesAnchor, out: Vector3): Vector3;
  /** Where the charges drawn now are (body frame): the «+» and the electrons on the plates. */
  charges(): { positive: Vector3[]; negative: Vector3[] };
  /** Where every electron of the legs is now (body frame) and whether it is drawn. */
  legElectrons(): { at: Vector3; shown: boolean }[];
  state(): PlatesState;
}

/** The can of a part: its radius and height (units) — the model's own, or its catalog key's. */
function canOf(part: PartModel): { r: number; h: number } {
  const size = (part as PartModel & { size?: { d: number; h: number } }).size;
  if (size) return { r: size.d / 2, h: size.h };
  const spec = Object.hasOwn(PARTS, part.key) ? PARTS[part.key] : undefined;
  const can =
    spec?.kind === 'capacitor' ? electrolyticCan(spec.farads, spec.ratedV) : electrolyticCan(470e-6, 16);
  return { r: (can.d * MM) / 2, h: can.h * MM };
}

/** The geometry of the view for a can `r` × `h` (body frame). */
export function platesLayout(r: number, h: number) {
  const { wall, plate, insulator } = PLATES;
  const y0 = RADIAL_Y;
  const y1 = y0 + h;
  const inner = r - wall;
  const half = plate.thick / 2;
  const x = P / 2;
  const bottom = y0 + CAN.bung.to + plate.low * h;
  const top = y1 - CAN.top.below - plate.high * h;
  return {
    y0,
    y1,
    r,
    h,
    inner,
    /** Leg 0's plate at −`x`, leg 1's at +`x`; each `half` thick either side. */
    x,
    half,
    bottom,
    top,
    /** The plates' half-depth along z. */
    depth: Math.sqrt(inner * inner - (x + half) ** 2) - plate.margin,
    ins: {
      half: insulator.thick / 2,
      bottom: bottom - insulator.over,
      top: top + insulator.over,
      depth: Math.sqrt(inner * inner - (insulator.thick / 2) ** 2) - insulator.margin,
    },
    /** The inner wall's span: over the bung to the top's underside. */
    floor: y0 + CAN.bung.to,
    ceiling: y1 - CAN.top.below,
  };
}

/** The sleeve's outer radius at height y (its profile up to the top's edge). */
function sleeveAt(profile: readonly (readonly [number, number])[], y: number): number {
  const side = profile.slice(0, 9);
  if (y <= side[0]![1]) return side[0]![0];
  for (let i = 1; i < side.length; i++) {
    const [r1, y1] = side[i]!;
    const [r0, y0] = side[i - 1]!;
    if (y <= y1) return y1 > y0 ? r0 + ((r1 - r0) * (y - y0)) / (y1 - y0) : r1;
  }
  return side.at(-1)![0];
}

/** Whether the face at `theta` (about the vertical, from +z toward +x) lies on the sleeve's stripe (over leg 1, +x). */
const onStripe = (theta: number): boolean => {
  const t = Math.atan2(Math.sin(theta), Math.cos(theta));
  return t >= Math.PI / 4 && t <= (3 * Math.PI) / 4;
};

/** Where a slab |x − `cx`| ≤ `half`, |z| ≤ `depth` meets the face at `theta`: its radii, or none ([0, 0]). */
function slabOnFace(cx: number, half: number, depth: number, theta: number): [number, number] {
  const s = Math.sin(theta);
  const c = Math.abs(Math.cos(theta));
  const reach = c > 1e-9 ? depth / c : Infinity;
  if (cx === 0) return [0, Math.min(Math.abs(s) > 1e-9 ? half / Math.abs(s) : Infinity, reach)];
  if (Math.abs(s) < 1e-9 || Math.sign(s) !== Math.sign(cx)) return [0, 0];
  const r0 = (Math.abs(cx) - half) / Math.abs(s);
  const r1 = Math.min((Math.abs(cx) + half) / Math.abs(s), reach);
  return r1 > r0 ? [r0, r1] : [0, 0];
}

/** Where a vertical round bar at (`cx`, 0) of radius `radius` meets the face at `theta`, or none. */
function barOnFace(cx: number, radius: number, theta: number): [number, number] {
  const along = cx * Math.sin(theta);
  const across = cx * Math.cos(theta);
  const d = radius * radius - across * across;
  if (along <= 0 || d <= 0) return [0, 0];
  return [along - Math.sqrt(d), along + Math.sqrt(d)];
}

/** A deterministic 0 … 1 hash (no `Math.random`: the view is the same in every frame and every run). */
function hash(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** The colours of the view. */
const COLORS = {
  plate: col('steel'),
  lead: LEG_COLOR,
  aluminium: mix('steel', 'slate', 0.25),
  sleeve: col('ink'),
  stripe: col('mist'),
  bung: mix('ink', 'slate', 0.3),
  insulator: col('mist'),
  /** The inside of the can, away from the light: dark, so the plates and the charges stand out against it. */
  wall: mix('steel', 'ink', 0.7),
} as const;

/** The view inside the electrolytic capacitor `part` (its model from `shared/parts`), closed. */
export function createPlates(part: PartModel): Plates {
  const { r, h } = canOf(part);
  const L = platesLayout(r, h);
  const group = new Group();
  group.name = `${part.key}:plates`;
  group.visible = false;

  // the can's body clipped by the half cut about its vertical axis; the print (never clipped by three) goes with it
  const wedge = createWedge(part, PLATES.wedge, 0, new Set(part.prints), { axis: 'y' });
  const prints = printKeeper(part, wedge);
  const clip = <T extends Material>(m: T): T => {
    m.clippingPlanes = [...wedge.planes];
    m.clipIntersection = true;
    return m;
  };

  /* ------------------------------------------------------------------------- the solids, cut too */

  // the plates and the leads in the can (the plate meshes and the orbs of `charge-field/parts/capacitor.ts`, REUSE.md)
  const metal = new Builder(`${part.key}:plates-metal`);
  for (const sign of [-1, 1]) {
    metal.add(G.rbox(PLATES.plate.thick, L.top - L.bottom, 2 * L.depth, 0.008, 2), {
      at: [sign * L.x, (L.bottom + L.top) / 2, 0],
      c: COLORS.plate,
      slot: 'metal',
    });
    metal.add(G.rod(new Vector3(sign * L.x, L.y0, 0), new Vector3(sign * L.x, L.bottom + 0.02, 0), LEG.radius, 10), {
      c: COLORS.lead,
      slot: 'metal',
    });
  }
  const platesMat = clip(
    tame(K.metal({ color: 'white', vertexColors: true, specular: 0.5, shininess: 36 })),
  );
  platesMat.name = 'plates.metal';
  const plates = new Mesh(metal.geometry('metal'), platesMat);
  plates.name = 'plates:metal';

  // the inside of the can: its inner wall facing in, its bottom facing up (and, bulged, the crack in the insulator)
  const coreMat = clip(tame(K.toon({ color: 'white', vertexColors: true, highlight: 0.15, rim: 0.2 })));
  coreMat.name = 'plates.core';
  const core = new Mesh(new BufferGeometry(), coreMat);
  core.name = 'plates:core';

  const insulatorMat = clip(tame(sheath({ color: 'mist', opacity: 0.5, edgeOpacity: 0.9 })));
  insulatorMat.name = 'plates.insulator';
  const insulator = new Mesh(
    G.rbox(PLATES.insulator.thick, L.ins.top - L.ins.bottom, 2 * L.ins.depth, 0.01, 2),
    insulatorMat,
  );
  insulator.name = 'plates:insulator';
  insulator.position.set(0, (L.ins.bottom + L.ins.top) / 2, 0);

  /* ------------------------------------------------------------------------- the section faces */

  let isBulged = false;
  const profile = sleeveProfile(r, L.y0, L.y1);
  // the sleeve's outside at height y; bulged, a little wider (as the part's own sleeve swells)
  const R = (y: number): number => sleeveAt(profile, y) * (isBulged ? CAN.bulge.swell : 1);
  const at = (v: number) => () => v;
  const sleeveColor = (theta: number): Color => (onStripe(theta) ? COLORS.stripe : COLORS.sleeve);
  const inside = r - CAN.rim;
  const domeTop = L.y1 + CAN.bulge.dome;
  /** The bulged top's outer surface at height y (`capacitors.ts`: a quarter circle from under the rim up to the dome). */
  const dome = (y: number): number => {
    const k = (y - (L.y1 - 0.012)) / (domeTop - (L.y1 - 0.012));
    return k <= 0 ? inside : k >= 1 ? 0 : inside * Math.sqrt(1 - k * k);
  };
  const topUnder = L.y1 - CAN.top.below;
  const topOver = topUnder + CAN.top.thick;
  const knots = profile.slice(0, 9).map(([, y]) => y);
  const layers: SectionLayer[] = [];
  // the sleeve and the aluminium wall, a stretch per straight piece of the profile
  for (let i = 1; i < knots.length; i++) {
    const u0 = knots[i - 1]!;
    const u1 = Math.min(knots[i]!, topUnder);
    if (u1 <= u0) continue;
    layers.push({ u0, u1, r0: (u) => R(u) - PLATES.sleeve, r1: R, color: sleeveColor, steps: 2 });
    const w0 = Math.max(u0, L.floor);
    if (u1 > w0) {
      layers.push({ u0: w0, u1, r0: at(L.inner), r1: (u) => R(u) - PLATES.sleeve, color: COLORS.aluminium, steps: 2 });
    }
  }
  // the folded rim over the top's edge
  layers.push({ u0: topUnder, u1: L.y1, r0: at(inside), r1: R, color: sleeveColor, steps: 4 });
  // the bung
  layers.push({
    u0: L.y0 + CAN.bung.from,
    u1: L.floor,
    r0: at(0),
    r1: (u) => R(u) - PLATES.sleeve,
    color: COLORS.bung,
    steps: 2,
  });
  // the top: flat, or (bulged) a domed sheet as thick
  layers.push({
    u0: topUnder,
    u1: topOver,
    r0: (u) => (isBulged ? dome(u + CAN.top.thick) : 0),
    r1: (u) => (isBulged ? dome(u) : inside),
    color: COLORS.plate,
    steps: 1,
  });
  layers.push({
    u0: topOver,
    u1: domeTop,
    r0: (u) => (isBulged ? dome(u + CAN.top.thick) : 0),
    r1: (u) => (isBulged ? dome(u) : 0),
    color: COLORS.plate,
    steps: 10,
  });
  // the insulator, the plates and the leads where the cut meets them
  layers.push({
    u0: L.ins.bottom,
    u1: L.ins.top,
    r0: at(0),
    r1: (_u, th) => slabOnFace(0, L.ins.half, L.ins.depth, th)[1],
    color: COLORS.insulator,
    steps: 1,
  });
  for (const sign of [-1, 1]) {
    const cx = sign * L.x;
    layers.push({
      u0: L.bottom,
      u1: L.top,
      r0: (_u, th) => slabOnFace(cx, L.half, L.depth, th)[0],
      r1: (_u, th) => slabOnFace(cx, L.half, L.depth, th)[1],
      color: COLORS.plate,
      steps: 1,
    });
    layers.push({
      u0: L.floor,
      u1: L.bottom,
      r0: (_u, th) => barOnFace(cx, LEG.radius, th)[0],
      r1: (_u, th) => barOnFace(cx, LEG.radius, th)[1],
      color: COLORS.lead,
      steps: 1,
    });
  }
  const section = createSection('y', 0, layers);
  // the faces take the sleeve's own material (its heat with it), clipping nothing
  const skinFrom = part.body[0] as KToonMaterial;
  const skin = skinFrom.clone();
  skin.name = 'plates.section';
  if (skinFrom.uniforms.uKHeat) skin.uniforms.uKHeat = skinFrom.uniforms.uKHeat;
  skin.clippingPlanes = [];
  const faces = new Mesh(section.geometry, skin);
  faces.name = 'plates:faces';

  /* ------------------------------------------------------------------------------- the charges */

  const N = PLATES.charges.count;
  const CR = PLATES.charges.radius;
  const positive: Orbs = createOrbs({ kind: 'proton', count: N, radius: CR, name: 'plates:plus' });
  const legCount = 2 * PLATES.electrons.perLeg;
  const negative: Orbs = createOrbs({
    kind: { ...ORB_STYLES.electron, intensity: 1 },
    halo: false,
    count: N + legCount,
    radius: CR,
    name: 'plates:electrons',
  });

  for (const m of [plates, core, insulator, faces, positive, negative] as Object3D[]) {
    m.castShadow = false;
    m.receiveShadow = m !== positive && m !== negative;
  }
  group.add(core, plates, insulator, faces, positive, negative);
  part.bodyGroup.add(group);

  /* -------------------------------------------------------------------------------- the state */

  let volts = 0;
  let amps = 0;
  /** +1 while the camera looks from the body's +z (the cut takes z > 0), −1 from −z. */
  let side = 1;
  let view = new Vector3(0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3));
  const viewLocal = view.clone();

  /** The pair `i` of the charges (low-discrepancy, so any first `n` spread over the plate): y and |z|. */
  const G2 = 1.324717957244746;
  const pairAt = (i: number): [number, number] => {
    const m = PLATES.charges.margin * CR;
    const u = (0.5 + i / G2) % 1;
    const v = (0.5 + i / (G2 * G2)) % 1;
    return [L.bottom + m + (L.top - L.bottom - 2 * m) * u, m + (L.depth - 2 * m) * v];
  };
  /** The inner side of the plate over leg `k` (0 the plus, 1 the minus), as x of a charge's middle. */
  const chargeX = (k: 0 | 1): number => {
    const off = PLATES.charges.off * CR;
    return k === 0 ? -L.x + L.half + off : L.x - L.half - off;
  };
  let shownCharges = 0;
  const placeCharges = (): void => {
    const n = isBulged ? 0 : chargeCount(volts);
    shownCharges = n;
    // the «+» on the plate at the higher potential, the electrons on the other
    const plus: 0 | 1 = volts >= 0 ? 0 : 1;
    const minus: 0 | 1 = plus === 0 ? 1 : 0;
    for (let i = 0; i < N; i++) {
      const [y, z] = pairAt(i);
      const on = i < n ? 1 : 0;
      positive.setPosition(i, chargeX(plus), y, -side * z, on);
      negative.setPosition(i, chargeX(minus), y, -side * z, on);
    }
    positive.commit();
    negative.commit();
  };

  /* --------------------------------------------------------------------- the electrons of the legs */

  /** Each leg's way from its socket up to its plate (body frame), offset toward the camera; its length. */
  let ways: { pts: Vector3[]; cum: number[]; length: number }[] = [];
  let waysKey = '';
  const legAt = Float64Array.from({ length: legCount }, (_, i) => {
    const k = i % PLATES.electrons.perLeg;
    return (k + 0.3 + 0.4 * hash(i, 7)) / PLATES.electrons.perLeg;
  });
  const ER = CR * PLATES.electrons.scale;
  const bodyInverse = new Matrix4();
  const buildWays = (): void => {
    part.bodyGroup.updateMatrix();
    bodyInverse.copy(part.bodyGroup.matrix).invert();
    const local = part.legTips.map((t) => t.clone().applyMatrix4(bodyInverse));
    const key = `${local.map((v) => v.toArray().map((x) => x.toFixed(5)).join(',')).join('|')}|${side}|${viewLocal
      .toArray()
      .map((x) => x.toFixed(4))
      .join(',')}`;
    if (key === waysKey) return;
    waysKey = key;
    const legs = radialLegs([-P / 2, P / 2], RADIAL_Y)(local);
    // under the can, on the leg's side toward the camera (across the leg, which stands up); in it, on the cut lead's
    // face — the way turns from one to the other in the bung, where none is drawn
    const across = new Vector3(viewLocal.x, 0, viewLocal.z);
    if (across.lengthSq() < 1e-12) across.set(0, 0, side);
    const outside = across.normalize().multiplyScalar(LEG.radius + 0.5 * ER);
    const cutFace = new Vector3(0, 0, side * (ER + INSET));
    ways = legs.map((leg, k) => {
      const x = (k === 0 ? -1 : 1) * L.x;
      const under = leg.filter((p) => p.y < L.y0);
      const pts = [
        ...under.map((p) => p.clone().add(outside)),
        new Vector3(x, L.y0, 0).add(outside),
        new Vector3(x, L.floor, 0).add(cutFace),
        new Vector3(x, L.bottom + 0.03, 0).add(cutFace),
      ];
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
      return { pts, cum, length: cum.at(-1)! };
    });
  };
  /** Electron `i` of the legs (body frame): leg i < perLeg is leg 0. */
  const legPoint = (i: number, out: Vector3): Vector3 => {
    const way = ways[i < PLATES.electrons.perLeg ? 0 : 1];
    if (!way) return out.set(0, -100, 0);
    const s = legAt[i]! * way.length;
    let j = 1;
    while (j < way.cum.length - 1 && way.cum[j]! < s) j++;
    const a = way.pts[j - 1]!;
    const b = way.pts[j]!;
    const span = way.cum[j]! - way.cum[j - 1]!;
    return out.copy(a).lerp(b, span > 0 ? (s - way.cum[j - 1]!) / span : 0);
  };
  /** Drawn where it can be seen: above the board's face, under its plate, not in the bung (where it turns in). */
  const legShown = (p: Vector3): boolean =>
    p.y > ER && p.y < L.bottom - ER && !(p.y > L.y0 - ER && p.y < L.floor + ER);
  let shownLeg = 0;
  const point = new Vector3();
  const placeLegs = (): void => {
    shownLeg = 0;
    for (let i = 0; i < legCount; i++) {
      legPoint(i, point);
      const on = legShown(point);
      if (on) shownLeg++;
      negative.setPosition(N + i, point.x, point.y, point.z, on ? PLATES.electrons.scale : 0);
    }
    negative.commit();
  };

  /* ------------------------------------------------------------------------------ the core mesh */

  const buildCore = (): void => {
    const b = new Builder(`${part.key}:plates-core`);
    // the inner wall, its profile downward so that it faces in
    b.lathe(
      [
        [L.inner, L.ceiling],
        [L.inner, L.floor],
      ],
      { seg: 48, c: COLORS.wall },
    );
    b.lathe(
      [
        [L.inner, L.floor],
        [0, L.floor],
      ],
      { seg: 48, c: COLORS.bung },
    );
    if (isBulged) {
      // the insulator broken through: a dark crack up its middle, on the half the cut leaves
      const { bends, radius } = PLATES.crack;
      const pts: Vector3[] = [];
      const z = -side * L.ins.depth * 0.35;
      for (let i = 0; i <= bends; i++) {
        const k = i / bends;
        const jag = (i % 2 === 0 ? 1 : -1) * (0.3 + 0.7 * hash(i, 11)) * L.ins.depth * 0.18;
        pts.push(new Vector3(0, L.bottom + (L.top - L.bottom) * k, z + jag));
      }
      b.tube(pts, radius, { seg: 6, c: CRACK_COLOR });
    }
    core.geometry.dispose();
    core.geometry = b.geometry('toon');
    core.geometry.computeBoundingBox();
    core.geometry.computeBoundingSphere();
  };
  buildCore();
  placeCharges();

  /* ----------------------------------------------------------------------------------- the view */

  const open = (): boolean => wedge.open;
  const inverse = new Matrix4();
  const pose = (): void => {
    const b1 = wedge.alpha - wedge.half;
    const b2 = wedge.alpha + wedge.half;
    section.pose(b1, b2);
  };

  const self: Plates = {
    what: 'plates',
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
      part.bodyGroup.updateWorldMatrix(true, false);
      viewLocal.copy(view).transformDirection(inverse.copy(part.bodyGroup.matrixWorld).invert());
      const s = viewLocal.z >= 0 ? 1 : -1;
      if (s !== side) {
        side = s;
        placeCharges();
        if (isBulged) buildCore();
      }
      pose();
      buildWays();
      placeLegs();
    },
    cut(t) {
      self.set(t, view);
    },
    volts(v) {
      const next = Number.isFinite(v) ? v : 0;
      if (chargeCount(next) !== chargeCount(volts) || Math.sign(next) !== Math.sign(volts)) {
        volts = next;
        placeCharges();
      } else volts = next;
    },
    flow(value) {
      amps = Number.isFinite(value) ? value : 0;
    },
    bulged(on) {
      if (on === isBulged) return;
      isBulged = on;
      buildCore();
      placeCharges();
      section.redo();
      if (open()) pose();
    },
    follow(s: InsideState | null, dt, t) {
      if (s) {
        self.flow(s.amps);
        self.bulged(s.bulged);
        self.volts(s.volts);
      }
      self.update(dt, t);
    },
    update(dt) {
      const step = Math.max(dt, 0);
      const v = isBulged ? 0 : electronSpeed(amps);
      if (step > 0 && v !== 0 && ways.length === 2) {
        const per = PLATES.electrons.perLeg;
        for (let i = 0; i < legCount; i++) {
          // leg 0 (from the socket up to the plus plate): the electrons go the way of `electronSpeed`, leg 1 the other
          const way = ways[i < per ? 0 : 1]!;
          const ds = ((i < per ? v : -v) * step) / way.length;
          const s = legAt[i]! + ds;
          legAt[i] = s - Math.floor(s);
        }
      }
      if (open()) placeLegs();
    },
    anchor(name, out) {
      const m = PLATES.charges.margin * CR;
      const y =
        name === 'insulator'
          ? L.ins.bottom + (L.ins.top - L.ins.bottom) * 0.3
          : L.bottom + (L.top - L.bottom) * 0.6;
      if (name === 'insulator') out.set(0, y, -side * INSET);
      else out.set(name === 'plus' ? -L.x + L.half : L.x - L.half, y, -side * m);
      part.bodyGroup.updateWorldMatrix(true, false);
      return part.bodyGroup.localToWorld(out);
    },
    charges() {
      // the «+» on the plate at the higher potential (leg 0's while the voltage is not negative), the electrons on the
      // other
      const plus: 0 | 1 = volts >= 0 ? 0 : 1;
      const on = (k: 0 | 1): Vector3[] =>
        Array.from({ length: shownCharges }, (_, i) => {
          const [y, z] = pairAt(i);
          return new Vector3(chargeX(k), y, -side * z);
        });
      return { positive: on(plus), negative: on(plus === 0 ? 1 : 0) };
    },
    legElectrons() {
      return Array.from({ length: legCount }, (_, i) => {
        const at3 = legPoint(i, new Vector3());
        return { at: at3, shown: legShown(at3) };
      });
    },
    state() {
      let calls = 0;
      let insideCalls = 0;
      part.bodyGroup.traverseVisible((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        if (m === positive && shownCharges === 0) return;
        if (m === negative && shownCharges === 0 && shownLeg === 0) return;
        const mat = m.material as Material | Material[];
        if (!(Array.isArray(mat) ? mat : [mat]).some((x) => x.visible)) return;
        calls++;
        for (let p: Object3D | null = m; p; p = p.parent) if (p === group) insideCalls++;
      });
      return {
        volts,
        charges: shownCharges,
        count: N,
        positive: volts >= 0 ? 'plus' : 'minus',
        amps,
        speed: isBulged ? 0 : electronSpeed(amps),
        legElectrons: open() ? shownLeg : 0,
        bulged: isBulged,
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
      for (const g of [plates.geometry, core.geometry, insulator.geometry, section.geometry]) g.dispose();
      for (const m of [platesMat, coreMat, insulatorMat, skin]) m.dispose();
      for (const o of [positive, negative]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
  };
  return self;
}

/** The plates of a door's cutaway, when the part's inside is an electrolytic's. */
export function asPlates(c: Cutaway | null): Plates | null {
  return c !== null && 'what' in c && (c as Plates).what === 'plates' ? (c as Plates) : null;
}
