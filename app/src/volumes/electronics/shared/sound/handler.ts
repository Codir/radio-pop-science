/**
 * The model's side of the stream: one message in, one message out. The background thread (`model.worker.ts`) and
 * the synchronous path of `createStream` both run the model through this handler, so the two give the same blocks.
 *
 * - `init` compiles the board into a `Transient` at the setup's rate, starts it from the operating point and makes
 *   one array per probe; a second `init` replaces it all (that is how the model starts again).
 * - `block` takes the request's board, if it has one (`Transient.rebuild`: time and charges run on), and runs one
 *   block. The model writes into its own arrays block after block, so the reply carries copies — new buffers, which
 *   make the transfer list. `ms` is the clock's reading after the model minus before it.
 * - A block before `init`, a board without an operating point, a malformed board or probe, or any exception of the
 *   model is an `error` reply, never an exception out of here.
 */
import { type Probe, Transient } from '@electronics/sim/core';
import type { FromWorker, ToWorker } from './protocol';

export interface HandlerOutput {
  reply: FromWorker;
  /** The buffers of the reply's arrays, to be transferred rather than copied. */
  transfer: ArrayBuffer[];
}

export interface Handler {
  handle(msg: ToWorker): HandlerOutput | null;
}

const failed = (message: string): HandlerOutput => ({ reply: { type: 'error', message }, transfer: [] });

const told = (e: unknown): string => (e instanceof Error ? e.message : String(e));

interface Playing {
  transient: Transient;
  block: number;
  probes: Probe[];
}

/** `now` is a clock in milliseconds; it is read just before and just after the model. */
export function createHandler(now: () => number): Handler {
  let playing: Playing | null = null;

  return {
    handle(msg) {
      if (msg.type === 'init') {
        playing = null;
        const { net, rate, block, substeps, probes } = msg.setup;
        try {
          if (!(Number.isInteger(block) && block >= 1))
            throw new RangeError(`a block holds a whole number of samples from 1: ${block}`);
          const transient = new Transient(net, { dt: 1 / rate, substeps });
          if (!transient.start('dc')) return failed(`stream: no operating point (${transient.reason})`);
          const own = probes.map((p): Probe => ({ ...p, out: new Float32Array(block) }));
          transient.run(0, own); // the probes are checked before any block
          playing = { transient, block, probes: own };
        } catch (e) {
          return failed(told(e));
        }
        return { reply: { type: 'ready' }, transfer: [] };
      }
      if (msg.type !== 'block') return null;
      if (playing === null) return failed('stream: block before init');
      const { seq, first, net, revision } = msg.request;
      const { transient, block, probes } = playing;
      try {
        if (net !== null) transient.rebuild(net);
        const before = now();
        const steps = transient.run(block, probes);
        const ms = now() - before;
        const transfer: ArrayBuffer[] = [];
        const samples = probes.map((p) => {
          const copy = new Float32Array(p.out);
          copy.fill(0, steps);
          transfer.push(copy.buffer);
          return copy;
        });
        return { reply: { type: 'block', reply: { seq, first, revision, steps, samples, ms } }, transfer };
      } catch (e) {
        return failed(told(e));
      }
    },
  };
}
