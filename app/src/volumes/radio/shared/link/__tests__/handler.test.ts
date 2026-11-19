import { describe, expect, it } from 'vitest';
import { createFmLink, DEFAULT_STATE, type ProbeRequest } from '@radio/sim/core';
import { createHandler } from '../handler';
import type { LinkReply, ToWorker } from '../protocol';

const LUMA = Uint8Array.from({ length: 12288 }, (_, i) => (i * 7) % 256);

function frame(kind: 'step' | 'still', seq: number, probe: ProbeRequest | null = null): ToWorker {
  return {
    type: 'frame',
    request: { seq, kind, state: structuredClone(DEFAULT_STATE), luma: LUMA.slice(), probe },
  };
}

function ready(seed: number) {
  const h = createHandler(() => 0);
  h.handle({ type: 'init', seed });
  return h;
}

type Out = ReturnType<ReturnType<typeof createHandler>['handle']>;

function replyOf(out: Out): LinkReply {
  if (out === null || out.reply.type !== 'frame')
    throw new Error(`not a frame: ${JSON.stringify(out?.reply)}`);
  return out.reply.reply;
}

describe('link handler', () => {
  it('init → ready', () =>
    expect(createHandler(() => 0).handle({ type: 'init', seed: 7 })).toEqual({
      reply: { type: 'ready' },
      transfer: [],
    }));

  it('frame → той самий кадр, що дає createFmLink(seed).step', () => {
    const h = ready(7);
    const ref = createFmLink(7);
    for (let seq = 1; seq <= 3; seq++) {
      const r = replyOf(h.handle(frame('step', seq)));
      const want = ref.step(DEFAULT_STATE, LUMA);
      expect(r.seq).toBe(seq);
      expect(r.screen).toEqual(want.screen);
      expect(r.meters).toEqual(want.meters);
    }
  });

  it('still → той самий кадр, що дає createFmLink(seed).still', () => {
    const h = ready(7);
    replyOf(h.handle(frame('step', 1)));
    replyOf(h.handle(frame('step', 2)));
    const r = replyOf(h.handle(frame('still', 3)));
    expect(r.seq).toBe(3);
    expect(r.screen).toEqual(createFmLink(7).still(DEFAULT_STATE, LUMA).screen);
  });

  it('відповідь несе власні буфери, і вони в transfer', () => {
    const h = ready(7);
    const out = h.handle(frame('step', 1))!;
    const first = replyOf(out);
    const copy = first.screen.slice();
    expect(out.transfer).toContain(first.screen.buffer);
    const second = replyOf(h.handle(frame('step', 2)));
    expect(first.screen).toEqual(copy);
    expect(second.screen.buffer).not.toBe(first.screen.buffer);
    expect(second.meters).not.toBe(first.meters);

    // the probe's arrays too: each in a buffer of its own, all of them in transfer
    const strip: ProbeRequest = { tap: 'rx.detected', view: 'strip', start: 0, span: 0.25, columns: 64 };
    const withProbe = h.handle(frame('step', 3, strip))!;
    const p = replyOf(withProbe).probe!;
    const lo = p.lo.slice();
    const hi = p.hi.slice();
    expect(lo.length).toBe(64);
    const buffers = [p.lo, p.hi, p.bins, p.points].map((a) => a.buffer);
    expect(new Set(buffers).size).toBe(4);
    for (const b of buffers) expect(withProbe.transfer).toContain(b);
    h.handle(frame('step', 4, strip));
    expect(p.lo).toEqual(lo);
    expect(p.hi).toEqual(hi);
  });

  it('ms — різниця показів годинника', () => {
    const marks = [10, 35];
    const h = createHandler(() => marks.shift()!);
    h.handle({ type: 'init', seed: 7 });
    expect(replyOf(h.handle(frame('step', 1))).ms).toBe(25);
    expect(marks).toHaveLength(0);
  });

  it('frame до init → error', () =>
    expect(createHandler(() => 0).handle(frame('step', 1))).toEqual({
      reply: { type: 'error', message: 'link: frame before init' },
      transfer: [],
    }));
});
