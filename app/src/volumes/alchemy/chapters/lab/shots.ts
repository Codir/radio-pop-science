/**
 * Every camera shot of the chapter. The unit scale: the subject of a step has a radius of about 6 world units
 * (`ctx.env.setScale(6)`). The atom sits at the origin (outer electrons 2 … 4.1 units out, see
 * `parts/atom-view.ts`) with its name plate to the right, up to x ≈ 9: the shots aim at the middle of that
 * pair and keep the depth of field on the atom. Each shot declares `fit`, the sphere that must stay in frame on
 * any aspect ratio.
 */
import type { Shot } from '@/engine/api';

/** Middle of the atom (x = 0) and its plate. */
const MIDDLE = 2.4;

export const SHOTS = {
  /** The atom in the middle of the lab; used by every step. */
  lab: {
    position: [MIDDLE, 1.0, 16.6],
    target: [MIDDLE, 0, 0],
    focus: [0, 0, 0],
    fov: 32,
    orbit: { azimuth: 0.3, polar: 0.2 },
    fit: { center: [MIDDLE, 0, 0], radius: 6.9 },
  },
  /** fission: the same view, wider, to leave room for the two fragments. */
  fission: {
    position: [MIDDLE, 1.2, 19.6],
    target: [MIDDLE, 0, 0],
    focus: [0, 0, 0],
    fov: 32,
    orbit: { azimuth: 0.3, polar: 0.2 },
    fit: { center: [MIDDLE, 0, 0], radius: 8.4 },
  },
} satisfies Record<string, Shot>;
