/**
 * Scene of the chapter `lab`: one scene for all 12 steps. Task 8 is the shell — the steps are declared with an
 * empty `show`; the atom, the tools and the chart arrive in the following tasks.
 */
import { defineScene } from '@/engine/api';
import { STEP_IDS } from './chapter';
import { SHOTS } from './shots';

export default defineScene((ctx) => {
  ctx.env.setScale(6);
  ctx.camera.shots(SHOTS);
  ctx.stage.define(Object.fromEntries(STEP_IDS.map((id) => [id, { show: [], camera: 'lab' }])));
  return {};
});
