/**
 * Dev-only volume «Пісочниця шляху»: the path format (docs/PATH_FORMAT.md) end to end on two short chapters —
 * documents, checks, generated content, the one-reader step panel, «Згадайте» links — and a journey with a
 * prologue and a practicum that are planned but not built, so the map shows layers, named floors, planned
 * chapters and the minutes left. Registered only with `?debug` (docs/VOLUMES.md).
 */
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // Named floors (volume.json → axis.floors): one atom 0 … the table 3. Moving up a floor zooms out.
    axis: {
      min: 0,
      max: 3,
      origin: 0,
      tick: 1,
      majorEvery: 1,
      format: (v) => identity.axis.floors.find((f) => f.value === v)?.label ?? '',
      ascending: 'out',
    },
    layout: { dx: 240, dy: 70 },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'day', mood: 'diorama' },
});
