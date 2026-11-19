#!/usr/bin/env python3
"""Reference model of the radio volume's first link, part one: the reduced standard, the test frame, the video line
with its sync pulse, the FM phase step and the two detectors.

This is the oracle that the TypeScript model in app/src/volumes/radio/sim/core is compared with. It is written from
the plan's shared contract and from textbook formulas (README.md names the open source of each), never from the
TypeScript: two independent derivations that agree are the evidence.

Commands (run from the repository root; numpy and scipy are needed, see requirements.txt):
  python3 tools/ref-models/radio/fm_chain.py --selftest      asserts the numbers the plan pins: `fm_chain selftest: OK`
  python3 tools/ref-models/radio/fm_chain.py --write <dir>   writes the samples: `fm_chain: wrote N file(s)`
  python3 tools/ref-models/radio/fm_chain.py --check <dir>   writes them to a temporary directory and compares:
                                                             `fm_chain: N fixture(s) up to date` (exit 0) or one
                                                             `fm_chain: <file> differs` per file (exit 1)

Samples are JSON on one line: floats with 6 significant digits, keys sorted, no spaces, a line feed at the end.
"""
import argparse
import json
import pathlib
import sys
import tempfile

import numpy as np
from scipy.signal import lfilter
from scipy.special import ndtri

# ── The reduced standard (the shared contract). Real frequency = model frequency × K. ──────────────────────────────
K = 40 / 9
COLS, ROWS, FRAME_LINES = 128, 96, 100  # 96 visible rows + 4 lines of the frame mark
LINE = {'samples': 288, 'front': 7, 'sync': 21, 'back': 26, 'active': 234}  # 1.65 : 4.7 : 5.7 : 52
FS_CH = 4.5e6  # rate of the channel, model Hz
OVERSAMPLE = 5
FS_WB = 22.5e6  # rate of the whole band, model Hz
FRAME_CH, FRAME_WB = 28_800, 144_000  # samples per frame
LEVEL = {'sync': 0.0, 'black': 0.3, 'white': 1.0}  # the signal u; 0 is the bottom of the sync pulse
DEVIATION = {'atSync': -4.3e6, 'span': 8.3e6}  # real Hz: f(u) = atSync + span·u
VIDEO_BW, CHANNEL_BW = 5.5e6, 20e6  # real Hz
BAND = {'centre': 2441e6, 'lo': 2400e6, 'hi': 2483.5e6}
IF = 35e6  # real Hz: where the channel stands after the shift
CHANNELS = [2414e6, 2432e6, 2450e6, 2468e6]

REAL_FS_CH = 20e6  # the channel rate in real Hz, as the contract writes it in radPerSample
LINE_US = {'samples': 64.0, 'front': 1.65, 'sync': 4.7, 'back': 5.7}  # a line of 625-line television, μs
GAUSS_SIZE = 65_536  # the noise table of the model: quantiles Φ⁻¹((i + 0.5) / 65 536)
GAUSS_SHOWN = (0, 16_384, 65_535)

SLOPE_R, SLOPE_THETA_DEG = 0.2, 82  # the slope detector: y[n] = x[n] + r·e^(jθ)·y[n − 1]
ANGLE_SEED, ANGLE_SIGMA = 2026, 0.05  # noise of the angle sample, standard deviation of each of the two shadows
ANGLE_STEPS = (0.3, 0.0, 0.3, 1.0, 0.65, 0.3, 1.0, 0.0)  # eight samples each: porch, sync bottom, black, white, grey …

# Places of the test frame as [column, row, column, row] (both ends inside); the spot is [column, row].
PLACES = {'wall': [8, 8, 39, 39], 'nook': [44, 8, 59, 39], 'pickets': [8, 48, 55, 79], 'ramp': [0, 84, 127, 91],
          'spot': [96, 24]}
CAT = {'row': 30, 'col': 96, 'rows': 14, 'cols': 18, 'luma': 90}  # an ellipse; the spot is on its forehead


def rad_per_sample(u):
    """Turn of the arrow per channel sample, radians: white +72°, the bottom of the sync pulse −77.4°."""
    return 2 * np.pi * (DEVIATION['atSync'] + DEVIATION['span'] * np.asarray(u, dtype=float)) / REAL_FS_CH


