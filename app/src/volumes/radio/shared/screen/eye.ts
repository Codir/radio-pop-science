/**
 * The camera's eye (decision 24): one extra renderer pass of the chapter's world scene into a 128 × 96 target of its
 * own, read back and turned into the luma the signal model encodes. Every cell is the average of four samples
 * (`EYE_SAMPLES`), like a cell of a real sensor averages its own area, so fine details do not flicker.
 *
 * The pass leaves the renderer as it found it: render target (with cube face and mip level), shadow-map auto update,
 * the visibility of hidden objects and the rim values of `kGlobals` (during chapter `update` they hold the HUD rig,
 * so the pass writes the world rig of `ctx.env.rig` for its own render) are saved before and restored in `finally`.
 */
import {
  Color,
  DataUtils,
  HalfFloatType,
  NearestFilter,
  type Object3D,
  PerspectiveCamera,
  RGBAFormat,
  type TextureDataType,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import type { ChapterContext } from '@/engine/api';
import { kGlobals } from '@/style';

export const EYE_COLS = 128;
export const EYE_ROWS = 96;
/** Multisample count of the eye's target: four samples per cell. */
export const EYE_SAMPLES = 4;

const PIXELS = EYE_COLS * EYE_ROWS;
const GAMMA = 1 / 2.2;
/** Mean linear luminance the auto exposure brings the frame to. */
const EXPOSURE_TARGET = 0.45;
const EXPOSURE_FLOOR = 0.02;
const EXPOSURE_MIN = 0.5;
const EXPOSURE_MAX = 8;
const NOTHING: readonly Object3D[] = [];

export interface EyeOptions {
  /** Vertical field of view, degrees (default 40). */
  fov?: number;
  /** World-layer objects the camera in the yard must not see (stands, probe, map, labels); asked on every pass. */
  hide?: () => readonly Object3D[];
}

export interface Eye {
  /** `mountWorld` makes it a child of `yard.anchors.lens`: the eye looks where the lens looks. */
  readonly camera: PerspectiveCamera;
  /** Format of the eye's own 128 × 96 target. */
  readonly format: 'half' | 'byte';
  /** Renderer passes so far. */
  readonly passes: number;
  /**
   * Wall-clock milliseconds of the last pass, from saving the renderer state to the end of its restore (render and
   * read-back included, the CPU luma conversion after it not) — for the report only.
   */
  readonly lastMs: number;
  /** Draw calls of the last pass. */
  readonly lastCalls: number;
  /** One extra renderer pass (decision 24) and the luma read-back; returns the same array every time. */
  capture(): Uint8Array;
  /** The cell the eye sees a world point in, or null when the point is outside the frame. */
  project(world: Vector3): { col: number; row: number } | null;
  dispose(): void;
}

/** Exposure that brings a frame of mean linear luminance `meanY` to the target, clamped to 0.5…8. */
export function autoExposure(meanY: number): number {
  const e = EXPOSURE_TARGET / Math.max(meanY, EXPOSURE_FLOOR);
  return Math.min(EXPOSURE_MAX, Math.max(EXPOSURE_MIN, e));
}

/** Linear channel value of RGBA pixel data. */
function channel(src: Uint16Array | Uint8Array, format: 'half' | 'byte', i: number): number {
  return format === 'half' ? DataUtils.fromHalfFloat(src[i]!) : src[i]! / 255;
}

/** Linear luminance Y of the pixel whose red channel is at `i`. */
function luminance(src: Uint16Array | Uint8Array, format: 'half' | 'byte', i: number): number {
  return (
    0.2126 * channel(src, format, i) +
    0.7152 * channel(src, format, i + 1) +
    0.0722 * channel(src, format, i + 2)
  );
}

function meanLuminance(src: Uint16Array | Uint8Array, format: 'half' | 'byte'): number {
  const n = src.length / 4;
  let sum = 0;
  for (let p = 0; p < n; p++) {
    const y = luminance(src, format, p * 4);
    if (y > 0) sum += y; // a NaN pixel must not blacken the whole frame
  }
  return n > 0 ? sum / n : 0;
}

/**
 * Camera luma from the linear colours of a frame: Y = 0.2126 R + 0.7152 G + 0.0722 B, × exposure, clamped to 0…1,
 * gamma 1/2.2, × 255. `src` is RGBA as `readPixels` gives it (row 0 at the bottom); `out` gets row 0 at the top.
 */
export function lumaFromPixels(
  src: Uint16Array | Uint8Array,
  format: 'half' | 'byte',
  exposure: number,
  out: Uint8Array,
  cols = EYE_COLS,
): void {
  const rows = out.length / cols;
  for (let r = 0; r < rows; r++) {
    const from = r * cols;
    const to = (rows - 1 - r) * cols;
    for (let c = 0; c < cols; c++) {
      const y = luminance(src, format, (from + c) * 4) * exposure;
      const v = y > 0 ? (y < 1 ? y : 1) : 0; // NaN reads as black
      out[to + c] = Math.round(Math.pow(v, GAMMA) * 255);
    }
  }
}

/** A cell of a luma frame and the mean of its neighbours inside the frame (up to eight). */
export function lumaAround(
  luma: Uint8Array,
  col: number,
  row: number,
  cols = EYE_COLS,
): { luma: number; around: number } {
  const rows = luma.length / cols;
  let sum = 0;
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    const r = row + dr;
    if (r < 0 || r >= rows) continue;
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      if ((dr === 0 && dc === 0) || c < 0 || c >= cols) continue;
      sum += luma[r * cols + c]!;
      n++;
    }
  }
  return { luma: luma[row * cols + col]!, around: n > 0 ? sum / n : 0 };
}

