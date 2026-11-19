/**
 * Scene of the radio sandbox (`index.ts` holds its words), on the world of the volume (`mountWorld`, B14): the yard,
 * the camera's eye on the lens of the first camera (it looks at the cat on the cross fence, the wicket, the white wall
 * of the shed and the dark nook of the woodshed), the line to the signal model and the monitor's screen, which shows
 * only what the line returned. Steps:
 *   eye   — the sandbox's own shot: the pole with the camera and a floating screen north-west of it with the eye's
 *           frame (`world.luma`, what the camera sees), next to the monitor in the kitchen (what came through the line);
 *   far   — the same scene and state from above (shot `top`): the eye must see exactly the same;
 *   yard  — the yard from its eight shots (`screen` follows the monitor), at any dusk, with the monitor anywhere on its
 *           route, the wicket, the garage gate and the tray;
 *   where — the controls a chapter has (B15): the miniature «where are we» (`@radio/shared/whereami`) with the route
 *           and nudge sliders and a choice of the depth it marks, from shot `route`;
 *   live  — the live screen: every knob of the line, the monitor wherever the reader takes it with the director's
 *           camera following it (or from `both` or `route`), the miniature, the level and the model's frames a second;
 *   still — the stops on a held page: the camera follows the monitor, the model computes one frame per state; the
 *           level, the wave over the noise and the share of lines lost.
 * Every step is entered with the line at DEFAULT_STATE (`world.resetLine()`), the dusk and the wicket at their
 * defaults and the step's controls at their declared values (`reset: true`), which are DEFAULT_STATE's; on every
 * update the scene writes the values of the current step's controls into `world.line` and `world.yard`, so a slider
 * and the line never part, after a return to a step either. The route, the nudge, the garage gate and the tray go
 * into the line, and the world moves the yard after it. The floating screen lies in `yard.hidden` (the eye would see
 * itself in it) and shows only in `eye` and `far`; the world takes no second frame of the eye for it.
 * Readers: `radio-eye` (the pass and what the eye sees of the shed's wall, the nook, the wicket and the cat's spot),
 * `radio-luma` (its frame), `radio-yard` (dusk, lantern, shot, grain, where the anchors must be, whether the
 * monitor's screen and the cellar's floor are in clear view), `radio-sandbox` (where `whereAt` puts the monitor on the
 * plan; `lumaHash` of the eye's frame; `stillHash` of a `still` frame of the model for DEFAULT_STATE and a frame made
 * by formula), `radio-bench` (the model's frame on the main thread) and the world's own `radio-world`; probes
 * `eye:<mark>-on-screen` (where the cell of the wall or the nook lies on the floating screen) and the yard's own
 * `yard:<anchor>`.
 */
import { type Object3D, Raycaster, Vector3 } from 'three';
import { fmtNumber, fmtUnit } from '@/content';
import { type Shot, defineScene } from '@/engine/api';
import { type ControlSpec, type StepUiSpec, stepUi } from '@/hud';
import { MONITOR_SCREEN } from '@radio/shared/models';
import { EYE_COLS, EYE_ROWS, createScreen, lumaAround } from '@radio/shared/screen';
import { nudgeSlider, routeSlider, whereAt, whereami } from '@radio/shared/whereami';
import {
  type ChannelNo,
  DEFAULT_STATE,
  type YARD_SHOTS,
  fnv1a,
  mountWorld,
  screenShot,
} from '@radio/shared/world';
import { LAYOUT, LENS, monitorPlace, screenPlace } from '@radio/shared/yard';
import { toScene } from '@radio/shared/yard/layout';
import { lanternLevel } from '@radio/shared/yard/look';
import { SANDBOX } from './index';

type StepId = keyof typeof SANDBOX.steps;
type Value = number | boolean | string;

