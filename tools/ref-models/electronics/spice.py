#!/usr/bin/env python3
"""Reference of the circuit model of the electronics volume: every case of cases.py becomes a SPICE deck, ngspice
solves it in batch mode, and what it gives goes to a sample that the tests of the TypeScript model
(app/src/volumes/electronics/sim/core) compare with: at the operating point the node voltages and the readings of
every part (`op`); in time, the voltages of chosen nodes and the currents of chosen parts at chosen moments and the
mean and swing of a node over a window (`tran`); for a sine, the amplitude of chosen nodes per volt of the source
(`ac`).

The deck is built from this script's own catalog — the numbers of the plan, written here again (README.md names their
sources) — never from the TypeScript: when two independent descriptions of the same parts give the same numbers, that
is the evidence. ngspice is the solver; this script only reads what it prints.

Commands (run from the repository root; ngspice is needed, /usr/bin/ngspice on this machine, nothing else):
  python3 tools/ref-models/electronics/spice.py --selftest       checks the numbers by hand: `spice selftest: OK`
  python3 tools/ref-models/electronics/spice.py --write [DIR]    writes the samples: `spice: wrote N file(s)`
  python3 tools/ref-models/electronics/spice.py --check [DIR]    solves again and compares: `spice: N fixture(s) up to
                                                                 date` (exit 0) or one `spice: <file> differs` per file
                                                                 (exit 1)
DIR is app/src/volumes/electronics/sim/core/__fixtures__ when it is left out. A sample is JSON on one line: keys sorted,
no spaces, floats with 10 significant digits, a line feed at the end. --check takes a sample as up to date when its
text is the same, or when its numbers differ from a fresh run by at most 1e-9 of their size (a last digit rounded the
other way by another build of ngspice) and everything else is the same.
"""
import argparse
import bisect
import json
import math
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

from cases import CASES

ROOT = pathlib.Path(__file__).resolve().parents[3]
FIXTURES = ROOT / 'app' / 'src' / 'volumes' / 'electronics' / 'sim' / 'core' / '__fixtures__'
NGSPICE = shutil.which('ngspice') or '/usr/bin/ngspice'

# ── The catalog: the numbers of the plan (their sources: app/src/volumes/electronics/sim/core/README.md) ──────────
WIRE_OHMS = 1e-3  # a jumper, a closed switch, the end of a pot's track
BATTERIES = {'battery-9v': (9.0, 1.5), 'battery-4aa': (6.0, 0.6), 'battery-aa': (1.5, 0.15)}  # (V, internal Ω)
SOURCES = {'ideal-9v': 9.0, 'ideal-5v': 5.0}  # ideal sources, V
POTS = {'pot-10k': 10e3}  # the whole track, Ω
LOADS = {'speaker-8': 8.0, 'earphone-32': 32.0, 'jumper': WIRE_OHMS}  # parts that are a plain resistance, Ω
E24 = (10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91)
PREFIX = {'R': 1, '': 1, 'k': 1e3, 'M': 1e6}

# Diodes and LEDs: the DC parameters of SPICE's diode — saturation current IS (A), emission coefficient N, series
# resistance RS (Ω), breakdown voltage BV (V) and the current at it IBV (A) — and, when the maker's model has one, a
# resistance across the whole part (Ω, 'leak'). Pins: anode, cathode.
DIODES = {
    # Nexperia (NXP) 1N4148, assets.nexperia.com/documents/spice-model/1N4148.txt: .SUBCKT 1N4148 1 2 /
    # R1 1 2 5.827E+9 / D1 1 2 1N4148 / .MODEL 1N4148 D IS = 4.352E-9 N = 1.906 BV = 110 IBV = 0.0001 RS = 0.6458 …
    'diode-1n4148': {'is': 4.352e-9, 'n': 1.906, 'rs': 0.6458, 'bv': 110.0, 'ibv': 1e-4, 'leak': 5.827e9},
    # Vishay (Thomatronik) d1n4007: is = 1.43733E-008 n = 1.80829 rs = 0.0414712 … bv = 1100 ibv = 10
    'diode-1n4007': {'is': 1.43733e-8, 'n': 1.80829, 'rs': 0.0414712, 'bv': 1100.0, 'ibv': 10.0},
    # 5 mm indicator LEDs fitted to the plan's forward voltage at 20 mA (the fit: README.md of the model)
    'led-red': {'is': 8.66e-18, 'n': 2.0, 'rs': 6.0, 'bv': 20.0, 'ibv': 10e-6},
    'led-yellow': {'is': 1.25e-18, 'n': 2.0, 'rs': 6.0, 'bv': 20.0, 'ibv': 10e-6},
    'led-green': {'is': 1.81e-19, 'n': 2.0, 'rs': 6.0, 'bv': 20.0, 'ibv': 10e-6},
    'led-blue': {'is': 2.45e-16, 'n': 3.5, 'rs': 10.0, 'bv': 20.0, 'ibv': 10e-6},
    'led-white': {'is': 2.45e-16, 'n': 3.5, 'rs': 10.0, 'bv': 20.0, 'ibv': 10e-6},
}
GMIN = 1e-12  # the conductance SPICE puts across every junction (S): ngspice's default gmin
VT = 1.38064852e-23 / 1.6021766208e-19 * (27 + 273.15)  # kT/q at ngspice's default 27 °C (its constants), V

