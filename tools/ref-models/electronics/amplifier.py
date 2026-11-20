#!/usr/bin/env python3
"""Why the volume's amplifier is the one it is, in ngspice's numbers: amplifiers on one, two and three transistors that
play the player's test tone from the 9 V battery, compared by the power they give before clipping, the power they give
with every transistor within its maker's ratings, the current they take from the battery at rest and playing (how
many hours it lives) and how much there is to explain; how far the transistor of the model — the Ebers–Moll part of
its maker's SPICE model — is from the maker's whole model in the amplifier the volume chose; and how much the chosen
amplifier depends on the β of its driver. It prints tables in Markdown that
app/src/volumes/electronics/sim/core/README.md quotes («The amplifier»).

  A  one transistor: a common-emitter stage, 2N3904 with 68 Ω in its collector, the 32 Ω earphone through 470 μF;
  C  two transistors: B's driver and one BC337-25 that follows it in class A, 68 Ω in its emitter, the 8 Ω speaker
     through 470 μF;
  D  two transistors: B's push-pull pair and its two diodes (1N4148) fed by 2.2 kΩ from either side, the volume
     control straight into the middle of the diodes — no driver, no gain in voltage;
  B  three transistors, the volume's amplifier (cases.py, `amplifier`): the driver BC547B with feedback from the
     output, two diodes 1N4007, the push-pull pair BC337-25 / BC327-25, the 8 Ω speaker through 470 μF — and, as it
     was tried while choosing, B with the first output pair 2N3904 / 2N3906 (two 1N4148 between their bases), B
     without its reservoir capacitor and B with the speaker returned to the supply.

All have the same supply — the battery, the switch, the protection diode, the reservoir capacitor and the LED «on» —
and the same input, the test tone (0.3 V behind 32 Ω, 1 kHz) on the 10 kΩ volume control. Each point is a transient
of 60 ms from the operating point; the last 20 ms give the amplitude of 1 kHz and of its harmonics up to the tenth, the
largest collector current of every transistor, the mean power it takes and the mean current of the battery. The
switch-on is a transient of 200 ms from every capacitor empty (ngspice's `method=gear` there: the trapezoid does not
get through it with the makers' whole models).

  python3 tools/ref-models/electronics/amplifier.py        (from the repository root; about a minute)
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

# The makers' ratings (README.md of the model, «Transistors»): the continuous collector current (A) and the power (W)
RATINGS = {
    'transistor-bc547b': (0.1, 0.5),
    'transistor-2n3904': (0.2, 0.625),
    'transistor-2n3906': (0.2, 0.625),
    'transistor-bc337-25': (0.5, 0.625),
    'transistor-bc327-25': (0.5, 0.625),
}

# The transistors of the volume's amplifier (B) and of B as it was first tried
FIRST_PAIR = {'Q2': 'transistor-2n3904', 'Q3': 'transistor-2n3906', 'D2': 'diode-1n4148', 'D3': 'diode-1n4148'}


def supply_and_input(volume):
    """The parts every variant shares: the battery, the switch, the protection diode, the reservoir capacitor, the
    LED «on» with its resistor, the player's tone and the volume control (nodes 1 … 6, the wiper 6)."""
    return [part('B1', 'battery-9v', [1, 0]), part('S1', 'switch', [1, 2], 1),
            part('D1', 'diode-1n4007', [2, 3]), part('C3', 'electrolytic-470u-16v', [3, 0]),
            part('R1', 'resistor-2k2', [3, 4]), part('LED1', 'led-red', [4, 0]),
            part('PL', 'player-tone', [5, 0]), part('VR1', 'pot-10k', [0, 6, 5], volume)]


def one_stage(volume):
    """Variant A: one 2N3904 biased by 6.8 kΩ and 1 kΩ with 4.7 Ω in its emitter and 68 Ω in its collector, the
    earphone through 470 μF."""
    return net(11, *supply_and_input(volume), part('C1', 'electrolytic-10u-16v', [7, 6]),
               part('RA', 'resistor-6k8', [3, 7]), part('RB', 'resistor-1k', [7, 0]),
               part('RC', 'resistor-68', [3, 8]), part('Q1', 'transistor-2n3904', [8, 7, 9]),
               part('RE', 'resistor-4R7', [9, 0]),
               part('C2', 'electrolytic-470u-16v', [8, 10]), part('PH', 'earphone-32', [10, 0]))


