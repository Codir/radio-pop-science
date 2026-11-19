/**
 * Scene of the radio sandbox (`index.ts` holds its words): the real yard of the volume (`mountYard`, B13) and the
 * camera's eye (`@radio/shared/screen`, decision 24) — a child of the lens of the first camera on the pole, so it looks
 * where the lens looks: at the cat on the cross fence, the wicket, the white wall of the shed and the dark nook of the
 * woodshed. Every engine update (`dt = 0` included) its frame goes to a floating screen north-west of the pole, to a
 * second, smaller screen 3,5 m in front of the eye (a child of its camera, over the wicket) and to the monitor's own
 * screen (whose mean brightness lights the kitchen, as the world will, B14). The floating and the second screen lie in
 * `yard.hidden`: the eye would see itself in them otherwise. Steps:
 *   eye  — the sandbox's own shot: the pole with the camera and the floating screen;
 *   far  — the same scene and state from above (shot `top`): the eye must see exactly the same;
 *   yard — the yard from its eight shots (`screen` follows the monitor), at any dusk, with the monitor anywhere on
 *          its route, the wicket, the garage gate and the tray; the floating and the second screen are hidden here.
 * Toggles (`eye`, `far`): `eye` stops the pass (the screens keep their last frame), for the draw-call and frame-time
 * checks of `qa/measure.mjs`; `inner` takes the second screen away and `hiding` empties `hide()`, for its check of
 * `hide()` (`hiding` is on again whenever a step is entered, so a hand left on it never shows `yard.hidden` to the eye).
 * Readers: `radio-eye` (the pass, what the eye sees of the shed's wall, the nook, the wicket and the cat's spot, which
 * of its cells the second screen covers), `radio-luma` (its frame), `radio-yard` (dusk, lantern, shot, grain, where the
 * anchors must be, whether the monitor's screen and the cellar's floor are in clear view); probes
 * `eye:<mark>-on-screen` (where the cell of the wall or the nook lies on the floating screen) and the yard's own
 * `yard:<anchor>`.
 */
