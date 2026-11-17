/**
 * The loop of wire (VISUAL.md §2): four pieces that together with the battery, the switch, the lamp and the
 * jumper of the second seat close the rounded rectangle.
 *
 *   m1  minus clamp → near left corner → left side → far left corner → second seat      (sheath tinted `blue`)
 *   m2  second seat → lamp socket (thread)                                               (`blue`)
 *   p1  plus clamp → switch — the stretch under the magnifier, extra smooth              (`coral`)
 *   p2  switch → near right corner → right side → lamp socket (bottom contact)           (`coral`)
 *
 * Copper core with a sharp glint inside a translucent sheath (the look of `atom/dive-in`). Nothing ever runs
 * along the wires on this floor. In the flashlight the same four pieces are its two flat metal strips; the
 * unfolding morphs path and section continuously (`setShape`).
 */
import { Group, Mesh, Vector3, type Color } from 'three';
import { G } from '@/kit';
import { K, SEMANTIC, col, type KToonMaterial } from '@/style';
import { DynTube, resample } from './dyn-tube';
import { BATTERY, LAMP, LOOP, SEAT, SWITCH, WIRE } from './layout';
import { sheath } from './materials';

export type WireId = 'm1' | 'm2' | 'p1' | 'p2';
export const WIRE_IDS: readonly WireId[] = ['m1', 'm2', 'p1', 'p2'];

const RINGS: Record<WireId, number> = { m1: 150, m2: 40, p1: 28, p2: 96 };
const RADIAL: Record<WireId, number> = { m1: 14, m2: 14, p1: 56, p2: 14 };
/** How far a wire's end sits inside its screw terminal. */
const INSET = 0.07;
const y = LOOP.y;
const v = (x: number, z: number): Vector3 => new Vector3(x, y, z);

/** The stand's wire paths (board frame), dense polylines with rounded corners. */
export function standPath(id: WireId): Vector3[] {
  switch (id) {
    case 'm1':
      return G.roundPath(
        [
          v(BATTERY.minusX + INSET, LOOP.near),
          v(LOOP.left, LOOP.near),
          v(LOOP.left, LOOP.far),
          v(SEAT.x - SEAT.width / 2 + INSET, LOOP.far),
        ],
        LOOP.corner,
        12,
      );
    case 'm2':
      return [v(SEAT.x + SEAT.width / 2 - INSET, LOOP.far), v(LAMP.x - LAMP.term + INSET, LOOP.far)];
    case 'p1':
      return [v(BATTERY.plusX - INSET, LOOP.near), v(SWITCH.inX + INSET, LOOP.near)];
    case 'p2':
      return G.roundPath(
        [
          v(SWITCH.outX - INSET, LOOP.near),
          v(LOOP.right, LOOP.near),
          v(LOOP.right, LAMP.z + LAMP.term - INSET),
        ],
        LOOP.corner,
        12,
      );
  }
}

export interface WireShape {
  /** Any polyline; it is resampled to the piece's ring count. */
  path: readonly Vector3[];
  /** 0 = flat metal strip … 1 = round wire. */
  round: number;
  /** Sheath coverage 0…1, growing from the piece's START (the clamp or terminal it leaves). */
  cover: number;
  /** 0…1: the strip's steel turns into the wire's copper. */
  copper: number;
  /** Normal of the strip's flat side at its start (transported along the path). Default: the board's up. */
  up?: Vector3;
  /** Length of stripped copper at the start and at the end (default `BARE` both): 0 = sheath to the very tip. */
  bare?: readonly [number, number];
  /**
   * A break in the copper under the intact sheath: centre (share of the length 0…1) and width (units). The copper
   * ends are flat cut faces (the core's rings are re-laid around the gap; the sheath is untouched).
   */
  gap?: { at: number; width: number };
}

/** Stripped copper at each end of a piece (the part that goes into a terminal, and a little more). */
export const BARE = 0.11;

