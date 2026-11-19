/**
 * The whole first link: the household wireless camera and its monitor, frame by frame.
 *
 * One call of `step` is one frame of the camera, 6.4 ms of model time, computed in the order of the contract:
 * the camera's frame → `encodeFrame` (the signal u with sync pulses) → the modulator (an arrow of length 1 that
 * turns with u) → the placer (the camera's channel `txChannel` in the band) → the rays of `trace` → the router
 * and the oven → the noise of the antenna → the receiver on channel `rxChannel ?? txChannel` (the input filter,
 * the amplifier with its ceiling, the shift, the filter of the channel and every fifth pair) → the limiter →
 * the slope or the angle detector → the filter of the video signal → the decoder with its own line rhythm → the
 * screen. Every block keeps its memory from frame to frame, so the stream is continuous.
 *
 * Nothing here draws a fault. Snow, torn lines, a rolling picture and a dark screen are what these blocks make of
 * the state of the yard and of the monitor's knobs.
 */
import { type AirState, createAir, trace } from './channel';
import { DELAY_LATENCY } from './dsp';
import {
  createAngleDetector,
  createModulator,
  createSlopeDetector,
  createVideoFilter,
  limit,
  LIMITER_FLOOR_DBM,
  SYNC_THRESHOLD,
  VIDEO_TAPS,
} from './fm';
import { createInterferers } from './interferers';
import { createProbe, type ProbeData, type ProbeRequest, type TapId } from './probe';
import {
  ANTENNA_NOISE_SIGMA,
  CHANNEL_FILTER,
  createFrontEnd,
  createPlacer,
  INPUT_FILTER,
  NOISE_DBM_IN_CHANNEL,
} from './rf';
import { createRng } from './rng';
import { SITE } from './site';
import { createFft } from './spectrum';
import {
  BAND,
  type ChannelNo,
  COLS,
  FRAME_CH,
  FRAME_WB,
  FS_CH,
  FS_WB,
  IF,
  OVERSAMPLE,
  ROWS,
} from './standard';
import { dbmToAmp } from './units';
import { createDecoder, type DecoderParams, encodeFrame } from './video';

/** The camera. */
export interface CameraState {
  /** false: the sync block is taken out, and the camera sends black where the pulses were. */
  sync: boolean;
}

/** The monitor and its knobs. */
export interface MonitorState {
  on: boolean;
  /** The channel the monitor listens to; null: it follows the camera's channel. */
  rxChannel: ChannelNo | null;
  /** The monitor's own line rhythm, samples per line; the right one is 288 (the model holds it to 240…336). */
  lineLength: number;
  /** 0…1: how far the rhythm listens to the sync pulses. */
  syncTrust: number;
  detector: 'slope' | 'angle';
  limiter: boolean;
}

export interface FmLinkState {
  air: AirState;
  camera: CameraState;
  monitor: MonitorState;
}

/**
 * What the monitor's meters read in one frame. The three `line…` numbers are counted from the picture that has
 * reached the monitor, and positive moves it to the left: the camera's cell (c, r) stands on the screen in column
 * c − (lineOffset + r·lineDrift)·128/234 and in row (r + lineRow) mod 100.
 */
export interface Meters {
  /** The level in the middle of the camera's channel on the monitor's antenna, dBm, and the field that gives it, V/m. */
  rxDbm: number;
  fieldVm: number;
  /** rxDbm against the noise in the filter of the channel, −92 dBm. */
  cnrDb: number;
  /** The part of the lines of this frame, 0…1, whose sync pulse was not found within 16 samples of its place. */
  syncLost: number;
  /**
   * How many samples the start of the monitor's line lags behind the camera's on the first line of the frame, read
   * where the frame begins. While the pulses hold the picture this is where the picture stands; with little trust
   * and a line length far from 288 the reading can fall past the monitor's own line boundary and differ from the
   * picture by a few samples.
   */
  lineOffset: number;
  /** How many samples more it lags with every line (about lineLength − 288 without sync pulses). */
  lineDrift: number;
  /** The row of the screen (0…99) where the monitor begins the camera's frame; 0 while the frame mark holds. */
  lineRow: number;
}

