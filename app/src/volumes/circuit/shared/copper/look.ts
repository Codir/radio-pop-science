/**
 * Light and lens of the lower floors, for the chapter that mounts the copper world: pass `copperEnv(lamp, group)`
 * as a step's `envTune` and `copperPost(depth, scale)` as its `post`. The key light is the lamp of the stand,
 * far above and to the right of the frame: warm and strong when the circuit is closed; when it is open only the
 * cool, weak «moonlight» of the room comes from the upper left (VISUAL §2, §3; hand-over pose of W1).
 */
import { Color, Vector3, type Object3D } from 'three';
import type { PostOverrides } from '@/engine/api';
import { col, type EnvOverrides } from '@/style';

type Vec = [number, number, number];

/**
 * Rig for all three floors. `lamp`: 0 = circuit open … 1 = lamp at full brightness. `group` is the mounted
 * `Copper.group`: the light directions are given in its frame and returned in world space (omit it when the
 * world is mounted without rotation).
 */
export function copperEnv(lamp: number, group?: Object3D): EnvOverrides {
  const k = Math.min(Math.max(lamp, 0), 1);
  const cool = col('sky').lerp(col('white'), 0.6);
  const warm = col('yellow.light').lerp(col('white'), 0.45);
  const world = (x: number, y: number, z: number): Vec => {
    const v = new Vector3(x, y, z).normalize();
    if (group) v.transformDirection(group.matrixWorld);
    return v.toArray() as Vec;
  };
  // from above, on the lamp's side when it is on, a little toward the reader: lit caps, shaded undersides
  const side = -0.3 + 0.55 * k;
  return {
    sunDir: world(side, 0.9, 0.4),
    keyColor: cool.lerp(warm, k),
    keyIntensity: 0.8 + 0.2 * k,
    // the fill is the dark of the room: deep indigo, a touch warmer when the lamp is on
    fillSky: new Color(0.3, 0.3, 0.66).lerp(new Color(0.5, 0.4, 0.62), k),
    fillGround: new Color(0.2, 0.15, 0.48),
    fillIntensity: 0.92,
    rimColor: k > 0.5 ? 'yellow.light' : 'sky',
    rimIntensity: 0.35 + 0.7 * k,
    rimDir: world(side * 0.8, 0.75, -0.6),
    bokeh: 0,
    motes: 0,
    fogDensity: 0,
  };
}

/** Subject radius the look was tuned at: `ctx.env.setScale(COPPER_LOOK_RADIUS * scale)`. */
export const COPPER_LOOK_RADIUS = 6;

/**
 * Lens for a resting depth. Floors «ряди атомів» and «один атом»: shallow focus on the focal plane, the planes
 * behind melt; only electrons and the nucleus bloom. Floor «жила дроту» (and the dive down to about 0.5): the
 * whole cylinder in focus — its edges lie far behind the surface the reader looks at. A continuous dive
 * switches on the way: `ctx.post.apply(copperPost(1, scale), { duration })`.
 * `scale` is the mount scale (`mountAtHandover`): the world-unit parameters follow it.
 */
export function copperPost(depth: number, scale = 1): PostOverrides {
  const core = depth < 0.5;
  return {
    dofAperture: core ? 0.12 : 5,
    dofRange: 0.45 * scale,
    dofMaxBlur: 20,
    dofReference: 2.2 * COPPER_LOOK_RADIUS * scale,
    bloomIntensity: 1.0,
    aoIntensity: core ? 0 : 0.3,
    aoRadius: 0.35 * scale,
    vignette: 0.55,
  };
}
