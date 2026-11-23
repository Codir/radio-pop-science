/**
 * The inner views of the parts (docs/volumes/electronics/VISUAL.md §7): the floor `inside` of the door's dive
 * (`shared/dive`), each opened on its place by the door's `cut`. E3 builds the carbon-film resistor's (`film.ts`); E4
 * the electrolytic's two plates with the model's charges (`plates.ts`) and the film capacitor's roll (`roll.ts`); the
 * wedge that opens a part, about its x or its vertical, and the section faces of a body not round about the axis are
 * every view's (`wedge.ts`).
 */
export {
  CLOSED,
  angleOf,
  createSection,
  createWedge,
  pointOf,
  printKeeper,
  radialOf,
  tangentOf,
  type Cutaway,
  type InsideState,
  type Section,
  type SectionLayer,
  type Wedge,
  type WedgeAxis,
} from './wedge';
export {
  FILM,
  asFilm,
  createFilm,
  electronSpeed,
  filmTurns,
  type Film,
  type FilmAnchor,
  type FilmOptions,
  type FilmState,
} from './film';
export {
  PLATES,
  asPlates,
  chargeCount,
  createPlates,
  platesLayout,
  type Plates,
  type PlatesAnchor,
  type PlatesState,
} from './plates';
export {
  ROLL,
  asRoll,
  boxReach,
  cornerPoint,
  createRoll,
  ovalReach,
  rollLayout,
  windAt,
  type Roll,
  type RollAnchor,
  type RollState,
} from './roll';
