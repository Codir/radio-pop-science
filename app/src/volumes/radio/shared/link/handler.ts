/**
 * The model's side of the link: one message in, one message out. The background thread (`model.worker.ts`) and the
 * synchronous path of `createLink` both run the model through this handler, so the two give the same frames.
 *
 * - `init` makes the model, `createFmLink(seed)`; a second `init` replaces it (that is how the model starts again).
 * - `frame` runs `step` or `still` as the request asks. The model's frame, meters and probe arrays live only until
 *   its next call, so the reply carries copies: new buffers for the screen and the probe's arrays (they make the
 *   transfer list) and a copy of the meters. `ms` is the clock's reading after the model minus before it.
 * - A frame before `init`, or any exception of the model, is an `error` reply, never an exception out of here.
 */
import { createFmLink, type FmLink, type FmLinkFrame, type ProbeData } from '@radio/sim/core';
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

/** A copy of the probe's data with arrays of its own; their buffers go to `transfer`. */
function copyProbe(p: ProbeData, transfer: ArrayBuffer[]): ProbeData {
  const own = (a: Float32Array): Float32Array => {
    const c = new Float32Array(a);
    transfer.push(c.buffer);
    return c;
  };
  return { ...p, lo: own(p.lo), hi: own(p.hi), bins: own(p.bins), points: own(p.points) };
}

/** `now` is a clock in milliseconds; it is read just before and just after the model. */
export function createHandler(now: () => number): Handler {
  let link: FmLink | null = null;

  return {
    handle(msg) {
      if (msg.type === 'init') {
        link = createFmLink(msg.seed);
        return { reply: { type: 'ready' }, transfer: [] };
      }
      if (msg.type !== 'frame') return null;
      if (link === null) return failed('link: frame before init');
      const { seq, kind, state, luma, probe } = msg.request;
      try {
        const before = now();
        const out: FmLinkFrame =
          kind === 'still' ? link.still(state, luma, probe) : link.step(state, luma, probe);
        const ms = now() - before;
        const screen = new Uint8Array(out.screen);
        const transfer: ArrayBuffer[] = [screen.buffer];
        const data = out.probe === null ? null : copyProbe(out.probe, transfer);
        return {
          reply: { type: 'frame', reply: { seq, screen, meters: { ...out.meters }, probe: data, ms } },
          transfer,
        };
      } catch (e) {
        return failed(told(e));
      }
    },
  };
}
