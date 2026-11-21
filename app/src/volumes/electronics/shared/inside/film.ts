/**
 * Inside a carbon-film resistor (docs/volumes/electronics/VISUAL.md §7; plan decision 7 of batch E3): the floor
 * `inside` of the door's dive into a resistor, opened on its place by the door's `cut` — the real view that took the
 * place of E2-8's temporary cutaway.
 *
 * What is drawn, in the part's body frame (x from leg 0 to leg 1 along the axis at `AXIAL_Y`):
 * - the white ceramic rod with the metal end caps (`mist`) pressed on its ends over the film, where the legs come in;
 * - the carbon film (`ink`) on the rod, a strip wound between the turns of the helical groove trimmed into it, its
 *   grains (instanced, a shade lighter); where the groove cuts the film the white ceramic shows;
 * - the lacquer with the bands is the part's own body: the wedge (`wedge.ts`) clips it away on the camera's side,
 *   and section faces close the cut — the lacquer with the bands' paint at its rim, and near leg 0, where the cut goes
 *   deeper (a step), the rod's section, the film on it and the cap: the rod and the film seen as layers;
 * - the electrons (`cyan`, the library's electron without its glow) drifting along the strip at a speed from the
 *   model's current (`flow`); the heat of the model (`heat`) as the colour of the film's surface, never as light
 *   (VISUAL §1 principle 3, §4.8); burnt (`burnt`), the film broken through in the middle under a charred belt.
 *
 * Honest drawing (`docs/volumes/electronics/chapters/resistor.md`, «Докладніше» of `inside`): the turns of the groove
 * grow with the value (`filmTurns`) — a picture of «a longer, narrower path, more ohms», not a real part's geometry;
 * the electrons' speed says only what current flows (`electronSpeed`), not a real drift speed.
 *
 * Draw calls while open: the rod and the caps, the strip, the grains, the electrons, the two section faces — six; the
 * burnt belt is a seventh. None while the part is whole (the group hidden).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Plane,
  Quaternion,
  Vector3,
  type Material,
} from 'three';
import { Builder } from '@/kit';
import { K, col, type KToonMaterial } from '@/style';
import { ORB_STYLES, createOrbs, type Orbs } from '@/fx';
import { PARTS } from '@electronics/sim/core';
import { tame } from '../bench/materials';
import { CRACK_COLOR, mix } from '../parts/part';
import {
  AXIAL_Y,
  LOOK_AT_REST,
  RESISTOR,
  RESISTOR_BODY,
  bandColor,
  createSurfaceLook,
  resistorRadius,
  type PartModel,
  type ResistorModel,
  type Surface,
} from '../parts';
import { INSET, createWedge, faceGeometry, type Cutaway, type InsideState, type Layer } from './wedge';

/** The numbers of the view, in the body frame's units (VISUAL §7, «Числа прольоту»). */
export const FILM = {
  /** The ceramic rod's radius; the film's outer radius on it. */
  rod: 0.085,
  film: 0.092,
  /** The rod stops this far inside each end of the body. */
  rodEnds: 0.03,
  /** The end caps: from `from` to `to` of the body's length at each end, their outer radius (they sit on the film). */
  cap: { from: 0.01, to: 0.17, outer: 0.122 },
  /** How far the bands' paint stands over the body (`parts/resistor.ts`). */
  paint: 0.004,
  /** The groove's width along the axis. */
  groove: 0.012,
  /** The turns of the groove (`filmTurns`): at least, at most, and how many more per decade of ohms. */
  turns: { min: 1, max: 12, perDecade: 2, at1: -1.5 },
  /** The wedge at `cut` 1: its width (radians). */
  wedge: (Math.PI * 2) / 3,
  /** Where the cut goes down to the rod, near leg 0: up to this far from the body's end. */
  step: 0.25,
  /** The electrons: their radius, how many, their speed per ampere along the strip and the most (units / s). */
  electrons: { radius: 0.008, count: 160, perAmp: 6, top: 0.6 },
  /** The grains of the film: how many, their radius. */
  grains: { count: 640, radius: [0.0035, 0.0055] as const },
  /** The charred belt of a burnt film: its half-width along the axis; the crack in its middle. */
  burn: { half: 0.03, crack: 0.006 },
} as const;

