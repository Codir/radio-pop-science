import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { createFmLink, DEFAULT_STATE, type FmLinkState } from '@radio/sim/core';
import { createLink, type Link, LINK_SYNC_EVERY, type WorkerLike } from '..';
import { createHandler } from '../handler';
import type { FromWorker, ToWorker } from '../protocol';

const LUMA = Uint8Array.from({ length: 12288 }, (_, i) => (i * 7) % 256);

type FrameMsg = Extract<ToWorker, { type: 'frame' }>;

/** A worker that keeps what it was sent; `answer(i)` runs the i-th request through a real handler. */
class FakeWorker implements WorkerLike {
  posted: { msg: ToWorker; transfer: Transferable[] | undefined }[] = [];
  terminated = 0;
  onmessage: ((e: { data: FromWorker }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  private readonly handler = createHandler(() => 0);

  postMessage(msg: ToWorker, transfer?: Transferable[]): void {
    this.posted.push({ msg, transfer });
    if (msg.type === 'init') this.handler.handle(msg);
  }

  terminate(): void {
    this.terminated++;
  }

  frames(): { msg: FrameMsg; transfer: Transferable[] | undefined }[] {
    return this.posted.filter(
      (p): p is { msg: FrameMsg; transfer: Transferable[] | undefined } => p.msg.type === 'frame',
    );
  }

  emit(data: FromWorker): void {
    this.onmessage?.({ data });
  }

  answer(i: number): void {
    const out = this.handler.handle(this.frames()[i]!.msg);
    this.emit(out!.reply);
  }
}

const clock = { time: 0 };
let disposers: (() => void)[] = [];
const ctx = { clock, onDispose: (fn: () => void) => disposers.push(fn) } as unknown as ChapterContext;
let k = 0;
let link: Link;
let err: MockInstance<typeof console.error>;

const tick = (): void => {
  clock.time = ++k / 60;
};
const at = (route: number): FmLinkState => {
  const s = structuredClone(DEFAULT_STATE);
  s.air.route = route;
  return s;
};
const luma = (): Uint8Array => LUMA;
const pumpAt = (r: number): boolean => (tick(), link.pump(at(r), luma, null));

beforeEach(() => {
  clock.time = 0;
  k = 0;
  disposers = [];
  err = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  err.mockRestore();
});

describe('link', () => {
  it('один запит у дорозі; після перерви — один кадр і один запит', () => {
    const w = new FakeWorker();
    let taken = 0;
    const counted = (): Uint8Array => (taken++, LUMA);
    link = createLink(ctx, { seed: 7, makeWorker: () => w });
    const pumpCounted = (r: number): boolean => (tick(), link.pump(at(r), counted, null));
    expect(link.mode).toBe('worker');
    expect(w.posted[0]!.msg).toEqual({ type: 'init', seed: 7 });
    expect(pumpCounted(0)).toBe(false);
    expect(w.frames()).toHaveLength(0); // not 'ready' yet
    w.emit({ type: 'ready' });
    for (let i = 0; i < 10; i++) pumpCounted(i % 5);
    expect(w.frames()).toHaveLength(1);
    expect(taken).toBe(1);
    expect(w.frames()[0]!.msg.request.state.air.route).toBe(0);
    w.answer(0);
    expect(pumpCounted(4)).toBe(true); // a frame came, and a request went with the FRESHEST state
    expect(w.frames()).toHaveLength(2);
    expect(w.frames()[1]!.msg.request.state.air.route).toBe(4);
    expect(link.frames).toBe(1);
    w.emit({ type: 'frame', reply: { ...link.frame!, seq: 1 } }); // a reply with an old seq is not taken
    expect(link.frames).toBe(1);
    w.answer(1); // the tab was hidden: the reply came, no pump, the engine's time stood
    expect(link.pump(at(2), counted, null)).toBe(true);
    expect(link.pump(at(2), counted, null)).toBe(false);
    for (let i = 0; i < 5; i++) pumpCounted(2);
    expect(w.frames()).toHaveLength(3);
    expect(link.frames).toBe(2);
    expect(taken).toBe(3);
  });

  it('кадр камери копіюється й передається', () => {
    const w = new FakeWorker();
    link = createLink(ctx, { seed: 7, makeWorker: () => w });
    w.emit({ type: 'ready' });
    pumpAt(1);
    const sent = w.frames()[0]!;
    expect(sent.msg.request.luma).not.toBe(LUMA);
    expect(sent.msg.request.luma).toEqual(LUMA);
    expect(sent.transfer).toEqual([sent.msg.request.luma.buffer]);
  });

  it('не частіше за 25 запитів на секунду часу рушія', () => {
    const w = new FakeWorker();
    link = createLink(ctx, { seed: 7, makeWorker: () => w });
    w.emit({ type: 'ready' });
    for (let i = 0; i < 60; i++) {
      const before = w.frames().length;
      pumpAt(1);
      if (w.frames().length > before) w.answer(before);
    }
    expect(w.frames()).toHaveLength(20);
    expect(link.frames).toBe(20);
  });

  it('падіння потоку → синхронний шлях', () => {
    const w = new FakeWorker();
    link = createLink(ctx, { seed: 7, makeWorker: () => w });
    w.emit({ type: 'ready' });
    pumpAt(1);
    expect(w.frames()).toHaveLength(1);
    w.onerror?.(new Error('x'));
    w.emit({ type: 'error', message: 'y' });
    expect(link.mode).toBe('sync');
    expect(w.terminated).toBe(1);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith('[radio/link] worker failed, switching to the main thread: x');
    w.answer(0); // the request in flight when it fell is not taken
    expect(link.frames).toBe(0);
    for (let i = 0; i < 6; i++) pumpAt(1);
    expect(link.frames).toBe(1);
    expect(link.frame!.screen).toEqual(createFmLink(7).step(at(1), LUMA).screen);
    expect(w.frames()).toHaveLength(1);
  });

  it('конструктор потоку кидає → синхронний шлях', () => {
    link = createLink(ctx, {
      seed: 7,
      makeWorker: () => {
        throw new Error('x');
      },
    });
    expect(link.mode).toBe('sync');
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith('[radio/link] worker failed, switching to the main thread: x');
    for (let i = 0; i < 6; i++) pumpAt(1);
    expect(link.frames).toBe(1);
  });

  it('помилка моделі: одна помилка в консолі, останній добрий кадр лишається', () => {
    link = createLink(ctx, { seed: 7, mode: 'sync' });
    for (let i = 0; i < 6; i++) pumpAt(1);
    const good = link.frame;
    expect(good).not.toBeNull();
    // step throws (the contract: no fallback values), the handler gives 'error'
    const bad = { ...at(1), monitor: null } as unknown as FmLinkState;
    for (let i = 0; i < 18; i++) expect((tick(), link.pump(bad, luma, null))).toBe(false);
    expect(link.frame).toBe(good);
    expect(link.frames).toBe(1);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith('[radio/link] model failed: fm-link: monitor is null');
    for (let i = 0; i < 6; i++) pumpAt(1);
    expect(link.frames).toBe(2);
  });

  it('без Worker у середовищі — sync, без запису в консоль', () => {
    expect(typeof Worker).toBe('undefined');
    expect(createLink(ctx, { seed: 7 }).mode).toBe('sync');
    expect(err).not.toHaveBeenCalled();
  });

  it('sync: один кадр моделі на шість оновлень', () => {
    let taken = 0;
    let made = 0;
    const counted = (): Uint8Array => (taken++, LUMA);
    link = createLink(ctx, { seed: 7, mode: 'sync', makeWorker: () => (made++, new FakeWorker()) });
    expect(link.mode).toBe('sync');
    expect(made).toBe(0);
    const fresh: number[] = [];
    for (let i = 1; i <= 12; i++) if ((tick(), link.pump(at(1), counted, null))) fresh.push(i);
    expect(fresh).toEqual([6, 12]);
    expect(link.frames).toBe(2);
    expect(taken).toBe(2);
  });

  it('still дорівнює still моделі й не чіпає живу лінію', () => {
    link = createLink(ctx, { seed: 7, mode: 'sync' });
    const ref = createFmLink(7);
    for (let i = 0; i < 6; i++) pumpAt(1);
    const a = link.frame!;
    expect(a.screen).toEqual(ref.step(at(1), LUMA).screen);
    const still = link.still(at(3), LUMA, null);
    expect(still.seq).toBe(-1);
    expect(still.ms).toBeGreaterThanOrEqual(0);
    expect(still.screen).toEqual(createFmLink(7).still(at(3), LUMA).screen);
    expect(link.frame).toBe(a);
    expect(link.frames).toBe(1);
    for (let i = 0; i < 6; i++) pumpAt(1);
    const b = link.frame!;
    expect(link.frames).toBe(2);
    expect(b.screen).toEqual(ref.step(at(1), LUMA).screen); // the second frame, as if no still came between
    const bad = { ...at(1), monitor: null } as unknown as FmLinkState;
    expect(() => link.still(bad, LUMA, null)).toThrow('[radio/link] still failed: fm-link: monitor is null');
  });

  it('fps — кадри моделі за секунду часу рушія; нульовий проміжок не ділить на нуль', () => {
    const w = new FakeWorker();
    link = createLink(ctx, { seed: 7, makeWorker: () => w });
    w.emit({ type: 'ready' });
    clock.time = 0;
    link.pump(at(1), luma, null); // request 0 at 0 s
    clock.time = 0.05;
    w.answer(0); // the first frame only marks its time
    expect(link.fps).toBe(0);
    link.pump(at(1), luma, null); // request 1
    w.answer(1); // the clock stands: skipped
    expect(link.fps).toBe(0);
    clock.time = 0.15;
    link.pump(at(1), luma, null); // request 2
    w.answer(2);
    expect(link.frames).toBe(3);
    expect(link.fps).toBeCloseTo(2, 9); // the second frame skipped, the third: 0 + 0.2 · (10 − 0)

    const w2 = new FakeWorker();
    link = createLink(ctx, { seed: 7, makeWorker: () => w2 });
    w2.emit({ type: 'ready' });
    for (let i = 0; i < 30; i++) {
      clock.time = 1 + i * 0.1;
      link.pump(at(1), luma, null);
      w2.answer(i);
    }
    expect(link.frames).toBe(30);
    expect(link.fps).toBeGreaterThan(9.5);
    expect(link.fps).toBeLessThan(10.5);
  });

  it('dispose зупиняє потік', () => {
    const w = new FakeWorker();
    link = createLink(ctx, { seed: 7, makeWorker: () => w });
    w.emit({ type: 'ready' });
    pumpAt(0);
    link.dispose();
    link.dispose();
    expect(w.terminated).toBe(1);
    expect(disposers).toHaveLength(1); // createLink put its own dispose into ctx.onDispose
    disposers[0]!();
    expect(w.terminated).toBe(1);
    const n = w.posted.length;
    let taken = 0;
    const counted = (): Uint8Array => (taken++, LUMA);
    // long enough for a request: none goes, and the eye is not read
    for (let i = 0; i < LINK_SYNC_EVERY; i++) expect((tick(), link.pump(at(0), counted, null))).toBe(false);
    expect(w.posted.length).toBe(n);
    expect(taken).toBe(0);
    w.answer(0);
    expect(link.frames).toBe(0); // a late reply changes nothing
  });
});
