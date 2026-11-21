import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { BOARD_PROBES, filterBoard } from '../board';
import { createHandler } from '../handler';
import type { BlockReply, FromWorker, StreamSetup, ToWorker } from '../protocol';
import { createStream, type Stream, type StreamOptions, type WorkerLike } from '../stream';

const BLOCK = 256;
const SETUP: StreamSetup = { net: filterBoard(1000), rate: 24000, block: BLOCK, probes: BOARD_PROBES };

type BlockMsg = Extract<ToWorker, { type: 'block' }>;

/** A worker that keeps what it was sent; `answer(i)` runs the i-th request through a real handler. */
class FakeWorker implements WorkerLike {
  posted: ToWorker[] = [];
  terminated = 0;
  onmessage: ((e: { data: FromWorker }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  private readonly handler = createHandler(() => 0);

  postMessage(msg: ToWorker): void {
    this.posted.push(structuredClone(msg));
    if (msg.type === 'init') this.handler.handle(structuredClone(msg));
  }

  terminate(): void {
    this.terminated++;
  }

  requests(): BlockMsg[] {
    return this.posted.filter((m): m is BlockMsg => m.type === 'block');
  }

  emit(data: FromWorker): void {
    this.onmessage?.({ data });
  }

  answer(i: number): void {
    this.emit(this.prepare(i));
  }

  /** The reply to the i-th request, computed now and emitted later (a real thread answers in the order it was sent). */
  prepare(i: number): FromWorker {
    return this.handler.handle(this.requests()[i]!)!.reply;
  }
}

let disposers: (() => void)[] = [];
const ctx = { onDispose: (fn: () => void) => disposers.push(fn) } as unknown as ChapterContext;
let err: MockInstance<typeof console.error>;
/** The output's room, as the test sets it. */
let room = 0;
let got: BlockReply[] = [];
let stream: Stream;

const options = (extra: Partial<StreamOptions> = {}): StreamOptions => ({
  wants: () => room > 0,
  onBlock: (b) => {
    got.push(b);
    room--;
  },
  ...extra,
});

beforeEach(() => {
  disposers = [];
  got = [];
  room = 0;
  err = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  err.mockRestore();
});

describe('the model stream', () => {
  it('one request on its way, only while the output wants a block; the next leaves as the block comes', () => {
    const w = new FakeWorker();
    stream = createStream(ctx, SETUP, options({ makeWorker: () => w }));
    expect(stream.mode).toBe('worker');
    expect(w.posted[0]).toEqual({ type: 'init', setup: SETUP });
    room = 3;
    stream.pump();
    expect(w.requests()).toHaveLength(0); // not 'ready' yet
    w.emit({ type: 'ready' }); // ready: the first request leaves at once
    expect(w.requests()).toHaveLength(1);
    for (let i = 0; i < 10; i++) stream.pump();
    expect(w.requests()).toHaveLength(1);
    expect(stream.busy).toBe(true);
    w.answer(0); // the block comes; the output still has room: the next request leaves without a pump
    expect(got).toHaveLength(1);
    expect(w.requests()).toHaveLength(2);
    w.answer(1);
    w.answer(2);
    expect(got).toHaveLength(3);
    expect(room).toBe(0);
    expect(w.requests()).toHaveLength(3); // full: nothing on its way
    expect(stream.busy).toBe(false);
    stream.pump();
    expect(w.requests()).toHaveLength(3);
    room = 1; // a block has played
    stream.pump();
    expect(w.requests()).toHaveLength(4);
    w.emit({ type: 'block', reply: { ...got[0]!, seq: 1 } }); // a reply with an old seq is not taken
    expect(got).toHaveLength(3);
    expect(stream.blocks).toBe(3);
    // the samples are numbered on: each block starts where the one before ended
    expect(got.map((b) => b.first)).toEqual([0, BLOCK, 2 * BLOCK]);
  });

  it('a request carries the board only when it changed, and the block its revision', () => {
    const w = new FakeWorker();
    stream = createStream(ctx, SETUP, options({ makeWorker: () => w }));
    room = 10;
    w.emit({ type: 'ready' });
    expect(w.requests()[0]!.request).toMatchObject({ net: null, revision: 1 });
    stream.board(filterBoard(null));
    stream.board(filterBoard(4700)); // two changes between requests: the freshest goes
    expect(stream.revision).toBe(3);
    w.answer(0);
    expect(w.requests()[1]!.request.revision).toBe(3);
    expect(w.requests()[1]!.request.net).toEqual(filterBoard(4700));
    w.answer(1);
    expect(w.requests()[2]!.request.net).toBeNull();
    expect(got.map((b) => b.revision)).toEqual([1, 3]);
  });

  it('new probes go with the next request, once, and bump the revision (E2-9: a scope’s probes)', () => {
    const w = new FakeWorker();
    stream = createStream(ctx, SETUP, options({ makeWorker: () => w }));
    room = 10;
    w.emit({ type: 'ready' });
    expect(w.requests()[0]!.request.probes ?? null).toBeNull();
    const probes = [{ node: 1 }, { node: 2 }];
    stream.probes(probes);
    stream.probes(probes.map((p) => ({ ...p }))); // the same list again: nothing new
    expect(stream.revision).toBe(2);
    w.answer(0);
    expect(w.requests()[1]!.request).toMatchObject({ net: null, probes, revision: 2 });
    w.answer(1);
    expect(w.requests()[2]!.request.probes ?? null).toBeNull();
    expect(got.map((b) => b.samples.length)).toEqual([2, 2]);
    w.answer(2);
    expect(got[2]!.samples).toHaveLength(2);
    expect(got[2]!.revision).toBe(2);
  });

  it('restart: the model starts again from the operating point of the new board, the numbering runs on', () => {
    const w = new FakeWorker();
    stream = createStream(ctx, SETUP, options({ makeWorker: () => w }));
    room = 10;
    w.emit({ type: 'ready' });
    w.answer(0);
    expect(w.requests()).toHaveLength(2); // the second on its way
    const stale = w.prepare(1); // the thread answers it before the new init
    stream.restart(filterBoard(null));
    expect(stream.revision).toBe(2);
    expect(w.posted.at(-1)).toEqual({ type: 'init', setup: { ...SETUP, net: filterBoard(null) } });
    w.emit(stale); // the reply to the request before the restart: not taken
    expect(got).toHaveLength(1);
    expect(w.requests()).toHaveLength(2); // nothing leaves before the model is ready again
    w.emit({ type: 'ready' });
    expect(w.requests()).toHaveLength(3);
    expect(w.requests()[2]!.request).toMatchObject({ first: BLOCK, net: null, revision: 2 });
    w.answer(2);
    const fresh = createHandler(() => 0);
    fresh.handle({ type: 'init', setup: { ...SETUP, net: filterBoard(null) } });
    const want = fresh.handle({ type: 'block', request: { seq: 1, first: BLOCK, net: null, revision: 2 } })!;
    expect(want.reply.type === 'block' && want.reply.reply.samples).toEqual(got[1]!.samples);
    expect(got[1]!.first).toBe(BLOCK);
    // on the main thread: the next block from the operating point of the board given
    const sync = createStream(ctx, SETUP, options({ mode: 'sync' }));
    stream.dispose();
    got = [];
    sync.pump();
    sync.restart(filterBoard(null));
    sync.pump();
    expect(got).toHaveLength(2);
    expect(got[1]!.samples).toEqual(want.reply.type === 'block' && want.reply.reply.samples);
    expect(got[1]!.first).toBe(BLOCK);
  });

  it('a failing thread → the main thread, with the board of that moment', () => {
    const w = new FakeWorker();
    stream = createStream(ctx, SETUP, options({ makeWorker: () => w }));
    room = 10;
    w.emit({ type: 'ready' });
    w.answer(0);
    stream.board(filterBoard(null));
    w.onerror?.(new Error('x'));
    w.emit({ type: 'error', message: 'y' });
    expect(stream.mode).toBe('sync');
    expect(w.terminated).toBe(1);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith('[electronics/sound] worker failed, switching to the main thread: x');
    w.answer(1); // the request on its way when it fell is not taken
    expect(got).toHaveLength(1);
    stream.pump();
    expect(got).toHaveLength(2);
    expect(got[1]!.first).toBe(BLOCK); // the samples are numbered on
    // the main thread starts the model with the board of that moment, from its operating point
    const fresh = createHandler(() => 0);
    fresh.handle({ type: 'init', setup: { ...SETUP, net: filterBoard(null) } });
    const want = fresh.handle({ type: 'block', request: { seq: 1, first: 0, net: null, revision: 2 } })!;
    expect(want.reply.type === 'block' && want.reply.reply.samples[0]).toEqual(got[1]!.samples[0]);
    expect(got[1]!.revision).toBe(2);
  });

  it('a thread whose constructor throws → the main thread', () => {
    stream = createStream(
      ctx,
      SETUP,
      options({
        makeWorker: () => {
          throw new Error('x');
        },
      }),
    );
    expect(stream.mode).toBe('sync');
    expect(err).toHaveBeenCalledWith('[electronics/sound] worker failed, switching to the main thread: x');
    room = 1;
    stream.pump();
    expect(got).toHaveLength(1);
  });

  it('without Worker in the environment — the main thread, nothing in the console', () => {
    expect(typeof Worker).toBe('undefined');
    expect(createStream(ctx, SETUP, options()).mode).toBe('sync');
    expect(err).not.toHaveBeenCalled();
  });

  it('the main thread: one block a pump while the output wants one; the same blocks as the thread', () => {
    let made = 0;
    stream = createStream(
      ctx,
      SETUP,
      options({ mode: 'sync', makeWorker: () => (made++, new FakeWorker()) }),
    );
    expect(stream.mode).toBe('sync');
    expect(made).toBe(0);
    stream.pump();
    expect(got).toHaveLength(0); // no room
    room = 2;
    stream.pump();
    expect(got).toHaveLength(1);
    stream.pump();
    stream.pump();
    expect(got).toHaveLength(2);
    expect(stream.ms).toBeGreaterThanOrEqual(0);
    const w = new FakeWorker();
    const threaded: BlockReply[] = [];
    createStream(ctx, SETUP, {
      wants: () => threaded.length < 2,
      onBlock: (b) => threaded.push(b),
      makeWorker: () => w,
    });
    w.emit({ type: 'ready' });
    w.answer(0);
    w.answer(1);
    expect(threaded.map((b) => b.samples)).toEqual(got.map((b) => b.samples));
  });

  it('an error of the model on the main thread: one line in the console, no block, the next board tries again', () => {
    const broken = { nodes: 2, parts: [{ id: 'X', spec: 'nothing', pins: [1, 0] }] };
    stream = createStream(ctx, { ...SETUP, net: broken }, options({ mode: 'sync' }));
    room = 5;
    for (let i = 0; i < 4; i++) stream.pump();
    expect(got).toHaveLength(0);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith('[electronics/sound] model failed: X: no part nothing in the catalog');
    stream.board(filterBoard(1000));
    stream.pump();
    expect(got).toHaveLength(1);
  });

  it('dispose stops the thread; a late reply changes nothing', () => {
    const w = new FakeWorker();
    stream = createStream(ctx, SETUP, options({ makeWorker: () => w }));
    room = 3;
    w.emit({ type: 'ready' });
    stream.dispose();
    stream.dispose();
    expect(w.terminated).toBe(1);
    expect(disposers).toHaveLength(1); // createStream put its own dispose into ctx.onDispose
    disposers[0]!();
    expect(w.terminated).toBe(1);
    const n = w.posted.length;
    stream.pump();
    expect(w.posted.length).toBe(n);
    w.answer(0);
    expect(got).toHaveLength(0);
  });
});