def class_a(volume):
    """Variant C: B's driver with its feedback and its load, and one BC337-25 following its collector in class A with
    68 Ω from its emitter to the ground (0.21 W there, of a 0.25 W resistor's rating), the speaker through 470 μF."""
    return net(14, *supply_and_input(volume), part('C1', 'electrolytic-10u-16v', [7, 6]),
               part('R2', 'resistor-1k5', [7, 8]), part('R3', 'resistor-47k', [12, 8]),
               part('R4', 'resistor-18k', [8, 0]), part('Q1', 'transistor-bc547b', [11, 8, 0]),
               part('R5', 'resistor-470', [3, 11]), part('Q2', 'transistor-bc337-25', [3, 11, 12]),
               part('RE', 'resistor-68', [12, 0]),
               part('C2', 'electrolytic-470u-16v', [12, 13]), part('LS1', 'speaker-8', [13, 0]))


def followers(volume):
    """Variant D: B's push-pull pair and two 1N4148 between their bases, 2.2 kΩ from the supply to the top and from the
    bottom to the ground, the volume control through 10 μF into the middle of the diodes; the speaker through 470 μF."""
    return net(14, *supply_and_input(volume), part('C1', 'electrolytic-10u-16v', [10, 6]),
               part('R5', 'resistor-2k2', [3, 9]), part('D2', 'diode-1n4148', [9, 10]),
               part('D3', 'diode-1n4148', [10, 11]), part('R6', 'resistor-2k2', [11, 0]),
               part('Q2', 'transistor-bc337-25', [3, 9, 12]), part('Q3', 'transistor-bc327-25', [0, 11, 12]),
               part('C2', 'electrolytic-470u-16v', [12, 13]), part('LS1', 'speaker-8', [13, 0]))


def swapped(build, specs):
    """`build` with the parts named in `specs` ({id: catalog key}) replaced."""
    def changed(volume):
        netlist = build(volume)
        for p in netlist['parts']:
            p['spec'] = specs.get(p['id'], p['spec'])
        return netlist
    return changed


def tried(kind):
    """B changed as it was tried while choosing: without the reservoir capacitor, with one 1N4148 in place of a 1N4007
    between the bases of the pair (more current at rest), or with the speaker returned to the supply instead of the
    ground and the driver's load fed from the speaker (a bootstrap through the speaker)."""
    def build(volume):
        netlist = amplifier(volume)
        if kind == 'no reservoir':
            netlist['parts'] = [p for p in netlist['parts'] if p['id'] != 'C3']
        elif kind == 'one diode 1N4148':
            netlist = swapped(amplifier, {'D2': 'diode-1n4148'})(volume)
        elif kind != 'chosen':
            for p in netlist['parts']:
                if p['id'] == 'LS1':
                    p['pins'] = [3, 13]
                elif p['id'] == 'R5':
                    p['pins'] = [13, 9]
        return netlist
    return build


VARIANTS = {
    'A': {'build': one_stage, 'out': 10, 'load': 32.0},
    'C': {'build': class_a, 'out': 13, 'load': 8.0},
    'D': {'build': followers, 'out': 13, 'load': 8.0},
    'B': {'build': amplifier, 'out': 13, 'load': 8.0},
    'B first': {'build': swapped(amplifier, FIRST_PAIR), 'out': 13, 'load': 8.0},
}


def transistors(netlist):
    return [p for p in netlist['parts'] if p['spec'] in spice.TRANSISTORS]


def at_rest(netlist, vendor):
    """{'v': node voltages, 'i': {id: [current into each pin]}} at the operating point."""
    body, nodes, currents = spice.circuit(netlist, vendor=vendor)
    vectors = ['v(%d)' % n for n in nodes] + sorted({v for pins in currents for pin in pins for v, _ in pin})
    printed = spice.run(['* amplifier at rest', '.options savecurrents %s' % spice.TRAN_OPTIONS, *body, '.control',
                         'set numdgt=17', 'op', 'print ' + ' '.join(vectors), '.endc', '.end'])
    into = {p['id']: [sum(sign * printed[v.lower()] for v, sign in pin) for pin in pins]
            for p, pins in zip(netlist['parts'], currents)}
    v = {n: printed['v(%d)' % n] for n in nodes}
    v[0] = 0.0
    return {'v': v, 'i': into}


