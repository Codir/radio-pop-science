/**
 * The amplifier of the volume (`amplifier.ts`): the netlist the stand builds in the chapter `amplifier`, against
 * ngspice's samples of the very same netlist — its operating point, its gain at 1 kHz on a small signal, what comes
 * out against what goes in from a whisper to past clipping, where clipping sets in, the amplifier switched off and the
 * battery the wrong way round. The tolerances are the plan's.
 */
import { describe, expect, it } from 'vitest';
import volume from '../../../volume.json';
import {
  AMPLIFIER_NODES,
  AMPLIFIER_ROLES,
  amplifierNetlist,
  PARTS,
  solveDC,
  Transient,
  type Netlist,
  type PartReading,
} from '../index';

interface OpSample {
  netlist: Netlist;
  v: number[];
  parts: Record<string, PartReading>;
}

interface ToneSample {
  netlist: Netlist;
  start: 'dc';
  stop: number;
  times: number[];
  v: Record<string, number[]>;
  i: Record<string, number[]>;
  window: [number, number];
  mean: Record<string, number>;
  swing: Record<string, number>;
  hertz: number;
  amplitude: Record<string, number>;
}

const files = import.meta.glob('../__fixtures__/*.json', { eager: true, import: 'default' });
const sample = <T>(name: string): T => files[`../__fixtures__/${name}.json`] as T;
const tone = (percent: number): ToneSample => sample<ToneSample>(`amplifier-v${percent}`);

function close(have: number | undefined, want: number, tolerance: number, what = ''): void {
  expect(have, what).toBeTypeOf('number');
  expect(Math.abs(have! - want), `${what}: ${have} against ${want}`).toBeLessThanOrEqual(tolerance);
}

/** The volume control at these percent: a small signal (10), louder (50, 80), clipping sets in (90), past it (95, 100). */
const VOLUMES = [10, 50, 80, 90, 95, 100] as const;
const RATE = 48000;
const { supply, volume: wiper, output, speaker } = AMPLIFIER_NODES;
const PROBED = [supply, wiper, output, speaker] as const;

/** The amplitude of a sine of `hertz` in `samples`, sample k taken at (first + k)/RATE over a whole number of periods:
 * the least-squares fit of a·sin + b·cos + c. */
function amplitude(samples: Float32Array, hertz: number, first: number): number {
  let ss = 0;
  let sc = 0;
  let cc = 0;
  let s1 = 0;
  let c1 = 0;
  let xs = 0;
  let xc = 0;
  let x1 = 0;
  const n = samples.length;
  for (let k = 0; k < n; k++) {
    const phase = (2 * Math.PI * hertz * (first + k)) / RATE;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const x = samples[k]!;
    ss += s * s;
    sc += s * c;
    cc += c * c;
    s1 += s;
    c1 += c;
    xs += x * s;
    xc += x * c;
    x1 += x;
  }
  // the normal equations [ss sc s1; sc cc c1; s1 c1 n]·[a b m] = [xs xc x1], by Cramer's rule
  const det = (a: number[]): number =>
    a[0]! * (a[4]! * a[8]! - a[5]! * a[7]!) -
    a[1]! * (a[3]! * a[8]! - a[5]! * a[6]!) +
    a[2]! * (a[3]! * a[7]! - a[4]! * a[6]!);
  const whole = det([ss, sc, s1, sc, cc, c1, s1, c1, n]);
  const a = det([xs, sc, s1, xc, cc, c1, x1, c1, n]) / whole;
  const b = det([ss, xs, s1, sc, xc, c1, s1, x1, n]) / whole;
  return Math.hypot(a, b);
}

/** What the model's amplifier does with the sample's tone: from its operating point at the audio rate, every probed
 * node at every step; over the sample's window, the amplitude of the tone, the mean and the swing of each; and its
 * value at the sample's moments. */