const L = RESISTOR.length;
const HALF = L / 2;
/** The exposed film between the caps: its half-length along the axis. */
const SPAN = HALF - FILM.cap.to;
/** The x of the step in the body frame. */
const STEP_X = FILM.step - HALF;
/** The film runs under the caps up to the rod's ends. */
const FILM_END = HALF - FILM.rodEnds;

/**
 * The turns of the helical groove for a resistance: 2 more per decade, from 1 (at 10 Ω and below) to 12 (at 10 MΩ) —
 * 330 Ω 3.5 turns, 1 kΩ 4.5, 10 kΩ 6.5. Monotone, bounded; anything not a positive number is the least.
 */
export function filmTurns(ohms: number): number {
  const { min, max, perDecade, at1 } = FILM.turns;
  if (!(ohms > 0) || !Number.isFinite(ohms)) return ohms === Infinity ? max : min;
  return Math.min(max, Math.max(min, at1 + perDecade * Math.log10(ohms)));
}

/**
 * The electrons' speed along the strip (units of the body frame per second) for the current into the part's first leg
 * (A, the model's `reading.i`): proportional to it, held at `FILM.electrons.top`. Electrons are negative: a current
 * from leg 0 to leg 1 moves them toward leg 0, so the sign is the other way to the current's (−x of the body frame).
 */
export function electronSpeed(amps: number): number {
  if (!Number.isFinite(amps)) return 0;
  const { perAmp, top } = FILM.electrons;
  const v = 0 - amps * perAmp; // never −0
  return Math.abs(v) > top ? Math.sign(v) * top : v;
}

/** What the film shows, for the checks. */
export interface FilmState {
  readonly ohms: number;
  readonly turns: number;
  /** The groove's pitch along the axis, the strip's width between two turns and the strip's length (units). */
  readonly pitch: number;
  readonly width: number;
  readonly path: number;
  readonly amps: number;
  /** Units of the strip per second (`electronSpeed`). */
  readonly speed: number;
  readonly electrons: number;
  /** Electrons drawn now (on the strip and not in the cut). */
  readonly shown: number;
  readonly open: boolean;
  readonly amount: number;
  readonly heat: number;
  readonly burnt: boolean;
  readonly surface: Surface;
  /** Meshes drawn now (an instanced one counted once). */
  readonly drawCalls: number;
}

/** The points a callout may point at. */
export type FilmAnchor = 'film' | 'groove' | 'rod';

export interface Film extends Cutaway {
  /** The view, a child of the part's body frame: it moves and turns with the part. */
  readonly group: Group;
  /** Cuts the groove for `ohms` (`filmTurns`); its turns now. */
  turns(ohms: number): number;
  /** Opens by `t` 0 … 1 on the side last given to `set` (the door's `cut`). */
  cut(t: number): void;
  /** The current into leg 0 (A): the electrons' drift. */
  flow(amps: number): void;
  /** The heat of the part, a share of its limit (`PartMemory.heat`): the colour of the film. */
  heat(share: number): void;
  /** Burnt: the film broken under a charred belt, the electrons still. */
  burnt(on: boolean): void;
  /** Every frame: the electrons move by the frame's time (a held frame, `dt` 0, moves nothing), the look follows. */
  update(dt: number, t: number): void;
  /** A world point for a callout: on the strip, on the groove, on the rod's section — on the camera's side. */
  anchor(name: FilmAnchor, out: Vector3): Vector3;
  /** Where every electron is now (body frame), for the checks. */
  electrons(): Vector3[];
  state(): FilmState;
}

