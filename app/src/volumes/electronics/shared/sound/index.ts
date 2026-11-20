/** The volume's own sound output and the circuit model playing in blocks behind it (README.md). */
export {
  createSoundOut,
  noaudioFlag,
  OUTPUT_LEVEL,
  type SoundOut,
  type SoundOutOptions,
  type SoundState,
} from './output';
export { BlockPlan, PLAN_CAPACITY, PLAN_LEAD, type PlanOptions, type PlannedBlock } from './plan';
export { Tape } from './tape';
export { createStream, type Stream, type StreamMode, type StreamOptions, type WorkerLike } from './stream';
export type { BlockReply, BlockRequest, FromWorker, ProbeSpec, StreamSetup, ToWorker } from './protocol';
export {
  BOARD_NODES,
  BOARD_PROBES,
  FILTER_CAPACITOR,
  FILTER_OHMS,
  filterBoard,
  SPEAKER_FULL_SCALE,
  type Netlist,
} from './board';
