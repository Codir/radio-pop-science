#!/usr/bin/env python3
"""Reference of the circuit model of the electronics volume: every case of cases.py becomes a SPICE deck, ngspice
solves it in batch mode, and the node voltages and the readings of every part go to a sample that the tests of the
TypeScript model (app/src/volumes/electronics/sim/core) compare with.

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
SOURCES = {'ideal-9v': 9.0}  # ideal sources, V
POTS = {'pot-10k': 10e3}  # the whole track, Ω
LOADS = {'speaker-8': 8.0, 'earphone-32': 32.0, 'jumper': WIRE_OHMS}  # parts that are a plain resistance, Ω
E24 = (10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91)
PREFIX = {'R': 1, '': 1, 'k': 1e3, 'M': 1e6}

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


def elements(k, p):
    """The SPICE lines of the k-th part `p` and the current into each of its pins as a list of (vector, sign) terms
    (an empty list is no current)."""
    spec, pins, name = p['spec'], p['pins'], str(k)
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


def deck(name, netlist):
    """(the lines of the deck, the nodes it prints, the pin currents of every part as in `elements`)."""
    body, currents, nodes = [], [], set()
    for k, p in enumerate(netlist['parts']):
        lines, pins = elements(k, p)
        body += lines
        currents.append(pins)
        for line in lines:
            nodes.update(int(token) for token in line.split()[1:3] if token.isdigit())
    nodes.discard(0)
    vectors = ['v(%d)' % n for n in sorted(nodes)]
    vectors += sorted({vector for pins in currents for pin in pins for vector, _ in pin})
    lines = ['* electronics oracle: %s' % name, '.options savecurrents', *body, '.control', 'set numdgt=17', 'op',
             'print ' + ' '.join(vectors), '.endc', '.end']
    return lines, sorted(nodes), currents


def run(lines):
    """Runs ngspice on the deck in a directory of its own (no .spiceinit of the user is read) and returns
    {vector: value} of what it printed."""
    with tempfile.TemporaryDirectory() as work:
        path = pathlib.Path(work) / 'deck.cir'
        path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        done = subprocess.run([NGSPICE, '-b', str(path)], cwd=work, env=dict(os.environ, HOME=work),
                              capture_output=True, text=True, timeout=60)
    printed = {}
    for line in done.stdout.splitlines():
        match = re.fullmatch(r'\s*(\S+)\s*=\s*([-+0-9.eE]+)\s*', line)
        if match:
            printed[match.group(1).lower()] = float(match.group(2))
    if done.returncode != 0 or re.search(r'(?im)^\s*error', done.stdout + done.stderr):
        raise RuntimeError('ngspice failed (exit %d):\n%s%s' % (done.returncode, done.stdout, done.stderr))
    return printed


def solve(name, netlist):
    """The sample of one case: the netlist, the deck, the node voltages and the readings of every part, the same
    readings the model gives: u from the first pin to the second, i into the first pin, p the power the part takes
    (the sum over its pins of the voltage against the last pin times the current into the pin)."""
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
    # every case has a deck ngspice solves, and a sample on one line
    for name, netlist in CASES.items():
        text = dump(solve(name, netlist))
        data = json.loads(text)
        assert text.endswith('\n') and text.count('\n') == 1, name
        assert json.dumps(data, sort_keys=True, separators=(',', ':')) + '\n' == text, name
        assert data['netlist'] == netlist and sorted(data['parts']) == sorted(p['id'] for p in netlist['parts']), name
        assert len(data['v']) == netlist['nodes'] and data['v'][0] == 0, name
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
