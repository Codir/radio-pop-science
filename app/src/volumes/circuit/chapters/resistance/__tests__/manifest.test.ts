import { describe, expect, it } from 'vitest';
import raw from '@circuit/content/generated/resistance.json';
import { STEP_IDS } from '../chapter';
import { caption } from '../content';
import manifest from '../index';
import { amps } from '../stand';

const NBSP = String.fromCharCode(160);

describe('resistance manifest', () => {
  it('lists the steps of the generated content, in order — and the typed STEP_IDS match', () => {
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect([...STEP_IDS]).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.title).toBe(raw.title);
  });
});

describe('resistance captions', () => {
  // the scene addresses the script's «Підписи» by position: if the script reorders them, this fails first
  it.each([
    ['bumps', 0, 'позначений електрон'],
    ['bumps', 1, 'удар'],
    ['bumps', 2, 'опір'],
    ['heat', 0, 'термометр'],
    ['shape', 0, 'ручка'],
    ['shape', 1, 'рамка-лічильник'],
    ['balance', 0, 'лічильник ударів'],
    ['balance', 1, '0,3 A'],
  ] as const)('%s #%i is «%s»', (step, i, text) => {
    expect(caption(step, i).split(NBSP).join(' ')).toBe(text);
  });
});

describe('the frame in amperes', () => {
  it('prints two decimals with a decimal comma', () => {
    expect(amps(0.3).split(NBSP).join(' ')).toBe('0,30 A');
    expect(amps(0.0886).split(NBSP).join(' ')).toBe('0,09 A');
  });
});