import { type Object3D, Raycaster, Vector3 } from 'three';
import { type Shot, defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { MONITOR_SCREEN } from '@radio/shared/models';
import { EYE_COLS, EYE_ROWS, createEye, createScreen, lumaAround } from '@radio/shared/screen';
import {
  LAYOUT,
  LENS,
  type YARD_SHOTS,
  monitorPlace,
  mountYard,
  screenPlace,
  screenShot,
} from '@radio/shared/yard';
import { toScene } from '@radio/shared/yard/layout';
import { lanternLevel } from '@radio/shared/yard/look';
import { SANDBOX } from './index';

const NOTHING: readonly Object3D[] = [];
const SHOTS = Object.keys(SANDBOX.shots) as (keyof typeof YARD_SHOTS)[];
/** The floating screen: north-west of the pole, facing the director's shot `eye`. */
const SCREEN = { width: 1.6, height: 1.2, at: toScene([-1.9, 1.6, 2.5]) } as const;
/** The sandbox's own shot of step `eye`: from the north-east, the pole with the cameras and the floating screen. */
const EYE_SHOT: Shot = {
  position: toScene([3.0, 6.5, 3.6]),
  target: toScene([-0.8, 0.4, 2.3]),
  fit: { center: toScene([-0.9, 0.6, 2.3]), radius: 1.9 },
};
/**
 * The second screen, in the eye camera's own axes: 3,5 m ahead, up and to the right of the axis, facing the eye (a
 * plane faces its +Z, the camera looks down its −Z). In the yard it hangs at about (−1,2; −3,4; 2,0) of the plan, over
 * the wicket, with nothing between it and the eye, all four corners in its frame.
 */
const INNER = { width: 0.8, height: 0.6, at: new Vector3(1.2, 0.5, -3.5) } as const;
type Mark = 'light' | 'dark' | 'wicket' | 'cat';

/** Is `o` drawn: it and every ancestor visible. */
const shown = (o: Object3D): boolean => {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};
const isMesh = (o: Object3D): boolean => (o as { isMesh?: boolean }).isMesh === true;

export default defineScene((ctx) => {
  const yard = mountYard(ctx);

  /* --------------------------------------------------------------------------- the eye and the screens */
  const screen = createScreen({ width: SCREEN.width, height: SCREEN.height });
  screen.object.position.set(...SCREEN.at);
  screen.object.lookAt(new Vector3(...(EYE_SHOT.position as readonly [number, number, number])));
  screen.power = 1;
  ctx.root.add(screen.object);
  const inner = createScreen({ width: INNER.width, height: INNER.height });
  inner.power = 1;
  yard.hidden.push(screen.object, inner.object);
  /** Toggle `hiding`: off, `hide()` gives nothing, and the eye sees the second screen (its check's control). */
  let hiding = true;
  const eye = createEye(ctx, { fov: LENS.fov, hide: () => (hiding ? yard.hidden : NOTHING) });
  yard.anchors.lens.add(eye.camera);
  eye.camera.add(inner.object);
  inner.object.position.copy(INNER.at);
  // the monitor's screen: the eye's frame straight on (the world will put the model's there, B14)
  const monitorScreen = createScreen(MONITOR_SCREEN);
  monitorScreen.power = 1;
  yard.anchors.monitorScreen.add(monitorScreen.object);
  /** The eye's last frame (zeros until the first pass). */
  let luma: Uint8Array = new Uint8Array(EYE_COLS * EYE_ROWS);

  /* ------------------------------------------------------------------------------- steps and shots */
  const ui = stepUi(ctx);
  /** The yard's shot `k`; `screen` follows the monitor. */
  const shotOf = (k: string): Shot | string =>
    k === 'screen' ? screenShot(ui.value<number>('route')) : SHOTS.includes(k as never) ? k : 'both';
  let lastShot = '';
  let lastRoute = Number.NaN;
  let lastNudge = Number.NaN;
  /** Whenever a step is entered, the eye hides `yard.hidden` again. */
  const entered = (): void => ui.set('hiding', true);
  ctx.camera.shots({ eye: EYE_SHOT });
  ctx.stage.define({
    eye: { camera: 'eye', enter: entered },
    far: { camera: 'top', enter: entered },
    yard: {
      enter(info) {
        entered();
        lastShot = ui.value<string>('shot');
        ctx.camera.go(shotOf(lastShot), { instant: info.instant });
      },
    },
  });
  const lab = [
    { type: 'toggle', id: 'eye', label: SANDBOX.labels.eye, value: true },
    { type: 'toggle', id: 'inner', label: SANDBOX.labels.inner, value: true },
    { type: 'toggle', id: 'hiding', label: SANDBOX.labels.hiding, value: true },
  ] as const;
  const slider = (
    id: 'dusk' | 'route' | 'wicket' | 'gate' | 'tray',
    min: number,
    max: number,
    value: number,
  ) => ({ type: 'slider', id, label: SANDBOX.labels[id], min, max, step: 0.01, digits: 2, value }) as const;
  ui.define({
    eye: { controls: lab },
    far: { controls: lab },
    yard: {
      controls: [
        {
          type: 'segmented',
          id: 'shot',
          label: SANDBOX.labels.shot,
          items: SHOTS.map((id) => ({ id, label: SANDBOX.shots[id] })),
          value: 'both',
        },
        slider('dusk', 0, 1, yard.dusk),
        slider('route', 0, 4, 1),
        {
          type: 'slider',
          id: 'nudge',
          label: SANDBOX.labels.nudge,
          unit: SANDBOX.labels.metre,
          min: -0.15,
          max: 0.15,
          step: 0.005,
          digits: 3,
          value: 0,
        },
        slider('wicket', -1, 1, 0),
        slider('gate', 0, 1, 0),
        slider('tray', 0, 1, 0),
      ],
    },
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
      ? { cell, ...lumaAround(luma, cell.col, cell.row) }
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
  /**
   * The cells of the eye's frame the second screen covers (inclusive; it faces the eye squarely, so its picture is
   * a rectangle), or null unless all four of its corners are in the frame.
   */
  const innerRect = (): { col0: number; row0: number; col1: number; row1: number } | null => {
    yard.root.updateMatrixWorld(true);
    const cells = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) =>
        eye.project(
          inner.object.localToWorld(new Vector3((sx * INNER.width) / 2, (sy * INNER.height) / 2, 0)),
        ),
      ),
    );
    if (cells.some((c) => c === null)) return null;
    const cols = cells.map((c) => c!.col);
    const rows = cells.map((c) => c!.row);
    return {
      col0: Math.min(...cols),
      row0: Math.min(...rows),
      col1: Math.max(...cols),
      row1: Math.max(...rows),
    };
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
    for (const v of luma) {
      if (v < lumaMin) lumaMin = v;
      if (v > lumaMax) lumaMax = v;
    }
    return {
      on: ui.value<boolean>('eye'),
      format: eye.format,
      passes: eye.passes,
      lastMs: eye.lastMs,
      lastCalls: eye.lastCalls,
      lumaMin,
      lumaMax,
      seen: { light: seen('light'), dark: seen('dark'), wicket: seen('wicket'), cat: seen('cat') },
      inner: { shown: inner.object.visible, hiding, rect: innerRect() },
    };
  });
  ctx.qa.expose('radio-luma', () => Array.from(luma));
  ctx.qa.expose('radio-yard', () => {
    const route = ui.value<number>('route');
    const nudge = ui.value<number>('nudge');
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
  ctx.qa.probe('eye:light-on-screen', () => onScreen('light'));
  ctx.qa.probe('eye:dark-on-screen', () => onScreen('dark'));

  return {
    update(dt, t) {
      const inYard = ctx.stage.current === 'yard';
      screen.object.visible = !inYard;
      inner.object.visible = !inYard && ui.value<boolean>('inner');
      hiding = ui.value<boolean>('hiding');
      yard.dusk = ui.value<number>('dusk');
      yard.wicket = ui.value<number>('wicket');
      yard.garageGate = ui.value<number>('gate');
      yard.tray = ui.value<number>('tray');
      const route = ui.value<number>('route');
      const nudge = ui.value<number>('nudge');
      if (route !== lastRoute || nudge !== lastNudge) {
        yard.monitorAt(route, nudge);
        if (inYard && route !== lastRoute && ui.value<string>('shot') === 'screen')
          ctx.camera.go(screenShot(route), { duration: 0.4 });
        lastRoute = route;
        lastNudge = nudge;
      }
      if (inYard) {
        const shot = ui.value<string>('shot');
        if (shot !== lastShot) {
          ctx.camera.go(shotOf(shot));
          lastShot = shot;
        }
      }
      yard.update(dt, t);
      if (!ui.value<boolean>('eye')) return;
      luma = eye.capture();
      screen.show(luma);
      inner.show(luma);
      monitorScreen.show(luma);
      let sum = 0;
      for (const v of luma) sum += v;
      yard.screenLight = (monitorScreen.power * sum) / luma.length / 255;
    },
  };
});