/** A deterministic 0 … 1 hash (no `Math.random`: the view is the same in every frame and every run). */
function hash(i: number, salt: number): number {
  const h = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/** The groove's geometry for a number of turns. */
function groove(turns: number) {
  const pitch = (2 * SPAN) / turns;
  const g = Math.min(FILM.groove, pitch * 0.4);
  return { pitch, g, width: pitch - g, path: Math.hypot(2 * Math.PI * FILM.film * turns, 2 * SPAN) };
}

/** The groove's middle at the helix angle φ (radians from where the groove begins at the cap by leg 0). */
const grooveX = (phi: number, pitch: number): number => -SPAN + (phi / (2 * Math.PI)) * pitch;

/** A point on the cylinder of radius r about the axis, at x and angle θ (from +y toward +z), in the body frame. */
const onCylinder = (x: number, r: number, theta: number, out: Vector3): Vector3 =>
  out.set(x, AXIAL_Y + r * Math.cos(theta), r * Math.sin(theta));

/**
 * The carbon strip: its top on the film's radius and its two walls down to the rod where the groove cuts it, wound
 * from a turn before the groove begins to a turn after it ends, held within the rod (the caps hide its ends).
 */
function stripGeometry(turns: number): BufferGeometry {
  const { pitch, g } = groove(turns);
  const pos: number[] = [];
  const nor: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const d = new Vector3();
  const n = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  const out = new Vector3();
  /** A quad facing `toward` (its winding turned so: the strip is drawn from outside, one side only). */
  const quad = (p: Vector3, q: Vector3, r: Vector3, s: Vector3, toward: Vector3): void => {
    n.crossVectors(e1.subVectors(q, p), e2.subVectors(s, p)).normalize();
    const flip = n.dot(toward) < 0;
    if (flip) n.negate();
    for (const v of flip ? [p, r, q, p, s, r] : [p, q, r, p, r, s]) {
      pos.push(v.x, v.y, v.z);
      nor.push(n.x, n.y, n.z);
    }
  };
  const MINUS_X = new Vector3(-1, 0, 0);
  const PLUS_X = new Vector3(1, 0, 0);
  const clampX = (x: number): number => Math.min(FILM_END, Math.max(-FILM_END, x));
  const steps = Math.ceil((turns + 2) * 64);
  const from = -2 * Math.PI;
  const to = 2 * Math.PI * (turns + 1);
  for (let i = 0; i < steps; i++) {
    const p0 = from + ((to - from) * i) / steps;
    const p1 = from + ((to - from) * (i + 1)) / steps;
    const lo0 = clampX(grooveX(p0, pitch) + g / 2);
    const hi0 = clampX(grooveX(p0, pitch) + pitch - g / 2);
    const lo1 = clampX(grooveX(p1, pitch) + g / 2);
    const hi1 = clampX(grooveX(p1, pitch) + pitch - g / 2);
    if (hi0 - lo0 < 1e-6 && hi1 - lo1 < 1e-6) continue;
    const { film: R, rod: r } = FILM;
    // the top (facing out of the cylinder), then the wall by the lower edge (facing −x) and by the upper one (+x)
    const mid = (p0 + p1) / 2;
    out.set(0, Math.cos(mid), Math.sin(mid));
    quad(onCylinder(lo0, R, p0, a), onCylinder(hi0, R, p0, b), onCylinder(hi1, R, p1, c), onCylinder(lo1, R, p1, d), out);
    quad(onCylinder(lo0, r, p0, a), onCylinder(lo0, R, p0, b), onCylinder(lo1, R, p1, c), onCylinder(lo1, r, p1, d), MINUS_X);
    quad(onCylinder(hi0, R, p0, a), onCylinder(hi0, r, p0, b), onCylinder(hi1, r, p1, c), onCylinder(hi1, R, p1, d), PLUS_X);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** The section faces' layers: the lacquer with the bands' paint all along, and near leg 0 the cut down to the axis. */
function faceLayers(model: ResistorModel): Layer[] {
  const { rod, film, rodEnds, cap, paint, step } = FILM;
  const R = resistorRadius;
  const at = (r: number) => () => r;
  const body = col(RESISTOR_BODY);
  const out: Layer[] = [];
  for (const mirrored of [false, true]) {
    // a stretch v0 … v1 from the end by leg 0, or the same stretch from the other end
    const span = (v0: number, v1: number): [number, number] => (mirrored ? [L - v1, L - v0] : [v0, v1]);
    const [e0, e1] = span(0, cap.from);
    out.push({ u0: e0, u1: e1, r0: at(0), r1: R, color: body, steps: 4 });
    const [c0, c1] = span(cap.from, cap.to);
    out.push({ u0: c0, u1: c1, r0: at(cap.outer), r1: R, color: body, steps: 24 });
  }
  out.push({ u0: cap.to, u1: L - cap.to, r0: at(film), r1: R, color: body, steps: 32 });
  // near leg 0 the cut goes through the cap, the film and the rod
  const metal = col('mist');
  out.push({ u0: cap.from, u1: cap.to, r0: at(film), r1: at(cap.outer), color: metal, steps: 1 });
  out.push({ u0: cap.from, u1: rodEnds, r0: at(0), r1: at(film), color: metal, steps: 1 });
  out.push({ u0: rodEnds, u1: step, r0: at(0), r1: at(rod), color: col('white'), steps: 1 });
  out.push({ u0: rodEnds, u1: step, r0: at(rod), r1: at(film), color: col('ink'), steps: 1 });
  // the bands' paint at the rim
  model.bands.forEach((c, i) => {
    const mid = RESISTOR.bands[i]!;
    out.push({
      u0: mid - RESISTOR.band / 2,
      u1: mid + RESISTOR.band / 2,
      r0: R,
      r1: (u: number) => R(u) + paint,
      color: bandColor(c),
      steps: 6,
    });
  });
  return out;
}

/** The ohms a part's key stands for (a resistor of the catalog), or 1 kΩ for anything else. */
function ohmsOf(part: PartModel): number {
  const spec = Object.hasOwn(PARTS, part.key) ? PARTS[part.key] : undefined;
  return spec?.kind === 'resistor' ? spec.ohms : 1000;
}

const UP = new Vector3(0, 1, 0);
const PARKED = 1e6;

export interface FilmOptions {
  /** The resistance the groove is cut for (default: the part's own, from its key). */
  readonly ohms?: number;
}

/** The view inside the resistor `part` (its model from `shared/parts`), closed. */
export function createFilm(part: PartModel, opts: FilmOptions = {}): Film {
  const model = part as ResistorModel;
  const group = new Group();
  group.name = `${part.key}:film`;
  group.visible = false;

  // the lacquer: the body's own materials, clipped by the wedge (made before the view joins the body)
  const wedge = createWedge(part, FILM.wedge, AXIAL_Y, new Set());
  // the inside clips the same wedge, but only up to the step near leg 0: there the cut goes down to the axis
  const stepPlane = new Plane(UP.clone(), PARKED);
  const inner = [wedge.planes[0], wedge.planes[1], stepPlane];
  const clipInner = <T extends Material>(m: T): T => {
    m.clippingPlanes = inner;
    m.clipIntersection = true;
    return m;
  };

  // the rod and the caps: one mesh, its colours per vertex
  const b = new Builder(`${part.key}:film-core`);
  const along = { axis: 'x' as const, at: [-HALF, AXIAL_Y, 0] as const };
  b.lathe(
    [
      [0, FILM.rodEnds],
      [FILM.rod, FILM.rodEnds],
      [FILM.rod, L - FILM.rodEnds],
      [0, L - FILM.rodEnds],
    ],
    { ...along, seg: 36, c: 'white' },
  );
  for (const [u0, u1, w] of [
    [FILM.cap.from, FILM.cap.to, FILM.rodEnds],
    [L - FILM.cap.to, L - FILM.cap.from, L - FILM.rodEnds],
  ] as const) {
    const leg0 = u0 < HALF;
    // a cup: the end wall over the rod's end, the side over the film
    const prof: [number, number][] = leg0
      ? [
          [0, u0],
          [FILM.cap.outer, u0],
          [FILM.cap.outer, u1],
          [FILM.film, u1],
          [FILM.film, w],
          [0, w],
        ]
      : [
          [0, w],
          [FILM.film, w],
          [FILM.film, u0],
          [FILM.cap.outer, u0],
          [FILM.cap.outer, u1],
          [0, u1],
        ];
    b.lathe(prof, { ...along, seg: 36, c: 'mist' });
  }
  const coreModel = b.build();
  const core = coreModel.group.children[0] as Mesh;
  core.name = 'film:core';
  clipInner(tame(core.material as KToonMaterial));

  // the carbon strip and its grains: one dark material each, both taking the heat as a colour (`createSurfaceLook`)
  const stripMat = clipInner(tame(K.toon({ color: 'ink', highlight: 0.2, rim: 0.35, softness: 0.1 })));
  const grainMat = clipInner(tame(K.toon({ color: mix('ink', 'slate', 0.55), highlight: 0.3, rim: 0.3 })));
  stripMat.name = 'film.strip';
  grainMat.name = 'film.grains';
  const strip = new Mesh(new BufferGeometry(), stripMat);
  strip.name = 'film:strip';
  const grains = new InstancedMesh(new IcosahedronGeometry(1, 0), grainMat, FILM.grains.count);
  grains.name = 'film:grains';
  grains.frustumCulled = false;

  // the charred belt of a burnt film: a dark band over the strip with a pale crack in its middle
  const bb = new Builder(`${part.key}:film-burn`);
  const belt = FILM.film + 0.0045;
  bb.lathe(
    [
      [FILM.film - 0.001, HALF - FILM.burn.half],
      [belt, HALF - FILM.burn.half],
      [belt, HALF + FILM.burn.half],
      [FILM.film - 0.001, HALF + FILM.burn.half],
    ],
    { ...along, seg: 36, c: mix('ink', 'wireBrown', 0.25) },
  );
  bb.lathe(
    [
      [belt - 0.001, HALF - FILM.burn.crack],
      [belt + 0.0008, HALF - FILM.burn.crack],
      [belt + 0.0008, HALF + FILM.burn.crack],
      [belt - 0.001, HALF + FILM.burn.crack],
    ],
    { ...along, seg: 36, c: CRACK_COLOR },
  );
  const burnModel = bb.build();
  const burn = new Group();
  burn.name = 'film:burn';
  for (const m of burnModel.group.children as Mesh[]) {
    clipInner(tame(m.material as KToonMaterial));
    burn.add(m);
  }

  // the electrons: the library's electron, without its glow (VISUAL §1: only the LEDs and the lamp glow)
  const orbs: Orbs = createOrbs({
    kind: { ...ORB_STYLES.electron, glyph: 'none', intensity: 1 },
    count: FILM.electrons.count,
    radius: FILM.electrons.radius,
    halo: false,
    name: 'film:electrons',
  });

  // the section faces: the body's own material (its heat with it), clipping nothing; colours per vertex
  const skinFrom = part.body[0] as KToonMaterial;
  const skin = skinFrom.clone();
  skin.name = 'film.section';
  skin.uniforms.uKHeat = skinFrom.uniforms.uKHeat!;
  skin.clippingPlanes = [];
  const layers = faceLayers(model);
  const pivot = new Group();
  pivot.position.set(0, AXIAL_Y, 0);
  const faces = [true, false].map((front) => {
    const face = new Mesh(faceGeometry(layers, L, front ? -INSET : INSET, front), skin);
    face.name = front ? 'film:face-a' : 'film:face-b';
    pivot.add(face);
    return face;
  });

  for (const m of [core, strip, grains, orbs, ...faces, ...(burn.children as Mesh[])]) {
    m.castShadow = false;
    m.receiveShadow = m !== orbs;
  }
  group.add(core, strip, grains, burn, orbs, pivot);
  part.bodyGroup.add(group);

  // the heat of the model on the film's surface (never light), its burnt marks the belt
  const look = createSurfaceLook([stripMat, grainMat], burn, { scorch: false, char: 0 });

  /* ------------------------------------------------------------------------------------- the state */

  let ohms = opts.ohms ?? ohmsOf(part);
  let nTurns = filmTurns(ohms);
  let geo = groove(nTurns);
  let amps = 0;
  let heatShare = 0;
  let isBurnt = false;
  let view = UP.clone();
  /** Each electron's place along the strip (0 … 1) and across it (−½ … ½ of the strip's width). */
  const along01 = Float64Array.from({ length: FILM.electrons.count }, (_, i) => (i + hash(i, 1) * 0.8) / FILM.electrons.count);
  const across = Float64Array.from({ length: FILM.electrons.count }, (_, i) => hash(i, 2) - 0.5);
  /**
   * The electrons' way along the strip's middle: from under the cap by leg 0 to under the other (`reach` beyond the
   * exposed film at each end), so an electron that comes round from one end to the other does so where none is seen.
   */
  const way = () => {
    const reach = Math.min(geo.pitch / 2, 0.1);
    const a = 2 * Math.PI * (-reach / geo.pitch - 0.5);
    const b = 2 * Math.PI * ((2 * SPAN + reach) / geo.pitch - 0.5);
    const r = FILM.film + FILM.electrons.radius * 0.65;
    return { a, b, length: Math.hypot(r * (b - a), 2 * (SPAN + reach)), spread: Math.min(geo.width, 0.12) * 0.7 };
  };
  let lane = way();

  const build = (): void => {
    strip.geometry.dispose();
    strip.geometry = stripGeometry(nTurns);
    // the grains on the strip between the caps, away from its edges
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const radial = new Vector3();
    const [r0, r1] = FILM.grains.radius;
    for (let i = 0; i < FILM.grains.count; i++) {
      const phi = hash(i, 3) * 2 * Math.PI * nTurns;
      const x = grooveX(phi, geo.pitch) + geo.g / 2 + geo.width * (0.08 + 0.84 * hash(i, 4));
      const r = r0 + (r1 - r0) * hash(i, 5);
      onCylinder(x, FILM.film + 0.0008, phi, p);
      radial.set(0, Math.cos(phi), Math.sin(phi));
      q.setFromUnitVectors(UP, radial);
      // beyond the exposed film the caps hide the grains: none drawn there
      const inside = Math.abs(x) < SPAN - 0.004 && !(isBurnt && Math.abs(x) < FILM.burn.half + 0.004);
      // a grain the caps or the belt would hide is not drawn: none of size, kept on the axis
      if (inside) grains.setMatrixAt(i, m.compose(p, q, s.set(r, r * 0.5, r)));
      else grains.setMatrixAt(i, m.compose(p.set(0, AXIAL_Y, 0), q.identity(), s.set(0, 0, 0)));
    }
    grains.instanceMatrix.needsUpdate = true;
    grains.computeBoundingBox();
    grains.computeBoundingSphere();
  };
  build();

  const point = new Vector3();
  /** Electron i in the body frame. */
  const electronAt = (i: number, out: Vector3): Vector3 => {
    const phi = lane.a + along01[i]! * (lane.b - lane.a);
    const x = grooveX(phi, geo.pitch) + geo.pitch / 2 + across[i]! * lane.spread;
    return onCylinder(x, FILM.film + FILM.electrons.radius * 0.65, phi, out);
  };
  /** The electron at x, angle θ is drawn: on the exposed strip, and not where the cut went down to the rod. */
  const drawnAt = (x: number, theta: number): boolean => {
    if (Math.abs(x) > SPAN - FILM.electrons.radius) return false;
    if (wedge.open && x < STEP_X + 0.01) {
      let d = theta - wedge.alpha;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < wedge.half + 0.15) return false;
    }
    return true;
  };
  let shown = 0;
  const place = (): void => {
    shown = 0;
    for (let i = 0; i < FILM.electrons.count; i++) {
      electronAt(i, point);
      const theta = Math.atan2(point.z, point.y - AXIAL_Y);
      const on = drawnAt(point.x, theta);
      if (on) shown++;
      orbs.setPosition(i, point.x, point.y, point.z, on ? 1 : 0);
    }
    orbs.commit();
  };

  const xAxis = new Vector3();
  const stepAt = new Vector3();
  const setPlanes = (): void => {
    if (!wedge.open) {
      stepPlane.set(UP, PARKED);
      return;
    }
    const frame = part.bodyGroup;
    frame.updateWorldMatrix(true, false);
    xAxis.setFromMatrixColumn(frame.matrixWorld, 0).normalize();
    frame.localToWorld(stepAt.set(STEP_X, AXIAL_Y, 0));
    // the negative side (removed where the wedge's planes remove it too) is the end by leg 0
    stepPlane.setFromNormalAndCoplanarPoint(xAxis, stepAt);
  };

  const open = (): boolean => wedge.open;
  const film: Film = {
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
      setPlanes();
      group.visible = open();
      if (!open()) return;
      faces[0]!.rotation.x = wedge.alpha - wedge.half;
      faces[1]!.rotation.x = wedge.alpha + wedge.half;
      place();
    },
    cut(t) {
      film.set(t, view);
    },
    turns(value) {
      const n = filmTurns(value);
      ohms = value;
      if (n !== nTurns) {
        nTurns = n;
        geo = groove(n);
        lane = way();
        build();
        if (open()) place();
      }
      return nTurns;
    },
    flow(value) {
      amps = Number.isFinite(value) ? value : 0;
    },
    heat(share) {
      heatShare = Number.isFinite(share) ? Math.max(0, share) : 0;
    },
    burnt(on) {
      if (on === isBurnt) return;
      isBurnt = on;
      build();
    },
    follow(s: InsideState | null, dt, t) {
      if (s) {
        film.flow(s.amps);
        film.heat(s.heat);
        film.burnt(s.burnt);
      }
      film.update(dt, t);
    },
    update(dt) {
      const step = Math.max(dt, 0);
      // no current flows in a burnt film: the electrons stand
      const v = isBurnt ? 0 : electronSpeed(amps);
      if (step > 0 && v !== 0) {
        const ds = (v * step) / lane.length;
        for (let i = 0; i < along01.length; i++) {
          const s = along01[i]! + ds;
          along01[i] = s - Math.floor(s);
        }
      }
      if (open()) place();
      look.set({ ...LOOK_AT_REST, heat: heatShare, status: isBurnt ? 'burnt' : 'ok' }, step);
    },
    anchor(name, out) {
      const a = wedge.alpha;
      if (name === 'rod') {
        // the rod's section between the cap and the step, halfway out from the axis toward the camera
        onCylinder((-SPAN + STEP_X) / 2, FILM.rod * 0.5, a, out);
      } else {
        // the groove crossing the wedge's middle nearest a point a little toward leg 1, or the strip beside it
        const target = name === 'groove' ? 0.08 : 0.08 + geo.pitch / 2;
        const k = Math.round(((target + SPAN) / geo.pitch) - a / (2 * Math.PI));
        const phi = a + 2 * Math.PI * k;
        const x = grooveX(phi, geo.pitch) + (name === 'film' ? geo.pitch / 2 : 0);
        onCylinder(x, name === 'groove' ? FILM.rod : FILM.film, a, out);
      }
      part.bodyGroup.updateWorldMatrix(true, false);
      return part.bodyGroup.localToWorld(out);
    },
    electrons() {
      return Array.from({ length: FILM.electrons.count }, (_, i) => electronAt(i, new Vector3()));
    },
    state() {
      let calls = 0;
      if (group.visible)
        group.traverseVisible((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          if (m === orbs && shown === 0) return;
          calls++;
        });
      return {
        ohms,
        turns: nTurns,
        pitch: geo.pitch,
        width: geo.width,
        path: geo.path,
        amps,
        speed: isBurnt ? 0 : electronSpeed(amps),
        electrons: FILM.electrons.count,
        shown: open() ? shown : 0,
        open: open(),
        amount: wedge.amount,
        heat: heatShare,
        burnt: isBurnt,
        surface: look.surface,
        drawCalls: calls,
      };
    },
    dispose() {
      wedge.dispose();
      group.removeFromParent();
      strip.geometry.dispose();
      grains.geometry.dispose();
      grains.dispose();
      for (const m of [core, ...faces, ...(burn.children as Mesh[])]) m.geometry.dispose();
      for (const m of [stripMat, grainMat, skin, core.material as Material, ...(burn.children as Mesh[]).map((x) => x.material as Material)])
        m.dispose();
      orbs.geometry.dispose();
      orbs.material.dispose();
    },
  };
  return film;
}

/** The film of a door's cutaway, when the part's inside is a film. */
export function asFilm(c: Cutaway | null): Film | null {
  return c !== null && 'anchor' in c && 'turns' in c ? (c as Film) : null;
}
