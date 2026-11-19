#!/usr/bin/env python3
"""Reference model of the radio volume's first link: the reduced standard, the test frame, the video line with its sync
pulse, the FM phase step, the two detectors, and the whole link from the camera's frame to the monitor's screen for
one ray at a set level (the screen without noise and the curve of cleanliness against the level).

This is the oracle that the TypeScript model in app/src/volumes/radio/sim/core is compared with. It is written from
the plan's shared contract and from textbook formulas (README.md names the open source of each), never from the
TypeScript: two independent derivations that agree are the evidence.

Commands (run from the repository root; numpy and scipy are needed, see requirements.txt):
  python3 tools/ref-models/radio/fm_chain.py --selftest      asserts the numbers the plan pins: `fm_chain selftest: OK`
  python3 tools/ref-models/radio/fm_chain.py --write <dir>   writes the samples: `fm_chain: wrote N file(s)`
  python3 tools/ref-models/radio/fm_chain.py --check <dir>   writes them to a temporary directory and compares:
                                                             `fm_chain: N fixture(s) up to date` (exit 0) or one
                                                             `fm_chain: <file> differs` per file (exit 1); byte for
                                                             byte, except the numbers of snr-curve.json named in
                                                             CURVE_TOLERANCE

Samples are JSON on one line: floats with 6 significant digits, keys sorted, no spaces, a line feed at the end.
"""
import argparse
import functools
import json
import math
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
REAL_FS_WB = 100e6  # the band rate in real Hz
LINE_US = {'samples': 64.0, 'front': 1.65, 'sync': 4.7, 'back': 5.7}  # a line of 625-line television, μs
GAUSS_SIZE = 65_536  # the noise table of the model: quantiles Φ⁻¹((i + 0.5) / 65 536)
GAUSS_SHOWN = (0, 16_384, 65_535)

SLOPE_R, SLOPE_THETA_DEG = 0.2, 82  # the slope detector: y[n] = x[n] + r·e^(jθ)·y[n − 1]
ANGLE_SEED, ANGLE_SIGMA = 2026, 0.05  # noise of the angle sample, standard deviation of each of the two shadows
ANGLE_STEPS = (0.3, 0.0, 0.3, 1.0, 0.65, 0.3, 1.0, 0.0)  # eight samples each: porch, sync bottom, black, white, grey …

# The whole first link (the plan's tasks B2, B4, B5 and B7 give these numbers; the reference takes no geometry: one
# ray at a set level, camera and monitor on channel 3, the default monitor).
CHANNEL_TAPS, CHANNEL_CUTOFF = 63, 0.1  # ±10 MHz of 100: the placer's interpolator and the channel filter
INPUT_TAPS, INPUT_CUTOFF = 47, 0.4175  # the input filter: 2399–2483 MHz
VIDEO_TAPS, VIDEO_CUTOFF = 31, 0.275  # the video filter: 5.5 MHz of 20
DELAY_LATENCY = 5  # band samples: the fixed latency of every ray (the ray's own delay is 0 here)
NOISE_DBM_IN_CHANNEL = -92  # antenna noise in the channel filter: kTB in 20 MHz (−101 dBm) + 9 dB of the receiver
SECOND_NOISE_DB = -30  # the noise of the later stages, added at the channel rate, relative to the line above
AMP_CEILING_DBM = -20  # the amplifier's ceiling
LIMITER_FLOOR_DBM = -100  # the smallest amplitude the limiter works with
SLOPE_SYNC_THRESHOLD = 0.226  # midway between the sync bottom and black at the slope detector's output
TX_CHANNEL = 3
LINE_LENGTH, TRUST = 288.0, 0.25  # the default monitor's own rhythm of lines and its trust in the sync pulses
CAPTURE = 16  # samples: a line whose sync pulse is further than this from its place counts as lost
SEED, WARM, FRAMES, REFERENCE_FRAMES = 2026, 2, 6, 16  # the measure of cleanliness (the same in the plan's task B9c)
STOP_LEVELS = (-54, -62, -70, -78, -88)  # dBm at the five stops of the route, 10 mW, the gate closed
CURVE_LEVELS = tuple(range(-60, -93, -2))  # −60, −62, …, −92 dBm
ABOVE = (-62, -74)  # the straight line of the curve above the threshold is fitted through these levels and those between
KNEE_DB = 6  # the knee: the highest level where the curve lies more than this below that line, extended

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