def transient(netlist, vendor, stop, step, nodes, parts, start_dc=True):
    """(times, {node: voltages}, {id: [currents into each pin]}) of a transient, for the `nodes` and `parts` asked."""
    body, _, currents = spice.circuit(netlist, None if start_dc else {}, vendor)
    pins = {p['id']: pin for p, pin in zip(netlist['parts'], currents)}
    nodes = sorted(set(nodes) - {0})
    vectors = ['v(%d)' % n for n in nodes] + sorted({v for id in parts for pin in pins[id] for v, _ in pin})
    options = spice.TRAN_OPTIONS + ('' if start_dc else ' method=gear')
    _, text = spice.run(['* amplifier in time', '.options savecurrents %s' % options, *body, '.control',
                         'set wr_singlescale', 'set wr_vecnames', 'option numdgt=17',
                         'tran %r %r 0 %r%s' % (step, stop, step, '' if start_dc else ' uic'),
                         'wrdata %s %s' % (spice.WAVEFORMS, ' '.join(vectors)), '.endc', '.end'],
                        read=spice.WAVEFORMS)
    times, columns = spice.waveforms(text)
    rows = range(len(times))
    waves = {n: columns['v(%d)' % n] for n in nodes}
    waves[0] = [0.0] * len(times)
    into = {id: [[sum(sign * columns[v.lower()][r] for v, sign in pin) for r in rows] for pin in pins[id]]
            for id in parts}
    return times, waves, into


def inside(times, values):
    return [x for t, x in zip(times, values) if WINDOW[0] <= t <= WINDOW[1]]


def playing(netlist, vendor, out, across=None):
    """What the amplifier does with the tone over the window: the amplitude of 1 kHz on the volume control and on the
    load and the load's distortion (THD), the load's highest and lowest voltage, the battery's mean current, and for
    every transistor its largest collector current and its mean power; with `across` (two nodes) the load is the
    voltage from the first to the second."""
    qs = transistors(netlist)
    nodes = {6, out, *(across or ()), *(n for p in qs for n in p['pins'])}
    times, waves, into = transient(netlist, vendor, WINDOW[1], 2e-06, nodes, ['B1', *(p['id'] for p in qs)])
    load = waves[out] if not across else [a - b for a, b in zip(waves[across[0]], waves[across[1]])]
    first = spice.fundamental(times, load, HERTZ, *WINDOW)
    rest = math.sqrt(sum(spice.fundamental(times, load, k * HERTZ, *WINDOW) ** 2 for k in HARMONICS))
    heard = inside(times, load)
    q = {}
    for p in qs:
        c, b, e = p['pins']
        ic, ib = into[p['id']][0], into[p['id']][1]
        power = [(waves[c][r] - waves[e][r]) * ic[r] + (waves[b][r] - waves[e][r]) * ib[r] for r in range(len(times))]
        q[p['id']] = {'peak': max(abs(x) for x in inside(times, ic)),
                      'power': spice.window_of(times, power, *WINDOW)[0], 'spec': p['spec']}
    return {'in': spice.fundamental(times, waves[6], HERTZ, *WINDOW), 'out': first, 'thd': rest / first,
            'top': max(heard), 'bottom': min(heard), 'battery': -spice.window_of(times, into['B1'][0], *WINDOW)[0],
            'q': q}


def switch_on(netlist, vendor):
    """The largest collector current of every transistor in the first 200 ms after the switch closes on a board whose
    capacitors are empty, and how long the largest of them stays above 200 mA."""
    times, _, into = transient(netlist, vendor, 0.2, 5e-06, [], [p['id'] for p in transistors(netlist)],
                               start_dc=False)
    peaks = {p['id']: max(abs(x) for x in into[p['id']][0]) for p in transistors(netlist)}
    worst = max(peaks, key=peaks.get)
    above = [t for t, x in zip(times, into[worst][0]) if abs(x) > 0.2]
    return peaks, worst, (above[-1] - above[0]) if above else 0.0


def hours(amps):
    """How long the battery feeds a steady current to 4.8 V, from the maker's chart (straight lines between its bars),
    or None beyond the chart's 50 mA."""
    (a0, c0), (a1, c1), (a2, c2) = CAPACITY
    if amps > a2:
        return None
    if amps <= a1:
        capacity = c0 + (c1 - c0) * (amps - a0) / (a1 - a0)
    else:
        capacity = c1 + (c2 - c1) * (amps - a1) / (a2 - a1)
    return capacity / amps


