#!/usr/bin/env python3
"""Why the volume's amplifier is the one it is, in ngspice's numbers: two amplifiers that play the player's test tone
from the 9 V battery, compared by the power they give before clipping, the current they take at rest (how many hours
the battery lives) and how much there is to explain; and how far the transistor of the model — the Ebers–Moll part of
its maker's SPICE model — is from the maker's whole model in the amplifier the volume chose. It prints two tables in
Markdown that app/src/volumes/electronics/sim/core/README.md quotes («The amplifier»).

  A  one common-emitter stage: 2N3904 with 68 Ω in its collector, the 32 Ω earphone through 470 μF;
  B  the volume's amplifier (cases.py, `amplifier`): the driver BC547B with feedback from the output, two diodes, the
     push-pull pair 2N3904 / 2N3906, the 8 Ω speaker through 470 μF — and, as it was tried while choosing, B without
     its reservoir capacitor and B with the speaker returned to the supply.

Both have the same supply — the battery, the switch, the protection diode, the reservoir capacitor and the LED «on» —
and the same input, the test tone (0.3 V behind 32 Ω, 1 kHz) on the 10 kΩ volume control. Each point is a transient
of 60 ms from the operating point; the last 20 ms give the amplitude of 1 kHz and of its harmonics up to the tenth.

  python3 tools/ref-models/electronics/amplifier.py        (from the repository root; about 20 s)
"""
import math
import sys

import spice
from cases import amplifier, net, part

VOLUMES = (0.1, 0.3, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0)
WINDOW = (0.04, 0.06)
HERTZ = 1000.0
HARMONICS = range(2, 11)

# Energizer 522 (9 V alkaline), product datasheet form 522GL1019: its chart «Milliamp-Hours Capacity, continuous
# discharge to 4.8 volts at 21 °C» reads about 600 mAh at 10 mA, 565 mAh at 25 mA and 445 mAh at 50 mA
CAPACITY = ((10e-3, 0.600), (25e-3, 0.565), (50e-3, 0.445))  # (A, Ah)


def one_stage(volume):
    """Variant A: the same supply and input as the volume's amplifier; one 2N3904 biased by 6.8 kΩ and 1 kΩ with 4.7 Ω
    in its emitter and 68 Ω in its collector, the earphone through 470 μF."""
    return net(11, part('B1', 'battery-9v', [1, 0]), part('S1', 'switch', [1, 2], 1),
               part('D1', 'diode-1n4007', [2, 3]), part('C3', 'electrolytic-470u-16v', [3, 0]),
               part('R1', 'resistor-2k2', [3, 4]), part('LED1', 'led-red', [4, 0]),
               part('PL', 'player-tone', [5, 0]), part('VR1', 'pot-10k', [0, 6, 5], volume),
               part('C1', 'electrolytic-10u-16v', [7, 6]),
               part('RA', 'resistor-6k8', [3, 7]), part('RB', 'resistor-1k', [7, 0]),
               part('RC', 'resistor-68', [3, 8]), part('Q1', 'transistor-2n3904', [8, 7, 9]),
               part('RE', 'resistor-4R7', [9, 0]),
               part('C2', 'electrolytic-470u-16v', [8, 10]), part('PH', 'earphone-32', [10, 0]))


def changed(kind):
    """B changed as it was tried while choosing: without the reservoir capacitor, or with the speaker returned to the
    supply instead of the ground and the driver's load fed from the speaker (a bootstrap through the speaker)."""
    def build(volume):
        netlist = amplifier(volume)
        if kind == 'no reservoir':
            netlist['parts'] = [p for p in netlist['parts'] if p['id'] != 'C3']
        else:
            for p in netlist['parts']:
                if p['id'] == 'LS1':
                    p['pins'] = [3, 13]
                elif p['id'] == 'R5':
                    p['pins'] = [13, 9]
        return netlist
    return build


VARIANTS = {
    'A': {'build': one_stage, 'out': 10, 'load': 32.0, 'transistors': ['Q1']},
    'B': {'build': amplifier, 'out': 13, 'load': 8.0, 'transistors': ['Q1', 'Q2', 'Q3']},
}


