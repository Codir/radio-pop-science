/**
 * The scene's link to the signal model. Chapters never call the model themselves: they call `pump` once per engine
 * update and show `frame` when it says a new one came.
 *
 * - The model runs in a background thread (`model.worker.ts`) when there is one. At most one request is on its way;
 *   the next one leaves only when the reply has come, with the state of that moment (the freshest state wins, old
 *   ones are never queued), and not sooner than 1 / LINK_MAX_FPS s of engine time after the one before: the eye's
 *   blocking read of its frame stays at 25 a second even on a fast machine. While the tab is hidden the engine does
 *   not update, so nothing is asked; on return the waiting reply is one frame and one request goes.
 * - Without a background thread the model runs here, in the main thread, once in LINK_SYNC_EVERY updates. A thread
 *   that fails (its constructor throws, `onerror`, or an `error` message) is terminated, and the link moves to the
 *   main thread for good. A missing `Worker` is not a failure and is not logged.
 * - An error of the model on the main thread keeps the last good frame; the next try comes LINK_SYNC_EVERY updates
 *   later. The link writes at most one `console.error` in its life (Review Focus 2: one error, not a stream).
 * - `still` runs a model instance of its own, made on the first call, so a held frame never touches the live line.
 * - `createLink` puts its own `dispose` into `ctx.onDispose` (the plan's correction П12: two copies of a chapter may
 *   live side by side at a boundary, so the thread belongs to the mount, never to the module); a reply after
 *   `dispose` changes nothing.
 */
import type { ChapterContext } from '@/engine/api';
import type { FmLinkState, ProbeRequest } from '@radio/sim/core';
import { createHandler, type Handler } from './handler';
import type { FromWorker, LinkReply, LinkRequest, ToWorker } from './protocol';

export type { FromWorker, LinkReply, LinkRequest, ToWorker } from './protocol';

export type LinkMode = 'worker' | 'sync';

