#!/usr/bin/env python3
"""Reference link budget of the radio volume: the yard in numbers → rays, levels, dead spots, the tray.

This is the oracle that the TypeScript model in app/src/volumes/radio/sim/core (channel.ts) is compared with. It reads
the same site.json as the model and the scene and follows only the plan's shared contract and the geometry rules of
task B6a (README.md names the open source of each formula), never the TypeScript: two independent derivations that
agree are the evidence.

Commands (run from the repository root; numpy is needed, see requirements.txt):
  link_budget.py --site <site.json>                   the table «target — number — verdict»; the last line is
                                                      `link_budget: targets OK` (exit 0) or
                                                      `link_budget: N target(s) missed` (exit 1)
  link_budget.py --site <site.json> --clear x0,y0,x1,y1 [--clear …]
                                                      plan rectangles against every ray of the model:
                                                      `link_budget: clear OK` (exit 0) or one line per crossed
                                                      rectangle with its number (exit 1)
  link_budget.py --site <site.json> --write <dir>     writes ladder.json and notches.json:
                                                      `link_budget: wrote 2 file(s)`
  link_budget.py --site <site.json> --check <dir>     writes them to a temporary directory and compares:
                                                      `link_budget: 2 fixture(s) up to date` (exit 0) or one
                                                      `link_budget: <file> differs` per file (exit 1)
  --write and --check refuse with `link_budget: no reflected ray at stop 2 …` (exit 1) when the worst point of stop 2
  has no reflected ray: notches.json would have nothing to describe. --write then writes no file at all.

Geometry (the rules of task B6a). Metres; x east, y north, z up, the origin is the ground under the camera.
- A ray gains 2 × 1.1 dBi of the two antennas and loses 20·lg(4πd/λ) of free space, λ = 0.1224 m for every channel.
- Walls are vertical and have no top or bottom. A ray pays for a wall when its trace on the plan crosses the wall's
  segment: the crossing lies strictly inside the ray (0 < t < 1) and on the wall with its ends (0 ≤ u ≤ 1). It pays
  for the slab when its two ends lie on different sides of slabZ.
- The open gate leaf is a mirror on the plan: the image of the source beyond the leaf's line; the reflection point must
  lie on the segment a–b. The reflected ray is √(plan length² + height difference²) long; the height of the reflection
  point divides the height difference in the same share as the plan path; the ray pays for walls on both of its legs.
  The leaf reflects with coefficient 1; its amplitude is multiplied by s²(3 − 2s), s = clamp((gate − 0.3)/0.6, 0, 1),
  so there is no reflected ray while gate ≤ 0.3.
- The tray next to the monitor's antenna is a single knife edge: J(v) = 6.9 + 20·lg(√((v − 0.1)² + 1) + v − 0.1) for
  v ≥ −0.78, else 0; v = h·√(2(d1 + d2)/(λ·d1·d2)), d1 the length of the direct ray, d2 = 0.05 m, the edge
  h = −0.4 + 0.48·tray m from the line of sight. Every ray loses the same J.
- The level in a channel is 10·lg(P/mW) + 20·lg|Σ 10^(gain/20)·e^(−j2π·f·τ)| at the channel's centre f, τ = d/c.
- The field is the one that would give that power on this antenna: E = √(480·π²·P/(λ²·G)), P in W, G = 10^0.11.

Samples are JSON on one line: floats with 6 significant digits, keys sorted, no spaces, a line feed at the end.
"""
import argparse
import json
import math
import pathlib
import sys
import tempfile

import numpy as np

# ── The physics of the shared contract ─────────────────────────────────────────────────────────────────────────────
LOSS_DB = {'brick': 8.0, 'wood': 3.0, 'glass': 1.0, 'slab': 10.0, 'iron': 30.0}
WAVELENGTH = 0.1224  # m: 2450 MHz, channel 3; the free-space loss of every channel is taken with it
ANTENNA_DBI = 1.1  # each of the two antennas, the camera's and the monitor's
C_M_PER_NS = 0.299792458
CHANNELS = (2414e6, 2432e6, 2450e6, 2468e6)  # real Hz, channels 1…4
TX_MW = 10.0
GATE_FROM, GATE_SPAN = 0.3, 0.6  # the leaf starts to mirror above gate 0.3 and is fully open from 0.9
TRAY_D2 = 0.05  # m: from the tray's edge to the monitor's antenna
TRAY_H0, TRAY_H1 = -0.4, 0.48  # the edge: h = −0.4 + 0.48·tray m from the line of sight
KNIFE_FROM = -0.78  # J(v) = 0 below this v

