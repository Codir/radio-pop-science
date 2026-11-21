/**
 * The light of the bench (docs/volumes/electronics/VISUAL.md §2), copied from `circuit/shared/stage/light.ts`
 * (shared/README.md, «Копії»). The bench's lamp is the key light while it burns; most steps run without it, so the
 * unlit room is lifted more than in `circuit` (`BENCH_AMBIENT`), and the board reads whole by the moon alone.
 *
 *   nothing lit     cold "moon" from the upper left (the environment's key light) + indigo fill, lifted
 *   the lamp burns  the lamp itself — a warm point light at the filament, strength tied to the model's filament,
 *                   casting soft shadows; the moon drops to half
 *
 * The point light is parented to the filament. The filament colour (and with it the light's colour) follows the
 * incandescence scale of `circuit/VISUAL.md` §5.3 (VISUAL §4.6).
 */
import { Color, PointLight, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { col } from '@/style';

/** Incandescence scale: cold tungsten → faint dark red (~600 °C) → red → orange → amber → pale yellow → white. */
const SCALE: readonly (readonly [number, Color])[] = [
  [0, col('steel.dark')],
  [0.1, col('red.dark')],
  [0.26, col('red')],
  [0.46, col('orange')],
  [0.66, col('amber')],
  [0.84, col('yellow.light')],
  [1, col('white')],
];

/** Colour of the filament at glow level `t` (0 cold … 1 working white). */
export function filamentColor(t: number, out = new Color()): Color {
  const x = Math.min(Math.max(t, 0), 1);
  for (let i = 1; i < SCALE.length; i++) {
    const [t1, c1] = SCALE[i]!;
    if (x <= t1) {
      const [t0, c0] = SCALE[i - 1]!;
      return out.copy(c0).lerp(c1, (x - t0) / (t1 - t0));
    }
  }
  return out.copy(SCALE[SCALE.length - 1]![1]);
}

export interface LightState {
  /** Glow of the filament 0…1 (0 = cold, 1 = fresh battery, working white). */
  glow: number;
  /**
   * Level 0…1 that drives the LIGHT (pool, bounce, room) when it differs from the filament's look — at the
   * click the light is in the frame at once while the coil's colour still runs up its scale. Default `glow`.
   */
  light?: number;
  /**
   * 0…1 (default `BENCH_AMBIENT`): how much the UNLIT room is lifted — an even cool fill and a slightly stronger
   * moon that step back as the lamp's output rises, so the lamp still turns the room on. 0 = the darkest look.
   */
  ambient?: number;
  /** Strength of the moon 0…1 (0 in `prologue/click`: the lamp is the only light in the frame). */
  moon: number;
}

export interface LightRig {
  lamp: PointLight;
  /** The shadowless bounce light; `mountBench` places it above the lamp's pool every frame (`BOUNCE_OFFSET`). */
  bounce: PointLight;
  /** Light output 0…1 for the current glow (what the pool, the motes and the glare follow). */
  readonly output: number;
  /** Apply the state (call every frame; cheap when nothing changed). */
  set(state: LightState): void;
  /**
   * Hand the environment to another owner (`true`: the lamp, bounce and filament still follow the state, but the
   * rig stops tuning the environment) or take it back (`false`: it re-applies, blending over `blend` seconds —
   * 0 for a jump). A floor below the bench (inside a part, its atoms) yields it while it lights its own world.
   */
  yieldEnv(yielded: boolean, blend?: number): void;
  /** Colour the filament should have for the current state (linear; × `emission` for the glow material). */
  readonly filament: Color;
  /** Emissive multiplier for the filament material: 0 when cold, > 1 (blooming) when it works. */
  readonly emission: number;
}

const MOON_KEY = 0.34;
const FILL = 0.3;
/**
 * The bench's lift of the unlit room (VISUAL §2 «Світло»: 0.8 against the circuit's 0.5): the lamp burns in few
 * steps, so the board, its sockets and the stripes of a resistor must read by the moon and the fill alone.
 */
export const BENCH_AMBIENT = 0.8;

export function createLight(ctx: ChapterContext, filament: Object3D): LightRig {
  // decay 1.55 instead of the physical 2: the pool still dies toward the left edge of the board, but the far
  // parts of the stand keep a readable warm side
  const lamp = new PointLight(0xffffff, 0, 18, 1.55);
  lamp.name = 'lamp-light';
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.camera.near = 0.15;
  lamp.shadow.camera.far = 16;
  lamp.shadow.radius = 36;
  lamp.shadow.bias = -0.0006;
  lamp.shadow.normalBias = 0.02;
  filament.add(lamp);
  // bounce: what the lit board and the dust give back to the room. A weak shadowless light above the pool —
  // it lets the lamp's light spill softly onto the table, lifts the silhouettes of things the lamp itself
  // cannot reach (the flashlight's own body) and softens the board's shadow on the table
  const bounce = new PointLight(0xffffff, 0, 15, 1.35);
  bounce.name = 'lamp-bounce';
  ctx.root.add(bounce);

  const warm = col('amber').lerp(col('yellow.light'), 0.45);
  const lampTone = new Color();
  const bounceTint = col('orange').lerp(col('pink'), 0.4);
  const color = new Color();
  let last = '';
  let emission = 0;
  let output = 0;
  let yielded = false;
  /** Blend of the next re-apply after the environment was given back, and until when that blend runs. */
  let returnBlend = -1;
  let settleUntil = -1;
  return {
    lamp,
    bounce,
    get output() {
      return output;
    },
    filament: color,
    get emission() {
      return emission;
    },
    set({ glow, moon, light: level, ambient = BENCH_AMBIENT }) {
      const g = Math.min(Math.max(glow, 0), 1);
      filamentColor(g, color);
      // light output grows faster than the colour temperature: a dull red filament lights nothing, an orange
      // one keeps a small pool around the lamp, a white one floods the board
      const lit = Math.min(Math.max(level ?? g, 0), 1);
      const out = lit ** 1.9;
      output = out;
      emission = g < 0.02 ? 0 : 0.9 + 2.6 * g ** 1.6;
      // the light is a little warmer than the filament looks: white-hot tungsten still gives yellowish light
      lamp.color.copy(filamentColor(lit, lampTone)).lerp(warm, 0.8 * lit);
      lamp.intensity = 7.5 * out;
      bounce.color.copy(lamp.color).lerp(bounceTint, 0.35);
      bounce.intensity = 1.5 * out;
      const key = `${out.toFixed(3)}|${moon.toFixed(3)}|${ambient.toFixed(3)}`;
      // the lift lives in the dark only: it fades with the lamp's output
      const lift = Math.min(Math.max(ambient, 0), 1) * (1 - Math.min(out * 1.6, 1));
      const moonLevel = moon * (1 - 0.5 * out);
      const keyIntensity = MOON_KEY * (moonLevel * (1 + 0.6 * lift) + 0.5 * lift * (1 - moon));
      // another owner lights the environment (the floors below the stand): leave it alone
      if (yielded) return;
      // re-apply when the state changed — or when a step entry reset the environment to its base behind our back
      // (not while our own blend back is still running: the environment is on its way to our values)
      const settling = ctx.clock.time < settleUntil;
      if (key === last && (settling || Math.abs(ctx.env.params.keyIntensity - keyIntensity) < 1e-4)) return;
      last = key;
      const duration = Math.max(returnBlend, 0);
      if (returnBlend > 0) settleUntil = ctx.clock.time + returnBlend + 0.05;
      returnBlend = -1;

      // the moon halves when the lamp works; the fill takes a little warmth from the lit board
      ctx.env.tune(
        {
          // (with no moon at all the lift is a moon of its own: a quarter of the full one at ambient 0.5)
          keyIntensity,
          fillIntensity: FILL * (0.25 + 0.75 * moon) + 0.1 * out + lift * (0.24 + 0.05 * (1 - moon)),
          fillGround: col('bg.violet')
            .lerp(col('orange'), 0.3 * out)
            .multiplyScalar(2.2),
          fillSky: col('bg.plum').lerp(col('blue'), 0.45).multiplyScalar(1.9),
          rimIntensity: 0.3 * moon + 0.5 * out,
          shadowStrength: 0.85,
        },
        { duration },
      );
    },
    yieldEnv(on, blend = 1.1) {
      if (yielded && !on) {
        last = '';
        returnBlend = blend;
      }
      yielded = on;
    },
  };
}
