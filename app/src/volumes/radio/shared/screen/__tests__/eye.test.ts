import { afterEach, describe, expect, it, vi } from 'vitest';
import { Color, DataUtils, Object3D, Scene, Vector3, type WebGLRenderTarget } from 'three';
import type { ChapterContext } from '@/engine/api';
import { kGlobals } from '@/style';
import { autoExposure, createEye, EYE_SAMPLES, lumaAround, lumaFromPixels } from '../eye';

/** Stands for whatever target the engine had bound before the pass (the pipeline's scene buffer). */
const MAIN = { name: 'main' };

interface FakeOptions {
  half?: boolean;
  dt?: number;
  boom?: boolean;
  fill?: number;
  badRead?: boolean;
}

interface During {
  autoUpdate: boolean;
  hidden: boolean[];
  rim: Color;
}

/** A renderer that logs what the eye asks of it, and a context around it. */
function fake(o: FakeOptions = {}) {
  const log: string[] = [];
  const hidden = [new Object3D(), new Object3D()];
  hidden[1]!.visible = false;
  const tracked: WebGLRenderTarget[] = [];
  const read: { buf: Uint8Array | Uint16Array | null } = { buf: null };
  const during: During = { autoUpdate: false, hidden: [], rim: new Color() };
  /** Milliseconds the fake spends: render 3, read 2 (read by `fakeClock`). */
  const clock = { now: 0 };
  let badLeft = o.badRead ?? false;
  let glError = false;
  const r = {
    target: MAIN as unknown,
    capabilities: { textureTypeReadable: () => o.half ?? true },
    shadowMap: { autoUpdate: true },
    info: { render: { calls: 0 } },
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    getRenderTarget: () => r.target,
    setRenderTarget(t: unknown) {
      r.target = t;
      log.push(t === MAIN ? 'target:main' : 'target:eye');
    },
    clear() {
      log.push('clear');
    },
    render() {
      log.push('render');
      r.info.render.calls += 7;
      clock.now += 3;
      during.autoUpdate = r.shadowMap.autoUpdate;
      during.hidden = hidden.map((h) => h.visible);
      during.rim = kGlobals.uKRimColor.value.clone();
      if (o.boom) throw new Error('boom');
    },
    readRenderTargetPixels(
      _t: unknown,
      _x: number,
      _y: number,
      _w: number,
      _h: number,
      buf: Uint8Array | Uint16Array,
    ) {
      log.push('read');
      clock.now += 2;
      buf.fill(o.fill ?? 0);
      read.buf = buf;
      if (badLeft && buf instanceof Uint16Array) {
        badLeft = false;
        glError = true;
      }
    },
    getContext: () => ({
      NO_ERROR: 0,
      getError: () => {
        if (!glError) return 0;
        glError = false;
        return 1282;
      },
    }),
  };
  const ctx = {
    renderer: r,
    scene: new Scene(),
    clock: { dt: o.dt ?? 1 / 60 },
    track: (x: WebGLRenderTarget) => (tracked.push(x), x),
    env: { rig: { rimColor: new Color(1, 0, 0), rimDir: new Vector3(0, 1, 0), lookScale: 2 } },
  } as unknown as ChapterContext;
  return { ctx, r, log, hidden, tracked, during, read, clock };
}

/**
 * The wall clock moves only with the fake renderer (render 3 ms, read 2 ms) and with the CPU luma conversion after
 * the pass (1 ms per half float), so `lastMs` shows which of them it spans.
 */
function fakeClock(f: ReturnType<typeof fake>): void {
  const fromHalf = DataUtils.fromHalfFloat;
  vi.spyOn(performance, 'now').mockImplementation(() => f.clock.now);
  vi.spyOn(DataUtils, 'fromHalfFloat').mockImplementation((h: number) => {
    f.clock.now += 1;
    return fromHalf(h);
  });
}

function expectRestored(f: ReturnType<typeof fake>, rim: Color, dir: Vector3): void {
  expect(f.r.target).toBe(MAIN);
  expect(f.r.shadowMap.autoUpdate).toBe(true);
  expect(f.hidden.map((o) => o.visible)).toEqual([true, false]);
  expect(kGlobals.uKRimColor.value.equals(rim)).toBe(true);
  expect(kGlobals.uKRimDir.value.equals(dir)).toBe(true);
  expect(kGlobals.uKLookScale.value).toBe(1);
}

