/**
 * The floors of the bench (docs/volumes/electronics/VISUAL.md §7; shared/README.md, «dive»): the magnifier as the door
 * from the step's shot down to a part (`part`) and into it (`inside`; `atoms` from E3). The rail maths, the camera rail
 * and the lens's keeper are copies of `circuit` (docs/volumes/electronics/REUSE.md, «Копії»); the door, the part's
 * stops and the table of inner views (`cutaway.ts`, the views themselves in `shared/inside`) are the bench's own.
 */
export {
  LENS_LANDS,
  LENS_LEG,
  createDiveRail,
  leadCamera,
  leadLens,
  ringEase,
  type DiveRail,
} from './rail-math';
export { cameraRail, type CameraRail } from './camera-rail';
export { emptyPose, lensKeeper, mixPose, type LensKeeper } from './lens-keeper';
export { FLIGHT, FLOORS, FLOOR_FROM, flightSeconds, floorAt, type FloorId } from './levels';
export {
  PART_VIEW,
  partLensPose,
  partPlace,
  partStops,
  placeOf,
  type BodyBox,
  type PartPlace,
  type PartStops,
} from './poses';
export { CLOSED, createCutaway, type Cutaway, type InsideState } from './cutaway';
export { CUT_OPENS, PASS, partDoor, type Door, type DoorOptions } from './door';
export { BENCH_VOLUME, benchLadder } from './ladder';
