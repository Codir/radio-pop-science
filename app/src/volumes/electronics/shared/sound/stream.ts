/**
 * The scene's stream of blocks from the circuit model. A scene never runs the model for sound itself: it gives the
 * board (`board`), calls `pump` once per engine update, and takes every block in `onBlock`, in order.
 *
 * - The model runs in a background thread (`model.worker.ts`) when there is one. At most one request is on its way,
 *   and it leaves only while the output `wants` a block. When a block comes, `onBlock` takes it and, if the output
 *   wants another, the next request leaves at once — not at the next engine update — so a long frame of the main
 *   thread does not starve the sound. A request carries the board only when it changed since the last one.
 * - Without a background thread the model runs here, in the main thread: one block per `pump` while the output
 *   wants one. A thread that fails (its constructor throws, `onerror`, or an `error` message) is terminated, and the
 *   stream moves to the main thread for good, with the board of that moment, from its operating point; the block that
 *   was on its way is lost. A missing `Worker` is not a failure and is not logged.
 * - An error of the model on the main thread gives no block; the next `pump` tries again. The stream writes at most
 *   one `console.error` in its life.
 * - The stream numbers the samples (`first`), so they run on when the model starts again on the main thread.
 * - New probes (`probes`, an oscilloscope's probe moved: E2-9) go with the next request, once; the model plays on.
 *   `restart` (a step's own new board, its parts new and whole: E2-9) starts the model again from the operating point
 *   of the board given, in the thread with a new `init` (the reply to the request on its way then is not taken) or on
 *   the main thread; the samples are numbered on.
 * - `createStream` puts its own `dispose` into `ctx.onDispose` (two copies of a chapter may live side by side at a
 *   boundary, so the thread belongs to the mount, never to the module); a reply after `dispose` changes nothing.
 *
 * After `radio/shared/link` (docs/volumes/electronics/REUSE.md).
 */
import type { ChapterContext } from '@/engine/api';
import type { Netlist } from '@electronics/sim/core';
import { createHandler, type Handler } from './handler';
import type { BlockReply, BlockRequest, FromWorker, ProbeSpec, StreamSetup, ToWorker } from './protocol';

export type StreamMode = 'worker' | 'sync';