function play(s: ToneSample): {
  amplitude: Record<number, number>;
  mean: Record<number, number>;
  swing: Record<number, number>;
  at: Record<number, number[]>;
  t: Transient;
} {
  const t = new Transient(structuredClone(s.netlist), { dt: 1 / RATE });
  expect(t.start(s.start)).toBe(true);
  const steps = Math.round(s.stop * RATE);
  const traces = PROBED.map(() => new Float32Array(steps));
  expect(
    t.run(
      steps,
      PROBED.map((node, k) => ({ node, out: traces[k]! })),
    ),
  ).toBe(steps);
  // sample k is the moment (k + 1)/RATE: the window (0.04, 0.06] is samples 1920 … 2879
  const first = Math.round(s.window[0] * RATE);
  const out = { amplitude: {}, mean: {}, swing: {}, at: {}, t } as ReturnType<typeof play>;
  PROBED.forEach((node, k) => {
    const window = traces[k]!.subarray(first);
    expect(window.length).toBe(Math.round((s.window[1] - s.window[0]) * RATE));
    out.amplitude[node] = amplitude(window, s.hertz, first + 1);
    out.mean[node] = window.reduce((sum, x) => sum + x, 0) / window.length;
    out.swing[node] = Math.max(...window) - Math.min(...window);
    out.at[node] = s.times.map((time) => traces[k]![Math.round(time * RATE) - 1]!);
  });
  return out;
}

const played = new Map<number, ReturnType<typeof play>>();
const playing = (percent: number): ReturnType<typeof play> => {
  if (!played.has(percent)) played.set(percent, play(tone(percent)));
  return played.get(percent)!;
};

/** Where clipping sets in: the input amplitude at which the gain has fallen to 90 % of its gain on a small signal
 * (about 0.9 dB), by straight lines between the measured points (input, gain). */
function onset(points: readonly (readonly [number, number])[]): number {
  const small = points[0]![1];
  for (let k = 1; k < points.length; k++) {
    const [x0, g0] = points[k - 1]!;
    const [x1, g1] = points[k]!;
    if (g0 / small >= 0.9 && g1 / small < 0.9)
      return x0 + ((g0 / small - 0.9) / ((g0 - g1) / small)) * (x1 - x0);
  }
  return Number.NaN;
}

describe('the netlist of the stand', () => {
  it('is the very netlist ngspice solved, at every volume, switched off and with the battery the wrong way round', () => {
    expect(amplifierNetlist({ volume: 0.5 })).toEqual(sample<OpSample>('amplifier-op').netlist);
    expect(amplifierNetlist({ volume: 0.5, reversed: true })).toEqual(
      sample<OpSample>('amplifier-reversed').netlist,
    );
    for (const percent of VOLUMES)
      expect(amplifierNetlist({ volume: percent / 100 })).toEqual(tone(percent).netlist);
    expect(amplifierNetlist({ volume: 1, on: false })).toEqual(sample<ToneSample>('amplifier-off').netlist);
    // a new netlist every time, which a stand may change; at rest by default: the volume in the middle, switched on
    const a = amplifierNetlist();
    expect(a).not.toBe(amplifierNetlist());
    expect(a).toEqual(amplifierNetlist({ volume: 0.5, on: true, reversed: false }));
    expect(amplifierNetlist({ source: 'ideal-ac-6v' }).parts.find((p) => p.id === 'PL')!.spec).toBe(
      'ideal-ac-6v',
    );
  });

  it('names every node for the probe, and every part has its role in a chapter of its own kind', () => {
    const net = amplifierNetlist();
    const used = new Set(net.parts.flatMap((p) => p.pins).filter((node) => node !== 0));
    const named = Object.values(AMPLIFIER_NODES);
    expect(new Set(named).size).toBe(named.length);
    expect([...used].sort((a, b) => a - b)).toEqual([...named].sort((a, b) => a - b));
    expect(net.nodes).toBe(Math.max(...named) + 1);
    const chapters = new Set(volume.journey.map((entry) => entry.id));
    // the chapters where each kind of part is explained
    const ofKind: Record<string, string[]> = {
      battery: ['prologue'],
      switch: ['prologue'],
      sine: ['prologue'],
      speaker: ['prologue'],
      resistor: ['resistor', 'resistor-pick', 'divider'],
      pot: ['divider'],
      capacitor: ['capacitor', 'capacitor-kinds', 'filter'],
      diode: ['diode'],
      led: ['led'],
      transistor: ['transistor', 'amplifier'],
    };
    expect(Object.keys(AMPLIFIER_ROLES).sort()).toEqual(net.parts.map((p) => p.id).sort());
    for (const p of net.parts) {
      const role = AMPLIFIER_ROLES[p.id]!;
      expect(chapters.has(role.chapter), p.id).toBe(true);
      expect(ofKind[PARTS[p.spec]!.kind], p.id).toContain(role.chapter);
      expect(role.role.length, p.id).toBeGreaterThan(10);
    }
  });
});

