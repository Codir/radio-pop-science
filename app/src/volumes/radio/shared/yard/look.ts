/**
 * The look of the yard (B13): the only owner of the volume's environment and post-processing — chapters do not call
 * `ctx.env.tune`, `ctx.post.base` or give their steps `envTune`. Dusk makes the sky and the light, not a grade of the
 * frame (VISUAL.md §5): `duskEnv` blends the engine's `dusk` set (0, with its five magenta and red colours replaced by
 * the volume's) field by field into its `night` set (1), always without motes (they swarm round the director's
 * target with a size taken from the main frame, so the eye would see big blots that follow the reader), grade tint
 * and harmony (grey stays grey on the screen). Two point lights stand in the scene for good and only change their
 * intensity (switching `visible` would recompile the programs): the lantern, from 0.4 of dusk on, and the kitchen,
 * the white light of the screen itself (`Yard.screenLight`). The lantern's bulb, the neighbour's window and the
 * bicycle's headlight light up yellow with the lantern (VISUAL.md §4); the kitchen window shines only with the screen.
 */
import { Color, type Object3D, PointLight, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { KitModel } from '@/kit';
import { type EnvOverrides, LOOK_SCALE, col, envPreset } from '@/style';
import { LAYOUT } from './layout';

/**
 * Intensity of the lantern's light at full `lanternLevel` (chosen on the eye's frames at dusk 0.5 and 1: the white
 * wall, the cat's spot and the pickets of the west fence bright enough against the gravel, the cat's body and the
 * grass behind the pickets; its fall-off is `LANTERN_REACH`).
 */
export const LANTERN_LIGHT = 3.5;
/**
 * Intensity of the kitchen's light at `screenLight` 1 (chosen on the shots `screen`, `antenna` and `window`: the
 * kitchen in the screen's light without blowing out the case and the board under it).
 */
export const KITCHEN_LIGHT = 0.8;
/**
 * The lights' range and decay: the lantern's light reaches across the back yard with a soft fall-off (the cat 4.4 m
 * from the bulb, the pickets by the wicket 6.0 m, the shed's wall 7.2 m), the kitchen's stays in the kitchen.
 */
const LANTERN_REACH = { distance: 16, decay: 0.7 } as const;
const KITCHEN_REACH = { distance: 5, decay: 1.6, ahead: 0.5 } as const;
/** The lantern is dark up to `on` and full from `full` (VISUAL.md §2 «Сутінки за главами»). */
const LANTERN = { on: 0.4, full: 0.5 } as const;
/** `dusk` changes smaller than this leave the environment as it is. */
const DUSK_STEP = 0.005;

/** The volume's colours at the dusk end (VISUAL.md §5): all in the `blue` family or without saturation. */
const DUSK_END: EnvOverrides = {
  mid: col('bg.violet').lerp(col('bg.plum'), 0.5),
  cloudColor: 'bg.plum',
  fogColor: col('bg.indigo').lerp(col('bg.violet'), 0.5),
  sunColor: col('sky').lerp(col('white'), 0.6),
  rimColor: 'blue',
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The environment of the yard at this dusk (0 early evening … 1 night; outside 0…1 — clamped): every field of the
 * engine's `dusk` set (with the volume's five colours) blended toward its `night` set; motes, grade tint and harmony
 * always 0. A full set, so the chapter's preset under it does not matter.
 */
export function duskEnv(dusk: number): EnvOverrides {
  const t = clamp01(dusk);
  const a = envPreset('dusk', DUSK_END);
  const b = envPreset('night');
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(a) as (keyof typeof a)[]) {
    if (key === 'kind') continue;
    const va = a[key];
    const vb = b[key];
    if (va instanceof Color && vb instanceof Color) out[key] = va.clone().lerp(vb, t);
    else if (va instanceof Vector3 && vb instanceof Vector3) {
      const v = va.clone().lerp(vb, t).normalize();
      out[key] = [v.x, v.y, v.z];
    } else if (typeof va === 'number' && typeof vb === 'number') out[key] = (1 - t) * va + t * vb;
  }
  return { ...(out as EnvOverrides), motes: 0, gradeTintAmount: 0, harmony: 0 };
}

/** The lantern: 0 up to 0.4 of dusk, then smoothly to 1 at 0.5. */
export function lanternLevel(dusk: number): number {
  if (dusk <= LANTERN.on) return 0;
  if (dusk >= LANTERN.full) return 1;
  const k = (dusk - LANTERN.on) / (LANTERN.full - LANTERN.on);
  return k * k * (3 - 2 * k);
}

export interface YardLook {
  /** The lantern's level now (0…1). */
  readonly lantern: number;
  /** Apply this dusk and the screen's light; cheap when nothing changed. */
  set(dusk: number, screenLight: number): void;
}

/**
 * Install the look once, at mounting: the environment's scale and the key light's shadow over the whole island, no
 * grain (P2), the point lights on the lantern's bulb and in front of the screen. `glow` — the models whose `night`
 * follows the lantern (its bulb, the neighbour's window, the bicycle's headlight).
 */
export function mountLook(
  ctx: ChapterContext,
  o: { lamp: Object3D; screen: Object3D; glow: readonly KitModel[]; dusk: number },
): YardLook {
  const { radius, centre } = LAYOUT.plan;
  ctx.env.setScale(radius, { adaptFrom: LOOK_SCALE.diorama });
  ctx.env.setShadow({ extent: radius, center: [centre[0], 0, centre[1]] });
  ctx.post.base({ grain: 0 });

  // the lantern: warm, in its bulb
  const lantern = new PointLight(
    col('yellow').lerp(col('white'), 0.35),
    0,
    LANTERN_REACH.distance,
    LANTERN_REACH.decay,
  );
  lantern.name = 'yard-lantern';
  o.lamp.add(lantern);
  // the kitchen: white like the black-and-white screen, half a metre in front of the glass
  const kitchen = new PointLight(col('white'), 0, KITCHEN_REACH.distance, KITCHEN_REACH.decay);
  kitchen.name = 'yard-kitchen';
  kitchen.position.set(0, 0, KITCHEN_REACH.ahead);
  o.screen.add(kitchen);

  let applied = Number.NaN;
  let level = 0;
  const look: YardLook = {
    get lantern() {
      return level;
    },
    set(dusk, screenLight) {
      if (!(Math.abs(dusk - applied) <= DUSK_STEP)) {
        ctx.env.base(duskEnv(dusk));
        applied = dusk;
      }
      level = lanternLevel(dusk);
      lantern.intensity = level * LANTERN_LIGHT;
      for (const m of o.glow) m.night = level;
      kitchen.intensity = clamp01(screenLight) * KITCHEN_LIGHT;
    },
  };
  look.set(o.dusk, 0);
  return look;
}
