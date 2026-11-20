import { describe, expect, it } from 'vitest';
import { type Probe, Transient } from '@electronics/sim/core';
import { BOARD_NODES, BOARD_PROBES, filterBoard } from '../board';
import { createHandler } from '../handler';
import type { BlockReply, StreamSetup, ToWorker } from '../protocol';

const RATE = 24000;
const BLOCK = 512;
const setup = (ohms: number | null = 1000): StreamSetup => ({
  net: filterBoard(ohms),
  rate: RATE,
  block: BLOCK,
  probes: BOARD_PROBES,
});
const block = (seq: number, net: StreamSetup['net'] | null = null): ToWorker => ({
  type: 'block',
  request: { seq, first: (seq - 1) * BLOCK, net, revision: net === null ? 1 : 2 },
});

function ready(s: StreamSetup = setup()) {
  const h = createHandler(() => 0);
  expect(h.handle({ type: 'init', setup: s })).toEqual({ reply: { type: 'ready' }, transfer: [] });
  return h;
}

type Out = ReturnType<ReturnType<typeof createHandler>['handle']>;

function replyOf(out: Out): BlockReply {
  if (out === null || out.reply.type !== 'block')
    throw new Error(`not a block: ${JSON.stringify(out?.reply)}`);
  return out.reply.reply;
}

/** The same board run straight by a transient: the blocks the handler must give. */
function reference(ohms: number | null) {
  const t = new Transient(filterBoard(ohms), { dt: 1 / RATE });
  t.start('dc');
  const sound = new Float32Array(BLOCK);
  const scope = new Float32Array(BLOCK);
  const probes: Probe[] = [
    { part: 'LS1', out: sound },
    { node: BOARD_NODES.speaker, out: scope },
  ];
  return {
    t,
    next: () => (t.run(BLOCK, probes), [sound.slice(), scope.slice()]),
  };
}

describe('the stream handler', () => {
  it('block → the samples a transient of the same board gives, block after block', () => {
    const h = ready();
    const ref = reference(1000);
    for (let seq = 1; seq <= 3; seq++) {
      const r = replyOf(h.handle(block(seq)));
      const [sound, scope] = ref.next();
      expect(r.seq).toBe(seq);
      expect(r.first).toBe((seq - 1) * BLOCK);
      expect(r.revision).toBe(1);
      expect(r.steps).toBe(BLOCK);
      expect(r.samples).toHaveLength(2);
      expect(r.samples[0]).toEqual(sound);
      expect(r.samples[1]).toEqual(scope);
    }
  });

  it('a request with a board goes on with it from the last moment (Transient.rebuild)', () => {
    const h = ready();
    const ref = reference(1000);
    replyOf(h.handle(block(1)));
    ref.next();
    const r = replyOf(h.handle(block(2, filterBoard(null))));
    ref.t.rebuild(filterBoard(null));
    const [sound] = ref.next();
    expect(r.revision).toBe(2);
    expect(r.samples[0]).toEqual(sound);
  });

  it('the reply carries arrays of its own, and they are in transfer', () => {
    const h = ready();
    const out = h.handle(block(1))!;
    const first = replyOf(out);
    const copy = first.samples[0]!.slice();
    expect(out.transfer).toHaveLength(2);
    for (const a of first.samples) expect(out.transfer).toContain(a.buffer);
    const second = replyOf(h.handle(block(2)));
    expect(first.samples[0]).toEqual(copy);
    expect(second.samples[0]!.buffer).not.toBe(first.samples[0]!.buffer);
  });

  it('ms — the difference of two readings of the clock', () => {
    const marks = [10, 35];
    const h = createHandler(() => marks.shift() ?? 0);
    h.handle({ type: 'init', setup: setup() });
    expect(replyOf(h.handle(block(1))).ms).toBe(25);
  });

  it('a block before init, a probe the board has not and a malformed board are errors, not exceptions', () => {
    expect(createHandler(() => 0).handle(block(1))).toEqual({
      reply: { type: 'error', message: 'stream: block before init' },
      transfer: [],
    });
    const h = createHandler(() => 0);
    const bad = h.handle({ type: 'init', setup: { ...setup(), probes: [{ part: 'R99' }] } });
    expect(bad?.reply).toEqual({ type: 'error', message: 'no part R99 on the board' });
    expect(h.handle(block(1))?.reply.type).toBe('error'); // a failed init leaves no model behind
    const good = ready();
    const out = good.handle(block(1, { nodes: 2, parts: [{ id: 'X', spec: 'nothing', pins: [1, 0] }] }));
    expect(out?.reply).toEqual({ type: 'error', message: 'X: no part nothing in the catalog' });
    expect(replyOf(good.handle(block(2))).steps).toBe(BLOCK); // the old board plays on
  });

  it('a board without an operating point is an error at init', () => {
    // the 9 V battery against the ideal 5 V source: no solution
    const net = {
      nodes: 2,
      parts: [
        { id: 'B1', spec: 'ideal-9v', pins: [1, 0] },
        { id: 'B2', spec: 'ideal-5v', pins: [1, 0] },
      ],
    };
    const out = createHandler(() => 0).handle({ type: 'init', setup: { ...setup(), net, probes: [] } });
    expect(out?.reply.type).toBe('error');
    expect((out?.reply as { message: string }).message).toMatch(/^stream: no operating point/);
  });
});
