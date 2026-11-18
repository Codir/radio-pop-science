/**
 * The chapter's view of the composed world (`@circuit/shared/world`): the stand with the lamp close up and the
 * battery's section, and the copper world below (the filament's atoms in `story`). Every mount detail — shots,
 * the stand's numbers the chapter drives — stays in this file and in the steps.
 */
import type { ChapterContext, Shot } from '@/engine/api';
import {
  BATTERY_SHOTS,
  LAMP_SHOTS,
  STAGE_POST,
  STAGE_SHOTS,
  createLoopGlow,
  type CircuitStage,
  type LoopGlow,
  type LampView,
} from '@circuit/shared/stage';
import { mountWorld, type CircuitWorld } from '@circuit/shared/world';
import { LAMP_CHAPTER_SHOTS } from './shots';

export interface LampWorld {
  world: CircuitWorld;
  stand: CircuitStage;
  lamp: LampView;
  /** The soft sleeve of light round the loop (chapter 4's `loop-glow`): the energy (`handover`) and the field's
   *  push (`story`). Steps set it; the scene ticks it. */
  glow: LoopGlow;
  /** A shot by name (the stage's, the lamp's, the battery's and the chapter's own). */
  shot(name: string): Shot;
  update(dt: number, t: number): void;
}

const ALL: Record<string, Shot> = {
  ...STAGE_SHOTS,
  ...LAMP_SHOTS,
  ...BATTERY_SHOTS,
  ...LAMP_CHAPTER_SHOTS,
};

export { STAGE_POST };

export function createLampWorld(ctx: ChapterContext): LampWorld {
  // the electrons' common shift as chapter 4 shows it (its `flow/connect`: 6 % of their speed at full glow)
  const world = mountWorld(ctx, { drift: 0.06 });
  const glow = createLoopGlow();
  glow.intensity = 0;
  world.stand.base.frame.add(glow.group);
  ctx.camera.shots({ ...LAMP_SHOTS, ...BATTERY_SHOTS, ...LAMP_CHAPTER_SHOTS });
  return {
    world,
    stand: world.stand,
    lamp: world.stand.lamp,
    glow,
    shot(name) {
      const s = ALL[name];
      if (!s) throw new Error(`lamp: no shot '${name}'`);
      return s;
    },
    update: (dt, t) => world.update(dt, t),
  };
}
