#!/usr/bin/env python3
"""Reference of the circuit model of the electronics volume: every case of cases.py becomes a SPICE deck, ngspice
solves it in batch mode, and what it gives goes to a sample that the tests of the TypeScript model
(app/src/volumes/electronics/sim/core) compare with: at the operating point the node voltages and the readings of
every part (`op`); in time, the voltages of chosen nodes and the currents of chosen parts at chosen moments and the
mean, the swing and the amplitude of a frequency of a node over a window (`tran`); for a sine, the amplitude of chosen
nodes per volt of the source (`ac`). amplifier.py, beside it, compares the amplifiers the volume could have chosen.

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
# Sources of a sine: the amplitude (V), the frequency (Hz) when the part has no setting — a setting is the frequency —
# and the internal resistance (Ω; 0 for an ideal source). Pins: plus, minus.
SINES = {
    'ideal-ac-6v': (6.0, 50.0, 0.0),
    # the player's level and internal resistance (the plan: 0.3 V amplitude behind 32 Ω) as a test tone of 1 kHz
    'player-tone': (0.3, 1000.0, 32.0),
}

# Bipolar transistors: the part of SPICE's Gummel–Poon model that the model takes, the transport form of Ebers–Moll
# with the Early effect — the saturation current IS (A), the forward and reverse current gains BF and BR, the forward
# Early voltage VAF (V); NF = NR = 1 and every other parameter at its default (none of RB, RC, RE, ISE, ISC, IKF, IKR,
# VAR, capacitances). The decks take exactly these, so that the model and ngspice solve the same equations; 'vendor'
# is the maker's whole model, which only amplifier.py runs (README.md of the model: how far the two are apart). Pins:
# collector, base, emitter.
TRANSISTORS = {
    # Philips Semiconductors, «SPICE Parameter Library for PHILIPS' Low Frequency Small Signal Transistors»
    # (phil_bjt.lib, revision 1.0 of 21 Nov 1996, for MicroSim PSpice): .MODEL QBC547B/PLP NPN
    'transistor-bc547b': {
        'type': 'npn', 'is': 2.39e-14, 'bf': 294.3, 'br': 7.946, 'vaf': 63.2,
        'vendor': 'IS=2.39E-14 NF=1.008 ISE=3.545E-15 NE=1.541 BF=294.3 IKF=0.1357 VAF=63.2 NR=1.004 ISC=6.272E-14 '
                  'NC=1.243 BR=7.946 IKR=0.1144 VAR=25.9 RB=1 IRB=1E-06 RBM=1 RE=0.4683 RC=0.85 XTB=0 EG=1.11 XTI=3 '
                  'CJE=1.358E-11 VJE=0.65 MJE=0.3279 TF=4.391E-10 XTF=120 VTF=2.643 ITF=0.7495 PTF=0 CJC=3.728E-12 '
                  'VJC=0.3997 MJC=0.2955 XCJC=0.6193 TR=1E-32 CJS=0 VJS=0.75 MJS=0.333 FC=0.9579'},
    # the same library: .MODEL QBC557B/PLP PNP
    'transistor-bc557b': {
        'type': 'pnp', 'is': 3.834e-14, 'bf': 344.4, 'br': 14.84, 'vaf': 21.11,
        'vendor': 'IS=3.834E-14 NF=1.008 ISE=1.219E-14 NE=1.528 BF=344.4 IKF=0.08039 VAF=21.11 NR=1.005 '
                  'ISC=2.852E-13 NC=1.28 BR=14.84 IKR=0.047 VAR=32.02 RB=1 IRB=1E-06 RBM=1 RE=0.6202 RC=0.5713 XTB=0 '
                  'EG=1.11 XTI=3 CJE=1.23E-11 VJE=0.6106 MJE=0.378 TF=5.595E-10 XTF=3.414 VTF=5.23 ITF=0.1483 PTF=0 '
                  'CJC=1.084E-11 VJC=0.1022 MJC=0.3563 XCJC=0.6288 TR=1E-32 CJS=0 VJS=0.75 MJS=0.333 FC=0.8027'},
    # Fairchild Semiconductor, datasheet «2N3904 / MMBT3904 / PZT3904» (2001, Rev A), «Spice Model» — its Ise=6.734
    # misses the f of femto (the same model elsewhere, PSpice's eval.lib: Ise=6.734f), taken here with it
    'transistor-2n3904': {
        'type': 'npn', 'is': 6.734e-15, 'bf': 416.4, 'br': 0.7371, 'vaf': 74.03,
        'vendor': 'Is=6.734f Xti=3 Eg=1.11 Vaf=74.03 Bf=416.4 Ne=1.259 Ise=6.734f Ikf=66.78m Xtb=1.5 Br=.7371 Nc=2 '
                  'Isc=0 Ikr=0 Rc=1 Cjc=3.638p Mjc=.3085 Vjc=.75 Fc=.5 Cje=4.493p Mje=.2593 Vje=.75 Tr=239.5n '
                  'Tf=301.2p Itf=.4 Vtf=4 Xtf=2 Rb=10'},
    # Fairchild Semiconductor, datasheet «2N3906 / MMBT3906 / PZT3906» (2001, Rev A), «Spice Model»
    'transistor-2n3906': {
        'type': 'pnp', 'is': 1.41e-15, 'bf': 180.7, 'br': 4.977, 'vaf': 18.7,
        'vendor': 'Is=1.41f Xti=3 Eg=1.11 Vaf=18.7 Bf=180.7 Ne=1.5 Ise=0 Ikf=80m Xtb=1.5 Br=4.977 Nc=2 Isc=0 Ikr=0 '
                  'Rc=2.5 Cjc=9.728p Mjc=.5776 Vjc=.75 Fc=.5 Cje=8.063p Mje=.3677 Vje=.75 Tr=33.42n Tf=179.3p Itf=.4 '
                  'Vtf=4 Xtf=6 Rb=10'},
    # the output pair of the amplifier (E1-6, fix round 1: 2N3904 / 2N3906 pass more than their 200 mA there).
    # Philips' library above: .MODEL QBC337-25/PLP NPN
    'transistor-bc337-25': {
        'type': 'npn', 'is': 4.13e-14, 'bf': 292.4, 'br': 23.68, 'vaf': 145.7,
        'vendor': 'IS=4.13E-14 NF=0.9822 ISE=3.534E-15 NE=1.35 BF=292.4 IKF=0.9 VAF=145.7 NR=0.982 ISC=1.957E-13 '
                  'NC=1.3 BR=23.68 IKR=0.1 VAR=20 RB=60 IRB=0.0002 RBM=8 RE=0.1129 RC=0.25 XTB=0 EG=1.11 XTI=3 '
                  'CJE=3.799E-11 VJE=0.6752 MJE=0.3488 TF=5.4E-10 XTF=4 VTF=4.448 ITF=0.665 PTF=90 CJC=1.355E-11 '
                  'VJC=0.3523 MJC=0.3831 XCJC=0.455 TR=3E-08 CJS=0 VJS=0.75 MJS=0.333 FC=0.643'},
    # Philips' BC327-25 as LTspice's standard.bjt carries it («mfg=Philips»; phil_bjt.lib has no BC327), read from
    # LTwiki's copy and from the KiCad SPICE library's Models/Transistor/BJT/BJT.lib
    'transistor-bc327-25': {
        'type': 'pnp', 'is': 1.08e-13, 'bf': 385.7, 'br': 20.57, 'vaf': 31.29,
        'vendor': 'IS=1.08E-13 NF=0.99 ISE=2.713E-14 NE=1.4 BF=385.7 IKF=0.3603 VAF=31.29 NR=0.9849 ISC=5.062E-13 '
                  'NC=1.295 BR=20.57 IKR=0.054 VAR=11.62 RB=1 IRB=1.00E-06 RBM=0.5 RE=0.1415 RC=0.2623 XTB=0 EG=1.11 '
                  'XTI=3 CJE=5.114E-11 VJE=0.8911 MJE=0.4417 TF=7.359E-10 XTF=1.859 VTF=3.813 ITF=0.4393 PTF=0 '
                  'CJC=2.656E-11 VJC=0.62 MJC=0.4836 XCJC=0.459 TR=5.00E-08 CJS=0 VJS=0.75 MJS=0.333 FC=0.99'},
}

# A transient is solved with tolerances far tighter than ngspice's defaults, so that the reference is much closer to
# the true waveform than the tolerances of the tests; its largest step is the case's `step`. So is the operating point
# of a circuit with a transistor: with the defaults (RELTOL 1e-3 of the largest voltage) ngspice leaves a node that only
# leakage holds — the collector of a transistor that is off — up to 0.6 mV from where its equations put it, 8.8e-4 of
# the voltage of the LED before it, too near the oracle's tolerance of 1e-3.
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


def elements(k, p, charges=None, vendor=False):
    """The SPICE lines of the k-th part `p` and the current into each of its pins as a list of (vector, sign) terms
    (an empty list is no current). `charges`, in a transient, is the voltage every capacitor starts with by id (0 for
    one it does not name); at the operating point (None) a capacitor is open and has no initial condition. `vendor`
    gives a transistor its maker's whole model instead of the part the model takes (amplifier.py only)."""
    spec, pins, name = p['spec'], p['pins'], str(k)
    if spec in TRANSISTORS:  # a probe of 0 V in front of every pin measures its current
        t = TRANSISTORS[spec]
        collector, base, emitter = pins
        inside = ['n%sc' % name, 'n%sb' % name, 'n%se' % name]
        # ngspice gives every transistor a substrate junction with GMIN across it, from the substrate (the ground when
        # the line names none) to the collector of a vertical NPN or the base of a lateral PNP — its defaults. A
        # discrete transistor has no substrate: tied to the node its junction faces, that junction carries nothing
        substrate = inside[0] if t['type'] == 'npn' else inside[1]
        params = t['vendor'] if vendor else 'is=%s bf=%s br=%s vaf=%s' % (
            number(t['is']), number(t['bf']), number(t['br']), number(t['vaf']))
        lines = ['v%s%s %d %s dc 0' % (name, pin, node, there)
                 for pin, node, there in zip('cbe', (collector, base, emitter), inside)]
        lines += ['q%s %s %s m%s' % (name, ' '.join(inside), substrate, name),
                  '.model m%s %s (%s)' % (name, t['type'], params)]
        return lines, [[('v%s%s#branch' % (name, pin), 1)] for pin in 'cbe']
    if spec in CAPACITORS:  # ESR from the first pin to the capacitance in node n<k>, the leak across the capacitance
        farads, esr, leak = CAPACITORS[spec]
        a, b = pins
        initial = '' if charges is None else ' ic=%s' % number(charges.get(p['id'], 0.0))
        lines = ['r%s %d n%s %s' % (name, a, name, number(esr)),
                 'c%s n%s %d %s%s' % (name, name, b, number(farads), initial),
                 'r%sl n%s %d %s' % (name, name, b, number(leak))]
        current = '@r%s[i]' % name
        return lines, [[(current, 1)], [(current, -1)]]
    if spec in SINES:  # 0 V at the operating point, 1 V in an AC analysis, the sine in time; behind its internal
        # resistance, when it has one, inside node n<k> (as a battery)
        amplitude, hertz, ohms = SINES[spec]
        plus, minus = pins
        hertz = max(p.get('setting', hertz), 0.0)
        wave = 'dc 0 ac 1 sin(0 %s %s)' % (number(amplitude), number(hertz))
        if ohms:
            lines = ['r%s %d n%s %s' % (name, plus, name, number(ohms)), 'v%s n%s %d %s' % (name, name, minus, wave)]
        else:
            lines = ['v%s %d %d %s' % (name, plus, minus, wave)]
        return lines, [[('v%s#branch' % name, 1)], [('v%s#branch' % name, -1)]]
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