STOPS = ('yard', 'kitchen', 'hallway', 'far room', 'cellar')
NUDGES = [(k - 60) / 400 for k in range(121)]  # −0.15 … +0.15, step 0.0025
SCAN_MHZ = [2400 + k / 4 for k in range(333)]  # 2400 … 2483 MHz, step 0.25: where the notches are looked for
WORST_ROUTE = 2  # the hallway
TRAY_KEYS = ('0.75', '0.8', '0.9', '1')
GATE_KEYS = ('0.45', '0.6', '0.75')


# ── The site ───────────────────────────────────────────────────────────────────────────────────────────────────────
def load_site(path):
    """site.json → a dictionary of numpy vectors; a malformed file raises ValueError with the place of the fault."""
    raw = json.loads(pathlib.Path(path).read_text(encoding='utf-8'))

    def number(value, what):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError('%s: expected a finite number, got %r' % (what, value))
        return float(value)

    def vec(value, n, what):
        if not isinstance(value, list) or len(value) != n:
            raise ValueError('%s: expected %d numbers, got %r' % (what, n, value))
        return np.array([number(x, what) for x in value])

    if not isinstance(raw.get('route'), list) or len(raw['route']) != 5:
        raise ValueError('route: expected five stops')
    axis = vec(raw['nudgeAxis'], 2, 'nudgeAxis')
    if abs(np.hypot(*axis) - 1) > 1e-3:
        raise ValueError('nudgeAxis: expected a unit vector, got %r' % raw['nudgeAxis'])
    walls = []
    for i, wall in enumerate(raw['walls']):
        if wall['material'] not in LOSS_DB or not isinstance(wall['id'], str):
            raise ValueError('walls[%d]: unknown material or id: %r' % (i, wall))
        walls.append((wall['id'], vec(wall['a'], 2, wall['id']), vec(wall['b'], 2, wall['id']),
                      LOSS_DB[wall['material']], wall['material']))
    if len({w[0] for w in walls}) != len(walls) or 'slab' in {w[0] for w in walls}:
        raise ValueError('walls: ids must be unique and not "slab"')
    return {'tx': vec(raw['tx'], 3, 'tx'),
            'route': [vec(stop, 3, 'route[%d]' % i) for i, stop in enumerate(raw['route'])],
            'axis': axis / np.hypot(*axis),
            'walls': walls,
            'slabZ': number(raw['slabZ'], 'slabZ'),
            'leaf': (vec(raw['gateLeaf']['a'], 2, 'gateLeaf.a'), vec(raw['gateLeaf']['b'], 2, 'gateLeaf.b')),
            'router': vec(raw['router']['at'], 3, 'router.at'),
            'oven': vec(raw['oven']['at'], 3, 'oven.at')}


def route_point(site, route):
    """The monitor's antenna on the route: exactly at the stops, linear between them; route is held to 0…4."""
    route = min(max(route, 0.0), 4.0)
    i = min(int(math.floor(route)), 3)
    a, b = site['route'][i], site['route'][i + 1]
    return a + (route - i) * (b - a)


def monitor(site, route, nudge):
    """The monitor's antenna moved by `nudge` metres along the nudge axis (on the plan; the height stays)."""
    p = route_point(site, route).copy()
    p[:2] += nudge * site['axis']
    return p


# ── Geometry on the plan ───────────────────────────────────────────────────────────────────────────────────────────
def cross(u, v):
    return u[0] * v[1] - u[1] * v[0]


def crosses(p, q, a, b):
    """Does the plan trace of the ray p → q cross the segment a–b? Strictly inside the ray (0 < t < 1), anywhere on the
    segment with its ends (0 ≤ u ≤ 1); a ray parallel to the segment never crosses it."""
    d, e, w = q[:2] - p[:2], b - a, a - p[:2]
    den = cross(d, e)
    if den == 0:
        return False
    t, u = cross(w, e) / den, cross(w, d) / den
    return 0 < t < 1 and 0 <= u <= 1


