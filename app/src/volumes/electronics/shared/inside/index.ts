/**
 * The inner views of the parts (docs/volumes/electronics/VISUAL.md §7): the floor `inside` of the door's dive
 * (`shared/dive`), each opened on the part's place by the door's `cut`. E3 builds the carbon-film resistor's
 * (`film.ts`); the wedge that opens a part is every view's (`wedge.ts`).
 */
export { CLOSED, createWedge, type Cutaway, type InsideState, type Wedge } from './wedge';
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