# ── The whole first link ───────────────────────────────────────────────────────────────────────────────────────────
def dbm_to_amp(dbm):
    """Amplitude in √mW of a level in dBm: |x|² of a pair is its power in mW."""
    return 10 ** (dbm / 20)


def design_lowpass(taps, cutoff):
    """Window-method low-pass filter: 2c·sinc(2c·(k − (N − 1)/2)) under a Hamming window, scaled to a sum of 1;
    `cutoff` is a share of the sample rate (the gain there is −6 dB)."""
    k = np.arange(taps)
    window = 0.54 - 0.46 * np.cos(2 * np.pi * k / (taps - 1))
    h = 2 * cutoff * np.sinc(2 * cutoff * (k - (taps - 1) / 2)) * window
    return h / h.sum()


CHANNEL_FILTER = design_lowpass(CHANNEL_TAPS, CHANNEL_CUTOFF)
INPUT_FILTER = design_lowpass(INPUT_TAPS, INPUT_CUTOFF)
VIDEO_FILTER = design_lowpass(VIDEO_TAPS, VIDEO_CUTOFF)
# Standard deviation of each shadow of the antenna noise at the band rate: after the channel filter it is −92 dBm.
ANTENNA_NOISE_SIGMA = dbm_to_amp(NOISE_DBM_IN_CHANNEL) / np.sqrt(2 * np.sum(CHANNEL_FILTER ** 2))
SECOND_NOISE_SIGMA = dbm_to_amp(NOISE_DBM_IN_CHANNEL + SECOND_NOISE_DB) / np.sqrt(2)  # each shadow, channel rate
CHANNEL_STEP = 2 * np.pi * (CHANNELS[TX_CHANNEL - 1] - BAND['centre']) / REAL_FS_WB  # radians per band sample


