/**
 * The messages between the scene and the circuit model playing in blocks. The same messages go to the background
 * thread (`model.worker.ts`) and, on the synchronous path, straight to `createHandler` in the main thread.
 */
import type { Netlist } from '@electronics/sim/core';

/** What a block records: the voltage of a node, or the current into the first pin of a part (`Transient.run`). */
export type ProbeSpec = { readonly node: number } | { readonly part: string };

/**
 * What the scene's own model has failed (E2-9: the bench's driver), by id: the burnt parts and the bulged cans. It is
 * the whole truth of the board: a part it does not name is whole.
 */
export interface StreamDamage {
  readonly burnt: readonly string[];
  readonly bulged: readonly string[];
}

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
  /**
   * The scene's damage (E2-9: the bench's oscilloscope). Given, the model starts with it and fails no part on its own
   * heat (`TransientOptions.fails`): the scene's model tells every failure (`BlockRequest.damage`), so what the stream
   * plays is the board the scene shows. Absent, the stream's model fails its parts on its own heat (E1-9).
   */
  damage?: StreamDamage;
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
  /** The scene's damage changed (a part burnt on the bench, E2-9): from this block on; absent or null, the same. */
  damage?: StreamDamage | null;
  /** How many boards, lists of probes and damages the scene had given when it asked: the block carries it back. */
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
