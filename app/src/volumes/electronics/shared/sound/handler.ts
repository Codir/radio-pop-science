/**
 * The model's side of the stream: one message in, one message out. The background thread (`model.worker.ts`) and
 * the synchronous path of `createStream` both run the model through this handler, so the two give the same blocks.
 *
 * - `init` compiles the board into a `Transient` at the setup's rate, starts it from the operating point and makes
 *   one array per probe; a second `init` replaces it all (that is how the model starts again). A setup with the
 *   scene's damage (E2-9) starts with it — a burnt part a gap, a bulged can its leak — and its model fails no part on
 *   its own heat (`TransientOptions.fails`): every failure is the scene's word.
 * - `block` takes the request's damage and board, if it has them (`Transient.rebuild`: time and charges run on; the
 *   damage is written into the model's state first, which the build reads, so a new damage alone builds the same
 *   board again), then its probes, if it has them (an oscilloscope's probe moved: new arrays, the model plays on), and
 *   runs one block. The model writes into its own arrays block after block, so the reply carries copies — new
 *   buffers, which make the transfer list. `ms` is the clock's reading after the model minus before it.
 * - A block before `init`, a board without an operating point, a malformed board or probe, or any exception of the
 *   model is an `error` reply, never an exception out of here.
 */
import {
  type ModelState,
  type Netlist,
  type Probe,
  Transient,
  createModelState,
  memoryOf,
} from '@electronics/sim/core';
import type { FromWorker, StreamDamage, ToWorker } from './protocol';

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

/** The scene's damage into the model's state for every part of `net`: a part it names burnt or bulged, every other
 * whole (the build reads it: `Transient.rebuild`, `start`). */
function tell(state: ModelState, net: Netlist, damage: StreamDamage): void {
  const burnt = new Set(damage.burnt);
  const bulged = new Set(damage.bulged);
  for (const p of net.parts) {
    const memory = memoryOf(state, p.id);
    memory.burnt = burnt.has(p.id);
    memory.bulged = bulged.has(p.id);
  }
}

/** `now` is a clock in milliseconds; it is read just before and just after the model. */
export function createHandler(now: () => number): Handler {
  let playing: Playing | null = null;

  return {
    handle(msg) {
      if (msg.type === 'init') {
        playing = null;
        const { net, rate, block, substeps, probes, damage } = msg.setup;
        try {
          if (!(Number.isInteger(block) && block >= 1))
            throw new RangeError(`a block holds a whole number of samples from 1: ${block}`);
          const state = createModelState();
          if (damage) tell(state, net, damage);
          // told the damage, the model takes it from the scene alone: nothing fails on the stream's own heat
          const transient = new Transient(net, {
            dt: 1 / rate,
            substeps,
            state,
            fails: damage === undefined,
          });
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
      const { seq, first, net, revision, damage } = msg.request;
      const { transient, block } = playing;
      try {
        // the damage first, into the state the build reads; a new damage alone builds the same board again
        if (damage) tell(transient.state, net ?? transient.circuit.net, damage);
        if (net !== null) transient.rebuild(net);
        else if (damage) transient.rebuild(transient.circuit.net);
        const asked = msg.request.probes;
        if (asked) {
          const own = asked.map((p): Probe => ({ ...p, out: new Float32Array(block) }));
          transient.run(0, own); // the probes are checked before the block; a bad one keeps the old ones
          playing.probes = own;
        }
        const { probes } = playing;
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
