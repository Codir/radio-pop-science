/**
 * Every camera shot of the chapter. The unit scale: the subject of a step has a radius of about 6 world units
 * around the origin (`ctx.env.setScale(6)`). Each shot declares `fit`, the sphere that must stay in frame on
 * any aspect ratio.
 */
import type { Shot } from '@/engine/api';

export const SHOTS = {
  /** The atom in the middle of the lab; used by every step except fission. */
  lab: {
    position: [0, 1.2, 17],
    target: [0, 0, 0],
    fov: 32,
    orbit: { azimuth: 0.3, polar: 0.2 },
    fit: { center: [0, 0, 0], radius: 6 },
  },
  /** fission: the same view, wider, to leave room for the two fragments. */
  fission: {
    position: [0, 1.4, 20],
    target: [0, 0, 0],
    fov: 32,
    orbit: { azimuth: 0.3, polar: 0.2 },
    fit: { center: [0, 0, 0], radius: 8 },
  },
} satisfies Record<string, Shot>;
