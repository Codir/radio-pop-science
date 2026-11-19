/**
 * The yard in numbers, in metres: x to the east, y to the north, z up, the origin on the ground under the camera.
 * The only source is `site.json`, which the scene, the model and the reference model (B6a) all read; this module
 * checks its shape when it loads and throws on a wrong one, so a broken file stops the model instead of
 * bending its numbers.
 */
import raw from './site.json';

export type Material = 'brick' | 'wood' | 'glass' | 'slab' | 'iron';

/** What a wave loses going through one wall of each material, dB (the slab is the floor over the cellar). */
export const LOSS_DB: Readonly<Record<Material, number>> = Object.freeze({
  brick: 8,
  wood: 3,
  glass: 1,
  slab: 10,
  iron: 30,
});

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/** A wall of the house on the plan, from `a` to `b`: vertical and with no limits in height. */
export interface Wall {
  id: string;
  a: Vec2;
  b: Vec2;
  material: Material;
}

export interface Site {
  /** The camera's antenna. */
  tx: Vec3;
  /** The five stops of the monitor: the yard, 20 m from the camera · the kitchen · the hallway · the far room · the cellar. */
  route: readonly [Vec3, Vec3, Vec3, Vec3, Vec3];
  /** The direction of «move the antenna» on the plan. */
  nudgeAxis: Vec2;
  /** Only the walls of the house: the shed and the garage are things of the scene. */
  walls: readonly Wall[];
  /** The height of the slab over the cellar. */
  slabZ: number;
  /** The open leaf of the garage gate on the plan; `a` is its hinge. */
  gateLeaf: { a: Vec2; b: Vec2 };
  router: { at: Vec3; mw: number };
  oven: { at: Vec3; leakMw: number };
}

/** A wrong shape of site.json. */
function bad(what: string): never {
  throw new Error(`site.json: ${what}`);
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) bad(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function finite(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) bad(`${what} is not a finite number`);
  return value;
}

function numbers(value: unknown, length: number, what: string): number[] {
  if (!Array.isArray(value) || value.length !== length) bad(`${what} is not a list of ${length} numbers`);
  return value.map((v, i) => finite(v, `${what}[${i}]`));
}

const vec2 = (value: unknown, what: string): Vec2 =>
  Object.freeze(numbers(value, 2, what) as [number, number]);
const vec3 = (value: unknown, what: string): Vec3 =>
  Object.freeze(numbers(value, 3, what) as [number, number, number]);

/**
 * The yard after a check of its shape: the lengths of the lists, finite numbers, known materials, the wall ids
 * unique and not 'slab' (`wallsBetween` names the slab so), an axis with a direction and a leaf with a length.
 * Returns a frozen copy.
 */
function readSite(value: unknown): Site {
  const site = record(value, 'the file');
  const route = site.route;
  if (!Array.isArray(route) || route.length !== 5) bad('route is not a list of five stops');
  if (!Array.isArray(site.walls)) bad('walls is not a list');
  const ids = new Set<string>();
  const walls = site.walls.map((value: unknown, i): Wall => {
    const wall = record(value, `walls[${i}]`);
    const { id, material } = wall;
    if (typeof id !== 'string' || id === '' || id === 'slab' || ids.has(id))
      bad(`walls[${i}].id is not a new name`);
    if (typeof material !== 'string' || !Object.hasOwn(LOSS_DB, material))
      bad(`walls[${i}].material is not one of ${Object.keys(LOSS_DB).join(', ')}`);
    ids.add(id);
    return Object.freeze({
      id,
      a: vec2(wall.a, `walls[${i}].a`),
      b: vec2(wall.b, `walls[${i}].b`),
      material: material as Material,
    });
  });
  const axis = vec2(site.nudgeAxis, 'nudgeAxis');
  if (axis[0] === 0 && axis[1] === 0) bad('nudgeAxis has no direction');
  const leaf = record(site.gateLeaf, 'gateLeaf');
  const hinge = vec2(leaf.a, 'gateLeaf.a');
  const end = vec2(leaf.b, 'gateLeaf.b');
  if (hinge[0] === end[0] && hinge[1] === end[1]) bad('gateLeaf has no length');
  const router = record(site.router, 'router');
  const oven = record(site.oven, 'oven');
  return Object.freeze({
    tx: vec3(site.tx, 'tx'),
    route: Object.freeze(route.map((stop: unknown, i) => vec3(stop, `route[${i}]`))) as Site['route'],
    nudgeAxis: axis,
    walls: Object.freeze(walls),
    slabZ: finite(site.slabZ, 'slabZ'),
    gateLeaf: Object.freeze({ a: hinge, b: end }),
    router: Object.freeze({ at: vec3(router.at, 'router.at'), mw: finite(router.mw, 'router.mw') }),
    oven: Object.freeze({ at: vec3(oven.at, 'oven.at'), leakMw: finite(oven.leakMw, 'oven.leakMw') }),
  });
}

/** The yard of the volume: `site.json`, checked. */
export const SITE: Site = readSite(raw);