class Decoder:
    """The monitor's own rhythm of lines, run sample by sample: the receiving side's algorithm of the plan's task B4.
    The rhythm counts `lineLength + wander` samples per line, pulls itself by `trust` towards every sync pulse it
    finds (ten samples under the threshold), and four frame marks in a row (65 samples under it) put the lines back in
    place. Every sample is spread over the cells its stretch of the line covers; at the end of a line the cells covered
    by more than a quarter go to the screen. Kept here is only what the screen and the share of lost lines need: the
    meters lineOffset, lineDrift and lineRow are not computed.

    The lines of the frame mark, 96–99, are never written to the screen. The plan's pseudo-code writes
    screen[line·128 + c] without a guard, and with little trust a line can turn into a frame-mark line halfway, holding
    cells of more than a quarter; the TypeScript decoder does not write them either."""

    def __init__(self, rng):
        self.rng = rng
        self.ph, self.line, self.run, self.marks, self.wander, self.prev = 0.0, 0, 0, 0, 0.0, LEVEL['black']
        self.frac, self.found = 0.5, False
        self.acc, self.weight = [0.0] * COLS, [0.0] * COLS
        self.screen = [0] * (COLS * ROWS)

    def process(self, video, line_length, trust, threshold):
        """Runs one frame of the video signal (a list of floats) into self.screen; returns (lost, lines)."""
        line_length, trust = min(max(line_length, 240.0), 336.0), min(max(trust, 0.0), 1.0)
        per_sample = COLS / LINE['active']  # cells per sample
        start, front, black, span = LINE['samples'] - LINE['active'], LINE['front'], LEVEL['black'], 0.7
        ph, line, run, marks, wander = self.ph, self.line, self.run, self.marks, self.wander
        prev, frac, found = self.prev, self.frac, self.found
        acc, weight, screen, uniform = self.acc, self.weight, self.screen, self.rng.random
        lost = lines = 0
        period = line_length + wander
        for v in video:
            if v < threshold:
                run += 1
                if run == 1:  # where between the two samples the signal crossed the threshold
                    frac = (prev - threshold) / (prev - v) if prev > v else 0.5
                elif run == 10:  # the start of the pulse against its place, folded into ±period/2
                    err = (ph - 9.5 + frac) - front
                    err = (err + period / 2) % period - period / 2
                    ph -= trust * err
                    if abs(err) <= CAPTURE:
                        found = True
                elif run == 65:  # a frame mark; four in a row give the lines 96…99
                    line = ROWS + marks
                    marks = min(marks + 1, 3)
            else:
                if 10 <= run < 65:
                    marks = 0
                run = 0
            prev = v
            if line < ROWS:  # the sample covers [(ph − 54)·128/234, (ph − 53)·128/234) of the row of cells
                a = (ph - start) * per_sample
                b = a + per_sample
                if b > 0.0 and a < COLS:
                    c = math.floor(a)
                    edge = c + 1.0
                    if c >= 0:
                        w = (b if b < edge else edge) - a
                        acc[c] += v * w
                        weight[c] += w
                    if b > edge and c + 1 < COLS:
                        w = b - edge
                        acc[c + 1] += v * w
                        weight[c + 1] += w
            ph += 1.0
            if ph >= period:
                ph -= period
                row = line * COLS
                for c in range(COLS):
                    w = weight[c]
                    if w > 0.25 and line < ROWS:  # never the frame-mark lines 96–99 (see the class)
                        level = math.floor((acc[c] / w - black) / span * 255 + 0.5)  # rounds as Math.round does
                        screen[row + c] = 0 if level < 0 else 255 if level > 255 else level
                    acc[c] = weight[c] = 0.0
                if not found:
                    lost += 1
                found = False
                lines += 1
                line = (line + 1) % FRAME_LINES
                wander = min(max(wander + (uniform() - 0.5) * 0.02, -0.05), 0.05)
                period = line_length + wander
        self.ph, self.line, self.run, self.marks, self.wander = ph, line, run, marks, wander
        self.prev, self.frac, self.found = prev, frac, found
        return lost, lines


