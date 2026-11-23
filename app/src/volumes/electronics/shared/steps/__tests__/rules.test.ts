/**
 * The steps' rules over a stub bench (no WebGL): the hand's policy by kind (`policy.ts`), the phone's dock buttons for
 * the tray and the switch (`dock.ts`) and the multimeter's switch and number in the panel (`meter.ts`).
 */
import { describe, expect, it } from 'vitest';
import type { Bench, HandPolicy } from '../../bench';
import type { MeterMode } from '../../instruments';
import { handPolicy, kindOf } from '../policy';
import { SWITCH_ID, switchToggle, trayButtonId, trayButtons } from '../dock';
import { MODE_ID, READOUT_ID, meterReadout, meterSwitch } from '../meter';

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
  });

  it('takes what the rules allow by key — a part, its leg, a tray slot, the probes, the switch — and never a lead', () => {
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
