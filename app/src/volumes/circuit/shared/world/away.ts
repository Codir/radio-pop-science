/**
 * «Away»: the stand pulled back, small and low behind a board, out of focus — the frame the prologue ends on
 * (`prologue/map`, the map of the volume on a board in front of it). It belongs to the world because the next
 * chapter starts from it: `world.flyIn` begins on this pose and moves on to the lens in one continuous move
 * (docs/requests/B-circuit-wire.md §5), so leaving the map is not a cut to the stand.
 */
import type { PostOverrides, Shot } from '@/engine/api';
import { STAGE_FOV } from '@circuit/shared/stage';

// far back and looking above the stand: it sits small and low, under the board's level, out of focus
const POSITION: [number, number, number] = [0, 8.4, 16.5];
const TARGET: [number, number, number] = [0, 3.6, 0.4];
/** The board's plane stands this far from the camera on its line of sight (the depth of field focuses there). */
const DISTANCE = 6;
const look = TARGET.map((v, i) => v - POSITION[i]!);
const len = Math.hypot(...look);
/** The point the depth of field holds sharp: in front of the stand, where the board is. */
export const AWAY_FOCUS = POSITION.map((v, i) => v + (look[i]! / len) * DISTANCE) as [number, number, number];

export const AWAY_SHOT = {
  position: POSITION,
  target: TARGET,
  focus: AWAY_FOCUS,
  fov: STAGE_FOV,
  fit: { center: AWAY_FOCUS, radius: 1.7 },
  orbit: { azimuth: 0.12, polar: 0.08, zoom: [0.95, 1.1] as [number, number] },
} satisfies Shot;

/** The stand behind the board: calm — strongly out of focus, corners darker, less bloom. */
export const AWAY_POST: PostOverrides = {
  dofAperture: 4.6,
  dofRange: 0.5,
  dofMaxBlur: 22,
  vignette: 0.85,
  bloomIntensity: 0.7,
};