class Link:
    """The first link for one ray at a set level, the state after reset(): the camera's frame → FM modulator → the
    placer (×5 through the channel filter, then shifted to channel 3) → one ray (gain and the fixed latency) → antenna
    noise → input filter → amplifier with a ceiling → shift of channel 3 to zero → channel filter and ÷5 → the noise
    of the later stages → limiter → slope detector → video filter → decoder → screen. Every block keeps its memory
    from frame to frame. Three noise streams come from numpy.random.default_rng on children of one SeedSequence:
    the antenna, the later stages and the rhythm of lines (so the rhythm walks the same way with noise and without)."""

    def __init__(self, dbm, seed=SEED, noise=True):
        air, later, rhythm = (np.random.default_rng(child) for child in np.random.SeedSequence(seed).spawn(3))
        self.air, self.later, self.noise, self.amp = air, later, noise, dbm_to_amp(dbm)
        self.decoder = Decoder(rhythm)
        self.phase = self.place_phase = self.shift_phase = 0.0
        self.z_place = np.zeros(CHANNEL_TAPS - 1, complex)
        self.ray = np.zeros(DELAY_LATENCY, complex)
        self.z_input = np.zeros(INPUT_TAPS - 1, complex)
        self.z_channel = np.zeros(CHANNEL_TAPS - 1, complex)
        self.z_slope = np.zeros(1, complex)
        self.z_video = np.zeros(VIDEO_TAPS - 1)

    def step(self, u):
        """One frame of the signal u (FRAME_CH samples) through the link; returns (screen, lost, lines)."""
        size = len(u) * OVERSAMPLE
        phase = self.phase + np.cumsum(rad_per_sample(u))  # the modulator: the phase grows by radPerSample(u)
        self.phase = phase[-1] % (2 * np.pi)
        up = np.zeros(size, complex)
        up[::OVERSAMPLE] = np.exp(1j * phase) * OVERSAMPLE  # y[n] = 5·Σ h[n − 5k]·x[k]: the amplitude is kept
        placed, self.z_place = lfilter(CHANNEL_FILTER, 1.0, up, zi=self.z_place)
        turn = CHANNEL_STEP * np.arange(size)
        placed = placed * np.exp(1j * (self.place_phase + turn))
        self.place_phase = (self.place_phase + CHANNEL_STEP * size) % (2 * np.pi)
        antenna = self.amp * np.concatenate((self.ray, placed[:-DELAY_LATENCY]))  # the one ray
        self.ray = placed[-DELAY_LATENCY:]
        if self.noise:
            antenna = antenna + ANTENNA_NOISE_SIGMA * self.air.standard_normal(2 * size).view(complex)
        x, self.z_input = lfilter(INPUT_FILTER, 1.0, antenna, zi=self.z_input)
        ceiling = dbm_to_amp(AMP_CEILING_DBM)
        x = x / np.sqrt(1 + np.abs(x) ** 2 / ceiling ** 2)  # the amplifier at full gain: g = 1, so ÷g changes nothing
        x = x * np.exp(-1j * (self.shift_phase + turn))
        self.shift_phase = (self.shift_phase + CHANNEL_STEP * size) % (2 * np.pi)
        x, self.z_channel = lfilter(CHANNEL_FILTER, 1.0, x, zi=self.z_channel)
        x = x[::OVERSAMPLE]  # out[k] = Σ h[i]·x[5k − i]
        if self.noise:
            x = x + SECOND_NOISE_SIGMA * self.later.standard_normal(2 * len(x)).view(complex)
        length, floor = np.abs(x), dbm_to_amp(LIMITER_FLOOR_DBM)
        x = x / np.where(length >= floor, length, floor)  # the limiter: length 1, or x/floor below the floor
        y, self.z_slope = lfilter([1.0], [1.0, -slope_pole()], x, zi=self.z_slope)
        gain, offset = slope_line()
        video, self.z_video = lfilter(VIDEO_FILTER, 1.0, gain * np.abs(y) + offset, zi=self.z_video)
        lost, lines = self.decoder.process(video.tolist(), LINE_LENGTH, TRUST, SLOPE_SYNC_THRESHOLD)
        return np.array(self.decoder.screen, dtype=float), lost, lines


def run_link(dbm, frames, noise=True):
    """Screens (frames × 12 288) and shares of lost lines of `frames` frames of the test frame at `dbm` on the
    antenna, from reset; seed SEED."""
    link, u = Link(dbm, SEED, noise), encode_frame(test_frame())
    screens, lost = [], []
    for _ in range(frames):
        screen, missed, lines = link.step(u)
        screens.append(screen)
        lost.append(missed / lines if lines else 0.0)
    return np.array(screens), np.array(lost)


@functools.lru_cache(maxsize=None)
def noiseless():
    """The 16 screens after 2 frames of warming up, without any noise, at the level of stop 0; and their lost lines."""
    screens, lost = run_link(STOP_LEVELS[0], WARM + REFERENCE_FRAMES, noise=False)
    return screens[WARM:], lost[WARM:]


@functools.lru_cache(maxsize=None)
def reference_screen():
    """The model screen of the measure: the mean of 16 frames after 2 frames of warming up at the level of stop 0."""
    screens, _ = run_link(STOP_LEVELS[0], WARM + REFERENCE_FRAMES)
    return screens[WARM:].mean(axis=0)


