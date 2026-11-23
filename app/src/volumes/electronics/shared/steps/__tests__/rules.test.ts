/**
 * The steps' rules over a stub bench (no WebGL): the hand's policy by kind and the probes by name (`policy.ts`), the
 * phone's dock buttons for the tray, the switch and the player (`dock.ts`) and the multimeter's switch and number in
 * the panel (`meter.ts`).
 */
import { describe, expect, it } from 'vitest';
import { PARTS } from '@electronics/sim/core';
import type { Bench, HandPolicy } from '../../bench';
import type { MeterMode } from '../../instruments';
import { handPolicy, kindOf } from '../policy';
import { PLAYER_ID, SWITCH_ID, playerToggle, switchToggle, trayButtonId, trayButtons } from '../dock';
import { MODE_ID, READOUT_ID, meterReadout, meterSwitch } from '../meter';
import { conditionText } from '../state';

/** A bench with only what the rules read: the board's parts, the hand's policy, the switch and the multimeter. */
function stubBench(parts: Record<string, string> = {}) {
  const offered: string[] = [];
  const bench = {
    state: { parts: new Map(Object.entries(parts).map(([id, spec]) => [id, { id, spec }])) },
    hands: {
      policy: null as HandPolicy | null,
      offer: (spec: string) => void offered.push(spec),
    },
    flying: false,
    closed: 0,
    multimeter: {
      mode: 'off' as MeterMode,
      readout: (id: string, label: string) => ({ type: 'readout', id, label }),
    },
  };
  return { bench, as: bench as unknown as Bench, offered };
}

