/**
 * The chapter context the steps' tests mount a live bench in (`mountBench`, no WebGL): only what the bench and the
 * step stand use, with the engine's own `CameraDirector`; the stage's step is settable, the input's handlers are kept.
 * Not a test file: `stand.test.ts` and `live.test.ts` import it.
 */
import { Group, type Object3D } from 'three';
import type { AppState, ChapterContext } from '@/engine/api';
import { CameraDirector } from '@/engine/camera/director';

export type Click = { enabled?: () => boolean; click?: () => void; tooltip?: () => string };

export function stubContext(formFactor: 'desktop' | 'phone' = 'desktop') {
  const root = new Group();
  let seed = 1;
  const next = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const camera = new CameraDirector();
  camera.setViewport(1920, 1080);
  const handlers = new Map<Object3D, Click>();
  const stage = { current: 'a' as string | null };
  const settings = { audio: true, volume: 0.8 } as AppState['settings'];
  const ctx = {
    root,
    clock: { dt: 0, time: 0 },
    onDispose: () => {},
    onResize: () => () => {},
    qa: { expose: () => () => {}, probe: (_n: string, _t: Object3D | (() => unknown)) => () => {} },
    input: {
      register: (o: Object3D, h: Click) => {
        handlers.set(o, h);
        return () => handlers.delete(o);
      },
      on: () => () => {},
    },
    device: { formFactor, hover: true },
    viewport: { width: 1920, height: 1080, aspect: 1920 / 1080, dpr: 1 },
    quality: { count: (n: number) => n },
    random: { next, range: (a: number, b: number) => a + (b - a) * next() },
    env: {
      base: () => {},
      setScale: () => {},
      setShadow: () => {},
      tune: () => {},
      params: { keyIntensity: 0 },
    },
    post: { base: () => {} },
    camera,
    stage,
    nav: { volume: null, volumes: [] },
    reducedMotion: false,
    renderer: { info: { render: { calls: 0 } } },
    // the volume's own sound output (the option `sound`): its store and a gesture that never comes (it plays silently
    // on the engine's clock)
    store: { get: () => ({ settings }) as AppState, subscribe: () => () => {} },
    gesture: new Promise<void>(() => {}),
    manifest: { theme: { accent: 'teal', sky: 'studio', mood: 'studio' } },
  } as unknown as ChapterContext;
  return { ctx, camera, stage, handlers };
}