describe('eye', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('стан після capture — як до нього', () => {
    const f = fake();
    const rim = kGlobals.uKRimColor.value.clone();
    const dir = kGlobals.uKRimDir.value.clone();
    createEye(f.ctx, { hide: () => f.hidden }).capture();
    expectRestored(f, rim, dir);
  });

  it('…і тоді, коли render кидає виняток', () => {
    const f = fake({ boom: true });
    const rim = kGlobals.uKRimColor.value.clone();
    const dir = kGlobals.uKRimDir.value.clone();
    const eye = createEye(f.ctx, { hide: () => f.hidden });
    expect(() => eye.capture()).toThrow('boom');
    expectRestored(f, rim, dir);
  });

  it('один прохід: один clear, один render, одне читання', () => {
    const f = fake();
    const eye = createEye(f.ctx, { hide: () => f.hidden });
    fakeClock(f);
    eye.capture();
    expect(f.log).toEqual(['target:eye', 'clear', 'render', 'read', 'target:main']);
    expect(f.during.hidden).toEqual([false, false]);
    expect(f.during.rim.equals(new Color(1, 0, 0))).toBe(true);
    expect([eye.passes, eye.lastCalls]).toEqual([1, 7]);
    expect(eye.lastMs).toBe(5); // render and read; the luma conversion after the pass is not timed
  });

  it('capture: середнє → витримка → яскравість, той самий масив', () => {
    // every channel 1.0: mean 1 → exposure 0.5 → 0.5^(1/2.2)·255
    const f = fake({ fill: 15360 });
    const eye = createEye(f.ctx);
    const a = eye.capture();
    expect(a.length).toBe(12288);
    expect(a.every((v) => v === 186)).toBe(true);
    expect(eye.capture()).toBe(a);
  });

  it('тіні: живий кадр бере готову карту, зупинений оновлює її сам', () => {
    const live = fake({ dt: 1 / 60 });
    createEye(live.ctx).capture();
    expect(live.during.autoUpdate).toBe(false);
    const held = fake({ dt: 0 });
    createEye(held.ctx).capture();
    expect(held.during.autoUpdate).toBe(true);
  });

  it('запасний формат', () => {
    const a = fake({ half: false });
    const eye = createEye(a.ctx);
    eye.capture();
    expect(eye.format).toBe('byte');
    expect(a.read.buf).toBeInstanceOf(Uint8Array);
    expect(a.read.buf!.length).toBe(49152);

    const b = fake();
    const half = createEye(b.ctx);
    half.capture();
    expect(half.format).toBe('half');
    expect(b.read.buf).toBeInstanceOf(Uint16Array);
    expect(b.tracked[0]!.samples).toBe(EYE_SAMPLES);

    // the device promised half-float read-back and refused it
    const c = fake({ badRead: true });
    const bad = createEye(c.ctx);
    fakeClock(c);
    bad.capture();
    expect(bad.format).toBe('byte');
    expect(c.read.buf).toBeInstanceOf(Uint8Array);
    expect(c.tracked).toHaveLength(2);
    expect(bad.lastMs).toBe(5); // the repeated byte pass only, not the refused half pass before it
  });

  it('lumaFromPixels: рядки перевернуто, витримка, гама', () => {
    // in GL row 0 is the bottom one: [white, black]; the top one: [grey, red]
    const out = new Uint8Array(4);
    const bytes = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255, 255, 0, 0, 255]);
    lumaFromPixels(bytes, 'byte', 1, out, 2);
    expect([...out]).toEqual([186, 126, 255, 0]);
    lumaFromPixels(bytes, 'byte', 2, out, 2);
    expect([...out]).toEqual([255, 173, 255, 0]);
    const H1 = 15360,
      H05 = 14336,
      H2 = 16384; // 1.0, 0.5 and 2.0 in half precision
    const half = new Uint16Array([H1, H1, H1, H1, 0, 0, 0, H1, H05, H05, H05, H1, H2, 0, 0, H1]);
    lumaFromPixels(half, 'half', 1, out, 2);
    expect([...out]).toEqual([186, 173, 255, 0]);
    lumaFromPixels(half, 'half', 0.5, out, 2);
    expect([...out]).toEqual([136, 126, 186, 0]);
  });

  it('autoExposure', () => {
    expect(autoExposure(0.45)).toBeCloseTo(1, 9);
    expect(autoExposure(0.09)).toBeCloseTo(5, 9);
    expect(autoExposure(0.001)).toBe(8);
    expect(autoExposure(2)).toBe(0.5);
  });

  it('lumaAround: комірка й середнє сусідів', () => {
    const l = new Uint8Array(12288).fill(10);
    l[5 * 128 + 7] = 250;
    expect(lumaAround(l, 7, 5)).toEqual({ luma: 250, around: 10 });
    expect(lumaAround(l, 6, 5)).toEqual({ luma: 10, around: 40 }); // (7·10 + 250) / 8
    expect(lumaAround(l, 0, 0)).toEqual({ luma: 10, around: 10 }); // a corner has three neighbours
  });

  it('project', () => {
    // the camera sits at the origin and looks along −Z, 40° at 4 : 3
    const eye = createEye(fake().ctx);
    expect(eye.project(new Vector3(0, 0, -10))).toEqual({ col: 64, row: 48 });
    expect(eye.project(new Vector3(-1, 1, -10))).toEqual({ col: 50, row: 34 });
    expect(eye.project(new Vector3(0, 0, 10))).toBeNull();
    expect(eye.project(new Vector3(100, 0, -10))).toBeNull();
  });

  it('dispose звільняє текстуру', () => {
    const f = fake();
    const eye = createEye(f.ctx);
    let disposed = 0;
    f.tracked[0]!.addEventListener('dispose', () => disposed++);
    eye.dispose();
    expect(disposed).toBe(1);
  });
});