export interface Wires {
  group: Group;
  setShape(id: WireId, shape: WireShape): void;
  /** Lay all four pieces on the stand as finished wires. */
  setStand(): void;
  /** 0 = the sheaths nearly one neutral tint … 1 = coral from the plus, blue from the minus. */
  setPoles(amount: number): void;
  /**
   * The dive 0…1 as the piece under the lens (`p1`) shows it: its sheath dissolves smoothly over the second half
   * of the flight, and its bare core turns into ONE copper that does not depend on the room's light — the same
   * muted copper with the lamp on or off (the lamp only adds a warm top), so the lower floor has one colour to
   * continue from.
   */
  setDive(dive: number): void;
  /** @deprecated use `setDive`; kept for callers of the first version (1 = solid sheath). */
  setLensSheath(fade: number): void;
  core(id: WireId): Mesh;
}

const UP = new Vector3(0, 1, 0);
/** Indices of the two collapsed rings of the last `breakRings` (the copper is missing between them). */
const breakAt: [number, number] = [-1, -1];
const HAIR = 0.002;
/**
 * `n` rings along `pts` (already even, of total `length`) with a gap of copper: rings spread evenly up to the
 * first cut, one collapsed ring a hair after it, one collapsed a hair before the second cut, evenly on from it.
 */
function breakRings(pts: readonly Vector3[], n: number, gap: { at: number; width: number }, length: number): Vector3[] {
  const s0 = Math.max(gap.at * length - gap.width / 2, 0.05);
  const s1 = Math.min(gap.at * length + gap.width / 2, length - 0.05);
  const rest = n - 2;
  const k0 = Math.max(2, Math.min(rest - 2, Math.round((rest * s0) / (length - (s1 - s0)))));
  const at: number[] = [];
  for (let i = 0; i < k0; i++) at.push((s0 * i) / (k0 - 1));
  at.push(s0 + HAIR, s1 - HAIR);
  const k1 = rest - k0;
  for (let i = 0; i < k1; i++) at.push(s1 + ((length - s1) * i) / (k1 - 1));
  breakAt[0] = k0;
  breakAt[1] = k0 + 1;
  const step = length / (n - 1);
  return at.map((d) => {
    const f = Math.min(Math.max(d / step, 0), n - 1);
    const i = Math.min(Math.floor(f), n - 2);
    return pts[i]!.clone().lerp(pts[i + 1]!, f - i);
  });
}
/** Flat strip: 2.1 wire radii wide, a quarter of one thick. */
const STRIP: [number, number] = [WIRE.core * 2.1, WIRE.core * 0.3];