/** Clear the GL error flags raised before the read, so the check after it sees only the read's own error. */
function drainErrors(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  for (let i = 0; i < 16; i++) if (gl.getError() === gl.NO_ERROR) return;
}

export function createEye(ctx: ChapterContext, opts: EyeOptions = {}): Eye {
  const renderer = ctx.renderer;
  const camera = new PerspectiveCamera(opts.fov ?? 40, EYE_COLS / EYE_ROWS, 0.1, 200);
  const hide = opts.hide ?? ((): readonly Object3D[] => NOTHING);

  const makeTarget = (type: TextureDataType): WebGLRenderTarget =>
    ctx.track(
      new WebGLRenderTarget(EYE_COLS, EYE_ROWS, {
        type,
        format: RGBAFormat,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        depthBuffer: true,
        generateMipmaps: false,
        samples: EYE_SAMPLES,
      }),
    );

  let format: 'half' | 'byte' = renderer.capabilities.textureTypeReadable(HalfFloatType) ? 'half' : 'byte';
  let target = makeTarget(format === 'half' ? HalfFloatType : UnsignedByteType);
  let pixels: Uint16Array | Uint8Array =
    format === 'half' ? new Uint16Array(PIXELS * 4) : new Uint8Array(PIXELS * 4);
  // three calls half floats readable as soon as a float colour-buffer extension exists (WebGLCapabilities.js:40-52),
  // yet a device may still refuse the read: the first half-float pass checks the GL error flag.
  let readChecked = format !== 'half';
  const luma = new Uint8Array(PIXELS);

  let passes = 0;
  let lastMs = 0;
  let lastCalls = 0;

  // saved state, reused every pass
  const savedRim = new Color();
  const savedDir = new Vector3();
  const savedVisible: boolean[] = [];
  const point = new Vector3();

  /** One pass into the eye's target and the read-back; true when the device reported an error on the read. */
  const pass = (checkRead: boolean): boolean => {
    const t0 = performance.now();
    const gl = checkRead ? renderer.getContext() : null;
    const prevTarget = renderer.getRenderTarget();
    const prevFace = renderer.getActiveCubeFace();
    const prevMip = renderer.getActiveMipmapLevel();
    const prevAutoUpdate = renderer.shadowMap.autoUpdate;
    const hidden = hide();
    savedVisible.length = 0;
    for (const o of hidden) savedVisible.push(o.visible);
    savedRim.copy(kGlobals.uKRimColor.value);
    savedDir.copy(kGlobals.uKRimDir.value);
    const savedLookScale = kGlobals.uKLookScale.value;
    let failed = false;
    try {
      // a live frame takes the shadow map of the previous frame; a held one (dt 0, `?freeze`) redraws it itself
      if (ctx.clock.dt > 0) renderer.shadowMap.autoUpdate = false;
      for (const o of hidden) o.visible = false;
      const rig = ctx.env.rig;
      kGlobals.uKRimColor.value.copy(rig.rimColor);
      kGlobals.uKRimDir.value.copy(rig.rimDir).normalize();
      kGlobals.uKLookScale.value = rig.lookScale ?? 1;
      renderer.setRenderTarget(target);
      renderer.clear(true, true, true);
      const calls = renderer.info.render.calls;
      renderer.render(ctx.scene, camera);
      lastCalls = renderer.info.render.calls - calls;
      passes++;
      if (gl) drainErrors(gl);
      renderer.readRenderTargetPixels(target, 0, 0, EYE_COLS, EYE_ROWS, pixels);
      if (gl) failed = gl.getError() !== gl.NO_ERROR;
    } finally {
      renderer.setRenderTarget(prevTarget, prevFace, prevMip);
      renderer.shadowMap.autoUpdate = prevAutoUpdate;
      for (let i = 0; i < hidden.length; i++) hidden[i]!.visible = savedVisible[i]!;
      kGlobals.uKRimColor.value.copy(savedRim);
      kGlobals.uKRimDir.value.copy(savedDir);
      kGlobals.uKLookScale.value = savedLookScale;
    }
    lastMs = performance.now() - t0;
    return failed;
  };

  return {
    camera,
    get format() {
      return format;
    },
    get passes() {
      return passes;
    },
    get lastMs() {
      return lastMs;
    },
    get lastCalls() {
      return lastCalls;
    },
    capture(): Uint8Array {
      if (readChecked) {
        pass(false);
      } else {
        const failed = pass(true);
        readChecked = true;
        if (failed) {
          target.dispose();
          target = makeTarget(UnsignedByteType);
          format = 'byte';
          pixels = new Uint8Array(PIXELS * 4);
          pass(false);
        }
      }
      lumaFromPixels(pixels, format, autoExposure(meanLuminance(pixels, format)), luma);
      return luma;
    },
    project(world: Vector3): { col: number; row: number } | null {
      camera.updateMatrixWorld();
      const p = point.copy(world).project(camera);
      if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z < -1 || p.z > 1) return null;
      return {
        col: Math.min(EYE_COLS - 1, Math.floor(((p.x + 1) / 2) * EYE_COLS)),
        row: Math.min(EYE_ROWS - 1, Math.floor(((1 - p.y) / 2) * EYE_ROWS)),
      };
    },
    dispose(): void {
      target.dispose();
    },
  };
}