# ── The test frame ─────────────────────────────────────────────────────────────────────────────────────────────────
def test_frame():
    """Brightness of the 128 × 96 test frame, an integer array [row][column]; a later rule covers an earlier one."""
    r, c = np.mgrid[0:ROWS, 0:COLS]
    luma = 40 + r  # the background: a slow ramp down the frame

    def box(name):
        c0, r0, c1, r1 = PLACES[name]
        return slice(r0, r1 + 1), slice(c0, c1 + 1)

    luma[box('wall')] = 255  # the wall of the shed
    luma[box('nook')] = 0  # the nook
    luma[box('pickets')] = np.where(c[box('pickets')] % 2 == 0, 255, 0)  # pickets one cell wide
    luma[box('ramp')] = np.rint(c[box('ramp')] * 255 / 127)  # the grey ramp
    cat = ((r - CAT['row']) / CAT['rows']) ** 2 + ((c - CAT['col']) / CAT['cols']) ** 2 <= 1
    luma[cat] = CAT['luma']
    luma[PLACES['spot'][1], PLACES['spot'][0]] = 255  # the spot on the forehead
    return luma


# ── The frame as a signal ──────────────────────────────────────────────────────────────────────────────────────────
def stretch(cells):
    """A row of 128 cells → 234 samples: sample k stands at p = (k + 0.5)·128/234 − 0.5 and takes the linear mix of the
    cells ⌊p⌋ and ⌊p⌋ + 1; beyond either edge it takes the edge cell."""
    cells = np.asarray(cells, dtype=float)
    p = (np.arange(LINE['active']) + 0.5) * COLS / LINE['active'] - 0.5
    left = np.floor(p).astype(int)
    share = p - left
    last = len(cells) - 1
    return cells[np.clip(left, 0, last)] * (1 - share) + cells[np.clip(left + 1, 0, last)] * share


def encode_line(cells, sync=True):
    """One line of the signal u, 288 samples: [front 7 × 0.3][sync 21 × 0][back 26 × 0.3][active 234]. `cells` is a
    row of brightness, or None for a line of the frame mark: [front 7 × 0.3][255 × 0][back 26 × 0.3]. A camera without
    the sync block (`sync` false) puts 0.3 wherever 0 was."""
    black, white = LEVEL['black'], LEVEL['white']
    bottom = LEVEL['sync'] if sync else black
    front, back = LINE['front'], LINE['back']
    out = np.full(LINE['samples'], black)
    if cells is None:
        out[front:LINE['samples'] - back] = bottom
    else:
        out[front:front + LINE['sync']] = bottom
        out[LINE['samples'] - LINE['active']:] = black + (white - black) * stretch(cells) / 255
    return out


def encode_frame(luma, sync=True):
    """A frame of the signal u, 28 800 samples: 96 picture lines, then 4 lines of the frame mark."""
    lines = [encode_line(luma[r], sync) for r in range(ROWS)]
    lines += [encode_line(None, sync) for _ in range(FRAME_LINES - ROWS)]
    return np.concatenate(lines)


def line_of(signal, row):
    return signal[row * LINE['samples']:(row + 1) * LINE['samples']]


# ── Frequency modulation and the two detectors ─────────────────────────────────────────────────────────────────────
def modulate(u):
    """u → pairs of length 1 (a complex array): the phase grows by rad_per_sample(u[n]) at every sample, from 0."""
    return np.exp(1j * np.cumsum(rad_per_sample(u)))


def detect_angle(x):
    """The angle detector: u[n] = (angle(x[n]·conj(x[n − 1]))·20e6/2π + 4.3e6)/8.3e6, with x[−1] = 1."""
    x = np.asarray(x, dtype=complex)
    before = np.concatenate(([1.0 + 0.0j], x[:-1]))
    hz = np.angle(x * np.conj(before)) * REAL_FS_CH / (2 * np.pi)
    return (hz - DEVIATION['atSync']) / DEVIATION['span']


def slope_pole():
    return SLOPE_R * np.exp(1j * np.deg2rad(SLOPE_THETA_DEG))


def slope_settled(u):
    """Settled length of y for a constant u: 1/|1 − r·e^(j(θ − ω))|, ω = rad_per_sample(u). This is the response of
    the one-pole filter y[n] = x[n] + r·e^(jθ)·y[n − 1] at the frequency ω."""
    return 1 / np.abs(1 - slope_pole() * np.exp(-1j * rad_per_sample(u)))


def slope_line():
    """(gain, offset) of the straight line that puts black at 0.3 and white at 1."""
    black, white = slope_settled(LEVEL['black']), slope_settled(LEVEL['white'])
    gain = (LEVEL['white'] - LEVEL['black']) / (white - black)
    return float(gain), float(LEVEL['black'] - gain * black)


