/**
 * The bench's link to the circuit model (`driver.ts`): the one place the bench calls `sim/core`; and the checks' small
 * helpers (`hash.ts`, copied from `radio`).
 */
export { OHMMETER, createBenchModel, type BenchModel, type BenchModelSource } from './driver';
export { fnv1a, meanOf } from './hash';