# Capacitors: the capacitance C (F), the equivalent series resistance ESR (Ω) in front of it and the leak (Ω) across
# the capacitance. Pins: a, b (an electrolytic: plus, minus). The numbers and their sources: README.md of the model.
CAPACITORS = {
    # ceramic, 50 V: C0G (100 pF, 1 nF) and X7R (10 nF, 100 nF); ESR 0.03 Ω, insulation 10 GΩ
    'ceramic-100p': (100e-12, 0.03, 10e9),
    'ceramic-1n': (1e-9, 0.03, 10e9),
    'ceramic-10n': (10e-9, 0.03, 10e9),
    'ceramic-100n': (100e-9, 0.03, 10e9),
    # film, polyester, 63 V (WIMA MKS 2): insulation 10 GΩ up to 0.33 μF, 1250 s (MΩ·μF) above
    'film-100n': (100e-9, 0.03, 10e9),
    'film-1u': (1e-6, 0.03, 1.25e9),
    # aluminium electrolytic: ESR = tan δ / (2π·120 Hz·C) with tan δ 0.20 at 16 V and 0.28 at 6.3 V (Nichicon VR);
    # the leak is the rated voltage over the leakage current after 5 minutes, 0.002·C·U + 3 μA (Vishay 048 RML)
    'electrolytic-1u-16v': (1e-6, 265.3, 5.277e6),
    'electrolytic-10u-16v': (10e-6, 26.53, 4.819e6),
    'electrolytic-100u-16v': (100e-6, 2.653, 2.581e6),
    'electrolytic-470u-16v': (470e-6, 0.5644, 886.9e3),
    'electrolytic-1000u-16v': (1000e-6, 0.2653, 457.1e3),
    'electrolytic-100u-6v3': (100e-6, 3.714, 1.479e6),
}
# Sources of a sine without internal resistance: the amplitude (V) and the frequency (Hz) when the part has no
# setting; a setting is the frequency. Pins: plus, minus.
SINES = {'ideal-ac-6v': (6.0, 50.0)}

# A transient is solved with tolerances far tighter than ngspice's defaults, so that the reference is much closer to
# the true waveform than the tolerances of the tests; its largest step is the case's `step`.
TRAN_OPTIONS = 'reltol=1e-6 abstol=1e-15 vntol=1e-9'

DIGITS = 10  # significant digits of a float in a sample
CHECK_TOLERANCE = 1e-9  # --check: relative difference that still counts as the same number
CHECK_FLOOR = 1e-15  # … and absolute, for numbers near zero


def resistor_ohms(key):
    """The value of a resistor of the catalog from its letter code (IEC 60062): resistor-4R7 is 4.7 Ω, resistor-470
    470 Ω, resistor-4k7 4.7 kΩ, resistor-1M 1 MΩ. Only E24 values from 1 Ω to 10 MΩ are in the catalog."""
    match = re.fullmatch(r'resistor-(\d+)(?:([RkM])(\d)?)?', key)
    if not match:
        raise KeyError(key)
    whole, letter, tenth = match.group(1), match.group(2) or '', match.group(3) or ''
    if letter == 'R' and not tenth:
        raise KeyError(key)
    ohms = (int(whole) * 10 + int(tenth or 0)) * PREFIX[letter] / 10
    digits = ohms / 10 ** (math.floor(math.log10(ohms)) - 1)
    if not (1 <= ohms <= 10e6 and round(digits) in E24 and abs(digits - round(digits)) < 1e-9):
        raise KeyError(key)
    return ohms


def number(x):
    """A number as SPICE reads it: plain digits, never a scale letter (in SPICE «M» is milli)."""
    return repr(float(x))