def slope_static(u):
    """Settled output of the slope detector for a constant u."""
    gain, offset = slope_line()
    return gain * slope_settled(u) + offset


def detect_slope(x):
    """The slope detector run sample by sample (through the filter itself, not through its formula)."""
    gain, offset = slope_line()
    return gain * np.abs(lfilter([1.0], [1.0, -slope_pole()], np.asarray(x, dtype=complex))) + offset


def angle_case():
    """(pairs x, output u) of the angle sample: an FM signal with steps and noise, and what the formula gives for the
    pairs as they are written to the file (6 significant digits)."""
    clean = modulate(np.repeat(ANGLE_STEPS, 8))
    noise = np.random.default_rng(ANGLE_SEED).normal(0.0, ANGLE_SIGMA, (len(clean), 2))
    pairs = sig6(np.column_stack((clean.real + noise[:, 0], clean.imag + noise[:, 1])).ravel())
    return pairs, detect_angle(np.array(pairs[0::2]) + 1j * np.array(pairs[1::2]))


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
    raise TypeError('no rule for %r in a sample' % type(x))


def fx_standard():
    table = ndtri((np.array(GAUSS_SHOWN) + 0.5) / GAUSS_SIZE)
    return {'K': K, 'COLS': COLS, 'ROWS': ROWS, 'FRAME_LINES': FRAME_LINES, 'LINE': LINE, 'FS_CH': FS_CH,
            'OVERSAMPLE': OVERSAMPLE, 'FS_WB': FS_WB, 'FRAME_CH': FRAME_CH, 'FRAME_WB': FRAME_WB, 'LEVEL': LEVEL,
            'DEVIATION': DEVIATION, 'VIDEO_BW': VIDEO_BW, 'CHANNEL_BW': CHANNEL_BW, 'BAND': BAND, 'IF': IF,
            'CHANNELS': CHANNELS,
            'radWhite': rad_per_sample(LEVEL['white']), 'radSync': rad_per_sample(LEVEL['sync']),
            'gauss': {str(i): q for i, q in zip(GAUSS_SHOWN, table)}}


def fx_test_frame():
    return {'cols': COLS, 'rows': ROWS, 'luma': test_frame().ravel(), 'places': PLACES}


def fx_video_lines():
    luma = test_frame()
    with_sync, without = encode_frame(luma, sync=True), encode_frame(luma, sync=False)
    return {'lines': {str(row): line_of(with_sync, row) for row in (0, 50, 96)}, 'noSync': {'0': line_of(without, 0)}}


def fx_fm_phase():
    u = sig6(np.linspace(0, 1, 256))  # the step is taken from u as it is written to the file
    return {'u': u, 'step': rad_per_sample(u)}


def fx_slope_curve():
    gain, offset = slope_line()
    u = np.arange(21) / 20
    return {'r': SLOPE_R, 'thetaDeg': SLOPE_THETA_DEG, 'gain': gain, 'offset': offset, 'u': u, 'out': slope_static(u)}


def fx_angle():
    pairs, u = angle_case()
    return {'x': pairs, 'u': u}


FIXTURES = {'standard.json': fx_standard, 'test-frame.json': fx_test_frame, 'video-lines.json': fx_video_lines,
            'fm-phase.json': fx_fm_phase, 'slope-curve.json': fx_slope_curve, 'angle.json': fx_angle}