const SEED = 1;
const DUSK = 0.2;
/** `radio-bench`: how many `still` frames it averages. */
const BENCH_RUNS = 10;
/** The frame of `stillHash`: made by formula, never seen by the eye. */
const PATTERN = Uint8Array.from({ length: EYE_COLS * EYE_ROWS }, (_, i) => (i * 7) % 256);
const SHOTS = Object.keys(SANDBOX.shots) as (keyof typeof YARD_SHOTS)[];
/** The views of step `live`: `screen` follows the monitor. */
const VIEWS = ['screen', 'both', 'route'] as const;
const CHANNELS: readonly ChannelNo[] = [1, 2, 3, 4];
/** The floating screen: north-west of the pole, facing the director's shot `eye`. */
const SCREEN = { width: 1.6, height: 1.2, at: toScene([-1.9, 1.6, 2.5]) } as const;
/** The sandbox's own shot of step `eye`: from the north-east, the pole with the cameras and the floating screen. */
const EYE_SHOT: Shot = {
  position: toScene([3.0, 6.5, 3.6]),
  target: toScene([-0.8, 0.4, 2.3]),
  fit: { center: toScene([-0.9, 0.6, 2.3]), radius: 1.9 },
};
type Mark = 'light' | 'dark' | 'wicket' | 'cat';

/** Is `o` drawn: it and every ancestor visible. */
const shown = (o: Object3D): boolean => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};
const isMesh = (o: Object3D): boolean => (o as { isMesh?: boolean }).isMesh === true;