/** One frame of the link: the screen (128·96, row 0 on top), the meters, and what the probe asked for. */
export interface FmLinkFrame {
  screen: Uint8Array;
  meters: Meters;
  probe: ProbeData | null;
}

export interface FmLink {
  /**
   * The next frame; it goes on from the one before. The returned frame, its meters and its arrays belong to the
   * link and live until the next call. A damaged state or a frame of another size is a RangeError, thrown before
   * any block moves; no field is replaced by a value of the link's own.
   */
  step(state: FmLinkState, luma: Uint8Array, probe?: ProbeRequest | null): FmLinkFrame;
  /** A frame that depends only on (seed, state, luma): `reset()`, one frame of warming up, then this frame. */
  still(state: FmLinkState, luma: Uint8Array, probe?: ProbeRequest | null): FmLinkFrame;
  /** Starts every block again: after it the frames repeat bit for bit. */
  reset(): void;
}

/**
 * The delay of the chain, samples of the channel: how much later the picture reaches the decoder than the camera
 * sent it. Counted from the lengths of the filters: the interpolator of the placer and the filter of the channel
 * (both CHANNEL_FILTER, half its length each), the input filter, the latency of the delay lines (all at the band's
 * rate, so divided by OVERSAMPLE) and the filter of the video signal. With 63, 47 and 31 taps: (62 + 23 + 5)/5 + 15.
 */
export const CHAIN_DELAY: number =
  (CHANNEL_FILTER.length - 1 + (INPUT_FILTER.length - 1) / 2 + DELAY_LATENCY) / OVERSAMPLE +
  (VIDEO_TAPS - 1) / 2;

/**
 * The kitchen with everything as it should be: route 1, nothing moved, the gate shut, no tray, 10 mW on channel 3,
 * no router and no oven; the camera with its sync block; the monitor on, following the camera's channel, the right
 * line length, trust 0.25, the slope detector and the limiter. Frozen: a copy is changed, not this.
 */
export const DEFAULT_STATE: FmLinkState = Object.freeze({
  air: Object.freeze<AirState>({
    route: 1,
    nudge: 0,
    gate: 0,
    tray: 0,
    txPowerMw: 10,
    txChannel: 3,
    router: false,
    oven: false,
  }),
  camera: Object.freeze<CameraState>({ sync: true }),
  monitor: Object.freeze<MonitorState>({
    on: true,
    rxChannel: null,
    lineLength: 288,
    syncTrust: 0.25,
    detector: 'slope',
    limiter: true,
  }),
});

const CELLS = COLS * ROWS;
/** The power of the camera is held to 0.1…10 mW, as `trace` and the air hold it. */
const TX_MW_LEAST = 0.1;
const TX_MW_MOST = 10;
/** The labels of the forks of the seed: the air, the router and the oven, the receiver, the line rhythm. */
const FORK = { air: 1, interferers: 2, receiver: 3, rhythm: 4 } as const;
/** The rates of the taps, model Hz, and the real middles of the taps of pairs (a real tap has none). */
const RATES: Record<TapId, number> = {
  'camera.video': FS_CH,
  'air.rx': FS_WB,
  'rx.shifted': FS_CH,
  'rx.limited': FS_CH,
  'rx.detected': FS_CH,
};
const CENTRES: Record<TapId, number> = {
  'camera.video': 0,
  'air.rx': BAND.centre,
  'rx.shifted': IF,
  'rx.limited': IF,
  'rx.detected': 0,
};

/** A value in a message: an object by its kind, so that a frame of floats does not print all its numbers. */
function told(value: unknown): string {
  if (typeof value !== 'object' || value === null) return String(value);
  return `a ${(value as { constructor?: { name?: string } }).constructor?.name ?? 'bare object'}`;
}

function refuse(what: string, value: unknown): never {
  throw new RangeError(`fm-link: ${what} is ${told(value)}`);
}

const isPart = (v: unknown): boolean => typeof v === 'object' && v !== null;

function finite(v: unknown, what: string): void {
  if (typeof v !== 'number' || !Number.isFinite(v)) refuse(what, v);
}

function flag(v: unknown, what: string): void {
  if (typeof v !== 'boolean') refuse(what, v);
}

function channel(v: unknown, what: string): void {
  if (v !== 1 && v !== 2 && v !== 3 && v !== 4) refuse(what, v);
}

