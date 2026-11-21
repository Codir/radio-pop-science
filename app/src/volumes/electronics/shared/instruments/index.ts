/**
 * The instruments of the bench (docs/volumes/electronics/VISUAL.md §5): the multimeter (`meter.ts`) with its probes
 * (`probe.ts`) and what it reads (`meter-model.ts`); the oscilloscope (`scope.ts`) with its probes, what it shows
 * (`scope-model.ts`) and the arithmetic of a sweep (`sweep.ts`); the speaker in sound (`speaker.ts`: its current
 * through the volume's own sound output, which paces the model in time). The bench mounts the meter and the scope
 * (`bench.multimeter`, `bench.oscilloscope`) and, with its option `sound`, the speaker (`bench.speaker`); a chapter
 * turns the meter's dial (`mode`), sets the scope's scale (`settings`), puts their probes (`put`) and shows the meter's
 * number (`readout`) and the scope's trace (`chart`) in the step's panel.
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
export {
  PROBE,
  PROBE_LEAD,
  PROBE_LENGTH,
  STANDING,
  createProbe,
  type Probe,
  type ProbeColors,
  type ProbePose,
  type ProbeWorld,
} from './probe';
export { decimateMinMax, findTrigger, type Points } from './sweep';
export {
  PEAK_CHUNK,
  ROLL_BUCKETS,
  SCOPE_CHANNELS,
  SCOPE_COLORS,
  SCOPE_DEFAULTS,
  SCOPE_GRID,
  SCREEN_BUCKETS,
  SCREEN_POINTS,
  SWEEP_BUCKETS,
  ScopeModel,
  scopeRange,
  scopeSettings,
  voltsOf,
  type ScopeDisplay,
  type ScopeSettings,
  type ScopeSetup,
  type ScopeState,
  type ScopeTrace,
  type ScopeTrigger,
  type ScopeUnit,
  type ScopeWords,
} from './scope-model';
export {
  SCOPE_INPUT,
  SCOPE_LEAD,
  SCOPE_PROBES,
  SCOPE_SCREEN,
  createOscilloscope,
  type Oscilloscope,
  type ScopeProbeName,
} from './scope';
export {
  SPEAKER,
  createSpeaker,
  speakerFullScale,
  speakerSamples,
  type Speaker,
  type SpeakerLevel,
  type SpeakerOptions,
} from './speaker';
