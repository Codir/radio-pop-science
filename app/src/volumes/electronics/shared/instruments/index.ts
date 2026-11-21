/**
 * The instruments of the bench (docs/volumes/electronics/VISUAL.md §5): the multimeter (`meter.ts`) with its probes
 * (`probe.ts`) and what it reads (`meter-model.ts`). The bench mounts it (`bench.multimeter`); a chapter turns its dial
 * (`mode`), puts its probes (`put`) and shows its number in the step's panel (`readout`).
 */
export {
  METER_ID,
  METER_MODES,
  METER_REFRESH,
  OHM_LIMIT,
  PROBE_NAMES,
  UNIT,
  createMeterDisplay,
  formatReading,
  meterExtra,
  meterText,
  readMeter,
  type MeterDisplay,
  type MeterMode,
  type MeterUnit,
  type ProbeName,
  type ProbeSockets,
} from './meter-model';
export { DIAL, DIAL_ANGLE, createMultimeter, type MeterWorld, type Multimeter } from './meter';
export { PROBE, PROBE_LEAD, PROBE_LENGTH, STANDING, createProbe, type Probe, type ProbePose, type ProbeWorld } from './probe';