/**
 * Refuses a damaged state or frame, before any block of the chain sees it. A missing part, a field of the wrong
 * kind, a number that is not finite, a channel other than 1…4 or a frame that is not 128·96 bytes is a RangeError.
 * A finite number outside its range is not damage: the blocks hold it to the range, as the contract says.
 */
function check(state: FmLinkState, luma: Uint8Array): void {
  if (!isPart(state)) refuse('the state', state);
  const { air, camera, monitor } = state;
  if (!isPart(air)) refuse('air', air);
  if (!isPart(camera)) refuse('camera', camera);
  if (!isPart(monitor)) refuse('monitor', monitor);
  finite(air.route, 'air.route');
  finite(air.nudge, 'air.nudge');
  finite(air.gate, 'air.gate');
  finite(air.tray, 'air.tray');
  finite(air.txPowerMw, 'air.txPowerMw');
  channel(air.txChannel, 'air.txChannel');
  flag(air.router, 'air.router');
  flag(air.oven, 'air.oven');
  flag(camera.sync, 'camera.sync');
  flag(monitor.on, 'monitor.on');
  if (monitor.rxChannel !== null) channel(monitor.rxChannel, 'monitor.rxChannel');
  finite(monitor.lineLength, 'monitor.lineLength');
  finite(monitor.syncTrust, 'monitor.syncTrust');
  if (monitor.detector !== 'slope' && monitor.detector !== 'angle')
    refuse('monitor.detector', monitor.detector);
  flag(monitor.limiter, 'monitor.limiter');
  if (!(luma instanceof Uint8Array)) refuse('the frame', luma);
  if (luma.length !== CELLS) refuse('the frame', `${luma.length} cells, not ${CELLS}`);
}

/**
 * The link of seed `seed`. Its parts draw from forks of the seed, `createRng(seed).fork(k).u32()`: 1 the air (the
 * noise of the antenna), 2 the router and the oven, 3 the receiver, 4 the line rhythm. All the link's buffers are
 * made here; the blocks make their own work arrays on the first frame, and since every block is always given the
 * same lengths, no frame after it makes a new one.
 *
 * - The camera puts its signal on `txChannel`; the antenna starts every frame from silence; the noise of the
 *   antenna has the deviation ANTENNA_NOISE_SIGMA. The receiver listens to `rxChannel ?? txChannel` with the full
 *   gain and the input filter in the way.
 * - The limiter brings every pair at least dbmToAmp(LIMITER_FLOOR_DBM) long to the length 1. Without it the signal
 *   is divided by the amplitude of the direct ray alone, dbmToAmp(10·lg(txPowerMw) + gain of ray 0): the receiver
 *   is set for the direct wave, and everything else rocks the brightness.
 * - The decoder cuts the pulses at SYNC_THRESHOLD of the detector, listens to them with `syncTrust` and gets
 *   `delay: CHAIN_DELAY`, so its line numbers are counted from the picture that has reached it.
 * - A monitor that is off computes nothing: the camera and the air go on (the probe on the antenna still works),
 *   the screen and the taps `rx.*` are zeros, and so are syncLost, lineOffset, lineDrift and lineRow; the level
 *   and the field are those of the air. Its receiver goes on from where it stopped when it is on again.
 * - The probe reads the taps of this frame: `camera.video` (28 800 samples of u), `air.rx` (144 000 pairs on the
 *   antenna, after the noise), `rx.shifted` and `rx.limited` (28 800 pairs after the filter of the channel and
 *   after the limiter, shown round IF), `rx.detected` (28 800 samples after the filter of the video signal); its
 *   scale is a transform of 1024 pairs.
 */