def walls_between(site, p, q):
    """Ids of the walls the ray p → q pays for, in the order of site.json; the slab is "slab", last."""
    ids = [wid for wid, a, b, _, _ in site['walls'] if crosses(p, q, a, b)]
    if (p[2] - site['slabZ']) * (q[2] - site['slabZ']) < 0:
        ids.append('slab')
    return ids


def walls_db(site, ids):
    loss = {wid: db for wid, _, _, db, _ in site['walls']}
    return sum(LOSS_DB['slab'] if wid == 'slab' else loss[wid] for wid in ids)


def mirror(site, p, q):
    """The ray p → leaf → q: (reflection point R, length, share of the leaf from a) or None. The image of p beyond the
    leaf's line; R is where the plan line image → q meets the leaf's line, and it must lie on a–b with its ends."""
    a, b = site['leaf']
    span = np.hypot(*(b - a))
    along = (b - a) / span
    sp, sq = cross(along, p[:2] - a), cross(along, q[:2] - a)
    if sp * sq <= 0:  # the source and the receiver must stand on the same side of the leaf's line
        return None
    image = 2 * (a + np.dot(p[:2] - a, along) * along) - p[:2]
    part = sp / (sp + sq)  # where the line image → q meets the leaf's line, as a part of the plan path
    point = image + part * (q[:2] - image)
    on = float(np.dot(point - a, along) / span)
    if not 0 <= on <= 1:
        return None
    length = math.hypot(np.hypot(*(q[:2] - image)), q[2] - p[2])
    return np.array([point[0], point[1], p[2] + part * (q[2] - p[2])]), length, on


# ── Rays and levels ────────────────────────────────────────────────────────────────────────────────────────────────
def free_space_db(d):
    return 20 * math.log10(4 * math.pi * d / WAVELENGTH)


def gate_share(gate):
    """How much of the leaf's mirror is there: s²(3 − 2s), s = clamp((gate − 0.3)/0.6, 0, 1)."""
    s = min(max((gate - GATE_FROM) / GATE_SPAN, 0.0), 1.0)
    return s * s * (3 - 2 * s)


def knife_db(tray, d1):
    """Loss behind the tray's edge (a single knife edge), dB."""
    h = TRAY_H0 + TRAY_H1 * tray
    v = h * math.sqrt(2 * (d1 + TRAY_D2) / (WAVELENGTH * d1 * TRAY_D2))
    if v < KNIFE_FROM:
        return 0.0
    return 6.9 + 20 * math.log10(math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1)


def rays(site, route, nudge=0.0, gate=0.0, tray=0.0):
    """The rays from the camera's antenna to the monitor's: the direct one first, then the one from the leaf when there
    is one. Each is a dictionary: gainDb (both antennas, free space, walls, the gate's share, the tray), delayNs,
    walls (ids on its legs), legs (plan segments), and for the reflected one the share of the leaf `on`."""
    tx, rx = site['tx'], monitor(site, route, nudge)
    d = float(np.linalg.norm(rx - tx))
    tray_db = knife_db(tray, d)
    ids = walls_between(site, tx, rx)
    out = [{'gainDb': 2 * ANTENNA_DBI - free_space_db(d) - walls_db(site, ids) - tray_db, 'delayNs': d / C_M_PER_NS,
            'd': d, 'walls': ids, 'legs': [(tx, rx)]}]
    share = gate_share(gate)
    hit = mirror(site, tx, rx)
    if share > 0 and hit is not None:
        point, length, on = hit
        ids = walls_between(site, tx, point) + walls_between(site, point, rx)
        ids = [i for i in ids if i != 'slab'] + [i for i in ids if i == 'slab']  # the slab last, as everywhere
        gain = 2 * ANTENNA_DBI - free_space_db(length) - walls_db(site, ids) - tray_db + 20 * math.log10(share)
        out.append({'gainDb': gain, 'delayNs': length / C_M_PER_NS, 'd': length, 'walls': ids,
                    'legs': [(tx, point), (point, rx)], 'on': on})
    return out