def measure(dbm):
    """(cleanliness, dB; share of lost lines) of a level: 10·lg(255²/mean square of the difference from the model
    screen) over all cells of 6 frames taken after reset and 2 frames of warming up; the share is their mean."""
    screens, lost = run_link(dbm, WARM + FRAMES)
    mean_square = np.mean((screens[WARM:] - reference_screen()) ** 2)
    return float(10 * np.log10(255 ** 2 / mean_square)), float(np.mean(lost[WARM:]))


def line_above(levels, clean):
    """(slope, intercept) of the least-squares straight line through the points from −62 to −74 dBm."""
    levels, clean = np.asarray(levels, dtype=float), np.asarray(clean, dtype=float)
    chosen = (levels <= ABOVE[0]) & (levels >= ABOVE[1])
    slope, intercept = np.polyfit(levels[chosen], clean[chosen], 1)
    return float(slope), float(intercept)


@functools.lru_cache(maxsize=None)
def snr_curve():
    """The curve of cleanliness against the level at the antenna, its slope above the threshold, the knee, and the
    same measure at the levels of the five stops."""
    points = {dbm: measure(dbm) for dbm in sorted(set(CURVE_LEVELS) | set(STOP_LEVELS), reverse=True)}
    clean = [points[dbm][0] for dbm in CURVE_LEVELS]
    slope, intercept = line_above(CURVE_LEVELS, clean)
    below = [dbm for dbm, c in zip(CURVE_LEVELS, clean) if slope * dbm + intercept - c > KNEE_DB]
    return {'levels': list(CURVE_LEVELS), 'clean': clean, 'syncLost': [points[dbm][1] for dbm in CURVE_LEVELS],
            'knee': max(below) if below else None, 'slopeAbove': slope,
            'stops': {'levels': list(STOP_LEVELS), 'clean': [points[dbm][0] for dbm in STOP_LEVELS],
                      'syncLost': [points[dbm][1] for dbm in STOP_LEVELS]},
            'frames': FRAMES, 'seed': SEED}


def flat_cells(luma):
    """«Level cells» of a frame, flattened: both neighbours in the row differ by at most 8; never the edge columns."""
    flat = np.zeros(luma.shape, dtype=bool)
    middle = luma[:, 1:-1]
    flat[:, 1:-1] = (np.abs(middle - luma[:, :-2]) <= 8) & (np.abs(middle - luma[:, 2:]) <= 8)
    return flat.ravel()


def print_curve(curve):
    slope, intercept = line_above(curve['levels'], curve['clean'])
    print('fm_chain: cleanliness against the level at the antenna (seed %d, %d frames after %d of warming up)' % (
        curve['seed'], curve['frames'], WARM))
    for dbm, clean, lost in zip(curve['levels'], curve['clean'], curve['syncLost']):
        print('  %4d dBm  clean %5.2f dB  syncLost %.3f  under the line %5.2f dB' % (
            dbm, clean, lost, slope * dbm + intercept - clean))
    print('  stops %s dBm: clean %s dB, syncLost %s' % (
        ' / '.join('%d' % v for v in curve['stops']['levels']), ' / '.join('%.2f' % v for v in curve['stops']['clean']),
        ' / '.join('%.3f' % v for v in curve['stops']['syncLost'])))
    clean = dict(zip(curve['levels'], curve['clean']))
    print('  slopeAbove %.3f dB per dB, knee %s dBm, clean(-74) - clean(-82) = %.2f dB' % (
        curve['slopeAbove'], curve['knee'], clean[-74] - clean[-82]))


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


def fx_link_noiseless():
    return {'screen': noiseless()[0].mean(axis=0)}


def fx_snr_curve():
    return snr_curve()


FIXTURES = {'standard.json': fx_standard, 'test-frame.json': fx_test_frame, 'video-lines.json': fx_video_lines,
            'fm-phase.json': fx_fm_phase, 'slope-curve.json': fx_slope_curve, 'angle.json': fx_angle,
            'link-noiseless.json': fx_link_noiseless, 'snr-curve.json': fx_snr_curve}