/** What the link needs of a background thread; a real `Worker` and the tests' stand-in both fit. */
export interface WorkerLike {
  postMessage(msg: ToWorker, transfer?: Transferable[]): void;
  onmessage: ((e: { data: FromWorker }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  terminate(): void;
}

export interface LinkOptions {
  seed?: number;
  mode?: 'auto' | LinkMode;
  makeWorker?: () => WorkerLike;
}

export interface Link {
  readonly mode: LinkMode;
  /** The freshest frame of the model. */
  readonly frame: LinkReply | null;
  /** How many frames of the model have come. */
  readonly frames: number;
  /** Frames of the model per second of engine time, smoothed. */
  readonly fps: number;
  /**
   * Once per engine update. With no request on its way it takes the state, calls luma() and sends them.
   * true: a new frame has come since the last call.
   */
  pump(state: FmLinkState, luma: () => Uint8Array, probe: ProbeRequest | null): boolean;
  /**
   * A `still` frame, computed synchronously in either mode, by a model of its own (`seq: -1`). A state the model
   * refuses is an Error here, not a held frame: a held page has no older frame to keep showing.
   */
  still(state: FmLinkState, luma: Uint8Array, probe: ProbeRequest | null): LinkReply;
  dispose(): void;
}

/** The main thread: at most one frame of the model in LINK_SYNC_EVERY engine updates. */
export const LINK_SYNC_EVERY = 6;
/** At most LINK_MAX_FPS requests per second of engine time. */
export const LINK_MAX_FPS = 25;

/** How close to the gap between requests counts as the gap (engine time is a sum of steps of 1/60 s). */
const GAP_TOLERANCE = 1e-6;
/** Weight of the newest frame in the smoothed `fps`. */
const FPS_WEIGHT = 0.2;
const DEFAULT_SEED = 1;

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

export function createLink(ctx: ChapterContext, opts: LinkOptions = {}): Link {
  const seed = opts.seed ?? DEFAULT_SEED;
  let mode: LinkMode = 'sync';
  let worker: WorkerLike | null = null;
  let ready = false;
  /** The seq of the request on its way, or null. */
  let pending: number | null = null;
  let seq = 0;
  let sentAt = -Infinity;
  let frame: LinkReply | null = null;
  let frames = 0;
  /** A frame came since the last `pump`. */
  let arrived = false;
  let fps = 0;
  let frameAt: number | null = null;
  let complained = false;
  let disposed = false;
  let local: Handler | null = null;
  let updates = 0;
  let stills: Handler | null = null;

  const complain = (message: string): void => {
    if (complained) return;
    complained = true;
    console.error(message);
  };

  const startModel = (now: () => number): Handler => {
    const h = createHandler(now);
    h.handle({ type: 'init', seed });
    return h;
  };

  const take = (reply: LinkReply): void => {
    frame = reply;
    frames++;
    arrived = true;
    const t = ctx.clock.time;
    if (frameAt === null) {
      frameAt = t;
      return;
    }
    const dt = t - frameAt;
    if (dt > 0) {
      fps += FPS_WEIGHT * (1 / dt - fps);
      frameAt = t;
    }
  };

  /** The background thread failed: stop it and stay on the main thread for good. */
  const fail = (text: string): void => {
    if (mode !== 'worker' || disposed) return;
    complain(`[radio/link] worker failed, switching to the main thread: ${text}`);
    const w = worker;
    worker = null;
    mode = 'sync';
    pending = null;
    w?.terminate();
  };

  const listen = (w: WorkerLike): void => {
    w.onmessage = (e) => {
      if (disposed || worker !== w) return;
      const msg = e.data;
      if (msg.type === 'ready') ready = true;
      else if (msg.type === 'error') fail(msg.message);
      else if (msg.type === 'frame' && msg.reply.seq === pending) {
        pending = null;
        take(msg.reply);
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
      worker.postMessage({ type: 'init', seed });
    } catch (e) {
      fail(told(e));
    }
  }

  const send = (state: FmLinkState, luma: () => Uint8Array, probe: ProbeRequest | null): void => {
    const w = worker!;
    const data = new Uint8Array(luma());
    const request: LinkRequest = { seq: ++seq, kind: 'step', state, luma: data, probe };
    pending = request.seq;
    sentAt = ctx.clock.time;
    try {
      w.postMessage({ type: 'frame', request }, [data.buffer]);
    } catch (e) {
      fail(told(e));
    }
  };

  const link: Link = {
    get mode() {
      return mode;
    },
    get frame() {
      return frame;
    },
    get frames() {
      return frames;
    },
    get fps() {
      return fps;
    },

    pump(state, luma, probe) {
      if (disposed) return false;
      const came = arrived;
      arrived = false;
      if (mode === 'worker') {
        if (ready && pending === null && ctx.clock.time - sentAt >= 1 / LINK_MAX_FPS - GAP_TOLERANCE)
          send(state, luma, probe);
        return came;
      }
      if (++updates % LINK_SYNC_EVERY !== 0) return came;
      local ??= startModel(clockMs);
      const out = local.handle({
        type: 'frame',
        request: { seq: ++seq, kind: 'step', state, luma: luma(), probe },
      });
      if (out?.reply.type === 'frame') {
        take(out.reply.reply);
        arrived = false;
        return true;
      }
      if (out?.reply.type === 'error') complain(`[radio/link] model failed: ${out.reply.message}`);
      return came;
    },

    still(state, luma, probe) {
      stills ??= startModel(clockMs);
      const out = stills.handle({ type: 'frame', request: { seq: -1, kind: 'still', state, luma, probe } });
      if (out?.reply.type === 'frame') return out.reply.reply;
      throw new Error(
        `[radio/link] still failed: ${out?.reply.type === 'error' ? out.reply.message : 'no reply'}`,
      );
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

  ctx.onDispose(() => link.dispose());
  return link;
}