def hours_text(amps):
    h = hours(amps)
    return '%.0f' % h if h is not None else 'under %.0f (beyond the chart: 445 mAh at 50 mA)' % (CAPACITY[2][1] / amps)


def first_below(values, at, level):
    """Where `values` first falls below `level`: the matching point of `at`, on straight lines between the points
    (None when it never does)."""
    for k in range(1, len(values)):
        if values[k - 1] >= level > values[k]:
            share = (values[k - 1] - level) / (values[k - 1] - values[k])
            return at[k - 1] + share * (at[k] - at[k - 1])
    return None


def rated_load(point, limit_a=None):
    """How near its ratings the transistor nearest them is: the largest of its peak collector current over its rated
    current and its mean power over its rated power (`limit_a` in place of every rated current, when given)."""
    return max(max(q['peak'] / (limit_a or RATINGS[q['spec']][0]), q['power'] / RATINGS[q['spec']][1])
               for q in point['q'].values())


def measure(variant, vendor, volumes=VOLUMES):
    v = VARIANTS[variant]
    netlist = v['build'](0.5)
    rest = at_rest(netlist, vendor)
    sweep = [playing(v['build'](volume), vendor, v['out']) for volume in volumes]
    inputs = [s['in'] for s in sweep]
    outputs = [s['out'] for s in sweep]
    gains = [o / i for o, i in zip(outputs, inputs)]
    power = [o * o / 2 / v['load'] for o in outputs]
    loads = [rated_load(s) for s in sweep]
    # the power where the distortion reaches 10 % (the usual rating of a small amplifier), between the points
    at10 = first_below([-s['thd'] for s in sweep], power, -0.10)
    # where clipping sets in: the input at which the gain is down to 90 % of the gain at 10 % of the volume, and the
    # power on the load there
    onset = first_below([g / gains[0] for g in gains], inputs, 0.9)
    onset_power = first_below([g / gains[0] for g in gains], power, 0.9)
    quiet = -rest['i']['B1'][0]
    return {
        'volumes': volumes, 'sweep': sweep, 'power': power, 'gains': gains, 'loads': loads,
        'quiet': quiet, 'gain': gains[0], 'thd': sweep[0]['thd'], 'power10': at10,
        'full': power[-1], 'full_thd': sweep[-1]['thd'], 'onset': onset, 'onset_power': onset_power,
        # the loudest point with every transistor within its ratings: where the nearest one reaches them, or full volume
        'rated': first_below([-x for x in loads], power, -1.0),
        'rated_volume': first_below([-x for x in loads], list(volumes), -1.0),
        'collectors': {p['id']: rest['i'][p['id']][0] for p in transistors(netlist)},
        'rest': rest, 'parts': len(netlist['parts']), 'transistors': [p['spec'] for p in transistors(netlist)],
    }


def name(spec):
    return spec.split('-', 1)[1].upper()


def mw(watts):
    """Milliwatts to the nearest one, or to a tenth below 10 mW."""
    return ('%.0f mW' if watts >= 9.95e-3 else '%.1f mW') % (1e3 * watts)