# --check compares these numbers of snr-curve.json (at its top and under `stops`) within a tolerance, and the rest of
# that file, the knee too, byte for byte: cleanliness ± 0.5 dB, the share of lost lines ± 0.03.
CURVE_TOLERANCE = {'clean': 0.5, 'syncLost': 0.03}


def dump(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n'


def render(build):
    return dump(sig6(build()))


def same_curve(have, fresh):
    """Whether the bytes `have` of snr-curve.json agree with the text `fresh` this script writes now: the numbers of
    CURVE_TOLERANCE within their tolerance, everything else byte for byte."""
    try:
        text = have.decode('utf-8')
        data, want = json.loads(text), json.loads(fresh)
        if dump(data) != text:  # not in the form this script writes
            return False
        for part, wanted in ((data, want), (data['stops'], want['stops'])):
            for key, tolerance in CURVE_TOLERANCE.items():
                mine, theirs = part[key], wanted[key]
                if len(mine) != len(theirs) or any(abs(a - b) > tolerance for a, b in zip(mine, theirs)):
                    return False
                part[key] = theirs
    except (ValueError, KeyError, TypeError):
        return False
    return dump(data) == fresh


def write(directory):
    directory = pathlib.Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for name, build in FIXTURES.items():
        (directory / name).write_text(render(build), encoding='utf-8', newline='\n')
    return len(FIXTURES)


def check(directory):
    """Names of the samples in `directory` that are not what this script writes now (a missing file differs too);
    snr-curve.json is compared by same_curve."""
    directory = pathlib.Path(directory)
    with tempfile.TemporaryDirectory() as fresh:
        write(fresh)
        differ = []
        for name in FIXTURES:
            have, now = directory / name, (pathlib.Path(fresh) / name).read_bytes()
            if not have.is_file():
                differ.append(name)
            elif name == 'snr-curve.json':
                if not same_curve(have.read_bytes(), now.decode('utf-8')):
                    differ.append(name)
            elif have.read_bytes() != now:
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
    # Carson's rule: twice (half the swing + the highest video frequency). Half the swing, 4.15 MHz, is not the peak
    # deviation: the sync bottom departs 4.3 MHz from the centre of the channel.
    carson = 2 * (DEVIATION['span'] / 2 + VIDEO_BW)
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

    # The whole link without noise: the rhythm keeps every line, and the picture is the test frame bent by the slope
    # detector (up to 6 % of the span, 16 levels) and softened by the video filter. The bounds are those the plan's
    # task B9b sets for the TypeScript link at the kitchen.
    screens, lost = noiseless()
    flat, mean = flat_cells(luma), screens.mean(axis=0)
    assert screens.shape == (REFERENCE_FRAMES, COLS * ROWS) and lost.max() == 0, 'without noise every line is kept'
    error = np.abs(mean - luma.ravel())[flat]
    assert error.mean() <= 6 and error.max() <= 30, 'level cells: %g on average, %g at most' % (error.mean(), error.max())
    print('fm_chain: without noise, level cells against the test frame: %.2f on average, %.0f at most; one frame '
          'departs from the mean of %d by up to %.2f' % (error.mean(), error.max(), REFERENCE_FRAMES,
                                                         np.abs(screens[:, flat] - mean[flat]).max()))

    # The whole link: the curve of cleanliness against the level at the antenna, and the levels of the five stops.
    curve = fx_snr_curve()
    print_curve(curve)
    levels, stops = curve['levels'], curve['stops']
    assert levels == list(CURVE_LEVELS) and stops['levels'] == list(STOP_LEVELS), 'levels of the curve and the stops'
    clean, lost = dict(zip(levels, curve['clean'])), dict(zip(levels, curve['syncLost']))
    at_stop, lost_at_stop = dict(zip(stops['levels'], stops['clean'])), dict(zip(stops['levels'], stops['syncLost']))
    assert 0.65 <= curve['slopeAbove'] <= 1.2, 'slope of the curve above the threshold: %g' % curve['slopeAbove']
    assert curve['knee'] is not None and -86 <= curve['knee'] <= -76, 'the knee: %r' % curve['knee']
    assert clean[-74] - clean[-82] >= 12, 'the fall from -74 to -82 dBm: %g dB' % (clean[-74] - clean[-82])
    assert lost[-74] < 0.02 and lost[-88] > 0.5, 'lost lines at -74 and -88 dBm: %g, %g' % (lost[-74], lost[-88])
    assert at_stop[-54] >= 38 and at_stop[-62] >= 38, 'stops 0 and 1 are clean: %g, %g' % (at_stop[-54], at_stop[-62])
    assert lost_at_stop[-54] == 0 and lost_at_stop[-62] == 0, 'stops 0 and 1 lose no line'
    assert 32 <= at_stop[-70] <= 38 and at_stop[-62] - at_stop[-70] >= 3, 'stop 2, a trace of grain: %g' % at_stop[-70]
    assert 16 <= at_stop[-78] <= 28 and lost_at_stop[-78] <= 0.1, 'stop 3, grain and the first sparks: %g, %g' % (
        at_stop[-78], lost_at_stop[-78])
    assert at_stop[-88] <= 14 and lost_at_stop[-88] >= 0.5, 'stop 4, snow: %g, %g' % (at_stop[-88], lost_at_stop[-88])

    # The samples: sizes the plan names, and text that reads back as the same numbers.
    sizes = {'test-frame.json': {'luma': COLS * ROWS}, 'fm-phase.json': {'u': 256, 'step': 256},
             'slope-curve.json': {'u': 21, 'out': 21}, 'angle.json': {'x': 128, 'u': 64},
             'link-noiseless.json': {'screen': COLS * ROWS},
             'snr-curve.json': {'levels': 17, 'clean': 17, 'syncLost': 17, 'stops': 3}}
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
    text = render(fx_snr_curve)
    written = json.loads(text)
    assert sorted(written) == ['clean', 'frames', 'knee', 'levels', 'seed', 'slopeAbove', 'stops', 'syncLost'], written
    assert all(len(written['stops'][key]) == 5 for key in ('levels', 'clean', 'syncLost')), 'snr-curve: the stops'
    assert (written['frames'], written['seed']) == (6, 2026) and isinstance(written['knee'], int), 'snr-curve'

    # --check on snr-curve.json: cleanliness ± 0.5 dB, lost lines ± 0.03, the rest byte for byte.
    def changed(part, key, by):
        """The written curve with `by` added to `key` (to every number of a list), at the top or under `stops`."""
        data = json.loads(text)
        place = data[part] if part else data
        place[key] = [v + by for v in place[key]] if isinstance(place[key], list) else place[key] + by
        return dump(data).encode('utf-8')

    assert same_curve(text.encode('utf-8'), text), 'the curve against itself'
    for part, key, by, same in ((None, 'clean', 0.45, True), (None, 'clean', -0.55, False),
                                (None, 'syncLost', 0.025, True), (None, 'syncLost', 0.035, False),
                                ('stops', 'clean', -0.45, True), ('stops', 'clean', 0.55, False),
                                ('stops', 'syncLost', -0.025, True), ('stops', 'syncLost', 0.035, False),
                                (None, 'slopeAbove', 1e-5, False), (None, 'knee', 2, False), (None, 'frames', 1, False),
                                (None, 'levels', 2, False), ('stops', 'levels', 2, False)):
        assert same_curve(changed(part, key, by), text) is same, '--check of snr-curve.json: %s %s %+g' % (
            part, key, by)
    assert not same_curve(text.replace(',', ', ', 1).encode('utf-8'), text), 'a curve not in the written form'
    assert not same_curve(b'{}', text) and not same_curve(b'\xff', text), 'a broken curve'
    print('fm_chain selftest: OK')


def main():
    parser = argparse.ArgumentParser(
        description='Reference model of the radio volume: standard, frame, detectors, the whole first link.')
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