def elements(k, p, charges=None):
    """The SPICE lines of the k-th part `p` and the current into each of its pins as a list of (vector, sign) terms
    (an empty list is no current). `charges`, in a transient, is the voltage every capacitor starts with by id (0 for
    one it does not name); at the operating point (None) a capacitor is open and has no initial condition."""
    spec, pins, name = p['spec'], p['pins'], str(k)
    if spec in CAPACITORS:  # ESR from the first pin to the capacitance in node n<k>, the leak across the capacitance
        farads, esr, leak = CAPACITORS[spec]
        a, b = pins
        initial = '' if charges is None else ' ic=%s' % number(charges.get(p['id'], 0.0))
        lines = ['r%s %d n%s %s' % (name, a, name, number(esr)),
                 'c%s n%s %d %s%s' % (name, name, b, number(farads), initial),
                 'r%sl n%s %d %s' % (name, name, b, number(leak))]
        current = '@r%s[i]' % name
        return lines, [[(current, 1)], [(current, -1)]]
    if spec in SINES:  # 0 V at the operating point, 1 V in an AC analysis, the sine in time
        amplitude, hertz = SINES[spec]
        plus, minus = pins
        hertz = max(p.get('setting', hertz), 0.0)
        line = 'v%s %d %d dc 0 ac 1 sin(0 %s %s)' % (name, plus, minus, number(amplitude), number(hertz))
        return [line], [[('v%s#branch' % name, 1)], [('v%s#branch' % name, -1)]]
    if spec in BATTERIES:  # the ideal source behind its internal resistance, inside node n<k>
        volts, ohms = BATTERIES[spec]
        plus, minus = pins
        lines = ['r%s %d n%s %s' % (name, plus, name, number(ohms)),
                 'v%s n%s %d dc %s' % (name, name, minus, number(volts))]
        return lines, [[('v%s#branch' % name, 1)], [('v%s#branch' % name, -1)]]
    if spec in SOURCES:
        plus, minus = pins
        return ['v%s %d %d dc %s' % (name, plus, minus, number(SOURCES[spec]))], [
            [('v%s#branch' % name, 1)], [('v%s#branch' % name, -1)]]
    if spec in POTS:  # two parts of the track, each at least a wire
        ccw, wiper, cw = pins
        setting = min(max(p.get('setting', 0.5), 0.0), 1.0)
        lower = max(setting * POTS[spec], WIRE_OHMS)
        upper = max((1 - setting) * POTS[spec], WIRE_OHMS)
        a, b = '@r%sa[i]' % name, '@r%sb[i]' % name
        lines = ['r%sa %d %d %s' % (name, ccw, wiper, number(lower)),
                 'r%sb %d %d %s' % (name, wiper, cw, number(upper))]
        return lines, [[(a, 1)], [(a, -1), (b, 1)], [(b, -1)]]
    if spec in DIODES:  # a probe of 0 V in front of the anode measures the current (the leak's too); the diode has a
        # model of its own
        anode, cathode = pins
        d = DIODES[spec]
        lines = ['v%sp %d n%sa dc 0' % (name, anode, name),
                 'd%s n%sa %d m%s' % (name, name, cathode, name),
                 '.model m%s d (is=%s n=%s rs=%s bv=%s ibv=%s)' % (
                     name, number(d['is']), number(d['n']), number(d['rs']), number(d['bv']), number(d['ibv']))]
        if 'leak' in d:
            lines.append('r%sl n%sa %d %s' % (name, name, cathode, number(d['leak'])))
        probe = 'v%sp#branch' % name
        return lines, [[(probe, 1)], [(probe, -1)]]
    if spec == 'switch':
        if p.get('setting', 0) < 0.5:  # open: no element at all
            return [], [[], []]
        ohms = WIRE_OHMS
    elif spec in LOADS:
        ohms = LOADS[spec]
    else:
        ohms = resistor_ohms(spec)
    a, b = pins
    current = '@r%s[i]' % name
    return ['r%s %d %d %s' % (name, a, b, number(ohms))], [[(current, 1)], [(current, -1)]]


def circuit(netlist, charges=None):
    """(the element lines of the netlist, the nodes they use but the ground, the pin currents of every part as in
    `elements`)."""
    body, currents, nodes = [], [], set()
    for k, p in enumerate(netlist['parts']):
        lines, pins = elements(k, p, charges)
        body += lines
        currents.append(pins)
        for line in lines:
            nodes.update(int(token) for token in line.split()[1:3] if token.isdigit())
    nodes.discard(0)
    return body, sorted(nodes), currents


def deck(name, netlist):
    """(the lines of the deck at the operating point, the nodes it prints, the pin currents of every part)."""
    body, nodes, currents = circuit(netlist)
    vectors = ['v(%d)' % n for n in nodes]
    vectors += sorted({vector for pins in currents for pin in pins for vector, _ in pin})
    lines = ['* electronics oracle: %s' % name, '.options savecurrents', *body, '.control', 'set numdgt=17', 'op',
             'print ' + ' '.join(vectors), '.endc', '.end']
    return lines, nodes, currents


