import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, Object3D, PerspectiveCamera } from 'three';
import type { ChapterContext } from '@/engine/api';
import { COLS, DEFAULT_STATE, type FmLinkState, type Meters, type ProbeRequest, ROWS } from '@radio/sim/core';
import { type Link, type LinkReply, createLink } from '../../link';
import { MONITOR_SCREEN } from '../../models';
import { EYE_COLS, EYE_ROWS, type Eye, type Screen, createEye, createScreen } from '../../screen';
import { LENS, type Yard, mountYard } from '../../yard';
import type * as LinkModule from '../../link';
import type * as ScreenModule from '../../screen';
import type * as YardModule from '../../yard';
import { createWorld, fnv1a, mountWorld } from '..';

// mountWorld's own parts are watched (the real ones run underneath) and the yard is a stand-in: the real one needs
// the whole engine. createWorld's tests below build every part by hand and never reach these.
vi.mock('../../yard', async (importOriginal) => ({
  ...(await importOriginal<typeof YardModule>()),
  mountYard: vi.fn(),
}));
vi.mock('../../screen', async (importOriginal) => {
  const real = await importOriginal<typeof ScreenModule>();
  return { ...real, createEye: vi.fn(real.createEye), createScreen: vi.fn(real.createScreen) };
});
vi.mock('../../link', async (importOriginal) => {
  const real = await importOriginal<typeof LinkModule>();
  return { ...real, createLink: vi.fn(real.createLink) };
});

const CELLS = COLS * ROWS;

const METERS: Meters = {
  rxDbm: -62,
  fieldVm: 0.03,
  cnrDb: 30,
  syncLost: 0,
  lineOffset: 0,
  lineDrift: 0,
  lineRow: 0,
};

interface Calls {
  capture: number;
  still: number;
  pump: number;
  show: number;
  disposed: string[];
}

/** createWorld on stand-ins that count what the world asks of them. */
function make({ frozen, link = true }: { frozen: boolean; link?: boolean }) {
  const calls: Calls = { capture: 0, still: 0, pump: 0, show: 0, disposed: [] };
  const disposers: (() => void)[] = [];
  const readers = new Map<string, () => unknown>();
  const clock = { dt: 0, time: 0 };
  const ctx = {
    clock,
    onDispose: (fn: () => void) => disposers.push(fn),
    qa: { expose: (name: string, fn: () => unknown) => (readers.set(name, fn), () => {}) },
  } as unknown as ChapterContext;

  const pixels = new Uint8Array(CELLS);
  const eye = {
    camera: new PerspectiveCamera(),
    format: 'byte',
    passes: 3,
    lastMs: 1.5,
    lastCalls: 42,
    capture: () => (calls.capture++, pixels),
    project: () => null,
    dispose: () => calls.disposed.push('eye'),
  } as unknown as Eye;

  /** What the model answers with; a test puts its own screen here. */
  const answer = { screen: new Uint8Array(CELLS) };
  const reply = (seq: number): LinkReply => ({
    seq,
    screen: answer.screen,
    meters: { ...METERS },
    probe: null,
    ms: 12,
  });
  const stills: { state: FmLinkState; luma: Uint8Array; probe: ProbeRequest | null }[] = [];
  const pumps: { state: FmLinkState; probe: ProbeRequest | null }[] = [];
  let frame: LinkReply | null = null;
  const fakeLink = {
    mode: 'sync',
    get frame() {
      return frame;
    },
    frames: 0,
    fps: 7.5,
    pump(state: FmLinkState, luma: () => Uint8Array, probe: ProbeRequest | null) {
      calls.pump++;
      pumps.push({ state, probe });
      if (calls.pump % 4 !== 0) return false;
      luma();
      frame = reply(calls.pump);
      return true;
    },
    still(state: FmLinkState, luma: Uint8Array, probe: ProbeRequest | null) {
      calls.still++;
      stills.push({ state, luma, probe });
      return reply(-1);
    },
    dispose: () => calls.disposed.push('link'),
  } as unknown as Link;

  const shown = new Uint8Array(CELLS);
  const screen = {
    object: new Mesh(),
    power: 0,
    show(luma: Uint8Array) {
      calls.show++;
      shown.set(luma);
    },
    luma: shown,
    dispose: () => calls.disposed.push('screen'),
  } as unknown as Screen;

  const at: [number, number][] = [];
  const yardUpdates: [number, number][] = [];
  const yard = {
    root: new Group(),
    anchors: {},
    dusk: 0.2,
    wicket: 0,
    garageGate: 0,
    tray: 0,
    screenLight: 0,
    monitorAt: (r: number, n: number) => at.push([r, n]),
    hidden: [] as Object3D[],
    update: (dt: number, t: number) => yardUpdates.push([dt, t]),
  } as unknown as Yard;

  const world = createWorld(ctx, { yard, eye, screen, link: link ? fakeLink : null, frozen });
  let t = 0;
  /** One engine update of `dt` seconds. */
  const tick = (dt: number): void => {
    t += dt;
    clock.dt = dt;
    clock.time = t;
    world.update(dt, t);
  };
  const read = (): Record<string, unknown> => readers.get('radio-world')!() as Record<string, unknown>;
  return { world, calls, tick, read, answer, pixels, stills, pumps, at, yardUpdates, disposers };
}