def response_db(ray_list, hz):
    """20·lg|Σ 10^(gain/20)·e^(−j2π·f·τ)|: the gain of all rays together at the real frequency hz."""
    s = sum(10 ** (r['gainDb'] / 20) * np.exp(-2j * np.pi * hz * r['delayNs'] * 1e-9) for r in ray_list)
    return 20 * math.log10(abs(s))


def level_dbm(site, route, nudge=0.0, gate=0.0, tray=0.0, channel=3, tx_mw=TX_MW):
    """Received level in the middle of a channel, dBm."""
    return 10 * math.log10(tx_mw) + response_db(rays(site, route, nudge, gate, tray), CHANNELS[channel - 1])


def field_vm(dbm):
    """The field that would give this power on this antenna: E = √(480·π²·P/(λ²·G)), P in W."""
    watts = 10 ** ((dbm - 30) / 10)
    return math.sqrt(480 * math.pi ** 2 * watts / (WAVELENGTH ** 2 * 10 ** (ANTENNA_DBI / 10)))


def minima(values):
    """Indices of the inner local minima of a sequence."""
    return [k for k in range(1, len(values) - 1) if values[k] < values[k - 1] and values[k] <= values[k + 1]]


def worst_nudge(site):
    levels = [level_dbm(site, WORST_ROUTE, n, gate=1.0) for n in NUDGES]
    return NUDGES[int(np.argmin(levels))], levels


def notches_mhz(site, nudge):
    response = [response_db(rays(site, WORST_ROUTE, nudge, gate=1.0), f * 1e6) for f in SCAN_MHZ]
    return [SCAN_MHZ[k] for k in minima(response)]


# ── The samples ────────────────────────────────────────────────────────────────────────────────────────────────────
def sig6(x):
    """The same structure with every float rounded to 6 significant digits; whole numbers and names pass through."""
    if isinstance(x, dict):
        return {key: sig6(value) for key, value in x.items()}
    if isinstance(x, np.ndarray):
        return sig6(x.tolist())
    if isinstance(x, (list, tuple)):
        return [sig6(value) for value in x]
    if isinstance(x, (float, np.floating)):
        return float('%.6g' % x) + 0.0  # + 0.0 turns −0.0 into 0.0
    if isinstance(x, (int, np.integer)) and not isinstance(x, bool):
        return int(x)
    if isinstance(x, str):
        return x
    raise TypeError('no rule for %r in a sample' % type(x))


def fx_ladder(site):
    """The five stops, 10 mW, channel 3, gate shut, no tray: one ray each."""
    stops = []
    for i in range(5):
        (ray,) = rays(site, i)
        dbm = level_dbm(site, i)
        stops.append({'d': ray['d'], 'walls': ray['walls'], 'gainDb': ray['gainDb'], 'rxDbm10': dbm,
                      'rxDbm1': level_dbm(site, i, tx_mw=1.0), 'fieldVm': field_vm(dbm)})
    return {'stops': stops}


class NoReflection(Exception):
    """The worst point of stop 2 has no reflected ray, so notches.json has no extra path, delay or amplitude."""


def fx_notches(site):
    """Stop 2 with the gate open: the level along the nudge axis, the worst point, its notches; the tray at stop 1; the
    gate half open at the worst point; how many rays reach the route with the gate open."""
    worst, levels = worst_nudge(site)
    pair = rays(site, WORST_ROUTE, worst, gate=1.0)
    if len(pair) != 2:
        raise NoReflection('no reflected ray at stop %d (gate open, worst nudge %+.4f)' % (WORST_ROUTE, worst))
    direct, reflected = pair
    extra = reflected['d'] - direct['d']
    shut = level_dbm(site, 1)
    return {'route': WORST_ROUTE, 'extraM': extra, 'delayNs': extra / C_M_PER_NS,
            'a': 10 ** ((reflected['gainDb'] - direct['gainDb']) / 20), 'worstNudge': worst,
            'nudge': NUDGES, 'rxDbm': levels, 'notchMhz': notches_mhz(site, worst),
            'tray': {key: shut - level_dbm(site, 1, tray=float(key)) for key in TRAY_KEYS},
            'gate': {key: level_dbm(site, WORST_ROUTE, worst, gate=float(key)) for key in GATE_KEYS},
            'rayCount': [len(rays(site, k / 4, gate=1.0)) for k in range(17)]}


