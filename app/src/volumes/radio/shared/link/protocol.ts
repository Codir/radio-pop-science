/**
 * The messages between the scene and the signal model. The same messages go to the background thread
 * (`model.worker.ts`) and, on the synchronous path, straight to `createHandler` in the main thread.
 */
import type { FmLinkState, Meters, ProbeData, ProbeRequest } from '@radio/sim/core';

/** One frame asked of the model: `step` goes on from the frame before, `still` depends only on (seed, state, luma). */
export interface LinkRequest {
  seq: number;
  kind: 'step' | 'still';
  state: FmLinkState;
  /** The camera's frame, 128·96 values. */
  luma: Uint8Array;
  probe: ProbeRequest | null;
}

/** The model's frame: buffers of its own (they may be transferred), and how long the model took, ms. */
export interface LinkReply {
  seq: number;
  screen: Uint8Array;
  meters: Meters;
  probe: ProbeData | null;
  ms: number;
}

export type ToWorker = { type: 'init'; seed: number } | { type: 'frame'; request: LinkRequest };

export type FromWorker =
  { type: 'ready' } | { type: 'frame'; reply: LinkReply } | { type: 'error'; message: string };
