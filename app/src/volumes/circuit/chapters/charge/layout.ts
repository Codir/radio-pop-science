/**
 * Where the chapter's props stand on the table in front of the stand (world units, the stage at the origin;
 * the table top is y = 0, the board's near edge is at z ≈ 2.2). Everything sits left of the stand and nearer
 * the reader than the board, below the bottom edge of the main shot `stand` — so the chapter's first and last
 * frames are the plain stand shot, and in the table shots the stand stands in the right third, out of focus.
 */
import { Vector3 } from 'three';

/** The figure with fluffy hair (its feet). */
export const FIGURE = new Vector3(-3.3, 0, 4.55);
/** Where the reader's balloon waits during `field` (right of the shot, under nothing). */
export const BALLOON_AWAY = new Vector3(0.7, 0.5, 5.3);
/** Where the figure steps for `field`: right of the shot, out of the way of the probe. */
export const FIGURE_ASIDE = new Vector3(-1.45, 0, 3.75);
/** Where the figure steps for `shift`: left, wholly out of the shot. */
export const FIGURE_OUT = new Vector3(-4.65, 0, 5.3);
/** The reader's balloon at rest, lying on its side (its centre). */
export const BALLOON_REST = new Vector3(-1.85, 0.5, 5.0);
/** The stand of the second balloon (its foot): left of the figure, the arm reaching right. */
export const HANGER = new Vector3(-7.92, 0, 4.15);
/** Where the four spheres of `signs` lie (centre of their square). */
export const SPHERES = new Vector3(-4.1, 0, 6.9);
/** The spare piece of wire (`shift`): its centre; it lies along world +x. */
export const SPARE = new Vector3(0.2, 0, 3.0);
export const SPARE_LENGTH = 1.9;

/** The drag plane of the balloon: vertical, through the figure, facing the camera of `rub`. */
export const RUB_PLANE_NORMAL = new Vector3(0.12, 0, 1).normalize();