FIXTURES = {'ladder.json': fx_ladder, 'notches.json': fx_notches}


def render(build, site):
    return json.dumps(sig6(build(site)), sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n'


def write(directory, site):
    """Renders every sample before writing any, so a site that cannot give one of them leaves `directory` as it was."""
    texts = {name: render(build, site) for name, build in FIXTURES.items()}
    directory = pathlib.Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for name, text in texts.items():
        (directory / name).write_text(text, encoding='utf-8', newline='\n')
    return len(texts)


def check(directory, site):
    """Names of the samples in `directory` that are not what this script writes now (a missing file differs too)."""
    directory = pathlib.Path(directory)
    with tempfile.TemporaryDirectory() as fresh:
        write(fresh, site)
        return [name for name in FIXTURES if not (directory / name).is_file()
                or (directory / name).read_bytes() != (pathlib.Path(fresh) / name).read_bytes()]


# ── The table «target — number — verdict» ──────────────────────────────────────────────────────────────────────────
def spans(flags, step):
    """Runs of True in a sequence sampled every `step`, as (first, last) values."""
    out, start = [], None
    for k, flag in enumerate(list(flags) + [False]):
        if flag and start is None:
            start = k
        elif not flag and start is not None:
            out.append((start * step, (k - 1) * step))
            start = None
    return out


def gaps(xs):
    return [b - a for a, b in zip(xs, xs[1:])]


def table(site):
    """Prints the table and returns the number of missed targets."""
    rows = []

    def row(what, target, value, ok):
        rows.append((what, target, value, 'ok' if ok else 'MISSED'))

    ladder = fx_ladder(site)['stops']
    for i, (stop, want) in enumerate(zip(ladder, (-54, -62, -70, -78, -88))):
        what = 'level at stop %d, %s' % (i, STOPS[i]) + (' (10 mW, channel 3, gate shut)' if i == 0 else '')
        row(what, '%d ± 1.5 dBm' % want, '%.2f dBm' % stop['rxDbm10'], abs(stop['rxDbm10'] - want) <= 1.5)
    field = ladder[0]['fieldVm']
    row('field at stop 0 (%.2f m from the camera)' % ladder[0]['d'], '0.03 V/m ± 10 %', '%.4f V/m' % field,
        0.027 <= field <= 0.033)

    worst, levels = worst_nudge(site)
    notches = notches_mhz(site, worst)
    every = gaps(notches)
    row('gate open, stop 2, worst point: notches every', '27..33 MHz',
        '%.2f..%.2f MHz (%d notches)' % (min(every), max(every), len(notches)) if every else 'fewer than two notches',
        bool(every) and all(27 <= g <= 33 for g in every))
    depth = min(levels) - level_dbm(site, WORST_ROUTE)
    row('gate open, stop 2: deepest dead spot against the gate shut', '-10.5..-8 dB', '%.2f dB' % depth,
        -10.5 <= depth <= -8)
    spots = [NUDGES[k] for k in minima(levels)]
    steps = [100 * g for g in gaps(spots)]
    row('gate open, stop 2: step between dead spots along nudge', '5.5..8 cm',
        '%.2f..%.2f cm (%d dead spots)' % (min(steps), max(steps), len(spots)) if steps else 'fewer than two',
        bool(steps) and all(5.5 <= s <= 8 for s in steps))
    tray = level_dbm(site, 1) - level_dbm(site, 1, tray=1.0)
    row('tray against the monitor\'s antenna, stop 1: loss', '15..18 dB', '%.2f dB' % tray, 15 <= tray <= 18)

    ch3, ch1 = min(levels), level_dbm(site, WORST_ROUTE, worst, gate=1.0, channel=1)
    row('worst point: channel 1 above channel 3', '>= 6 dB', '%.2f dB' % (ch1 - ch3), ch1 - ch3 >= 6)
    counts = [len(rays(site, WORST_ROUTE, n, gate=1.0)) for n in (-0.15, 0.0, 0.15)]
    row('stop 2: rays at nudge -0.15, 0, +0.15 (gate open)', '2, 2, 2', ', '.join(map(str, counts)),
        counts == [2, 2, 2])
    sums = [walls_db(site, stop['walls']) for stop in ladder]
    row('walls on the direct ray, stops 0..4', '0/8/14/22/32 dB', '/'.join('%g' % s for s in sums) + ' dB',
        sums == [0, 8, 14, 22, 32])
    kitchen = ladder[1]['walls']
    materials = {wid: m for wid, _, _, _, m in site['walls']}
    row('walls on the direct ray to the kitchen', 'one brick wall',
        ', '.join('%s (%s)' % (w, materials.get(w, 'slab')) for w in kitchen) or 'none',
        len(kitchen) == 1 and materials.get(kitchen[0]) == 'brick')

    widths = [max(len(r[i]) for r in rows + [('what', 'target', 'value', 'verdict')]) for i in range(4)]
    print('link_budget: site %s' % site['path'])
    for r in [('what', 'target', 'value', 'verdict')] + rows:
        print('  ' + '  '.join(cell.ljust(width) for cell, width in zip(r, widths)).rstrip())

    # Details without a verdict: the numbers the plan quotes. A moved yard may leave stop 2 without a reflected ray;
    # the depth and channel rows above are then missed, so the details only say so and the last line is still printed.
    at_worst = rays(site, WORST_ROUTE, worst, gate=1.0)
    plain = rays(site, WORST_ROUTE, 0.0, gate=1.0)
    at_zero = '%.2f m' % (plain[1]['d'] - plain[0]['d']) if len(plain) == 2 else 'no reflected ray'
    if len(at_worst) == 2:
        direct, reflected = at_worst
        extra = reflected['d'] - direct['d']
        print('  worst point: nudge %+.4f; extra path %.2f m (at nudge 0: %s), %.1f ns; reflected/direct amplitude '
              '%.3f; channel 3 %.2f dBm, channel 1 %.2f dBm; the leaf is hit at %.2f of its length'
              % (worst, extra, at_zero, extra / C_M_PER_NS, 10 ** ((reflected['gainDb'] - direct['gainDb']) / 20),
                 ch3, ch1, reflected['on']))
    else:
        print('  worst point: nudge %+.4f; no reflected ray (extra path at nudge 0: %s); channel 3 %.2f dBm, '
              'channel 1 %.2f dBm' % (worst, at_zero, ch3, ch1))
    print('  worst point, gate %s: %s dBm' % (' / '.join(GATE_KEYS), ' / '.join(
        '%.2f' % level_dbm(site, WORST_ROUTE, worst, gate=float(g)) for g in GATE_KEYS)))
    loss = [(t / 100, level_dbm(site, 1) - level_dbm(site, 1, tray=t / 100)) for t in range(101)]
    free = max(t for t, db in loss if db == 0)
    print('  tray at stop 1: 0 dB up to %.2f; %s dB at %s; the kitchen with the tray %.2f dBm' % (
        free, ' / '.join('%.2f' % (level_dbm(site, 1) - level_dbm(site, 1, tray=float(k))) for k in TRAY_KEYS),
        ' / '.join(TRAY_KEYS), level_dbm(site, 1, tray=1.0)))

    on_route = [rays(site, k / 100, gate=1.0) for k in range(401)]
    runs = spans((len(r) == 2 for r in on_route), 0.01)
    print('  reflected ray on the route (gate open, nudge 0, step 0.01): %s' % (
        ', '.join('%.2f..%.2f' % run for run in runs) or 'nowhere'))
    for first, last in runs:
        part = on_route[round(first * 100):round(last * 100) + 1]
        below = [r[0]['gainDb'] - r[1]['gainDb'] for r in part]
        walls = sorted({len([w for w in r[1]['walls'] if w != 'slab']) for r in part})
        print('    %.2f..%.2f: the reflected ray crosses %s wall(s), %.1f..%.1f dB below the direct one (%s)' % (
            first, last, '/'.join(map(str, walls)), min(below), max(below), ', '.join(part[0][1]['walls'])))

    missed = sum(r[3] != 'ok' for r in rows)
    print('link_budget: targets OK' if missed == 0 else 'link_budget: %d target(s) missed' % missed)
    return missed


# ── Plan rectangles against the rays ───────────────────────────────────────────────────────────────────────────────
def hits_box(p, q, box):
    """Does the plan segment p → q touch the closed rectangle box = (x0, y0, x1, y1)? (Liang–Barsky clipping.)"""
    lo, hi = 0.0, 1.0
    for axis, (low, high) in enumerate(((box[0], box[2]), (box[1], box[3]))):
        d = q[axis] - p[axis]
        if d == 0:
            if not low <= p[axis] <= high:
                return False
            continue
        t0, t1 = sorted(((low - p[axis]) / d, (high - p[axis]) / d))
        lo, hi = max(lo, t0), min(hi, t1)
        if lo > hi:
            return False
    return True


def all_rays(site):
    """Every ray of the model on the route 0…4 (step 0.05) at nudge −0.15, 0, +0.15: (name, plan segment)."""
    for k in range(81):
        for nudge in (-0.15, 0.0, 0.15):
            where = 'route %.2f nudge %+.2f' % (k / 20, nudge)
            rx = monitor(site, k / 20, nudge)
            for i, ray in enumerate(rays(site, k / 20, nudge, gate=1.0)):
                for j, (p, q) in enumerate(ray['legs']):
                    yield '%s, %s' % ('direct ray' if i == 0 else 'reflected ray, leg %d' % (j + 1), where), p, q
            yield 'router ray, %s' % where, site['router'], rx
            yield 'oven ray, %s' % where, site['oven'], rx


def clear(site, boxes):
    """Prints `clear OK` or a line per crossed rectangle; returns the number of crossed rectangles."""
    crossed = 0
    for n, box in enumerate(boxes, start=1):
        hit = next(((name, p, q) for name, p, q in all_rays(site) if hits_box(p, q, box)), None)
        if hit is not None:
            crossed += 1
            print('link_budget: rectangle %d (%s) is crossed by the %s' % (n, ','.join('%g' % v for v in box), hit[0]))
    if crossed == 0:
        print('link_budget: clear OK')
    return crossed


def parse_box(text):
    try:
        x0, y0, x1, y1 = (float(v) for v in text.split(','))
    except ValueError:
        raise argparse.ArgumentTypeError('expected x0,y0,x1,y1, got %r' % text)
    return min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)