describe('the hand’s rules by kind', () => {
  it('names the kinds the steps tell apart', () => {
    expect(kindOf('resistor-4k7')).toBe('resistor');
    expect(kindOf('led-red')).toBe('led');
    expect(kindOf('jumper')).toBe('jumper');
    expect(kindOf('diode-1n4007')).toBe('other');
    expect(kindOf('transistor-bc547b')).toBe('other');
    expect(kindOf('')).toBe('other');
    // the capacitors by their dielectric (the catalog's): a ceramic disc and a film box, and the electrolytic can apart
    expect(kindOf('ceramic-100n')).toBe('capacitor');
    expect(kindOf('ceramic-100p')).toBe('capacitor');
    expect(kindOf('film-100n')).toBe('capacitor');
    expect(kindOf('film-1u')).toBe('capacitor');
    expect(kindOf('pot-10k')).toBe('pot');
    for (const [key, spec] of Object.entries(PARTS)) {
      if (spec.kind !== 'capacitor') continue;
      expect(kindOf(key), key).toBe(spec.dielectric === 'electrolytic' ? 'electrolytic' : 'capacitor');
    }
    expect(kindOf('electrolytic-100u-6v3')).toBe('electrolytic');
    expect(kindOf('electrolytic-470u-16v')).toBe('electrolytic');
  });

  it('takes a plug lead the step names, and names it by its own name', () => {
    const { as } = stubBench();
    const p = handPolicy(as, {
      lead: (name) => name === 'pl+',
      name: (w) => (w.lead ? `lead ${w.lead}` : ''),
    });
    expect(p.take('lead:pl+')).toBe(true);
    expect(p.take('lead:pl-')).toBe(false);
    expect(p.take('lead:spk+')).toBe(false);
    expect(p.tooltip?.('lead:pl+')).toBe('lead pl+');
    expect(p.tooltip?.('lead:pl-')).toBe('lead pl-');
    // without the rule no lead is taken
    expect(handPolicy(as, { name: () => '' }).take('lead:pl+')).toBe(false);
  });

  it('lets a carried part come down where the step’s `place` says — a part back into its own sockets — and passes on what arrived', () => {
    const { as } = stubBench({ C3: 'electrolytic-470u-16v', R5: 'resistor-470' });
    const home: Record<string, readonly string[]> = { C3: ['e2', 'f2'] };
    const arrived: string[] = [];
    const p = handPolicy(as, {
      part: () => true,
      // a part that stood on the board goes back only into its own sockets; any other anywhere it finds free ones
      place: (_spec, id, legs) => home[id] === undefined || home[id].every((s, k) => s === legs[k]),
      done: (k, where) => void arrived.push(`${k} ${where}`),
      name: (w) => w.id ?? '',
    });
    expect(p.place?.('part:C3', ['e2', 'f2'])).toBe(true);
    expect(p.place?.('part:C3', ['e3', 'f3'])).toBe(false);
    expect(p.place?.('part:C3', ['f2', 'e2'])).toBe(false);
    expect(p.place?.('part:R5', ['a3', 'a7'])).toBe(true);
    // the spec and the id of the part
    const seen: string[] = [];
    handPolicy(as, { place: (spec, id) => (seen.push(`${spec} ${id}`), true), name: () => '' }).place?.('part:C3', []);
    expect(seen).toEqual(['electrolytic-470u-16v C3']);
    // no rule: anywhere; a leg or a tray slot is never asked here (the hand asks for a carried part only)
    expect(handPolicy(as, { name: () => '' }).place?.('part:C3', ['a1', 'a2'])).toBe(true);
    p.done?.('part:C3', 'tray');
    p.done?.('probe:red', 'board');
    expect(arrived).toEqual(['part:C3 tray', 'probe:red board']);
    // the names under the pointer get the part's id too
    expect(p.tooltip?.('part:C3')).toBe('C3');
    expect(p.tooltip?.('leg:R5:0')).toBe('R5');
  });

  it('takes what the rules allow by key — a part, its leg, a tray slot, the probes, the switch — and no lead without its rule', () => {
    const { as } = stubBench({ R1: 'resistor-330', LED1: 'led-red', J1: 'jumper' });
    const p = handPolicy(as, {
      part: (spec) => kindOf(spec) === 'resistor',
      leg: (spec, id) => kindOf(spec) === 'jumper' && id === 'J1',
      tray: ['resistor-330'],
      probes: true,
      flip: (spec) => kindOf(spec) === 'led',
      name: (w) => (w.switch ? 'switch' : w.probe ? `probe ${w.probe}` : (w.spec ?? '')),
    });
    expect(p.take('part:R1')).toBe(true);
    expect(p.take('part:LED1')).toBe(false);
    expect(p.take('leg:J1:0')).toBe(true);
    expect(p.take('leg:R1:0')).toBe(false);
    expect(p.take('tray:resistor-330')).toBe(true);
    expect(p.take('tray:resistor-1k')).toBe(false);
    expect(p.take('probe:red')).toBe(true);
    expect(p.take('switch')).toBe(false);
    expect(p.take('lead:spk+')).toBe(false);
    expect(p.flip?.('part:LED1')).toBe(true);
    expect(p.flip?.('part:R1')).toBe(false);
    expect(p.flip?.('leg:LED1:0')).toBe(false);
    expect(p.tooltip?.('part:LED1')).toBe('led-red');
    expect(p.tooltip?.('leg:J1:1')).toBe('jumper');
    expect(p.tooltip?.('tray:resistor-330')).toBe('resistor-330');
    expect(p.tooltip?.('probe:black')).toBe('probe black');
    expect(p.tooltip?.('switch')).toBe('switch');
    expect(p.tooltip?.('lead:spk+')).toBe('');
  });

  it('takes the probes a step names, the oscilloscope’s too, and names each by its own name; `true` is the meter’s two', () => {
    const { as } = stubBench();
    const name = (w: { probe?: string }): string => (w.probe ? `probe ${w.probe}` : '');
    const scope = handPolicy(as, { probes: ['ch1'], name });
    expect(scope.take('probe:ch1')).toBe(true);
    for (const k of ['probe:ch2', 'probe:red', 'probe:black', 'probe:other'] as const) expect(scope.take(k)).toBe(false);
    expect(scope.tooltip?.('probe:ch1')).toBe('probe ch1');
    expect(scope.tooltip?.('probe:ch2')).toBe('probe ch2');
    expect(scope.tooltip?.('probe:other')).toBe('');
    const both = handPolicy(as, { probes: ['ch1', 'ch2', 'red'], name });
    expect((['probe:ch1', 'probe:ch2', 'probe:red', 'probe:black'] as const).map((k) => both.take(k))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    const meter = handPolicy(as, { probes: true, name });
    expect((['probe:red', 'probe:black', 'probe:ch1', 'probe:ch2'] as const).map((k) => meter.take(k))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(handPolicy(as, { probes: false, name }).take('probe:red')).toBe(false);
  });

  it('takes nothing the rules leave out', () => {
    const { as } = stubBench({ R1: 'resistor-330' });
    const p = handPolicy(as, { name: () => '' });
    for (const k of ['part:R1', 'leg:R1:0', 'tray:resistor-330', 'probe:red', 'switch'] as const)
      expect(p.take(k)).toBe(false);
  });
});

describe('the phone’s dock', () => {
  it('puts a tray slot’s part over the board while the hand may take it; on a phone only', () => {
    const { bench, as, offered } = stubBench();
    let phone = false;
    const [b] = trayButtons(
      as,
      ['resistor-330'],
      (spec) => `+ ${spec}`,
      () => phone,
    );
    expect(b!.id).toBe(trayButtonId('resistor-330'));
    expect(b!.label).toBe('+ resistor-330');
    const visible = b!.visible as () => boolean;
    const disabled = b!.disabled as () => boolean;
    expect(visible()).toBe(false);
    phone = true;
    expect(visible()).toBe(true);
    expect(disabled()).toBe(true);
    bench.hands.policy = { take: (k) => k === 'tray:resistor-330' };
    expect(disabled()).toBe(false);
    bench.flying = true;
    expect(disabled()).toBe(true);
    b!.onClick?.();
    expect(offered).toEqual(['resistor-330']);
  });

  it('closes and opens the battery’s switch while the hand may take it', () => {
    const { bench, as } = stubBench();
    const t = switchToggle(as, 'switch', () => true);
    expect(t.id).toBe(SWITCH_ID);
    expect((t.disabled as () => boolean)()).toBe(true);
    bench.hands.policy = { take: (k) => k === 'switch' };
    expect((t.disabled as () => boolean)()).toBe(false);
    t.onChange?.(true);
    expect(bench.closed).toBe(1);
    t.onChange?.(false);
    expect(bench.closed).toBe(0);
    // on the step's shot only: shown on a phone, off while the camera flies
    expect((t.visible as () => boolean)()).toBe(true);
    expect((switchToggle(as, 'switch', () => false).visible as () => boolean)()).toBe(false);
    bench.flying = true;
    expect((t.disabled as () => boolean)()).toBe(true);
  });

  it('with `inside`, is shown on every device and works while the camera is down in the part (the floor `inside`)', () => {
    const { bench, as } = stubBench();
    const t = switchToggle(as, 'switch', () => false, { inside: true });
    expect(t.id).toBe(SWITCH_ID);
    expect((t.visible as () => boolean)()).toBe(true);
    bench.hands.policy = { take: (k) => k === 'switch' };
    bench.flying = true;
    expect((t.disabled as () => boolean)()).toBe(false);
    t.onChange?.(true);
    expect(bench.closed).toBe(1);
    // still the step's: not while the hand may not take the switch
    bench.hands.policy = { take: () => false };
    expect((t.disabled as () => boolean)()).toBe(true);
  });
});

describe('the player in the dock', () => {
  it('is a toggle on a phone only that plays or stops it', () => {
    let phone = false;
    const played: boolean[] = [];
    const t = playerToggle(
      'player',
      () => phone,
      (on) => void played.push(on),
    );
    expect(t.id).toBe(PLAYER_ID);
    expect(t.label).toBe('player');
    expect(t.value).toBe(false);
    expect((t.visible as () => boolean)()).toBe(false);
    phone = true;
    expect((t.visible as () => boolean)()).toBe(true);
    t.onChange?.(true);
    t.onChange?.(false);
    expect(played).toEqual([true, false]);
  });
});

describe('a part’s state in words', () => {
  it('gives the step’s word for the model’s condition, «—» for none — and a capacitor’s «warm» the word for «ok»', () => {
    const words = { ok: 'within', warm: 'warm', hot: 'hot', bulged: 'bulged' };
    expect(conditionText('resistor-330', 'ok', words)).toBe('within');
    expect(conditionText('resistor-330', 'warm', words)).toBe('warm');
    expect(conditionText('resistor-330', 'burnt', words)).toBe('—');
    expect(conditionText('resistor-330', null, words)).toBe('—');
    expect(conditionText('resistor-330', undefined, words)).toBe('—');
    // a capacitor's «warm» is its voltage alone (plan decision 2 of batch E4): never a word of warmth
    for (const can of ['electrolytic-100u-16v', 'electrolytic-100u-6v3', 'ceramic-100n', 'film-1u']) {
      expect(conditionText(can, 'warm', words), can).toBe('within');
      expect(conditionText(can, 'hot', words), can).toBe('hot');
      expect(conditionText(can, 'bulged', words), can).toBe('bulged');
    }
    // a step with no word for «ok» shows nothing for a warm can either
    expect(conditionText('electrolytic-470u-16v', 'warm', { hot: 'hot' })).toBe('—');
  });
});

describe('the multimeter in the panel', () => {
  it('offers the step’s positions of the dial, «off» in the step’s word, the others by the instrument’s symbols', () => {
    const { bench, as } = stubBench();
    const s = meterSwitch(as, 'meter', ['off', 'V', 'A', 'ohm'], 'off-word', 'off');
    expect(s.id).toBe(MODE_ID);
    expect(s.items.map((i) => i.label)).toEqual(['off-word', 'V', 'A', 'Ω']);
    expect(s.value).toBe('off');
    s.onChange?.('V');
    expect(bench.multimeter.mode).toBe('V');
    expect((s.disabled as () => boolean)()).toBe(false);
    bench.flying = true;
    expect((s.disabled as () => boolean)()).toBe(true);
    expect(meterReadout(as, 'reading')).toMatchObject({ id: READOUT_ID, label: 'reading' });
  });
});