/** The context mountWorld's real eye and link need. */
function mountCtx() {
  return {
    renderer: { capabilities: { textureTypeReadable: () => false } },
    clock: { dt: 0, time: 0 },
    track: <T>(x: T) => x,
    onDispose: () => {},
    qa: { expose: () => () => {} },
  } as unknown as ChapterContext;
}

/** The stand-in mountYard gives mountWorld. */
function standInYard(): Yard {
  return {
    root: new Group(),
    anchors: { lens: new Object3D(), monitorScreen: new Object3D() },
    dusk: 0.2,
    wicket: 0,
    garageGate: 0,
    tray: 0,
    screenLight: 0,
    monitorAt: () => {},
    hidden: [new Object3D()],
    update: () => {},
  } as unknown as Yard;
}

describe('world', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('зупинений кадр: один still, і лише коли щось змінилося', () => {
    const { world, calls, tick, pixels, stills } = make({ frozen: true });
    for (let i = 0; i < 180; i++) tick(1 / 60);
    expect([calls.capture, calls.still, calls.pump]).toEqual([0, 0, 0]);
    tick(0);
    expect([calls.capture, calls.still, calls.show]).toEqual([1, 1, 1]);
    expect(stills[0]).toEqual({ state: DEFAULT_STATE, luma: pixels, probe: null });
    expect(stills[0]!.state).toBe(world.line);
    expect(world.luma).toBe(pixels);
    expect(world.meters).toEqual(METERS);
    expect(world.probeData).toBeNull();
    tick(0);
    expect(calls.still).toBe(1);
    world.line.air.route = 3;
    tick(0);
    expect(calls.still).toBe(2);
    world.probe = { tap: 'air.rx', view: 'strip', start: 0, span: 1, columns: 256 };
    tick(0);
    expect(calls.still).toBe(3);
    expect(stills[2]!.probe).toBe(world.probe);
    tick(1 / 60);
    tick(0);
    expect(calls.still).toBe(4);
    world.yard.wicket = 0.5;
    tick(0);
    expect(calls.still).toBe(5);
    world.yard.dusk = 0.9;
    tick(0);
    expect(calls.still).toBe(6);
    expect([calls.capture, calls.show, calls.pump]).toEqual([6, 6, 0]);
  });

  it('жива сторінка: pump раз на оновлення, око й екран — раз на кадр моделі', () => {
    const { world, calls, tick, pumps } = make({ frozen: false });
    for (let i = 0; i < 60; i++) tick(1 / 60);
    expect([calls.pump, calls.capture, calls.show, calls.still]).toEqual([60, 15, 15, 0]);
    expect(pumps.every((p) => p.state === world.line && p.probe === null)).toBe(true);
    // the glass lights up with λ = 8 over the second
    expect(world.screen.power).toBeCloseTo(1 - Math.exp(-8), 6);
  });

  it('подвір’я слухає лінію', () => {
    const { world, tick, at, yardUpdates } = make({ frozen: false });
    Object.assign(world.line.air, { route: 2.5, nudge: 0.05, gate: 1, tray: 0.5 });
    tick(1 / 60);
    expect(at.at(-1)).toEqual([2.5, 0.05]);
    expect(world.yard.garageGate).toBe(1);
    expect(world.yard.tray).toBe(0.5);
    expect(yardUpdates).toEqual([[1 / 60, 1 / 60]]);
  });

  it('вимкнений монітор гасне, увімкнений світить на кухню', () => {
    const { world, tick, answer } = make({ frozen: true });
    answer.screen = new Uint8Array(CELLS).fill(128);
    world.screen.power = 1;
    world.line.monitor.on = false;
    tick(0);
    expect(world.screen.power).toBe(0);
    expect(world.yard.screenLight).toBe(0);
    world.line.monitor.on = true;
    tick(0);
    expect(world.screen.power).toBe(1);
    expect(world.yard.screenLight).toBeCloseTo(128 / 255, 6);
  });

  it("link: 'off' → без моделі, екран темний", () => {
    const { world, calls, tick, read } = make({ frozen: false, link: false });
    expect(world.link).toBeNull();
    expect(world.meters).toBeNull();
    expect(world.line.monitor.on).toBe(true);
    for (let i = 0; i < 60; i++) tick(1 / 60);
    expect(world.screen.power).toBe(0);
    expect(world.yard.screenLight).toBe(0);
    expect(calls.capture).toBe(0);
    expect(read()).toMatchObject({ mode: 'off', frames: 0, fps: 0, meters: null });
  });

  it('resetLine повертає DEFAULT_STATE, не міняючи об’єкта', () => {
    const { world } = make({ frozen: false });
    const ref = world.line;
    const parts = [ref.air, ref.camera, ref.monitor];
    world.line.air.route = 4;
    world.line.camera.sync = false;
    world.line.monitor.lineLength = 290;
    world.resetLine();
    expect(world.line).toBe(ref);
    expect([world.line.air, world.line.camera, world.line.monitor]).toEqual(parts);
    expect(world.line.air).toBe(parts[0]);
    expect(world.line).toEqual(DEFAULT_STATE);
    expect(world.line).not.toBe(DEFAULT_STATE);
  });

  it('звільнення', () => {
    const { calls, disposers } = make({ frozen: false });
    expect(disposers).toHaveLength(1);
    for (const fn of disposers) fn();
    expect(calls.disposed).toEqual(['link', 'eye', 'screen']);
  });

  it('radio-world: числа для перевірок', () => {
    const { tick, read, answer } = make({ frozen: true });
    tick(0); // the screen of zeros
    expect(read()).toMatchObject({
      mode: 'sync',
      frames: 1,
      screenHash: '52965dc5',
      screenMean: 0,
      screenNoise: 0,
    });
    expect(read()).toEqual({
      mode: 'sync',
      frames: 1,
      fps: 7.5,
      modelMs: 12,
      meters: METERS,
      screenHash: '52965dc5',
      screenMean: 0,
      screenNoise: 0,
      eye: { format: 'byte', passes: 3, lastMs: 1.5, lastCalls: 42 },
    });
    answer.screen = new Uint8Array(CELLS).map((_, i) => (i % 2 === 0 ? 0 : 10));
    tick(1 / 60);
    tick(0);
    expect(read()).toMatchObject({ frames: 2, screenMean: 5, screenNoise: 10 });
    // within each row only: row r all r
    answer.screen = new Uint8Array(CELLS).map((_, i) => Math.floor(i / COLS));
    tick(1 / 60);
    tick(0);
    expect(read()).toMatchObject({ frames: 3, screenMean: (ROWS - 1) / 2, screenNoise: 0 });
  });

  it('кадр ока дорівнює кадрові моделі', () => expect([EYE_COLS, EYE_ROWS]).toEqual([COLS, ROWS]));

  it('fnv1a: опорні значення алгоритму', () => {
    // the test vectors of FNV-1a, 32 bits (draft-eastlake-fnv): '', 'a', 'foobar'
    const of = (text: string): string => fnv1a(new TextEncoder().encode(text));
    expect([of(''), of('a'), of('foobar')]).toEqual(['811c9dc5', 'e40c292c', 'bf9cf968']);
  });

  it('те, чого око не бачить, не кидає тіні', () => {
    // on a live frame the eye takes the shadow map of the main render (B1a)
    const { world, tick } = make({ frozen: false });
    const stand = new Group();
    const block = new Mesh();
    block.castShadow = true;
    stand.add(block);
    const tree = new Mesh();
    tree.castShadow = true;
    world.yard.hidden.push(stand);
    tick(1 / 60);
    expect([stand.castShadow, block.castShadow, tree.castShadow]).toEqual([false, false, true]);
  });

  it('mountWorld: око ховає yard.hidden, дивиться з об’єктива; екран — на якорі монітора', () => {
    const yard = standInYard();
    vi.mocked(mountYard).mockReturnValueOnce(yard);
    const ctx = mountCtx();
    const world = mountWorld(ctx, { dusk: 0.35 });
    expect(world.yard).toBe(yard);
    expect(vi.mocked(mountYard).mock.calls[0]).toEqual([ctx, { dusk: 0.35 }]);
    expect(yard.dusk).toBe(0.35);
    const opts = vi.mocked(createEye).mock.calls[0]![1]!;
    expect(opts.fov).toBe(LENS.fov);
    expect(opts.hide!()).toBe(yard.hidden);
    yard.hidden.push(new Object3D());
    expect(opts.hide!()).toHaveLength(2);
    expect(world.eye.camera.parent).toBe(yard.anchors.lens);
    expect(vi.mocked(createScreen).mock.calls[0]).toEqual([MONITOR_SCREEN]);
    expect(world.screen.object.parent).toBe(yard.anchors.monitorScreen);
  });

  it('mountWorld: лінія — сама, синхронна, без неї; на зупиненій сторінці — синхронна', () => {
    const modes = (opts: Parameters<typeof mountWorld>[1]) => {
      vi.mocked(mountYard).mockReturnValueOnce(standInYard());
      vi.mocked(createLink).mockClear();
      const world = mountWorld(mountCtx(), opts);
      return { world, link: vi.mocked(createLink).mock.calls[0]?.[1] };
    };
    expect(modes(undefined).link).toEqual({ seed: 1, mode: 'auto' });
    expect(modes({ link: 'sync', seed: 7 }).link).toEqual({ seed: 7, mode: 'sync' });
    const off = modes({ link: 'off' });
    expect([off.link, off.world.link]).toEqual([undefined, null]);
    vi.stubGlobal('location', { search: '?freeze=60' });
    expect(modes({ link: 'auto' }).link).toEqual({ seed: 1, mode: 'sync' });
  });
});