WAVEFORMS = 'tran.txt'  # the file a transient deck writes its waveforms to (wrdata), in ngspice's directory


def run(lines, read=None):
    """Runs ngspice on the deck in a directory of its own (no .spiceinit of the user is read) and returns
    {vector: value} of what it printed, and the text of the file `read` it wrote there when one is named."""
    with tempfile.TemporaryDirectory() as work:
        path = pathlib.Path(work) / 'deck.cir'
        path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        done = subprocess.run([NGSPICE, '-b', str(path)], cwd=work, env=dict(os.environ, HOME=work),
                              capture_output=True, text=True, timeout=120)
        written = pathlib.Path(work) / read if read else None
        text = written.read_text(encoding='utf-8') if written is not None and written.is_file() else None
    printed = {}
    for line in done.stdout.splitlines():
        match = re.fullmatch(r'\s*(\S+)\s*=\s*([-+0-9.eE]+)\s*', line)
        if match:
            printed[match.group(1).lower()] = float(match.group(2))
    if done.returncode != 0 or re.search(r'(?im)^\s*error', done.stdout + done.stderr):
        raise RuntimeError('ngspice failed (exit %d):\n%s%s' % (done.returncode, done.stdout, done.stderr))
    if read and text is None:
        raise RuntimeError('ngspice wrote no %s:\n%s%s' % (read, done.stdout, done.stderr))
    return (printed, text) if read else printed


def solve(name, case):
    """The sample of one case of cases.py, by its analysis: a plain netlist is an operating point."""
    analysis = case.get('analysis', 'op')
    if analysis == 'tran':
        return solve_tran(name, case)
    if analysis == 'ac':
        return solve_ac(name, case)
    return solve_op(name, case)


def solve_op(name, netlist):
    """The sample of an operating point: the netlist, the deck, the node voltages and the readings of every part, the
    same readings the model gives: u from the first pin to the second, i into the first pin, p the power the part
    takes (the sum over its pins of the voltage against the last pin times the current into the pin)."""
    lines, nodes, currents = deck(name, netlist)
    printed = run(lines)
    wanted = ['v(%d)' % n for n in nodes] + [vector for pins in currents for pin in pins for vector, _ in pin]
    missing = [vector for vector in wanted if vector.lower() not in printed]
    if missing:
        raise RuntimeError('ngspice did not print %s for %s' % (', '.join(missing), name))
    v = [0.0] * netlist['nodes']
    for n in nodes:
        v[n] = printed['v(%d)' % n]
    parts = {}
    for p, pins in zip(netlist['parts'], currents):
        into = [float(sum(sign * printed[vector.lower()] for vector, sign in pin)) for pin in pins]
        at = [v[node] for node in p['pins']]
        power = sum((at[k] - at[-1]) * into[k] for k in range(len(at) - 1))
        parts[p['id']] = {'u': at[0] - at[1], 'i': into[0], 'p': power}
    return {'analysis': 'op', 'case': name, 'netlist': netlist, 'spice': lines, 'v': v, 'parts': parts}


def waveforms(text):
    """{vector: [values]} and the times of what `wrdata` wrote: a header of names, then one row per time point."""
    rows = [line.split() for line in text.splitlines() if line.strip()]
    names = [name.lower() for name in rows[0]]
    columns = {name: [float(row[k]) for row in rows[1:]] for k, name in enumerate(names)}
    return columns.pop('time'), columns


def interpolate(times, values, t):
    """The waveform at the moment `t`, linear between ngspice's time points."""
    j = bisect.bisect_left(times, t)
    if j < len(times) and times[j] == t:
        return values[j]
    if j == 0 or j == len(times):
        raise RuntimeError('ngspice gave no time point around %r s' % t)
    share = (t - times[j - 1]) / (times[j] - times[j - 1])
    return values[j - 1] + share * (values[j] - values[j - 1])


def window_of(times, values, start, stop):
    """(mean, swing) of the waveform from `start` to `stop`: its integral over the window (by trapezoids between
    ngspice's time points) over the window's length, and its largest value less its smallest."""
    points = [(start, interpolate(times, values, start))]
    points += [(t, x) for t, x in zip(times, values) if start < t < stop]
    points.append((stop, interpolate(times, values, stop)))
    area = sum((t1 - t0) * (x0 + x1) / 2 for (t0, x0), (t1, x1) in zip(points, points[1:]))
    level = [x for _, x in points]
    return area / (stop - start), max(level) - min(level)