/** What the stream needs of a background thread; a real `Worker` and the tests' stand-in both fit. */
export interface WorkerLike {
  postMessage(msg: ToWorker, transfer?: Transferable[]): void;
  onmessage: ((e: { data: FromWorker }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}

export interface StreamOptions {
  /** Whether the output takes one more block now; asked before every request. */
  wants: () => boolean;
  /** Every block of the model, in order. */
  onBlock: (block: BlockReply) => void;
  mode?: 'auto' | StreamMode;
  makeWorker?: () => WorkerLike;
}

export interface Stream {
  readonly mode: StreamMode;
  /** How many blocks of the model have come. */
  readonly blocks: number;
  /** A request is on its way. */
  readonly busy: boolean;
  /** How many boards and lists of probes have been given (the setup's is the first): a block carries the revision it
   * was asked with. */
  readonly revision: number;
  /** How long the model took for its last block, ms (NaN before the first). */
  readonly ms: number;
  /** A new board: the next request carries it, and the model goes on with it from its last moment. */
  board(net: Netlist): void;
  /** New probes (the same list again changes nothing): the next request carries them, the model plays on. */
  probes(list: readonly ProbeSpec[]): void;
  /** The model starts again from the operating point of `net` (a step's own board): the samples are numbered on. */
  restart(net: Netlist): void;
  /** Once per engine update: a request (or, on the main thread, a block) while the output wants one. */
  pump(): void;
  dispose(): void;
}

/** The text of an error, an error event or anything else thrown. */
function told(e: unknown): string {
  if (e instanceof Error) return e.message;
  const message = (e as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : String(e);
}

const clockMs = (): number => performance.now();

/**
 * The model's background thread. The literal `new Worker(new URL(…, import.meta.url), …)` is the form Vite finds and
 * bundles; a DOM Worker's `onmessage` expects a MessageEvent, so it is not assignable to WorkerLike as is.
 */
const spawnWorker = (): WorkerLike =>
  new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

export function createStream(ctx: ChapterContext, setup: StreamSetup, opts: StreamOptions): Stream {
  let mode: StreamMode = 'sync';
  let worker: WorkerLike | null = null;
  let ready = false;
  /** The request on its way, or null. */
  let pending: BlockRequest | null = null;
  let seq = 0;
  /** The stream's index of the next block's first sample. */
  let next = 0;
  let net = setup.net;
  let probes: readonly ProbeSpec[] = setup.probes;
  let revision = 1;
  /** The board and the probes the model on the current path has (a request carries what it has not). */
  let netSent = true;
  let probesSent = true;
  let blocks = 0;
  let ms = Number.NaN;
  let complained = false;
  let disposed = false;
  let local: Handler | null = null;
  /** The revision whose board the main thread could not start (no try again until another board comes). */
  let refused = 0;

  const complain = (message: string): void => {
    if (complained) return;
    complained = true;
    console.error(message);
  };

  const ask = (): BlockRequest => {
    const request: BlockRequest = {
      seq: ++seq,
      first: next,
      net: netSent ? null : net,
      ...(probesSent ? {} : { probes }),
      revision,
    };
    netSent = probesSent = true;
    return request;
  };
  /** The setup the model starts with now: the board and the probes of this moment. */
  const now = (): StreamSetup => ({ ...setup, net, probes });

  const take = (reply: BlockReply): void => {
    next = reply.first + setup.block;
    blocks++;
    ms = reply.ms;
    opts.onBlock(reply);
  };

  /** The background thread failed: stop it and stay on the main thread for good. */
  const fail = (text: string): void => {
    if (mode !== 'worker' || disposed) return;
    complain(`[electronics/sound] worker failed, switching to the main thread: ${text}`);
    const w = worker;
    worker = null;
    mode = 'sync';
    pending = null;
    w?.terminate();
  };

  const send = (): void => {
    const w = worker;
    if (w === null || disposed || !ready || pending !== null || !opts.wants()) return;
    pending = ask();
    try {
      w.postMessage({ type: 'block', request: pending });
    } catch (e) {
      fail(told(e));
    }
  };

  const listen = (w: WorkerLike): void => {
    w.onmessage = (e) => {
      if (disposed || worker !== w) return;
      const msg = e.data;
      if (msg.type === 'ready') {
        ready = true;
        send();
      } else if (msg.type === 'error') fail(msg.message);
      else if (msg.type === 'block' && msg.reply.seq === pending?.seq) {
        pending = null;
        take(msg.reply);
        send();
      }
    };
    w.onerror = (e) => {
      if (!disposed && worker === w) fail(told(e));
    };
  };

  if (opts.mode !== 'sync' && (opts.makeWorker !== undefined || typeof Worker !== 'undefined')) {
    mode = 'worker';
    try {
      worker = opts.makeWorker?.() ?? spawnWorker();
      listen(worker);
      worker.postMessage({ type: 'init', setup });
    } catch (e) {
      fail(told(e));
    }
  }

  /** One block on the main thread; the model starts (again) with the board of this moment. */
  const runHere = (): void => {
    if (local === null) {
      if (refused === revision) return;
      const h = createHandler(clockMs);
      const out = h.handle({ type: 'init', setup: structuredClone(now()) });
      if (out?.reply.type !== 'ready') {
        refused = revision;
        complain(
          `[electronics/sound] model failed: ${out?.reply.type === 'error' ? out.reply.message : 'no reply'}`,
        );
        return;
      }
      local = h;
      netSent = probesSent = true;
    }
    const request = ask();
    const out = local.handle({
      type: 'block',
      request: request.net === null ? request : { ...request, net: structuredClone(request.net) },
    });
    if (out?.reply.type === 'block') take(out.reply.reply);
    else if (out?.reply.type === 'error') complain(`[electronics/sound] model failed: ${out.reply.message}`);
  };

  const stream: Stream = {
    get mode() {
      return mode;
    },
    get blocks() {
      return blocks;
    },
    get busy() {
      return pending !== null;
    },
    get revision() {
      return revision;
    },
    get ms() {
      return ms;
    },

    board(board) {
      if (disposed) return;
      net = board;
      revision++;
      netSent = false;
    },

    probes(list) {
      if (disposed) return;
      const same =
        list.length === probes.length &&
        list.every((p, k) => JSON.stringify(p) === JSON.stringify(probes[k]));
      if (same) return;
      probes = list.map((p) => ({ ...p }));
      revision++;
      probesSent = false;
    },

    restart(board) {
      if (disposed) return;
      net = board;
      revision++;
      // the model of this moment starts again: the request on its way (if any) is not taken
      pending = null;
      local = null;
      refused = 0;
      const w = worker;
      if (mode !== 'worker' || w === null) return;
      ready = false;
      netSent = probesSent = true;
      try {
        w.postMessage({ type: 'init', setup: now() });
      } catch (e) {
        fail(told(e));
      }
    },

    pump() {
      if (disposed) return;
      if (mode === 'worker') send();
      else if (opts.wants()) runHere();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      const w = worker;
      worker = null;
      pending = null;
      w?.terminate();
    },
  };

  ctx.onDispose(() => stream.dispose());
  return stream;
}