def at_rest(netlist, vendor):
    """{'v': node voltages, 'i': {id: current into the first pin}} at the operating point."""
    body, nodes, currents = spice.circuit(netlist, vendor=vendor)
    vectors = ['v(%d)' % n for n in nodes] + sorted({v for pins in currents for pin in pins for v, _ in pin})
    printed = spice.run(['* amplifier at rest', '.options savecurrents %s' % spice.TRAN_OPTIONS, *body, '.control',
                         'set numdgt=17', 'op', 'print ' + ' '.join(vectors), '.endc', '.end'])
    into = {p['id']: sum(sign * printed[v.lower()] for v, sign in pins[0])
            for p, pins in zip(netlist['parts'], currents)}
    return {'v': {n: printed['v(%d)' % n] for n in nodes}, 'i': into}


def playing(netlist, vendor, nodes, across=None):
    """{node: (amplitude of 1 kHz, its total harmonic distortion)} over the window, from the operating point; with
    `across` (two nodes), the voltage from the first to the second under the key 'across'."""
    body, _, _ = spice.circuit(netlist, vendor=vendor)
    vectors = ['v(%d)' % n for n in [*nodes, *(across or ())]]
    _, text = spice.run(['* amplifier playing', '.options savecurrents %s' % spice.TRAN_OPTIONS, *body, '.control',
                         'set wr_singlescale', 'set wr_vecnames', 'option numdgt=17',
                         'tran 2e-06 %r 0 2e-06' % WINDOW[1], 'wrdata %s %s' % (spice.WAVEFORMS, ' '.join(vectors)),
                         '.endc', '.end'], read=spice.WAVEFORMS)
    times, columns = spice.waveforms(text)
    waves = {n: columns['v(%d)' % n] for n in nodes}
    if across:
        waves['across'] = [a - b for a, b in zip(columns['v(%d)' % across[0]], columns['v(%d)' % across[1]])]
    out = {}
    for key, wave in waves.items():
        first = spice.fundamental(times, wave, HERTZ, *WINDOW)
        rest = math.sqrt(sum(spice.fundamental(times, wave, k * HERTZ, *WINDOW) ** 2 for k in HARMONICS))
        out[key] = (first, rest / first)
    return out


def hours(amps):
    """How long the battery feeds a steady current to 4.8 V, from the maker's chart (straight lines between its bars,
    its ends beyond them)."""
    (a0, c0), (a1, c1), (a2, c2) = CAPACITY
    if amps <= a1:
        capacity = c0 + (c1 - c0) * (amps - a0) / (a1 - a0)
    else:
        capacity = c1 + (c2 - c1) * (amps - a1) / (a2 - a1)
    return capacity / amps


def first_below(values, at, level):
    """Where `values` first falls below `level`: the matching point of `at`, on straight lines between the points
    (None when it never does)."""
    for k in range(1, len(values)):
        if values[k - 1] >= level > values[k]:
            share = (values[k - 1] - level) / (values[k - 1] - values[k])
            return at[k - 1] + share * (at[k] - at[k - 1])
    return None


def measure(variant, vendor):
    v = VARIANTS[variant]
    rest = at_rest(v['build'](0.5), vendor)
    sweep = [(volume, playing(v['build'](volume), vendor, [6, v['out']])) for volume in VOLUMES]
    inputs = [s[6][0] for _, s in sweep]
    outputs = [s[v['out']][0] for _, s in sweep]
    distortion = [s[v['out']][1] for _, s in sweep]
    gains = [o / i for o, i in zip(outputs, inputs)]
    power = [o * o / 2 / v['load'] for o in outputs]
    # the power where the distortion reaches 10 % (the usual rating of a small amplifier), between the points
    at = first_below([-d for d in distortion], power, -0.10)
    # where clipping sets in: the input at which the gain is down to 90 % of the gain at 10 % of the volume
    onset = first_below([g / gains[0] for g in gains], inputs, 0.9)
    quiet = -rest['i']['B1']
    table = list(zip(VOLUMES, inputs, outputs, gains, power, distortion))
    return {
        'table': table,
        'quiet': quiet, 'hours': hours(quiet), 'gain': gains[0], 'thd': distortion[0], 'power10': at,
        'full': power[-1], 'full_thd': distortion[-1], 'onset': onset,
        'collectors': {q: rest['i'][q] for q in v['transistors']},
        'out_at_rest': rest['v'][12] if variant == 'B' else rest['v'][8], 'supply': rest['v'][3],
    }


