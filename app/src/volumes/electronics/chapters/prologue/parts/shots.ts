/**
 * The chapter's own shots. `quiet` is the bench's `stand` on a desk and a tablet; on a phone the bench's `phone` shows
 * the field of sockets alone (VISUAL §9), and the step's one gesture is a tap on the player's box — so the phone's
 * `quiet` holds the field, the player and the speaker. `map` on the desktop shell, where its board is drawn over the
 * scene, is the stand pulled back behind that board, out of focus (after the circuit's prologue,
 * `circuit/shared/world/away.ts`: docs/volumes/electronics/REUSE.md, «Копії»): its depth of field focuses in front of
 * the stand, where the board is; the board, the size `fill`, covers it all but a blur at its right edge. On a phone or
 * a tablet the board is in the sheet's board tab and the scene is what the reader sees beside it: the bench's own
 * shot and post, no blur of the step's.
 */
import type { FormFactor, PostOverrides, Shot } from '@/engine/api';
import { STAGE_FOV, STAGE_SHOTS, boardToWorld } from '@electronics/shared/bench';

const v3 = (x: number, y: number, z: number): [number, number, number] => {
  const p = boardToWorld(x, y, z);
  return [p.x, p.y, p.z];
};

/**
 * `quiet` on a phone: a sphere over the field of sockets, the player and the speaker (the base frame: the field from
 * x −3,0 to 2,4, the player and the speaker at x 3,45 to 4,1, from z −2,6 to 2,2), seen steeply from above as the
 * bench's `phone` is.
 */
const QUIET_CENTER = v3(0.45, 0.3, -0.4);
export const QUIET_PHONE: Shot = {
  position: [QUIET_CENTER[0], QUIET_CENTER[1] + 12.4, QUIET_CENTER[2] + 8.6],
  target: QUIET_CENTER,
  fov: STAGE_FOV,
  fit: { center: QUIET_CENTER, radius: 3.9 },
};

/** `quiet` as the page is now: the bench's `stand`, or the phone's own. */
export const quietShot = (phone: boolean): Shot => (phone ? QUIET_PHONE : STAGE_SHOTS.stand);

// far back and looking above the stand: it sits small and low, under the board's level, out of focus
const POSITION: [number, number, number] = [0, 9.8, 19.5];
const TARGET: [number, number, number] = [0, 4.2, 0.9];
/** The board's plane stands this far from the camera on its line of sight (the depth of field focuses there). */
const DISTANCE = 7;
const look = TARGET.map((v, i) => v - POSITION[i]!);
const len = Math.hypot(...look);
/** The point the depth of field holds sharp: in front of the stand, where the board with the map is. */
export const MAP_FOCUS = POSITION.map((v, i) => v + (look[i]! / len) * DISTANCE) as [number, number, number];

export const MAP_SHOT: Shot = {
  position: POSITION,
  target: TARGET,
  focus: MAP_FOCUS,
  fov: STAGE_FOV,
  fit: { center: MAP_FOCUS, radius: 2 },
  orbit: { azimuth: 0.12, polar: 0.08, zoom: [0.95, 1.1] },
};

/**
 * Whether the step's board is drawn over the scene: the desktop shell only (`ctx.device` reads `desktop` there, a
 * tablet under the reader's desktop shell, `Settings.deskShell`, too); on a phone or a tablet the board goes into the
 * sheet's board tab.
 */
export const boardOnCanvas = (form: FormFactor): boolean => form === 'desktop';

/**
 * `map` as the page is now: pulled back behind the board where the board is over the scene; where it is in the sheet,
 * the bench's own shot — `stand` on a tablet (the chapter's first shot there), `phone` on a phone.
 */
export const mapShot = (form: FormFactor): Shot =>
  boardOnCanvas(form) ? MAP_SHOT : form === 'phone' ? STAGE_SHOTS.phone : STAGE_SHOTS.stand;
/** The flight into `map` (s): the engine's 1,8 s took ≈ 0,33 a frame from the scope's shot, at the QA's limit. */
export const MAP_FLIGHT = 2.4;

/** The stand behind the map: calm — strongly out of focus, the corners darker, less bloom (the circuit's numbers). */
export const MAP_POST: PostOverrides = {
  dofAperture: 4.6,
  dofRange: 0.5,
  dofMaxBlur: 22,
  vignette: 0.85,
  bloomIntensity: 0.7,
};

/** `map`'s post as the page is now: `MAP_POST` behind the board over the scene; beside the sheet the bench's own. */
export const mapPost = (form: FormFactor): PostOverrides => (boardOnCanvas(form) ? MAP_POST : {});
