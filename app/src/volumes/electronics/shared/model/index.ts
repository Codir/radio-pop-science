/**
 * The bench's link to the circuit model (`driver.ts`): the one place the bench calls `sim/core`; the model in time,
 * played by E1-9's stream for the oscilloscope (`live.ts`); and the checks' small helpers (`hash.ts`, copied from
 * `radio`).
 */
export {
  OHMMETER,
  STILL,
  createBenchModel,
  type BenchModel,
  type BenchModelSource,
  type PartState,
  type Still,
  type StillTap,
  type StillWindow,
} from './driver';
export { fnv1a, meanOf } from './hash';
export { LIVE, createLive, type Live, type LiveOptions } from './live';