def main():
    if not spice.pathlib.Path(spice.NGSPICE).is_file():
        print('amplifier: ngspice not found (%s)' % spice.NGSPICE)
        return 2
    a, b, full = measure('A', False), measure('B', False), measure('B', True)
    print('| | A: one stage, 32 Ω earphone | B: driver and push-pull pair, 8 Ω speaker |')
    print('|---|---|---|')
    print('| transistors | 2N3904 | BC547B, 2N3904, 2N3906 |')
    shared = {'B1', 'S1', 'D1', 'C3', 'R1', 'LED1', 'PL', 'VR1'}  # the supply, the LED «on», the input
    print('| parts but the supply, the LED and the volume control | %d | %d |' % tuple(
        sum(p['id'] not in shared for p in VARIANTS[x]['build'](0.5)['parts']) for x in 'AB'))
    print('| gain at 1 kHz, volume at 10 %% | %.2f (THD %.1f %%) | %.2f (THD %.1f %%) |' % (
        a['gain'], 100 * a['thd'], b['gain'], 100 * b['thd']))
    print('| power at 10 %% THD | %s | %s |' % tuple(
        '%.0f mW' % (1e3 * x['power10']) if x['power10'] else 'not reached (%.0f mW at full volume, THD %.1f %%)' % (
            1e3 * x['full'], 100 * x['full_thd']) for x in (a, b)))
    print('| power at full volume | %.0f mW (THD %.1f %%) | %.0f mW (THD %.1f %%) |' % (
        1e3 * a['full'], 100 * a['full_thd'], 1e3 * b['full'], 100 * b['full_thd']))
    print('| battery current at rest | %.1f mA | %.1f mA |' % (1e3 * a['quiet'], 1e3 * b['quiet']))
    print('| hours of the 9 V battery at rest | %.0f | %.0f |' % (a['hours'], b['hours']))
    print()
    print('| B, at rest and playing | the model (IS, BF, BR, VAF) | the makers\' whole models | difference |')
    print('|---|---|---|---|')
    rows = [
        ('the supply at rest (V)', b['supply'], full['supply'], '%.3f'),
        ('the output at rest (V)', b['out_at_rest'], full['out_at_rest'], '%.3f'),
        ('battery current at rest (mA)', 1e3 * b['quiet'], 1e3 * full['quiet'], '%.2f'),
        ('driver BC547B, collector (mA)', 1e3 * b['collectors']['Q1'], 1e3 * full['collectors']['Q1'], '%.2f'),
        ('output pair at rest (mA)', 1e3 * b['collectors']['Q2'], 1e3 * full['collectors']['Q2'], '%.2f'),
        ('gain at 1 kHz, volume at 10 %', b['gain'], full['gain'], '%.2f'),
        ('THD at 10 % of the volume (%)', 100 * b['thd'], 100 * full['thd'], '%.2f'),
        ('clipping sets in: the input (V)', b['onset'], full['onset'], '%.3f'),
        ('power at 10 % THD (mW)', 1e3 * b['power10'], 1e3 * full['power10'], '%.0f'),
        ('power at full volume (mW)', 1e3 * b['full'], 1e3 * full['full'], '%.0f'),
        ('THD at full volume (%)', 100 * b['full_thd'], 100 * full['full_thd'], '%.1f'),
    ]
    for what, model, maker, form in rows:
        print('| %s | %s | %s | %+.0f %% |' % (what, form % model, form % maker, 100 * (maker / model - 1)))
    print()
    print('| B as tried while choosing | 30 % | 50 % | 70 % | full volume |')
    print('|---|---|---|---|---|')
    for kind, across in (('no reservoir', None), ('the speaker to the supply', (3, 13))):
        cells = []
        for volume in (0.3, 0.5, 0.7, 1.0):
            heard = playing(changed(kind)(volume), False, [13], across)['across' if across else 13]
            cells.append('%.0f mW, THD %.1f %%' % (1e3 * heard[0] ** 2 / 16, 100 * heard[1]))
        print('| %s | %s |' % (kind, ' | '.join(cells)))
    print()
    print('| B playing 1 kHz: the volume | the tone on the volume control | on the speaker | gain | power | THD |')
    print('|---|---|---|---|---|---|')
    for volume, i, o, g, p, d in b['table']:
        print('| %.0f %% | %.1f mV | %.3f V | %.2f | %.1f mW | %.1f %% |' % (
            100 * volume, 1e3 * i, o, g, 1e3 * p, 100 * d))
    return 0


if __name__ == '__main__':
    sys.exit(main())
