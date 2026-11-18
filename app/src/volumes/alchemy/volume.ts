/**
 * «Ядерна алхімія» — a game volume, a branch of the course: one atom in a lab, a set of tools (projectiles,
 * γ-quanta, waiting for a decay, electrons) and the real nuclide table. Identity, groups and the journey are
 * data (`volume.json`, shared with the document pipeline); this file adds the journey axis, the group emblem
 * and the default environment.
 */
import { fmtScale } from '@/content';
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is the scale of things, as in the course: log₁₀ of the size in metres, 10⁻¹⁸ m … 10⁻¹⁰ m. The lab
    // stands at the nucleus (10⁻¹⁴ m); later iterations go down to quarks, so the axis already reaches 10⁻¹⁸ m.
    axis: {
      min: -18,
      max: -10,
      origin: -14,
      tick: 1,
      majorEvery: 2,
      format: (exp) => fmtScale(exp),
      // moving up in scale zooms the camera out
      ascending: 'out',
    },
    emblems: { nucleus: 'micro' },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'micro', mood: 'micro' },
});