def joined(argv):
    """`--clear -1,-12,4,-9` → `--clear=-1,-12,4,-9`: argparse would take a value that starts with a minus for an
    option of its own."""
    out = []
    for arg in argv:
        if out and out[-1] == '--clear':
            out[-1] = '--clear=' + arg
        else:
            out.append(arg)
    return out


def main():
    parser = argparse.ArgumentParser(description='Reference link budget of the radio volume: rays, levels, notches.')
    parser.add_argument('--site', required=True, help='site.json: the yard in numbers')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--clear', metavar='x0,y0,x1,y1', type=parse_box, action='append',
                      help='a plan rectangle no ray of the model may cross (may be given several times)')
    mode.add_argument('--write', metavar='DIR', help='write ladder.json and notches.json to DIR')
    mode.add_argument('--check', metavar='DIR', help='compare the samples in DIR with what this script writes now')
    args = parser.parse_args(joined(sys.argv[1:]))
    try:
        site = load_site(args.site)
    except (AttributeError, KeyError, TypeError, ValueError) as error:
        print('link_budget: bad site %s: %s' % (args.site, error))
        return 2
    site['path'] = args.site
    if args.clear:
        return 1 if clear(site, args.clear) else 0
    if args.write is not None:
        try:
            count = write(args.write, site)
        except NoReflection as error:
            print('link_budget: %s; no file written' % error)
            return 1
        print('link_budget: wrote %d file(s)' % count)
        return 0
    if args.check is not None:
        try:
            differ = check(args.check, site)
        except NoReflection as error:
            print('link_budget: %s; notches.json cannot be built' % error)
            return 1
        for name in differ:
            print('link_budget: %s differs' % name)
        if differ:
            return 1
        print('link_budget: %d fixture(s) up to date' % len(FIXTURES))
        return 0
    return 1 if table(site) else 0


if __name__ == '__main__':
    sys.exit(main())