def solve_tran(name, case):
    """The sample of a transient from t = 0, every capacitor starting at its voltage in `charges` (0 when the case
    does not name it; the model's start 'zero' when none is named, else its start 'state'), with ngspice's step at
    most `step`: the voltage of every node of `nodes` and the current into the first pin of every part of `parts` at
    each of `times`, and over `window` (when given) the mean and the swing of every node of `nodes`."""
    netlist, charges = case['netlist'], case['charges']
    body, _, currents = circuit(netlist, charges)
    pins = {p['id']: pin for p, pin in zip(netlist['parts'], currents)}
    vectors = ['v(%d)' % n for n in case['nodes']]
    vectors += sorted({vector for id in case['parts'] for vector, _ in pins[id][0]} - set(vectors))
    lines = ['* electronics oracle: %s' % name, '.options savecurrents %s' % TRAN_OPTIONS, *body, '.control',
             'set wr_singlescale', 'set wr_vecnames', 'option numdgt=17',
             'tran %s %s 0 %s uic' % (number(case['step']), number(case['stop']), number(case['step'])),
             'wrdata %s %s' % (WAVEFORMS, ' '.join(vectors)), '.endc', '.end']
    _, text = run(lines, read=WAVEFORMS)
    times, columns = waveforms(text)
    missing = [vector for vector in vectors if vector.lower() not in columns]
    if missing:
        raise RuntimeError('ngspice did not write %s for %s' % (', '.join(missing), name))
    node = {n: columns['v(%d)' % n] for n in case['nodes']}
    into = {id: [sum(sign * columns[vector.lower()][row] for vector, sign in pins[id][0]) for row in range(len(times))]
            for id in case['parts']}
    sample = {'analysis': 'tran', 'case': name, 'netlist': netlist, 'spice': lines, 'start': case['start'],
              'charges': charges, 'step': case['step'], 'stop': case['stop'], 'times': case['times'],
              'v': {str(n): [interpolate(times, node[n], t) for t in case['times']] for n in case['nodes']},
              'i': {id: [interpolate(times, into[id], t) for t in case['times']] for id in case['parts']},
              'window': case['window'], 'mean': {}, 'swing': {}}
    if case['window']:
        for n in case['nodes']:
            mean, swing = window_of(times, node[n], *case['window'])
            sample['mean'][str(n)] = mean
            sample['swing'][str(n)] = swing
    return sample


def solve_ac(name, case):
    """The sample of an AC analysis: the source `source` gives 1 V, and the amplitude of every node of `nodes` at each
    of `frequencies` is its gain — what a sine of any amplitude comes out as, per volt."""
    netlist = case['netlist']
    if not any(p['id'] == case['source'] and p['spec'] in SINES for p in netlist['parts']):
        raise RuntimeError('%s: the source %s is not a sine of the catalog' % (name, case['source']))
    body, _, _ = circuit(netlist)
    control = []
    for j, hertz in enumerate(case['frequencies']):
        names = ['g%dn%d' % (j, n) for n in case['nodes']]
        control += ['ac lin 1 %s %s' % (number(hertz), number(hertz))]
        control += ['let %s = mag(v(%d))' % (g, n) for g, n in zip(names, case['nodes'])]
        control += ['print ' + ' '.join(names)]
    lines = ['* electronics oracle: %s' % name, '.options savecurrents', *body, '.control', 'set numdgt=17',
             *control, '.endc', '.end']
    printed = run(lines)
    gain = {}
    for n in case['nodes']:
        keys = ['g%dn%d' % (j, n) for j in range(len(case['frequencies']))]
        if any(key not in printed for key in keys):
            raise RuntimeError('ngspice did not print the gain of node %d for %s' % (n, name))
        gain[str(n)] = [printed[key] for key in keys]
    return {'analysis': 'ac', 'case': name, 'netlist': netlist, 'spice': lines, 'source': case['source'],
            'frequencies': case['frequencies'], 'gain': gain}


# ── The samples ──────────────────────────────────────────────────────────────────────────────────────────────────────
def rounded(x):
    """The same structure with every float rounded to DIGITS significant digits; whole numbers and text pass."""
    if isinstance(x, dict):
        return {key: rounded(value) for key, value in x.items()}
    if isinstance(x, (list, tuple)):
        return [rounded(value) for value in x]
    if isinstance(x, float):
        return float('%.*g' % (DIGITS, x)) + 0.0  # + 0.0 turns −0.0 into 0.0
    if isinstance(x, (int, str)) and not isinstance(x, bool):
        return x
    raise TypeError('no rule for %r in a sample' % type(x))


