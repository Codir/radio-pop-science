/**
 * The world of the volume (B14): the yard, the camera's eye on the lens of the first camera, the line to the signal
 * model and the monitor's screen behind the one call every chapter makes. A chapter sets the knobs of `line` (and
 * `probe`, the dusk, the wicket); the monitor shows what the model computed from what the eye saw — nothing else
 * ever writes to the screen.
 *
 * Every update: the yard follows the line (monitor, garage gate, tray) and runs its own life; the screen's glass
 * goes toward on or off; then the model. On a live page the line is pumped once per update and the eye takes a frame
 * only when the link asks for one. On a held page (`?freeze`, the plan's correction П11) the line is synchronous
 * and the model computes one `still` frame on a held frame (dt 0), and only when something changed: an update with
 * dt > 0 since the last held frame, or `line`, `probe`, the dusk or the wicket. Finally the screen lights the kitchen
 * by its power and the mean of the frame it shows.
 *
 * `mountWorld` builds the parts and calls `createWorld`, which runs the same logic on parts made by hand (the tests).
 */
import type { Object3D } from 'three';
import { type ChapterContext, damp } from '@/engine/api';
import {
  COLS,
  DEFAULT_STATE,
  type FmLinkState,
  type Meters,
  type ProbeData,
  type ProbeRequest,
} from '@radio/sim/core';
import { type Link, type LinkReply, createLink } from '../link';
import { MONITOR_SCREEN } from '../models';
import { EYE_COLS, EYE_ROWS, type Eye, type Screen, createEye, createScreen } from '../screen';
import { LENS, type Yard, mountYard } from '../yard';

// what chapters and sandboxes take from the world: `_dev` may import `@radio/shared/**` only (П7)
export { DEFAULT_STATE } from '@radio/sim/core';
export type {
  ChannelNo,
  FmLinkState,
  Meters,
  ProbeData,
  ProbeRequest,
  ProbeView,
  TapId,
} from '@radio/sim/core';
export { type RouteStop, YARD_SHOTS, screenShot } from '../yard';

export interface WorldOptions {
  /**
   * 'auto' (default) — the model in a background thread when there is one; 'sync' — on the main thread; 'off' — no
   * model, the screen stays dark.
   */
  link?: 'auto' | 'sync' | 'off';
  /** The model's seed, default 1. */
  seed?: number;
  /** 0 early evening … 1 night; the yard's own default when absent. */
  dusk?: number;
}

export interface RadioWorld {
  readonly yard: Yard;
  readonly eye: Eye;
  /** null with `link: 'off'`. */
  readonly link: Link | null;
  readonly screen: Screen;
  /** The state of the line. Steps write here, the model reads it on every frame of the model. */
  readonly line: FmLinkState;
  /** What the probe asks of the model with every frame; null — nothing. */
  probe: ProbeRequest | null;
  /** The meters of the frame on the screen; null until the first one. */
  readonly meters: Meters | null;
  /** The probe's answer that came with the frame on the screen. */
  readonly probeData: ProbeData | null;
  /** The camera's last frame (128·96) the model was fed: the eye's own array, zeros before the first. */
  readonly luma: Uint8Array;
  /** Puts `line` back to DEFAULT_STATE, field by field, in the same objects. */
  resetLine(): void;
  update(dt: number, t: number): void;
}

/** What `createWorld` runs on. `frozen`: the page is held (`?freeze`). */
export interface WorldParts {
  yard: Yard;
  eye: Eye;
  screen: Screen;
  link: Link | null;
  frozen: boolean;
}

/** How fast the glass follows the monitor's switch, 1/s (`damp`). */
const POWER_LAMBDA = 8;
const DEFAULT_SEED = 1;

/** FNV-1a, 32 bits, as eight hexadecimal digits. */
export function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

function meanOf(cells: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < cells.length; i++) sum += cells[i]!;
  return cells.length > 0 ? sum / cells.length : 0;
}