export function createFmLink(seed: number): FmLink {
  const root = createRng(seed);
  const modulator = createModulator();
  const placer = createPlacer();
  const air = createAir(root.fork(FORK.air).u32());
  const interferers = createInterferers(root.fork(FORK.interferers).u32());
  const receiver = createFrontEnd(root.fork(FORK.receiver).u32());
  receiver.gainDb = 0;
  receiver.inputFilter = true;
  const slope = createSlopeDetector();
  const angle = createAngleDetector();
  const videoFilter = createVideoFilter();
  const decoder = createDecoder(root.fork(FORK.rhythm).u32());
  const probe = createProbe();
  const fft = createFft(1024);
  const floor = dbmToAmp(LIMITER_FLOOR_DBM);

  const video = new Float32Array(FRAME_CH); // u on the camera's cable
  const carrier = new Float32Array(2 * FRAME_CH); // the modulator's arrow
  const sent = new Float32Array(2 * FRAME_WB); // the camera's channel in the band
  const antenna = new Float32Array(2 * FRAME_WB);
  const shifted = new Float32Array(2 * FRAME_CH);
  const limited = new Float32Array(2 * FRAME_CH);
  const turned = new Float32Array(FRAME_CH); // the detector's output before the filter of the video signal
  const detected = new Float32Array(FRAME_CH);
  const screen = new Uint8Array(CELLS);
  const taps: Record<TapId, Float32Array> = {
    'camera.video': video,
    'air.rx': antenna,
    'rx.shifted': shifted,
    'rx.limited': limited,
    'rx.detected': detected,
  };
  const encoding = { sync: true };
  const params: DecoderParams = { lineLength: 288, trust: 0.25, threshold: 0, delay: CHAIN_DELAY };
  const meters: Meters = {
    rxDbm: 0,
    fieldVm: 0,
    cnrDb: 0,
    syncLost: 0,
    lineOffset: 0,
    lineDrift: 0,
    lineRow: 0,
  };
  const frame: FmLinkFrame = { screen, meters, probe: null };

  const reset = (): void => {
    modulator.reset();
    placer.reset();
    air.reset();
    interferers.reset();
    receiver.reset();
    slope.reset();
    angle.reset();
    videoFilter.reset();
    decoder.reset();
    screen.fill(0);
  };

  const step = (state: FmLinkState, luma: Uint8Array, request?: ProbeRequest | null): FmLinkFrame => {
    check(state, luma);
    const { air: yard, camera, monitor } = state;
    const path = trace(SITE, yard);

    // the camera and the air
    encoding.sync = camera.sync;
    encodeFrame(luma, video, encoding);
    modulator.process(video, carrier);
    sent.fill(0);
    placer.place(carrier, yard.txChannel, sent);
    antenna.fill(0);
    air.apply(sent, path, yard.txPowerMw, antenna);
    interferers.add(antenna, yard, SITE);
    air.noise(antenna, ANTENNA_NOISE_SIGMA);
    meters.rxDbm = path.rxDbm;
    meters.fieldVm = path.fieldVm;
    meters.cnrDb = path.rxDbm - NOISE_DBM_IN_CHANNEL;

    if (monitor.on) {
      // the monitor
      receiver.process(antenna, monitor.rxChannel ?? yard.txChannel, shifted);
      if (monitor.limiter) {
        limited.set(shifted);
        limit(limited, floor);
      } else {
        const power = Math.min(TX_MW_MOST, Math.max(TX_MW_LEAST, yard.txPowerMw));
        const k = 1 / dbmToAmp(10 * Math.log10(power) + path.rays[0]!.gainDb);
        for (let i = 0, n = shifted.length; i < n; i++) limited[i] = shifted[i]! * k;
      }
      (monitor.detector === 'angle' ? angle : slope).process(limited, turned);
      videoFilter.process(turned, detected);
      params.lineLength = monitor.lineLength;
      params.trust = monitor.syncTrust;
      params.threshold = SYNC_THRESHOLD[monitor.detector];
      const seen = decoder.process(detected, params, screen);
      meters.syncLost = seen.lines > 0 ? seen.lost / seen.lines : 0;
      meters.lineOffset = seen.lineOffset;
      meters.lineDrift = seen.lineDrift;
      meters.lineRow = seen.lineRow;
    } else {
      shifted.fill(0);
      limited.fill(0);
      detected.fill(0);
      screen.fill(0);
      meters.syncLost = 0;
      meters.lineOffset = 0;
      meters.lineDrift = 0;
      meters.lineRow = 0;
    }

    const asked = request ?? null;
    frame.probe = asked === null ? null : probe.read(asked, taps, RATES, CENTRES, fft);
    return frame;
  };

  return {
    step,
    still(state, luma, request) {
      check(state, luma);
      reset();
      step(state, luma, null);
      return step(state, luma, request);
    },
    reset,
  };
}