def dump(data):
    return json.dumps(rounded(data), sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n'


def write(directory):
    directory = pathlib.Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for name, netlist in CASES.items():
        (directory / ('%s.json' % name)).write_text(dump(solve(name, netlist)), encoding='utf-8', newline='\n')
    return len(CASES)


def same(have, fresh):
    """Whether two read samples agree: the same keys, lengths, text and whole numbers; floats within CHECK_TOLERANCE."""
    if isinstance(have, dict) and isinstance(fresh, dict):
        return have.keys() == fresh.keys() and all(same(have[key], fresh[key]) for key in have)
    if isinstance(have, list) and isinstance(fresh, list):
        return len(have) == len(fresh) and all(same(a, b) for a, b in zip(have, fresh))
    if isinstance(have, float) or isinstance(fresh, float):
        if isinstance(have, bool) or isinstance(fresh, bool) or not isinstance(have, (int, float)) or not isinstance(
                fresh, (int, float)):
            return False
        return abs(have - fresh) <= CHECK_TOLERANCE * max(abs(have), abs(fresh)) + CHECK_FLOOR
    return type(have) is type(fresh) and have == fresh


def check(directory):
    """Names of the samples in `directory` that are not what this script writes now (a missing file differs too)."""
    directory = pathlib.Path(directory)
    differ = []
    for name, netlist in CASES.items():
        path = directory / ('%s.json' % name)
        fresh = dump(solve(name, netlist))
        if not path.is_file():
            differ.append(path.name)
            continue
        text = path.read_text(encoding='utf-8')
        try:
            if text != fresh and not same(json.loads(text), json.loads(fresh)):
                differ.append(path.name)
        except ValueError:
            differ.append(path.name)
    return differ


# ── The self-test: numbers by hand ───────────────────────────────────────────────────────────────────────────────────
def near(have, want, tolerance, what):
    assert abs(have - want) <= tolerance, '%s: %r, expected %r (± %g)' % (what, have, want, tolerance)


def selftest():
    if not __debug__:
        sys.exit('spice: the self-test is made of assert statements; run it without -O')
    # the letter codes of the catalog
    for key, ohms in (('resistor-1', 1), ('resistor-4R7', 4.7), ('resistor-470', 470), ('resistor-1k', 1e3),
                      ('resistor-2k2', 2.2e3), ('resistor-4k7', 4.7e3), ('resistor-47k', 47e3), ('resistor-1M', 1e6),
                      ('resistor-9M1', 9.1e6), ('resistor-10M', 10e6)):
        near(resistor_ohms(key), ohms, 1e-9 * ohms, key)
    for bad in ('resistor-1234', 'resistor-4R', 'resistor-20M', 'resistor-1k23', 'resistor-0R5', 'jumper'):
        try:
            resistor_ohms(bad)
        except KeyError:
            continue
        raise AssertionError('%s is not in the catalog' % bad)

    # the divider: 6 V; 3 mA, which the source gives out (the current into its plus pin is negative)
    divider = solve('divider', CASES['divider'])
    near(divider['v'][2], 6.0, 1e-9, 'divider: middle')
    near(divider['parts']['V1']['i'], -3e-3, 1e-12, 'divider: the source')
    near(divider['parts']['R2']['p'], 18e-3, 1e-12, 'divider: R2 takes 18 mW')
    # each battery on 100 Ω: E / (r + 100)
    load = solve('battery-load', CASES['battery-load'])
    for battery, resistor, node, (volts, ohms) in (('B1', 'R1', 1, BATTERIES['battery-9v']),
                                                    ('B2', 'R2', 2, BATTERIES['battery-4aa']),
                                                    ('B3', 'R3', 3, BATTERIES['battery-aa'])):
        current = volts / (ohms + 100)
        near(load['parts'][resistor]['i'], current, 1e-12, '%s: current' % battery)
        near(load['parts'][battery]['i'], -current, 1e-12, '%s: into the plus pin' % battery)
        near(load['v'][node], current * 100, 1e-9, '%s: terminals' % battery)
    # the pot in the middle with 4.7 kΩ on the wiper
    middle = solve('pot-mid', CASES['pot-mid'])
    lower = 5000 * 4700 / 9700
    near(middle['v'][2], 9 * lower / (1.5 + 5000 + lower), 1e-9, 'pot-mid: wiper')
    # the switches: nothing behind the open one; 6 V into 8 Ω beside 32 + 100 Ω through 1 + 1 mΩ
    switches = solve('speaker-switch', CASES['speaker-switch'])
    near(switches['parts']['R2']['i'], 0, 1e-15, 'behind the open switch')
    near(switches['parts']['S2']['i'], 0, 0, 'the open switch')
    load = 8 * 132 / 140
    near(switches['parts']['S1']['i'], 6 / (0.6 + 2e-3 + load), 1e-12, 'the closed switch')
    # a diode is SPICE's: the junction takes IS·(e^(vd/(N·Vt)) − 1) + GMIN·vd, and RS stands in front of it. The red
    # LED from the 9 V battery through 330 Ω: about 21 mA, and the loop's voltages add up to 9 V
    leds = solve('led-red', CASES['led-red'])
    red = DIODES['led-red']
    current, across = leds['parts']['D1']['i'], leds['parts']['D1']['u']
    junction = across - current * red['rs']
    near(red['is'] * math.expm1(junction / (red['n'] * VT)) + GMIN * junction, current, 1e-9 * current,
         'led-red: Shockley')
    near(9 - current * (1.5 + 330), across, 1e-9, 'led-red: the loop')
    near(current, 21.2e-3, 0.1e-3, 'led-red: about 21 mA')
    # 1N4148 from 5 V through 430 Ω: about 10 mA (9.93) at about 0.728 V, the loop's voltages adding up to 5 V
    forward = solve('diode-forward', CASES['diode-forward'])
    near(forward['parts']['D2']['i'], 9.93e-3, 0.01e-3, '1N4148 at about 10 mA')
    near(forward['parts']['D2']['u'], 0.728, 0.001, '1N4148: its voltage at about 10 mA')
    near(5 - forward['parts']['D2']['i'] * 430, forward['parts']['D2']['u'], 1e-9, '1N4148: the loop')
    # the wrong way round: SPICE's reverse region below −3·N·Vt, −IS·(1 + (3·N·Vt / (e·vd))³) + GMIN·vd, and the
    # current of the leak across the part — nanoamperes
    reverse = solve('diode-reverse', CASES['diode-reverse'])
    for diode, spec in (('D1', 'diode-1n4148'), ('D2', 'diode-1n4007'), ('D3', 'led-red')):
        d = DIODES[spec]
        current, across = reverse['parts'][diode]['i'], reverse['parts'][diode]['u']
        leak = across / d['leak'] if 'leak' in d else 0.0
        junction = across - (current - leak) * d['rs']
        cubic = (3 * d['n'] * VT / (junction * math.e)) ** 3
        near(current, -d['is'] * (1 + cubic) + GMIN * junction + leak, 1e-6 * abs(current), '%s reversed' % spec)
        assert -1e-6 < current < 0 and across < -8.99, '%s reversed: %r A at %r V' % (spec, current, across)
    # the fit of the LEDs: the forward voltage at 20 mA, IS·(e^(v/(N·Vt)) − 1) = 20 mA, lies in the plan's window
    for spec, (low, high) in (('led-red', (1.9, 2.0)), ('led-yellow', (2.0, 2.1)), ('led-green', (2.1, 2.2)),
                              ('led-blue', (3.0, 3.2)), ('led-white', (3.0, 3.2))):
        d = DIODES[spec]
        volts = d['n'] * VT * math.log1p(20e-3 / d['is']) + 20e-3 * d['rs']
        assert low <= volts <= high, '%s: %.4f V at 20 mA, outside %g … %g V' % (spec, volts, low, high)
    # capacitors in time, against the formulas of an RC circuit with the capacitor's ESR and leak
    farads, esr, leak = CAPACITORS['electrolytic-100u-16v']
    volts, ohms = BATTERIES['battery-9v']
    parallel = lambda a, b: a * b / (a + b)
    charge = solve('rc-charge', CASES['rc-charge'])
    loop = ohms + 10e3 + esr  # the battery, the resistor and the ESR in series; the leak across the capacitance
    final, tau = volts * leak / (leak + loop), farads * parallel(loop, leak)
    for t, node, into in zip(charge['times'], charge['v']['2'], charge['i']['C1']):
        inside = final * -math.expm1(-t / tau)  # the voltage across the capacitance
        current = (volts - inside) / loop
        near(node, inside + esr * current, 1e-6 * node, 'rc-charge at %g s' % t)
        near(into, current, 1e-5 * current, 'rc-charge: the current at %g s' % t)
    near(charge['v']['2'][3] / volts, -math.expm1(-1), 0.005, 'rc-charge: 63.2 % of 9 V after R·C = 1 s')
    discharge = solve('rc-discharge', CASES['rc-discharge'])
    tau = farads * parallel(10e3 + esr, leak)
    for t, node in zip(discharge['times'], discharge['v']['1']):
        near(node, 9 * math.exp(-t / tau) * 10e3 / (10e3 + esr), 1e-6 * node, 'rc-discharge at %g s' % t)
    near(discharge['v']['1'][3] / 9, math.exp(-1), 0.005, 'rc-discharge: 36.8 % after R·C = 1 s')
    # the LED fades: the current out of the capacitor is the LED's, and it only falls
    fading = solve('led-discharge', CASES['led-discharge'])
    current = fading['i']['D1']
    for k, (led, cap) in enumerate(zip(current, fading['i']['C1'])):
        near(led, -cap, 1e-9 * led, 'led-discharge: the loop at %g s' % fading['times'][k])
    assert all(a > b > 0 for a, b in zip(current, current[1:])), 'led-discharge: the current falls'
    assert 15e-3 < current[0] < 21e-3 and 0.5e-3 < current[-1] < 2e-3, current
    # the filters: the low-pass gives Z / (R + Z), the high-pass R / (R + Z), Z the capacitor with ESR and leak
    farads, esr, leak = CAPACITORS['film-100n']
    filters = solve('filters', CASES['filters'])
    for k, hertz in enumerate(filters['frequencies']):
        z = esr + 1 / (1 / leak + 2j * math.pi * hertz * farads)
        near(filters['gain']['2'][k], abs(z / (1e3 + z)), 1e-9, 'low-pass at %g Hz' % hertz)
        near(filters['gain']['3'][k], abs(1e3 / (1e3 + z)), 1e-9, 'high-pass at %g Hz' % hertz)
    # the rectifier: the peak less a diode's drop, the ripple about I / (f·C)
    rectifier = solve('rectifier', CASES['rectifier'])
    mean, swing = rectifier['mean']['2'], rectifier['swing']['2']
    assert 4.5 < mean < 5.5 and 0.5 * mean / 1e3 / 50 / 470e-6 < swing < 1.5 * mean / 1e3 / 50 / 470e-6, (mean, swing)

    # every case has a deck ngspice solves, and a sample on one line
    for name, case in CASES.items():
        text = dump(solve(name, case))
        data = json.loads(text)
        assert text.endswith('\n') and text.count('\n') == 1, name
        assert json.dumps(data, sort_keys=True, separators=(',', ':')) + '\n' == text, name
        netlist = case.get('netlist', case)
        assert data['netlist'] == netlist and data['analysis'] == case.get('analysis', 'op'), name
        if data['analysis'] == 'op':
            assert sorted(data['parts']) == sorted(p['id'] for p in netlist['parts']), name
            assert len(data['v']) == netlist['nodes'] and data['v'][0] == 0, name
        elif data['analysis'] == 'tran':
            assert all(len(series) == len(case['times']) for series in [*data['v'].values(), *data['i'].values()])
            assert sorted(data['mean']) == (sorted(data['v']) if case['window'] else []), name
        else:
            assert all(len(gain) == len(case['frequencies']) for gain in data['gain'].values()), name
    # --check: a last digit rounded the other way passes, a real change does not
    text = dump(divider)
    data = json.loads(text)
    nudged = json.loads(text)
    nudged['v'][2] *= 1 + 5e-10
    assert same(nudged, data), 'a number 5e-10 away'
    nudged['v'][2] *= 1 + 5e-9
    assert not same(nudged, data), 'a number 5e-9 away'
    nudged = json.loads(text)
    nudged['netlist']['parts'][1]['spec'] = 'resistor-1k1'
    assert not same(nudged, data), 'another part'
    nudged = json.loads(text)
    del nudged['parts']['R1']
    assert not same(nudged, data), 'a reading missing'
    print('spice selftest: OK')


def main():
    parser = argparse.ArgumentParser(description='Reference of the circuit model: the cases through ngspice.')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--selftest', action='store_true', help='check the numbers by hand')
    mode.add_argument('--write', metavar='DIR', nargs='?', const=str(FIXTURES), help='write the samples to DIR')
    mode.add_argument('--check', metavar='DIR', nargs='?', const=str(FIXTURES),
                      help='compare the samples in DIR with a fresh run')
    args = parser.parse_args()
    if not pathlib.Path(NGSPICE).is_file():
        print('spice: ngspice not found (%s)' % NGSPICE)
        return 2
    if args.selftest:
        selftest()
    elif args.write is not None:
        print('spice: wrote %d file(s)' % write(args.write))
    else:
        differ = check(args.check)
        for name in differ:
            print('spice: %s differs' % name)
        if differ:
            return 1
        print('spice: %d fixture(s) up to date' % len(CASES))
    return 0


if __name__ == '__main__':
    sys.exit(main())