def main():
    if not spice.pathlib.Path(spice.NGSPICE).is_file():
        print('amplifier: ngspice not found (%s)' % spice.NGSPICE)
        return 2
    m = {x: measure(x, False) for x in 'ACDB'}
    full = measure('B', True)
    shared = len(supply_and_input(0.5))
    order = 'ACDB'
    print('| | A: one stage, 32 Ω earphone | C: driver and one follower in class A, 8 Ω | D: push-pull pair without a '
          'driver, 8 Ω | B: driver and push-pull pair, 8 Ω |')
    print('|---|---|---|---|---|')
    print('| transistors | %s |' % ' | '.join(', '.join(name(s) for s in m[x]['transistors']) for x in order))
    print('| parts but the supply, the LED and the volume control | %s |' % ' | '.join(
        '%d' % (m[x]['parts'] - shared) for x in order))
    print('| gain at 1 kHz, volume at 10 %% | %s |' % ' | '.join(
        '%.2f (THD %.1f %%)' % (m[x]['gain'], 100 * m[x]['thd']) for x in order))
    print('| power at 10 %% THD | %s |' % ' | '.join(
        mw(m[x]['power10']) if m[x]['power10'] else 'not reached: %s at full volume (THD %.1f %%)' % (
            mw(m[x]['full']), 100 * m[x]['full_thd']) for x in order))
    print('| power at full volume | %s |' % ' | '.join(
        '%s (THD %.1f %%)' % (mw(m[x]['full']), 100 * m[x]['full_thd']) for x in order))
    print('| power with every transistor within its ratings | %s |' % ' | '.join(
        'up to full volume' if m[x]['rated'] is None else '%s (%.0f %% of the knob)' % (
            mw(m[x]['rated']), 100 * m[x]['rated_volume']) for x in order))
    print('| battery current at rest | %s |' % ' | '.join('%.1f mA' % (1e3 * m[x]['quiet']) for x in order))
    print('| hours of the 9 V battery at rest | %s |' % ' | '.join(hours_text(m[x]['quiet']) for x in order))
    half = VOLUMES.index(0.5)
    print('| battery current playing the tone, volume at 50 %% | %s |' % ' | '.join(
        '%.1f mA (%s on the load)' % (1e3 * m[x]['sweep'][half]['battery'], mw(m[x]['power'][half])) for x in order))
    print()

    first = measure('B first', False)
    first_full = measure('B first', True)
    b_on, b_worst, b_long = switch_on(amplifier(0.5), False)
    f_on, f_worst, f_long = switch_on(VARIANTS['B first']['build'](0.5), False)
    bw_on, _, _ = switch_on(amplifier(0.5), True)
    fw_on, _, fw_long = switch_on(VARIANTS['B first']['build'](0.5), True)
    print('| B\'s output pair | BC337-25 / BC327-25, two 1N4007 (chosen) | 2N3904 / 2N3906, two 1N4148 (tried first) |')
    print('|---|---|---|')
    print('| rated collector current | 500 mA | 200 mA |')
    print('| battery current at rest | %.2f mA | %.2f mA |' % (1e3 * m['B']['quiet'], 1e3 * first['quiet']))
    print('| the output pair at rest | %.2f mA | %.2f mA |' % (1e3 * m['B']['collectors']['Q2'],
                                                            1e3 * first['collectors']['Q2']))
    print('| power at 10 %% THD | %s | %s |' % (mw(m['B']['power10']), mw(first['power10'])))
    print('| the largest collector current at full volume: the model / the whole models | %.0f / %.0f mA | '
          '%.0f / %.0f mA |' % tuple(1e3 * max(q['peak'] for k, q in x['sweep'][-1]['q'].items() if k != 'Q1')
                                     for x in (m['B'], full, first, first_full)))
    def passes(x, amps=0.2):
        """Where a peak of the output pair first passes `amps`: the knob and the power on the speaker there."""
        over = [-max(q['peak'] for k, q in s['q'].items() if k != 'Q1') / amps for s in x['sweep']]
        knob = first_below(over, list(VOLUMES), -1)
        return 'never' if knob is None else '%.0f %% (%s)' % (100 * knob, mw(first_below(over, x['power'], -1)))
    print('| the knob where a peak first passes 200 mA: the model / the whole models | %s |' % ' | '.join(
        ' / '.join(passes(x) for x in pair) for pair in ((m['B'], full), (first, first_full))))
    print('| switching on with the capacitors empty: the largest collector current, the model / the whole models | '
          '%.0f / %.0f mA (%s) | %.0f / %.0f mA (%s), above 200 mA for %.1f / %.1f ms |' % (
              1e3 * b_on[b_worst], 1e3 * max(bw_on.values()), b_worst, 1e3 * f_on[f_worst], 1e3 * max(fw_on.values()),
              f_worst, 1e3 * f_long, 1e3 * fw_long))
    print()

    print('| B as tried while choosing | battery at rest | 10 % | 30 % | 50 % | 70 % | full volume |')
    print('|---|---|---|---|---|---|---|')
    for kind, across in (('chosen', None), ('no reservoir', None), ('one diode 1N4148', None),
                         ('the speaker to the supply', (3, 13))):
        cells = ['%.1f mA' % (-1e3 * at_rest(tried(kind)(0.5), False)['i']['B1'][0])]
        for volume in (0.1, 0.3, 0.5, 0.7, 1.0):
            heard = playing(tried(kind)(volume), False, 13, across)
            cells.append('%s, THD %.1f %%' % (mw(heard['out'] ** 2 / 16), 100 * heard['thd']))
        print('| %s | %s |' % (kind, ' | '.join(cells)))
    print()

    b = m['B']
    print('| B, at rest and playing | the model (IS, BF, BR, VAF) | the makers\' whole models | difference |')
    print('|---|---|---|---|')
    rows = [
        ('the supply at rest (V)', b['rest']['v'][3], full['rest']['v'][3], '%.3f'),
        ('the output at rest (V)', b['rest']['v'][12], full['rest']['v'][12], '%.3f'),
        ('battery current at rest (mA)', 1e3 * b['quiet'], 1e3 * full['quiet'], '%.2f'),
        ('driver BC547B, collector (mA)', 1e3 * b['collectors']['Q1'], 1e3 * full['collectors']['Q1'], '%.2f'),
        ('output pair at rest (mA)', 1e3 * b['collectors']['Q2'], 1e3 * full['collectors']['Q2'], '%.2f'),
        ('gain at 1 kHz, volume at 10 %', b['gain'], full['gain'], '%.2f'),
        ('THD at 10 % of the volume (%)', 100 * b['thd'], 100 * full['thd'], '%.2f'),
        ('THD at 50 % of the volume (%)', 100 * b['sweep'][half]['thd'], 100 * full['sweep'][half]['thd'], '%.2f'),
        ('battery current playing, volume at 50 % (mA)', 1e3 * b['sweep'][half]['battery'],
         1e3 * full['sweep'][half]['battery'], '%.1f'),
        ('clipping sets in: the input (V)', b['onset'], full['onset'], '%.3f'),
        ('clipping sets in: the power (mW)', 1e3 * b['onset_power'], 1e3 * full['onset_power'], '%.0f'),
        ('power at 10 % THD (mW)', 1e3 * b['power10'], 1e3 * full['power10'], '%.0f'),
        ('power at full volume (mW)', 1e3 * b['full'], 1e3 * full['full'], '%.0f'),
        ('THD at full volume (%)', 100 * b['full_thd'], 100 * full['full_thd'], '%.1f'),
        ('the speaker at full volume, highest (V)', b['sweep'][-1]['top'], full['sweep'][-1]['top'], '%.2f'),
        ('the speaker at full volume, lowest (V)', b['sweep'][-1]['bottom'], full['sweep'][-1]['bottom'], '%.2f'),
    ]
    for what, model, maker, form in rows:
        print('| %s | %s | %s | %+.0f %% |' % (what, form % model, form % maker, 100 * (maker / model - 1)))
    print()

    print('| B playing 1 kHz: the volume | the tone on the volume control | on the speaker | gain | power | THD | '
          'from the battery | Q2 / Q3 at the peaks |')
    print('|---|---|---|---|---|---|---|---|')
    for volume, s, g, p in zip(VOLUMES, b['sweep'], b['gains'], b['power']):
        print('| %.0f %% | %.1f mV | %.3f V | %.2f | %.1f mW | %.1f %% | %.1f mA | %.0f / %.0f mA |' % (
            100 * volume, 1e3 * s['in'], s['out'], g, 1e3 * p, 100 * s['thd'], 1e3 * s['battery'],
            1e3 * s['q']['Q2']['peak'], 1e3 * s['q']['Q3']['peak']))
    print()

    # how much B leans on its driver's β: BC547B's datasheet gives hFE 200 … 450 at 2 mA
    r2, r3, r4 = (spice.resistor_ohms(p['spec']) for p in amplifier(0.5)['parts'] if p['id'] in ('R2', 'R3', 'R4'))
    print('| B, the driver\'s β (BF) | the base at rest | R4\'s current | the driver\'s base current | the output at '
          'rest | R3, R4 alone would put it at | gain at 1 kHz, volume at 10 % |')
    print('|---|---|---|---|---|---|---|')
    base = spice.TRANSISTORS['transistor-bc547b']
    for bf in (200.0, base['bf'], 450.0):
        key = 'transistor-bc547b-bf%g' % bf
        spice.TRANSISTORS[key] = dict(base, bf=bf)
        build = swapped(amplifier, {'Q1': key})
        rest = at_rest(build(0.5), False)
        small = playing(build(0.1), False, 13)
        vb = rest['v'][8]
        print('| %g | %.3f V | %.1f μA | %.1f μA | %.3f V | %.3f V | %.2f |' % (
            bf, vb, 1e6 * vb / r4, 1e6 * rest['i']['Q1'][1], rest['v'][12], vb * (r3 + r4) / r4,
            small['out'] / small['in']))
    print()
    print('R3 / R2 = %.1f: the gain the two resistors would set with a driver of endless gain.' % (r3 / r2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
