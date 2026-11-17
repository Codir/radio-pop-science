import { describe, expect, it } from 'vitest';
import {
  homeState,
  occupancy,
  switchControls,
  verdict,
  type CircuitState,
  type ClampId,
  type WireKey,
} from '../parts/circuit';

/** A state from the wires' clamps (null = loose); everything in contact and whole unless changed after. */
function wired(map: Record<WireKey, [ClampId | null, ClampId | null]>, closed = true): CircuitState {
  const end = (clamp: ClampId | null) => ({ clamp, contact: true });
  return {
    switchClosed: closed,
    wires: {
      a: { ends: [end(map.a[0]), end(map.a[1])], whole: true },
      b: { ends: [end(map.b[0]), end(map.b[1])], whole: true },
      c: { ends: [end(map.c[0]), end(map.c[1])], whole: true },
    },
  };
}

describe('circuit verdict', () => {
  it('the stand as built lights, and the switch puts it out', () => {
    expect(verdict(homeState(true))).toBe('lit');
    expect(verdict(homeState(false))).toBe('open');
    expect(switchControls(homeState())).toBe(true);
  });

  it('all wires loose: dark', () => {
    expect(verdict(wired({ a: [null, null], b: [null, null], c: [null, null] }))).toBe('open');
  });

  it('the switch after the lamp works too, and the lamp has no polarity', () => {
    const s = wired({ a: ['plus', 'lampB'], b: ['lampA', 'swIn'], c: ['swOut', 'minus'] });
    expect(verdict(s)).toBe('lit');
    expect(switchControls(s)).toBe(true);
    const flipped = wired({ a: ['plus', 'lampA'], b: ['lampB', 'swOut'], c: ['swIn', 'minus'] });
    expect(switchControls(flipped)).toBe(true);
  });

  it('the lamp straight on the poles lights, but the switch does not control it', () => {
    const s = wired({ a: ['plus', 'lampA'], b: ['lampB', 'minus'], c: [null, null] });
    expect(verdict(s)).toBe('lit');
    expect(switchControls(s)).toBe(false);
  });

  it('a wire from pole to pole is a short; the lamp beside it stays dark', () => {
    expect(verdict(wired({ a: ['plus', 'minus'], b: [null, null], c: [null, null] }))).toBe('short');
    const s = wired({ a: ['plus', 'lampA'], b: ['lampB', 'minus'], c: ['plus', 'minus'] });
    expect(verdict(s)).toBe('short');
  });

  it('the switch across the poles: dark while open, a short when closed', () => {
    const s = wired({ a: ['plus', 'swIn'], b: ['swOut', 'minus'], c: [null, null] });
    expect(verdict({ ...s, switchClosed: false })).toBe('open');
    expect(verdict({ ...s, switchClosed: true })).toBe('short');
    expect(switchControls(s)).toBe(false);
  });

  it('`short`: the lamp wire moved onto the minus — poles joined through the switch', () => {
    const s = wired({ a: ['plus', 'swIn'], b: ['swOut', 'minus'], c: ['minus', 'lampA'] });
    expect(verdict(s)).toBe('short');
    expect(occupancy(s).minus).toBe(2);
  });

  it('`find-fault` 1: the plus end in the minus clamp beside the minus end — dark, no short', () => {
    const s = wired({ a: ['minus', 'swIn'], b: ['swOut', 'lampB'], c: ['minus', 'lampA'] });
    expect(verdict(s)).toBe('open');
  });

  it('`find-fault` 2: the sheath clamped instead of the copper breaks the loop', () => {
    const s = homeState();
    const broken: CircuitState = {
      ...s,
      wires: {
        ...s.wires,
        b: { ...s.wires.b, ends: [s.wires.b.ends[0], { clamp: 'lampB', contact: false }] },
      },
    };
    expect(verdict(broken)).toBe('open');
  });

  it('`find-fault` 3: copper broken under the sheath breaks the loop', () => {
    const s = homeState();
    expect(verdict({ ...s, wires: { ...s.wires, c: { ...s.wires.c, whole: false } } })).toBe('open');
  });

  it('a wire with both ends in one part only bridges that part', () => {
    const s = wired({ a: ['swIn', 'swOut'], b: ['plus', 'lampA'], c: ['lampB', 'minus'] }, false);
    expect(verdict(s)).toBe('lit');
    expect(switchControls(s)).toBe(false);
  });
});