def circuit(netlist, charges=None, vendor=False):
    """(the element lines of the netlist, the nodes they use but the ground, the pin currents of every part as in
    `elements`)."""
    body, currents, nodes = [], [], set()
    for k, p in enumerate(netlist['parts']):
        lines, pins = elements(k, p, charges, vendor)
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
    tight = any(p['spec'] in TRANSISTORS for p in netlist['parts'])
    options = '.options savecurrents' + (' %s' % TRAN_OPTIONS if tight else '')
    lines = ['* electronics oracle: %s' % name, options, *body, '.control', 'set numdgt=17', 'op',
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


def fundamental(times, values, hertz, start, stop):
    """The amplitude of the sine of `hertz` in the waveform from `start` to `stop` (a whole number of its periods): its
    Fourier coefficients (2/T)·∫x·sin and (2/T)·∫x·cos over the window, by trapezoids between ngspice's time points
    (the window's ends interpolated)."""
    periods = (stop - start) * hertz
    if abs(periods - round(periods)) > 1e-9 or round(periods) < 1:
        raise ValueError('the window %r … %r s is not a whole number of periods of %r Hz' % (start, stop, hertz))
    points = [(start, interpolate(times, values, start))]
    points += [(t, x) for t, x in zip(times, values) if start < t < stop]
    points.append((stop, interpolate(times, values, stop)))
    w = 2 * math.pi * hertz
    sine = cosine = 0.0
    for (t0, x0), (t1, x1) in zip(points, points[1:]):
        sine += (t1 - t0) * (x0 * math.sin(w * t0) + x1 * math.sin(w * t1)) / 2
        cosine += (t1 - t0) * (x0 * math.cos(w * t0) + x1 * math.cos(w * t1)) / 2
    return 2 * math.hypot(sine, cosine) / (stop - start)


def solve_tran(name, case):
    """The sample of a transient from t = 0 with ngspice's step at most `step`. It starts with every capacitor at its
    voltage in `charges` (0 when the case does not name it; the model's start 'zero' when none is named, else its start
    'state'), or, for the start 'dc', at the operating point of the circuit as ngspice solves it before the transient
    (the model's start 'dc'). It holds the voltage of every node of `nodes` and the current into the first pin of every
    part of `parts` at each of `times`; over `window` (when given) the mean and the swing of every node of `nodes`, and,
    when the case names `hertz`, the amplitude of that frequency in each of them."""
    netlist, charges, start = case['netlist'], case['charges'], case['start']
    if start == 'dc' and charges:
        raise ValueError('%s: a transient from the operating point starts with no charges of its own' % name)
    body, _, currents = circuit(netlist, None if start == 'dc' else charges)
    pins = {p['id']: pin for p, pin in zip(netlist['parts'], currents)}
    vectors = ['v(%d)' % n for n in case['nodes']]
    vectors += sorted({vector for id in case['parts'] for vector, _ in pins[id][0]} - set(vectors))
    lines = ['* electronics oracle: %s' % name, '.options savecurrents %s' % TRAN_OPTIONS, *body, '.control',
             'set wr_singlescale', 'set wr_vecnames', 'option numdgt=17',
             'tran %s %s 0 %s%s' % (number(case['step']), number(case['stop']), number(case['step']),
                                    '' if start == 'dc' else ' uic'),
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
    if case.get('hertz'):
        if not case['window']:
            raise ValueError('%s: an amplitude needs a window' % name)
        sample['hertz'] = case['hertz']
        sample['amplitude'] = {str(n): fundamental(times, node[n], case['hertz'], *case['window'])
                               for n in case['nodes']}
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

    # the amplitude of a frequency over a window: a sine of 1.5 V at 1 kHz on top of 2 V, cut into uneven pieces
    times = sorted({k * 1e-6 for k in range(0, 3001, 7)} | {3e-3})
    values = [2 + 1.5 * math.sin(2 * math.pi * 1e3 * t + 0.4) + 0.3 * math.sin(6 * math.pi * 1e3 * t) for t in times]
    near(fundamental(times, values, 1e3, 1e-3, 3e-3), 1.5, 1e-4, 'the amplitude of 1 kHz')
    try:
        fundamental(times, values, 1e3, 1e-3, 2.5e-3)
    except ValueError:
        pass
    else:
        raise AssertionError('a window of one and a half periods')
    # a transistor is SPICE's Gummel–Poon with IS, BF, BR, VAF alone: at the node voltages ngspice prints, the
    # transport form of Ebers–Moll with GMIN across both junctions gives the current its collector probe measures
    junction = lambda saturation, v: (saturation * math.expm1(v / VT) if v >= -3 * VT
                                      else -saturation * (1 + (3 * VT / (v * math.e)) ** 3))
    for name in ('transistor-bias', 'transistor-switch', 'amplifier-op'):
        sample = solve(name, CASES[name])
        for p in sample['netlist']['parts']:
            if p['spec'] not in TRANSISTORS:
                continue
            t = TRANSISTORS[p['spec']]
            sign = 1 if t['type'] == 'npn' else -1
            c, b, e = (sample['v'][node] for node in p['pins'])
            vbe, vbc = sign * (b - e), sign * (b - c)
            ibe, ibc = junction(t['is'], vbe), junction(t['is'], vbc)
            ic = sign * ((ibe - ibc) * (1 - vbc / t['vaf']) - ibc / t['br'] - GMIN * vbc)
            near(ic, sample['parts'][p['id']]['i'], 1e-6 * abs(ic), '%s %s: Ebers–Moll' % (name, p['id']))
    # the switch: the red LED lights with 21.1 mA; the transistor with its base on the ground lets GMIN·Vcb through
    switch = solve('transistor-switch', CASES['transistor-switch'])
    near(switch['parts']['D1']['i'], 21.11e-3, 0.01e-3, 'the switch on')
    near(switch['parts']['Q2']['i'], GMIN * switch['parts']['Q2']['u'], 0.01 * GMIN * switch['parts']['Q2']['u'],
         'the switch off: picoamperes')
    # the amplifier at rest: the output near half the supply, 13 mA from the battery; the wrong way round, only the
    # leakage of the protection diode
    rest = solve('amplifier-op', CASES['amplifier-op'])
    assert 0.4 < rest['v'][12] / rest['v'][3] < 0.5 and 12e-3 < -rest['parts']['B1']['i'] < 14e-3, rest['v']
    reverse = solve('amplifier-reversed', CASES['amplifier-reversed'])
    assert -20e-9 < reverse['parts']['D1']['i'] < -10e-9, reverse['parts']['D1']
    # playing: about 15.7 times on a small signal; the gain falls past clipping; switched off, microvolts
    small, full = solve('amplifier-v10', CASES['amplifier-v10']), solve('amplifier-v100', CASES['amplifier-v100'])
    gain = small['amplitude']['13'] / small['amplitude']['6']
    assert 15 < gain < 16.5 and full['amplitude']['13'] / full['amplitude']['6'] < 0.75 * gain, gain
    off = solve('amplifier-off', CASES['amplifier-off'])
    assert off['amplitude']['13'] < 1e-4 < 0.29 < off['amplitude']['6'], off['amplitude']

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
            assert sorted(data.get('amplitude', {})) == (sorted(data['v']) if case.get('hertz') else []), name
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
