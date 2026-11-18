/**
 * Every camera shot of the chapter. The unit scale: the subject of a step has a radius of about 6 world units
 * (`ctx.env.setScale(6)`). The atom sits at the origin (outer electrons 2 … 4.1 units out, see
 * `parts/atom-view.ts`) with its name plate to the right, up to x ≈ 9, and the emitter lower left (its back end
 * at (−4.6, −4.1), `parts/emitter.ts`): the shots aim at the middle of atom and plate and keep the depth of field
 * on the atom. Each shot declares `fit`, the sphere that must stay in frame on any aspect ratio — plate and emitter
 * included. A fission's fragments hang inside the same frame (`parts/fission-view.ts`), so every step keeps one
 * shot and the camera never jumps when a nucleus splits.
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
    fit: { center: [2.2, -0.4, 0], radius: 7.9 },
  },
} satisfies Record<string, Shot>;