export default defineScene((ctx) => {
  const world = mountWorld(ctx, { seed: SEED, dusk: DUSK });
  const { yard, eye, line } = world;

  /* ------------------------------------------------------------------------------- the floating screen */
  const screen = createScreen({ width: SCREEN.width, height: SCREEN.height });
  screen.object.position.set(...SCREEN.at);
  screen.object.lookAt(new Vector3(...(EYE_SHOT.position as readonly [number, number, number])));
  screen.power = 1;
  ctx.root.add(screen.object);
  yard.hidden.push(screen.object);
  ctx.onDispose(() => screen.dispose());
  /** The eye's pass whose frame the floating screen shows. */
  let screenPass = -1;

  /* ------------------------------------------------------------------------------------------ controls */
  const ui = stepUi(ctx);
  const slider = (id: 'dusk' | 'wicket' | 'gate' | 'tray', min: number, max: number, value: number) =>
    ({ type: 'slider', id, label: SANDBOX.labels[id], min, max, step: 0.01, digits: 2, value }) as const;
  const toggle = (id: 'on' | 'router' | 'oven' | 'sync' | 'limiter', value: boolean) =>
    ({ type: 'toggle', id, label: SANDBOX.labels[id], value }) as const;
  /**
   * A meter of the frame on the screen. Text, not a number: a number's count-up runs on the engine clock, which a
   * held page never moves, so a number readout of step `still` would keep the previous stop's value.
   */
  const meter = (id: 'rxDbm' | 'cnrDb' | 'syncLost', unit: string, scale = 1, digits = 1) =>
    ({
      type: 'readout',
      id,
      label: SANDBOX.labels[id],
      text: () => {
        const m = world.meters;
        return m === null ? '—' : fmtUnit(m[id] * scale, unit, { digits });
      },
    }) as const;
  // the route and the nudge: one pair of control objects for every step that has them, their limits from `whereami`
  const routeCtl = routeSlider({
    label: SANDBOX.labels.route,
    stops: SANDBOX.labels.whereami.stops,
    value: DEFAULT_STATE.air.route,
  });
  const nudgeCtl = nudgeSlider({ label: SANDBOX.labels.nudge, unit: SANDBOX.labels.centimetre });
  const where = whereami(ctx, {
    labels: SANDBOX.labels.whereami,
    route: () => ui.value<number>('route'),
    nudge: () => ui.value<number>('nudge'),
    // the depth choice lives in step `where`; elsewhere the plan marks the yard
    depth: () => (ctx.stage.current === 'where' ? (Number(ui.value<string>('depth')) as 0 | 1 | 2) : 0),
  });
  const { air, camera, monitor } = DEFAULT_STATE;
  const gate = slider('gate', 0, 1, air.gate);
  const tray = slider('tray', 0, 1, air.tray);
  const steps: Record<StepId, StepUiSpec> = {
    eye: { reset: true },
    far: { reset: true },
    yard: {
      reset: true,
      controls: [
        {
          type: 'segmented',
          id: 'shot',
          label: SANDBOX.labels.shot,
          items: SHOTS.map((id) => ({ id, label: SANDBOX.shots[id] })),
          value: 'both',
        },
        slider('dusk', 0, 1, DUSK),
        routeCtl,
        nudgeCtl,
        slider('wicket', -1, 1, 0),
        gate,
        tray,
      ],
    },
    where: {
      reset: true,
      controls: [
        where,
        routeCtl,
        nudgeCtl,
        {
          type: 'segmented',
          id: 'depth',
          label: SANDBOX.labels.depth,
          items: SANDBOX.labels.whereami.depth.map((label, i) => ({ id: String(i), label })),
          value: '0',
        },
      ],
    },
    live: {
      reset: true,
      controls: [
        {
          type: 'segmented',
          id: 'view',
          label: SANDBOX.labels.shot,
          items: VIEWS.map((id) => ({ id, label: SANDBOX.shots[id] })),
          value: 'screen',
        },
        toggle('on', monitor.on),
        routeCtl,
        nudgeCtl,
        tray,
        gate,
        {
          type: 'slider',
          id: 'power',
          label: SANDBOX.labels.power,
          unit: SANDBOX.labels.units.mW,
          min: 0.1,
          max: 10,
          scale: 'log',
          step: 2,
          marks: [0.1, 1, 10].map((v) => ({ value: v, label: fmtNumber(v) })),
          value: air.txPowerMw,
        },
        {
          type: 'segmented',
          id: 'channel',
          label: SANDBOX.labels.channel,
          items: CHANNELS.map((c) => ({ id: String(c), label: String(c) })),
          value: String(air.txChannel),
        },
        toggle('router', air.router),
        toggle('oven', air.oven),
        toggle('sync', camera.sync),
        {
          type: 'slider',
          id: 'line',
          label: SANDBOX.labels.line,
          unit: SANDBOX.labels.samples,
          min: 280,
          max: 296,
          step: 0.5,
          digits: 1,
          value: monitor.lineLength,
        },
        {
          type: 'segmented',
          id: 'detector',
          label: SANDBOX.labels.detector,
          items: (['slope', 'angle'] as const).map((id) => ({ id, label: SANDBOX.labels.detectors[id] })),
          value: monitor.detector,
        },
        toggle('limiter', monitor.limiter),
        where,
        meter('rxDbm', SANDBOX.labels.units.dBm),
        {
          type: 'readout',
          id: 'fps',
          label: SANDBOX.labels.fps,
          digits: 1,
          get: () => world.link?.fps ?? 0,
        },
      ],
    },
    still: {
      reset: true,
      controls: [
        routeCtl,
        nudgeCtl,
        meter('rxDbm', SANDBOX.labels.units.dBm),
        meter('cnrDb', SANDBOX.labels.units.dB),
        meter('syncLost', SANDBOX.labels.units.percent, 100, 0),
      ],
    },
  };
  ui.define(steps);

  /** Where each control's value goes: the line, or the yard's own knobs. */
  const WRITE: Readonly<Record<string, (v: Value) => void>> = {
    route: (v) => (line.air.route = v as number),
    nudge: (v) => (line.air.nudge = v as number),
    gate: (v) => (line.air.gate = v as number),
    tray: (v) => (line.air.tray = v as number),
    power: (v) => (line.air.txPowerMw = v as number),
    channel: (v) => (line.air.txChannel = Number(v) as ChannelNo),
    router: (v) => (line.air.router = v as boolean),
    oven: (v) => (line.air.oven = v as boolean),
    sync: (v) => (line.camera.sync = v as boolean),
    on: (v) => (line.monitor.on = v as boolean),
    line: (v) => (line.monitor.lineLength = v as number),
    detector: (v) => (line.monitor.detector = v as 'slope' | 'angle'),
    limiter: (v) => (line.monitor.limiter = v as boolean),
    dusk: (v) => (yard.dusk = v as number),
    wicket: (v) => (yard.wicket = v as number),
  };
  /** The controls of each step that write into the line or the yard. */
  const writes = new Map<string, readonly string[]>(
    Object.entries(steps).map(([id, spec]) => [
      id,
      (spec.controls ?? []).map((c: ControlSpec) => c.id).filter((c) => c in WRITE),
    ]),
  );

  /* ------------------------------------------------------------------------------- steps and shots */
  /** The director's shot of a view: `screen` follows the monitor wherever it is now. */
  const shotOf = (view: string, route: number): Shot | string =>
    view === 'screen' ? screenShot(route) : SHOTS.includes(view as never) ? view : 'both';
  /** The view the director's camera keeps in a step that has one (null — the step's own fixed shot). */
  const viewOf = (step: string | null): string | null =>
    step === 'yard'
      ? ui.value<string>('shot')
      : step === 'live'
        ? ui.value<string>('view')
        : step === 'still'
          ? 'screen'
          : null;
  let lastView = '';
  let lastRoute = Number.NaN;
  /**
   * Entering a step: the line at DEFAULT_STATE, the dusk and the wicket at their defaults; with a view, the camera at
   * the view's default (`reset: true` puts the controls back to their defaults right after this).
   */
  const enter = (view: string | null) => (info: { instant: boolean }) => {
    world.resetLine();
    yard.dusk = DUSK;
    yard.wicket = 0;
    if (view === null) return;
    lastView = view;
    lastRoute = DEFAULT_STATE.air.route;
    ctx.camera.go(shotOf(view, lastRoute), { instant: info.instant });
  };
  ctx.camera.shots({ eye: EYE_SHOT });
  ctx.stage.define({
    eye: { camera: 'eye', enter: enter(null) },
    far: { camera: 'top', enter: enter(null) },
    yard: { enter: enter('both') },
    where: { camera: 'route', enter: enter(null) },
    live: { enter: enter('screen') },
    still: { enter: enter('screen') },
  });

  /* ------------------------------------------------------------------------------------- QA hooks */
  /** The marks of `radio-eye.seen`: the white wall, the dark nook, the wicket and the cat's spot where it is now. */
  const markAt = (mark: Mark): Vector3 => {
    if (mark === 'cat') return yard.anchors.cat.getWorldPosition(new Vector3());
    const place = { light: 'shedWall', dark: 'nook', wicket: 'wicket' } as const;
    return new Vector3(...LAYOUT.places[place[mark]].position);
  };
  const seen = (mark: Mark) => {
    const cell = eye.project(markAt(mark));
    return cell
      ? { cell, ...lumaAround(world.luma, cell.col, cell.row) }
      : { cell: null, luma: null, around: null };
  };
  /** Where the cell the eye sees a mark in lies on the floating screen (row 0 at the top). */
  const onScreen = (mark: Mark): Vector3 | null => {
    const cell = eye.project(markAt(mark));
    if (!cell) return null;
    screen.object.updateWorldMatrix(true, false);
    return screen.object.localToWorld(
      new Vector3(
        ((cell.col + 0.5) / EYE_COLS - 0.5) * SCREEN.width,
        (0.5 - (cell.row + 0.5) / EYE_ROWS) * SCREEN.height,
        0,
      ),
    );
  };
  /** The visible meshes of the yard a ray from the director's camera meets, nearest first, up to `far`. */
  const hits = (to: Vector3, far = Infinity) => {
    const cam = ctx.camera.camera;
    cam.updateMatrixWorld();
    yard.root.updateMatrixWorld(true);
    const from = cam.getWorldPosition(new Vector3());
    const dir = to.clone().sub(from).normalize();
    return new Raycaster(from, dir, 0, far)
      .intersectObject(yard.root, true)
      .filter((h) => isMesh(h.object) && shown(h.object));
  };
  /**
   * Nothing of the yard in front of the monitor's screen: rays from the director's camera to its middle and to four
   * points at 40 % of its half-width and half-height meet no visible mesh more than 2 cm before the point.
   */
  const screenClear = (): boolean => {
    const anchor = yard.anchors.monitorScreen;
    const from = ctx.camera.camera.getWorldPosition(new Vector3());
    const w = 0.4 * (MONITOR_SCREEN.width / 2);
    const h = 0.4 * (MONITOR_SCREEN.height / 2);
    return [
      [0, 0],
      [w, h],
      [-w, h],
      [w, -h],
      [-w, -h],
    ].every(([x, y]) => {
      const p = anchor.localToWorld(new Vector3(x, y, 0));
      // the monitor's own screen lies on these points: it is not «in front of» them
      return hits(p, p.distanceTo(from) - 0.02).length === 0;
    });
  };
  /** Through the middle of the slab's cut, at floor height, the director's camera first meets the cellar's floor. */
  const cellarSeen = (): boolean => {
    const { min, max } = LAYOUT.plan.house.slabCut;
    const first = hits(new Vector3((min[0] + max[0]) / 2, 0, (min[1] + max[1]) / 2))[0];
    const floor = yard.root.getObjectByName('cellarFloor');
    if (!first || !floor) return false;
    for (let p: Object3D | null = first.object; p; p = p.parent) if (p === floor) return true;
    return false;
  };
  ctx.qa.expose('radio-eye', () => {
    let lumaMin = 255;
    let lumaMax = 0;
    for (const v of world.luma) {
      if (v < lumaMin) lumaMin = v;
      if (v > lumaMax) lumaMax = v;
    }
    return {
      format: eye.format,
      passes: eye.passes,
      lastMs: eye.lastMs,
      lastCalls: eye.lastCalls,
      lumaMin,
      lumaMax,
      seen: { light: seen('light'), dark: seen('dark'), wicket: seen('wicket'), cat: seen('cat') },
    };
  });
  ctx.qa.expose('radio-luma', () => Array.from(world.luma));
  ctx.qa.expose('radio-yard', () => {
    const { route, nudge } = line.air;
    return {
      dusk: yard.dusk,
      lantern: lanternLevel(yard.dusk),
      shot: ui.value<string>('shot'),
      grain: ctx.post.params.grain,
      want: {
        cameraAntenna: LAYOUT.tx,
        lens: LENS.position,
        monitorAntenna: monitorPlace(route, nudge).position,
        monitorScreen: screenPlace(route, nudge),
      },
      screenClear: screenClear(),
      cellarSeen: cellarSeen(),
    };
  });
  ctx.qa.expose('radio-sandbox', () => ({
    where: whereAt(ui.value<number>('route'), ui.value<number>('nudge')),
    lumaHash: fnv1a(world.luma),
    stillHash: world.link ? fnv1a(world.link.still(DEFAULT_STATE, PATTERN, null).screen) : null,
  }));
  // the line times the model (`performance.now` is not for chapters): a `still` frame is two frames of the model,
  // the run-up and the frame itself
  ctx.qa.expose('radio-bench', () => {
    if (!world.link) return { stillMs: Number.NaN, frameMs: Number.NaN };
    let sum = 0;
    for (let i = 0; i < BENCH_RUNS; i++) sum += world.link.still(line, world.luma, null).ms;
    const stillMs = sum / BENCH_RUNS;
    return { stillMs, frameMs: stillMs / 2 };
  });
  ctx.qa.probe('eye:light-on-screen', () => onScreen('light'));
  ctx.qa.probe('eye:dark-on-screen', () => onScreen('dark'));

  return {
    update(dt, t) {
      const step = ctx.stage.current;
      // the current step's controls → the line and the yard (other knobs stay where `enter` put them)
      for (const id of writes.get(step ?? '') ?? []) WRITE[id]!(ui.value(id));
      // the director's camera keeps the step's view; `screen` follows the monitor along the route
      const view = viewOf(step);
      if (view !== null) {
        const route = line.air.route;
        if (view !== lastView) {
          ctx.camera.go(shotOf(view, route));
          lastView = view;
          lastRoute = route;
        } else if (view === 'screen' && route !== lastRoute) {
          ctx.camera.go(screenShot(route), { duration: 0.4 });
          lastRoute = route;
        }
      }
      world.update(dt, t);
      // the floating screen (steps `eye` and `far`): the eye's frame, whenever the world took a new one
      screen.object.visible = step === 'eye' || step === 'far';
      if (screen.object.visible && eye.passes !== screenPass) {
        screen.show(world.luma);
        screenPass = eye.passes;
      }
    },
  };
});
