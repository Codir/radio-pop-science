/**
 * The electronics volume, "from the resistor to the amplifier", the sequel of the electron course (`circuit`)
 * — docs/superpowers/specs/2026-11-20-electronics-volume-design.md. On a stand like the one of `circuit` the
 * reader plugs parts into a board (resistors, capacitors, diodes, LEDs, transistors) and sees what each does by
 * light, by sound and by the waveform on an oscilloscope. Every chapter adds a part that has a real job in a small
 * amplifier, which the reader finally builds and hears play.
 * Identity, layers and the whole planned journey are data (`volume.json`); chapters are written in the path
 * format. A draft in the tree: only the site profile publishes it, in its own copy. While no chapter is built
 * the home screen is the lobby with `emptyNote` over the map of the planned chapters. The theme is the dark room
 * with the stand (studio), as in the chapters of `circuit`.
 */
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is the floor of the scene, as in `circuit`: the atoms of a part 0, inside a part 1, the part 2,
    // the stand 3 — equal steps on the map, named on the ruler (`axis.floors`). Going up zooms out.
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
  theme: { sky: 'studio', mood: 'studio' },
});
