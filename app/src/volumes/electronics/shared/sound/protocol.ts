/**
 * The messages between the scene and the circuit model playing in blocks. The same messages go to the background
 * thread (`model.worker.ts`) and, on the synchronous path, straight to `createHandler` in the main thread.
 */
import type { Netlist } from '@electronics/sim/core';

/** What a block records: the voltage of a node, or the current into the first pin of a part (`Transient.run`). */
export type ProbeSpec = { readonly node: number } | { readonly part: string };

/** The board and how to play it: the rate, the samples a block and what to record. */
export interface StreamSetup {
  net: Netlist;
  /** Samples per second. */
  rate: number;
  /** Samples a block. */
  block: number;
  /** Steps of integration a sample (1 when absent; `TransientOptions.substeps`). */
  substeps?: number;
  probes: readonly ProbeSpec[];
}

/** One block asked of the model. */
export interface BlockRequest {
  seq: number;
  /** The stream's index of the block's first sample (the scene counts them: the model may start again). */
  first: number;
  /** A new board for this block and the next ones (a part put in, a knob turned), or null: the same board. */
  net: Netlist | null;
  /**
   * New probes for this block and the next ones — an oscilloscope's probe moved to another row (E2-9) — or, absent or
   * null, the same probes. The model plays on: only what it records changes.
   */
  probes?: readonly ProbeSpec[] | null;
  /** How many boards and lists of probes the scene had given when it asked: the block carries it back. */
  revision: number;
}

/** The model's block: an array of its own per probe (they may be transferred), and how long the model took, ms. */
export interface BlockReply {
  seq: number;
  first: number;
  revision: number;
  /** How many steps succeeded: the samples after them are 0 (`Transient.run` stops at a moment without a solution). */
  steps: number;
  samples: Float32Array[];
  ms: number;
}

export type ToWorker = { type: 'init'; setup: StreamSetup } | { type: 'block'; request: BlockRequest };

export type FromWorker =
  { type: 'ready' } | { type: 'block'; reply: BlockReply } | { type: 'error'; message: string };
