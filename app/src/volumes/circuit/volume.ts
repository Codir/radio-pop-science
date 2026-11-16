/**
 * The pilot mini-volume «Електричний струм · Від атома до лампочки» (DECISIONS §60): the path from the atom
 * and the electron to a working circuit with a battery and a bulb — the reference volume of the library.
 * Identity and journey are data (`volume.json`); the journey is empty until the first chapter is built, and
 * the home screen then shows the volume's `emptyNote` (docs/VOLUMES.md §3).
 */
import { fmtScale } from '@/content';
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is the scale of things, as in `electricity`: log₁₀ of the characteristic size in metres, from
    // the atomic nucleus (10⁻¹⁵ m) to a circuit on a table (10⁰ m); 10⁻¹⁰ m (an atom) is drawn at height 0.
    // The range is provisional: the chapter list (docs/volumes/circuit/) settles it.
    axis: {
      min: -15,
      max: 0,
      origin: -10,
      tick: 1,
      majorEvery: 5,
      format: (exp) => fmtScale(exp),
      // moving up in scale zooms the camera out
      ascending: 'out',
    },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'day', mood: 'diorama' },
});