describe('the amplifier against ngspice', () => {
  it('at rest: every node within 1 % of ngspice; the output near half the supply, 15 mA from the battery', () => {
    const s = sample<OpSample>('amplifier-op');
    const dc = solveDC(amplifierNetlist({ volume: 0.5 }));
    expect(dc.ok).toBe(true);
    expect(dc.issues).toEqual([]);
    expect(dc.iterations).toBeLessThanOrEqual(50);
    s.v.forEach((want, node) => close(dc.v[node], want, 0.01 * Math.abs(want), `node ${node}`));
    for (const [id, want] of Object.entries(s.parts))
      close(dc.parts[id]!.i, want.i, 0.01 * Math.abs(want.i), id);
    // ngspice: 8.328 V on the supply after the protection diode, the output at 3.755 V; the battery gives 15.13 mA —
    // the LED 2.99 mA, the driver 8.25 mA, the output pair 3.89 mA
    close(s.v[supply], 8.328, 0.001, 'ngspice: the supply');
    close(s.v[output], 3.755, 0.001, 'ngspice: the output');
    close(-s.parts.B1!.i, 0.01513, 0.00001, 'ngspice: the battery');
    close(s.parts.LED1!.i, 0.00299, 0.00001, 'ngspice: the LED');
    close(s.parts.Q1!.i, 0.00825, 0.00001, 'ngspice: the driver');
    close(s.parts.Q2!.i, 0.00389, 0.00001, 'ngspice: the output pair');
    for (const id of Object.keys(s.parts)) expect(dc.status[id]!.condition, id).not.toBe('hot');
  });

  it('on a small signal (the volume at 10 %) its gain at 1 kHz is ngspice’s within 2 %', () => {
    const s = tone(10);
    const m = playing(10);
    const spice = s.amplitude[speaker]! / s.amplitude[wiper]!;
    close(spice, 15.72, 0.01, 'ngspice: 15.72 times');
    close(m.amplitude[speaker]! / m.amplitude[wiper]!, spice, 0.02 * spice, 'the gain');
    close(m.amplitude[speaker], s.amplitude[speaker]!, 0.02 * s.amplitude[speaker]!, 'on the speaker');
  });

  it('what comes out against what goes in, from 50 % of the volume to past clipping: within 3 % of ngspice', () => {
    for (const percent of VOLUMES.slice(1)) {
      const s = tone(percent);
      const m = playing(percent);
      for (const node of [wiper, output, speaker]) {
        const want = s.amplitude[node]!;
        close(m.amplitude[node], want, 0.03 * want, `${percent} %: the amplitude of node ${node}`);
      }
      // the waveform itself at 24 moments of the last millisecond, against its swing
      for (const node of [output, speaker]) {
        const swing = s.swing[node]!;
        s.v[node]!.forEach((want, k) =>
          close(m.at[node]![k], want, 0.03 * swing, `${percent} %: node ${node} at ${s.times[k]} s`),
        );
        close(m.swing[node], swing, 0.03 * swing, `${percent} %: the swing of node ${node}`);
      }
    }
    // ngspice: 1.02 V on the speaker at 50 %, 2.04 V at 80 %, 3.20 V at full volume — 0.64 W at the tone
    close(tone(50).amplitude[speaker], 1.017, 0.001, 'ngspice at 50 %');
    close(tone(80).amplitude[speaker], 2.035, 0.001, 'ngspice at 80 %');
    close(tone(100).amplitude[speaker], 3.196, 0.001, 'ngspice at 100 %');
  });

  it('clipping sets in where ngspice says, within 5 %', () => {
    const spice = VOLUMES.map(
      (p) => [tone(p).amplitude[wiper]!, tone(p).amplitude[speaker]! / tone(p).amplitude[wiper]!] as const,
    );
    const model = VOLUMES.map(
      (p) =>
        [
          playing(p).amplitude[wiper]!,
          playing(p).amplitude[speaker]! / playing(p).amplitude[wiper]!,
        ] as const,
    );
    const where = onset(spice);
    // ngspice: the gain is down to 90 % with 0.20 V of the tone on the volume control, between 90 % and 95 % of it
    close(where, 0.202, 0.002, 'ngspice: where clipping sets in');
    expect(where).toBeGreaterThan(tone(90).amplitude[wiper]!);
    expect(where).toBeLessThan(tone(95).amplitude[wiper]!);
    close(onset(model), where, 0.05 * where, 'the model');
    // past it the output hardly grows: from 95 % to 100 % the input grows by 30 %, the output by 7 %
    expect(model.at(-1)![1] / model.at(-2)![1]).toBeLessThan(0.85);
    // the limit of the swing on the speaker at full volume
    close(
      playing(100).swing[speaker],
      tone(100).swing[speaker]!,
      0.05 * tone(100).swing[speaker]!,
      'the clip',
    );
  });

  it('switched off: on the speaker only what leaks through passively, some 50 μV — no gain at all', () => {
    const s = sample<ToneSample>('amplifier-off');
    const m = play(s);
    close(s.amplitude[speaker], 4.5e-5, 0.1e-5, 'ngspice: 45 μV');
    expect(m.amplitude[speaker]).toBeLessThan(1e-4);
    close(m.amplitude[speaker], s.amplitude[speaker]!, 0.03 * s.amplitude[speaker]!, 'what leaks');
    // the full tone stands on the volume control and reaches the speaker some 6600 times weaker
    close(
      m.amplitude[wiper],
      s.amplitude[wiper]!,
      0.03 * s.amplitude[wiper]!,
      'the tone on the volume control',
    );
    expect(m.amplitude[speaker]! / m.amplitude[wiper]!).toBeLessThan(1e-3);
    expect(Math.abs(m.t.parts.B1!.i)).toBeLessThan(1e-12);
  });

  it('the battery the wrong way round: the protection diode lets less than 1 μA through', () => {
    const s = sample<OpSample>('amplifier-reversed');
    const dc = solveDC(amplifierNetlist({ reversed: true }));
    expect(dc.ok).toBe(true);
    close(s.parts.D1!.i, -14.4e-9, 0.1e-9, 'ngspice: −14.4 nA, the leakage of 1N4007 the wrong way round');
    close(dc.parts.D1!.i, s.parts.D1!.i, 0.01 * Math.abs(s.parts.D1!.i), 'the diode');
    close(dc.parts.B1!.i, s.parts.B1!.i, 0.01 * Math.abs(s.parts.B1!.i), 'the battery');
    expect(Math.abs(dc.parts.B1!.i)).toBeLessThan(1e-6);
    // nothing behind the diode gets more than 13 mV the wrong way round, and every part is whole
    for (const node of Object.values(AMPLIFIER_NODES))
      if (node > AMPLIFIER_NODES.switched) expect(Math.abs(dc.v[node]!), `node ${node}`).toBeLessThan(0.013);
    for (const [id, status] of Object.entries(dc.status)) expect(status.condition, id).toBe('ok');
  });
});

describe('the worked example of sim/core/README.md, as written there', () => {
  it('the amplifier at rest, playing at half volume, then louder', () => {
    const board = amplifierNetlist({ volume: 0.5 });
    const t = new Transient(board, { dt: 1 / 48000 });
    expect(t.start('dc')).toBe(true);
    close(t.v[AMPLIFIER_NODES.output], 3.755, 0.0005, 'the output at rest');
    close(t.parts.B1!.i, -0.01513, 0.000005, 'from the battery');
    const trace = new Float32Array(2880);
    expect(t.run(2880, [{ node: AMPLIFIER_NODES.speaker, out: trace }])).toBe(2880);
    close(amplitude(trace.subarray(1920), 1000, 1921), 1.017, 0.0005, '1 kHz on the speaker');
    board.parts.find((p) => p.id === 'VR1')!.setting = 0.9;
    expect(t.run(2880, [{ node: AMPLIFIER_NODES.speaker, out: trace }])).toBe(2880);
    close(amplitude(trace.subarray(1920), 1000, 2880 + 1921), 2.71, 0.005, 'louder, 60 ms later');
  });
});