/** The mean |a[r][c + 1] − a[r][c]| over every row. */
function noiseOf(cells: Uint8Array, cols: number): number {
  const rows = Math.floor(cells.length / cols);
  let sum = 0;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const row = r * cols;
    for (let c = 0; c + 1 < cols; c++) {
      sum += Math.abs(cells[row + c + 1]! - cells[row + c]!);
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

const castsNoShadow = (o: Object3D): void => {
  o.castShadow = false;
};

/** The world on parts built already; `opts.dusk`, when given, goes to the yard (`link` and `seed` are mountWorld's). */
export function createWorld(ctx: ChapterContext, parts: WorldParts, opts: WorldOptions = {}): RadioWorld {
  const { yard, eye, screen, link, frozen } = parts;
  if (opts.dusk !== undefined) yard.dusk = opts.dusk;
  const line: FmLinkState = structuredClone(DEFAULT_STATE);
  let probe: ProbeRequest | null = null;
  /** The reply on the screen. */
  let last: LinkReply | null = null;
  let luma: Uint8Array = new Uint8Array(EYE_COLS * EYE_ROWS);
  let shown = 0;
  let shownMean = 0;
  /** Held page: an update with dt > 0 came since the last held frame. */
  let moved = false;
  /** Held page: what the last held frame was computed for. */
  let heldFor = '';

  const capture = (): Uint8Array => (luma = eye.capture());
  const show = (reply: LinkReply): void => {
    last = reply;
    screen.show(reply.screen);
    shownMean = meanOf(reply.screen);
    shown++;
  };

  ctx.qa.expose('radio-world', () => ({
    mode: link?.mode ?? 'off',
    frames: shown,
    fps: link?.fps ?? 0,
    modelMs: last?.ms ?? 0,
    meters: last?.meters ?? null,
    screenHash: fnv1a(screen.luma),
    screenMean: meanOf(screen.luma),
    screenNoise: noiseOf(screen.luma, COLS),
    eye: { format: eye.format, passes: eye.passes, lastMs: eye.lastMs, lastCalls: eye.lastCalls },
  }));
  // one disposer for the mount (Review Focus 3); the link's own one in createLink is harmless twice
  ctx.onDispose(() => {
    link?.dispose();
    eye.dispose();
    screen.dispose();
  });

  return {
    yard,
    eye,
    link,
    screen,
    line,
    get probe() {
      return probe;
    },
    set probe(p: ProbeRequest | null) {
      probe = p;
    },
    get meters() {
      return last?.meters ?? null;
    },
    get probeData() {
      return last?.probe ?? null;
    },
    get luma() {
      return luma;
    },

    resetLine(): void {
      Object.assign(line.air, DEFAULT_STATE.air);
      Object.assign(line.camera, DEFAULT_STATE.camera);
      Object.assign(line.monitor, DEFAULT_STATE.monitor);
    },

    update(dt: number, t: number): void {
      // 1. the yard follows the line; chapters do not call yard.update themselves
      yard.monitorAt(line.air.route, line.air.nudge);
      yard.garageGate = line.air.gate;
      yard.tray = line.air.tray;
      yard.update(dt, t);
      // on a live frame the eye reuses the shadow map of the main render (B1a): what it must not see must not cast
      // a shadow there either, or the monitor would show the shadow of a stand without the stand
      for (const o of yard.hidden) o.traverse(castsNoShadow);

      // 2. the glass: a held frame (dt 0) shows the switch at once
      const power = link !== null && line.monitor.on ? 1 : 0;
      screen.power = dt === 0 ? power : damp(screen.power, power, POWER_LAMBDA, dt);

      // 3. the model
      if (link !== null) {
        if (frozen) {
          if (dt > 0) {
            moved = true;
          } else {
            const now = JSON.stringify([line, probe, yard.dusk, yard.wicket]);
            if (moved || now !== heldFor) {
              // cleared before the call: a state the model refuses throws once, not on every held frame
              moved = false;
              heldFor = now;
              show(link.still(line, capture(), probe));
            }
          }
        } else if (link.pump(line, capture, probe) && link.frame !== null) {
          show(link.frame);
        }
      }

      // 4. the screen's light on the kitchen
      yard.screenLight = (screen.power * shownMean) / 255;
    },
  };
}

export function mountWorld(ctx: ChapterContext, opts: WorldOptions = {}): RadioWorld {
  const frozen = new URLSearchParams(globalThis.location?.search ?? '').has('freeze');
  const yard = mountYard(ctx, { dusk: opts.dusk });
  const screen = createScreen(MONITOR_SCREEN);
  yard.anchors.monitorScreen.add(screen.object);
  const eye = createEye(ctx, { fov: LENS.fov, hide: () => yard.hidden });
  // the eye looks where the lens looks
  yard.anchors.lens.add(eye.camera);
  // a held page needs no background thread
  const link =
    opts.link === 'off'
      ? null
      : createLink(ctx, {
          seed: opts.seed ?? DEFAULT_SEED,
          mode: frozen || opts.link === 'sync' ? 'sync' : 'auto',
        });
  return createWorld(ctx, { yard, eye, screen, link, frozen }, opts);
}