def render(build):
    return json.dumps(sig6(build()), sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n'


def write(directory):
    directory = pathlib.Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for name, build in FIXTURES.items():
        (directory / name).write_text(render(build), encoding='utf-8', newline='\n')
    return len(FIXTURES)


def check(directory):
    """Names of the samples in `directory` that are not what this script writes now (a missing file differs too)."""
    directory = pathlib.Path(directory)
    with tempfile.TemporaryDirectory() as fresh:
        write(fresh)
        differ = []
        for name in FIXTURES:
            have = directory / name
            if not have.is_file() or have.read_bytes() != (pathlib.Path(fresh) / name).read_bytes():
                differ.append(name)
    return differ


# ── The self-test: the numbers the plan pins ───────────────────────────────────────────────────────────────────────
def near(have, want, tolerance, what):
    worst = float(np.max(np.abs(np.asarray(have, dtype=float) - np.asarray(want, dtype=float))))
    assert worst <= tolerance, '%s: off by %g (allowed %g): %r, expected %r' % (what, worst, tolerance, have, want)


def selftest():
    if not __debug__:
        sys.exit('fm_chain: the self-test is made of assert statements; run it without -O')

    # The standard: the parts of a line, the rates, the frame, the channels.
    assert LINE['front'] + LINE['sync'] + LINE['back'] + LINE['active'] == LINE['samples'] == 288, 'parts of a line'
    per_us = LINE['samples'] / LINE_US['samples']  # 4.5 samples per μs
    visible = LINE_US['samples'] - LINE_US['front'] - LINE_US['sync'] - LINE_US['back']  # 51.95 μs, the plan's «52»
    assert {part: round(us * per_us) for part, us in dict(LINE_US, active=visible).items()} == LINE, 'line timing'
    near(FS_CH * K, REAL_FS_CH, 1e-6, 'the channel rate is 20 MHz of real frequency')
    near(FS_WB * K, 100e6, 1e-6, 'the band rate is 100 MHz of real frequency')
    assert FS_WB == FS_CH * OVERSAMPLE and FRAME_CH == LINE['samples'] * FRAME_LINES == 28_800, 'rates'
    assert FRAME_WB == FRAME_CH * OVERSAMPLE == 144_000 and FRAME_LINES == ROWS + 4, 'frame'
    near(FRAME_CH / FS_CH, 6.4e-3, 1e-15, 'a frame lasts 6.4 ms of model time')
    near(LINE['samples'] / FS_CH, 64e-6, 1e-18, 'a line lasts 64 μs of model time')
    assert [f - BAND['centre'] for f in CHANNELS] == [-27e6, -9e6, 9e6, 27e6], 'channels round the centre of the band'
    assert BAND['lo'] <= CHANNELS[0] - CHANNEL_BW / 2 and CHANNELS[-1] + CHANNEL_BW / 2 <= BAND['hi'], 'band edges'
    near(np.rad2deg(rad_per_sample(LEVEL['white'])), 72, 1e-9, 'white turns the arrow by +72° per sample')
    near(np.rad2deg(rad_per_sample(LEVEL['sync'])), -77.4, 1e-9, 'the sync bottom turns it by −77.4° per sample')
    carson = 2 * (DEVIATION['span'] / 2 + VIDEO_BW)  # Carson's rule: twice (peak deviation + highest video frequency)
    assert carson <= CHANNEL_BW, 'the swing and the video band fit the channel: %g Hz' % carson
    standard = sig6(fx_standard())
    assert standard['gauss'] == {'0': -4.32492, '16384': -0.674466, '65535': 4.32492}, standard['gauss']
    assert (standard['radWhite'], standard['radSync'], standard['K']) == (1.25664, -1.35088, 4.44444), standard

    # The test frame.
    luma = test_frame()
    assert luma.shape == (ROWS, COLS) and luma.min() >= 0 and luma.max() <= 255, 'frame shape and range'
    assert int(luma.sum()) == 1_291_513, 'sum of the cells: %d' % luma.sum()
    assert luma[24][96] == 255 and luma[60][8] == 255 and luma[60][9] == 0 and luma[30][96] == 90, 'cells of the frame'

    # The frame as a signal.
    near(stretch(np.full(COLS, 77.0)), 77.0, 1e-12, 'a flat row stays flat')
    near(stretch(np.arange(COLS))[[0, 233]], [0, 127], 0, 'the edge cells at the edges')
    signal = encode_frame(luma)
    assert len(signal) == FRAME_CH, 'samples in a frame'
    first = line_of(signal, 0)
    near(first[0:7], 0.3, 0, 'line 0: the front porch')
    near(first[7:28], 0.0, 0, 'line 0: the sync pulse')
    near(first[28:54], 0.3, 0, 'line 0: the back porch')
    near(first[54], 0.4098, 1e-4, 'line 0: the first sample of the picture')
    near(line_of(signal, 50)[68:74], [0.742559, 0.990322, 0.632051, 0.350855, 0.733761, 0.883333], 1e-5,
         'line 50: the stretch rule on the pickets')
    for row in range(ROWS, FRAME_LINES):
        mark = line_of(signal, row)
        near(mark[0:7], 0.3, 0, 'line %d: the front porch' % row)
        near(mark[7:262], 0.0, 0, 'line %d: the frame mark' % row)
        near(mark[262:288], 0.3, 0, 'line %d: the back porch' % row)
    bare = encode_frame(luma, sync=False)
    near(line_of(bare, 0).min(), 0.3, 0, 'line 0 without sync pulses: the smallest value')
    near(bare.min(), 0.3, 0, 'no sync pulses anywhere in the frame')
    assert np.array_equal(bare[signal > 0], signal[signal > 0]), 'without sync pulses the rest stays as it was'

    # The slope detector.
    black, white, bottom = (float(slope_settled(LEVEL[name])) for name in ('black', 'white', 'sync'))
    near([black, white, bottom], [0.910452, 1.244107, 0.840834], 1e-5, 'settled length: black, white, sync bottom')
    gain, offset = slope_line()
    near([gain, offset], [2.097971, -1.610102], 1e-6, 'the line through black and white')
    near([slope_static(0.3), slope_static(1.0)], [0.3, 1.0], 1e-12, 'black and white after the line')
    near(slope_static(0.0), 0.1539, 5e-4, 'the sync bottom after the line')
    u21 = np.arange(21) / 20
    curve = slope_static(u21)
    assert np.all(np.diff(curve) > 0), 'the curve rises on all 21 points'
    picture = np.linspace(LEVEL['black'], LEVEL['white'], 7001)
    bend = float(np.max(np.abs(slope_static(picture) - picture))) / (LEVEL['white'] - LEVEL['black'])
    near(100 * bend, 6.19, 0.1, 'largest departure from the line between black and white, % of the span')
    for u in u21:  # the filter itself settles on the formula: 64 samples of a constant u, the last one
        near(detect_slope(modulate(np.full(64, u)))[-1], slope_static(u), 1e-12, 'the filter against its formula')

    # The modulator and the angle detector.
    ramp = np.linspace(0, 1, 256)
    near(detect_angle(modulate(ramp)), ramp, 1e-12, 'the angle detector returns u of a clean signal')
    near(np.abs(modulate(ramp)), 1.0, 1e-12, 'the modulated pairs have length 1')
    pairs, u = angle_case()
    steps = np.repeat(ANGLE_STEPS, 8)
    assert len(pairs) == 128 and len(u) == 64, 'sizes of the angle sample'
    scatter = float(np.std(u - steps))
    assert 0.01 < scatter < 0.05, 'noise of the angle sample: %g' % scatter  # ≈ 0.05·√2·20/(2π·8.3) = 0.027
    near(np.mean(u.reshape(8, 8), axis=1), ANGLE_STEPS, 0.05, 'the steps of the angle sample')

    # The samples: sizes the plan names, and text that reads back as the same numbers.
    sizes = {'test-frame.json': {'luma': COLS * ROWS}, 'fm-phase.json': {'u': 256, 'step': 256},
             'slope-curve.json': {'u': 21, 'out': 21}, 'angle.json': {'x': 128, 'u': 64}}
    for name, build in FIXTURES.items():
        text = render(build)
        data = json.loads(text)
        assert text.endswith('\n') and text.count('\n') == 1 and ' ' not in text, name
        assert json.dumps(data, sort_keys=True, separators=(',', ':')) + '\n' == text, name
        for key, size in sizes.get(name, {}).items():
            assert len(data[key]) == size, '%s: %s' % (name, key)
    lines = json.loads(render(fx_video_lines))
    assert sorted(lines['lines']) == ['0', '50', '96'] and sorted(lines['noSync']) == ['0'], 'video lines'
    assert all(len(line) == LINE['samples'] for line in [*lines['lines'].values(), *lines['noSync'].values()])
    phase = json.loads(render(fx_fm_phase))
    assert phase['u'][0] == 0 and phase['u'][-1] == 1 and all(b > a for a, b in zip(phase['u'], phase['u'][1:]))
    near(phase['step'], rad_per_sample(phase['u']), 5e-6, 'fm-phase: the step of the written u')
    assert sum(json.loads(render(fx_test_frame))['luma']) == 1_291_513, 'test-frame: sum of the cells'
    print('fm_chain selftest: OK')


def main():
    parser = argparse.ArgumentParser(description='Reference model of the radio volume: standard, frame, detectors.')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--selftest', action='store_true', help='assert the numbers the plan pins')
    mode.add_argument('--write', metavar='DIR', help='write the samples to DIR')
    mode.add_argument('--check', metavar='DIR', help='compare the samples in DIR with what this script writes now')
    args = parser.parse_args()
    if args.selftest:
        selftest()
    elif args.write is not None:
        print('fm_chain: wrote %d file(s)' % write(args.write))
    else:
        differ = check(args.check)
        for name in differ:
            print('fm_chain: %s differs' % name)
        if differ:
            return 1
        print('fm_chain: %d fixture(s) up to date' % len(FIXTURES))
    return 0


if __name__ == '__main__':
    sys.exit(main())
