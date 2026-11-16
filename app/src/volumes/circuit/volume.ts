/**
 * The pilot mini-volume «Електричний струм · Від атома до лампочки» (DECISIONS §60): the path from the atom
 * and the electron to a working circuit with a battery and a bulb — the reference volume of the library.
 * Identity, layers and the whole planned journey are data (`volume.json`, from docs/volumes/circuit/PATH.md);
 * chapters are written in the path format (docs/PATH_FORMAT.md). Until the first chapter is built the home
 * screen shows `emptyNote` over the map of the planned chapters (docs/VOLUMES.md §3).
 */
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is the floor of the scene (docs/volumes/circuit/VISUAL.md §3): one atom 0, rows of atoms 1, inside
    // a part 2, the stand 3 — equal steps on the map, named on the ruler (`axis.floors`). Going up zooms out.
    axis: {
      min: 0,
      max: 3,
      origin: 0,
      tick: 1,
      majorEvery: 1,
      format: (v) => identity.axis.floors.find((f) => f.value === v)?.label ?? '',
      ascending: 'out',
    },
    layout: { dx: 210, dy: 70 },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'day', mood: 'diorama' },
});