export function createWires(): Wires {
  const group = new Group();
  group.name = 'wires';
  const steel = col('steel').lerp(col('mist'), 0.35);
  const copperLow = col('orange.dark').lerp(col('wireBrown'), 0.5);
  const copperHigh = col('orange.dark').lerp(col('orange'), 0.7);
  const tints = {} as Record<WireId, Color>;
  // without poles both sheaths are one soft neutral plastic with a breath of their hue left in it
  const neutral = col('mist').lerp(col('violet'), 0.25);
  let poles = -1;
  let dived = -1;
  // the bare core's own colour at the hand-over: between the two ends of its gradient
  const HANDED = copperLow.clone().lerp(copperHigh, 0.55).multiplyScalar(0.72);
  const pieces = {} as Record<
    WireId,
    {
      core: DynTube;
      skin: DynTube;
      coreMat: KToonMaterial;
      skinMat: KToonMaterial;
      coreMesh: Mesh;
      pts: Vector3[];
    }
  >;
  for (const id of WIRE_IDS) {
    const plus = id.startsWith('p');
    const core = new DynTube(RINGS[id], RADIAL[id]);
    const skin = new DynTube(RINGS[id], RADIAL[id]);
    const coreMat = K.metal({ color: 'orange', specular: 0.22, shininess: 180, rim: 0.3, highlight: 0.2 });
    const tint = col(plus ? SEMANTIC.dcPlus : SEMANTIC.dcMinus).lerp(col('white'), 0.12);
    tints[id] = tint.clone();
    const skinMat = sheath({ color: tint, opacity: 0.56, edgeOpacity: 0.96, gloss: 0, highlight: 0.1 });
    const coreMesh = new Mesh(core.geometry, coreMat);
    coreMesh.name = `wire-${id}:core`;
    coreMesh.castShadow = coreMesh.receiveShadow = true;
    const skinMesh = new Mesh(skin.geometry, skinMat);
    skinMesh.name = `wire-${id}:sheath`;
    skinMesh.castShadow = true;
    skinMesh.renderOrder = 2;
    group.add(coreMesh, skinMesh);
    pieces[id] = { core, skin, coreMat, skinMat, coreMesh, pts: [] };
  }

  const setShape = (id: WireId, shape: WireShape): void => {
    const p = pieces[id];
    const n = RINGS[id];
    resample(shape.path, n, p.pts);
    const r = Math.min(Math.max(shape.round, 0), 1);
    const w = STRIP[0] + (WIRE.core - STRIP[0]) * r;
    const h = STRIP[1] + (WIRE.core - STRIP[1]) * r;
    const up = shape.up ?? UP;
    const length = G.pathLength(p.pts);
    const gap = shape.gap;
    // a break: the core's rings are laid out anew so that two of them stand exactly at each copper end — a full
    // ring and a collapsed one a hair apart give a flat cut face; the sheath keeps the even rings
    const corePts = gap ? breakRings(p.pts, n, gap, length) : p.pts;
    p.core.update(corePts, up, (i, out) => {
      const k = gap && (i === breakAt[0] || i === breakAt[1]) ? 0 : 1;
      out[0] = w * k;
      out[1] = h * k;
    });
    // sheath: full radius where covered, tucked just under the core's surface beyond the growth front;
    // a short length at both ends stays bare — the stripped copper that goes into the terminals
    const front = shape.cover * 1.08;
    const [bare0, bare1] = shape.bare ?? [BARE, BARE];
    p.skin.update(p.pts, up, (i, out) => {
      const s = i / (n - 1);
      const bare = s * length < bare0 || (1 - s) * length < bare1 ? 0 : 1;
      const k = Math.min(Math.max((front - s) / 0.08, 0), 1) * bare * r;
      out[0] = w * 0.96 + (WIRE.sheath - w * 0.96) * k;
      out[1] = h * 0.96 + (WIRE.sheath - h * 0.96) * k;
    });
    const c = Math.min(Math.max(shape.copper, 0), 1);
    p.coreMat.setGradient(steel.clone().lerp(copperLow, c), steel.clone().lerp(copperHigh, c), [
      y - WIRE.core,
      y + WIRE.core,
    ]);
    if (id === 'p1') dived = -1; // the dive look is re-applied on top of a new shape
  };

  return {
    group,
    setShape,
    setStand() {
      for (const id of WIRE_IDS) setShape(id, { path: standPath(id), round: 1, cover: 1, copper: 1 });
    },
    setPoles(amount) {
      const k = Math.min(Math.max(amount, 0), 1);
      if (k === poles) return;
      poles = k;
      for (const id of WIRE_IDS) pieces[id].skinMat.color.copy(neutral).lerp(tints[id], 0.18 + 0.82 * k);
    },
    setDive(dive) {
      const d = Math.min(Math.max(dive, 0), 1);
      if (d === dived) return;
      dived = d;
      const s = Math.min(Math.max((d - 0.45) / 0.5, 0), 1);
      const e = s * s * (3 - 2 * s);
      const p = pieces.p1;
      p.skinMat.fade = 1 - e;
      // lit part down to a third, the rest is the core's own even copper (emissive, below the bloom threshold)
      const lit = 1 - 0.68 * e;
      p.coreMat.setGradient(copperLow.clone().multiplyScalar(lit), copperHigh.clone().multiplyScalar(lit), [
        y - WIRE.core,
        y + WIRE.core,
      ]);
      p.coreMat.setEmissive(HANDED, 0.68 * e);
    },
    setLensSheath(fade) {
      pieces.p1.skinMat.fade = fade;
    },
    core: (id) => pieces[id].coreMesh,
  };
}
