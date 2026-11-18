/**
 * The radio volume, "from the electron to the screen" (docs/superpowers/specs/2026-11-17-radio-volume-design.md):
 * the road of one picture from a camera in the yard to a monitor in the kitchen — through the transmitter, the
 * air and the receiver back onto a screen. Identity, layers and the whole planned journey are data
 * (`volume.json`); chapters are written in the path format. A draft in the tree: only the site profile publishes
 * it, in its own copy. While no chapter is built the home screen is the lobby with `emptyNote`.
 * The map's axis is the station on the picture's road; the theme is an evening diorama (sky `dusk`).
 */
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // Stations, named on the ruler (`axis.floors`): the basics 0, camera 1, transmitter 2, air 3, receiver 4,
    // screen 5, and the whole road 6 (prologue, practicums). Equal steps on the map.
    axis: {
      min: 0,
      max: 6,
      origin: 0,
      tick: 1,
      majorEvery: 1,
      format: (v) => identity.axis.floors.find((f) => f.value === v)?.label ?? '',
      ascending: 'out',
    },
    layout: { dx: 210, dy: 70 },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'dusk', mood: 'diorama' },
});
