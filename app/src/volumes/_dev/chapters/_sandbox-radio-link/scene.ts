/**
 * Scene of the radio sandbox (`index.ts` holds its words). One scene for every step:
 *   eye — the camera's eye (`@radio/shared/screen`, decision 24) looks at a small yard (a house behind a picket
 *         fence; the park lamp stands off its frame) and two marks, a white cube on its left and a dark one on its
 *         right, set mirror-wise about its axis; every engine update (`dt = 0` included) its frame goes straight
 *         to a floating screen beside the yard. The director's shot keeps that screen in frame and taller than
 *         96 px (about 2,5 px per cell at 1280 × 720), so its cells stay sharp. A second, smaller screen hangs
 *         3,5 m in front of the eye (a child of its camera), above the dark cube, and shows the same frame: the eye
 *         would see itself in it, were both screens not in `hide()`;
 *   far — the same scene and state from the other side and farther: the eye must see exactly the same;
 *   props — (B12) the objects of the yard (`@radio/shared/models`, `buildYardProps(SAMPLE_PLAN)`), all at their own
 *         origin in a showcase, one visible at a time: the control `prop` picks it and the director frames it from
 *         the side that shows it best. The yard of `eye` and `far`, its screens and the eye are hidden here, and the
 *         eye makes no pass.
 * Toggles: `eye` stops the pass (the screens keep their last frame), for the draw-call and frame-time checks of
 * `qa/measure.mjs`; `inner` takes the second screen away and `hiding` empties `hide()`, for its check of `hide()`;
 * `shown` (step `props`) hides the object on show, so that its check can tell the object's own pixels from the sky.
 * Readers: `radio-eye` (the pass, what the eye sees of the marks, which of its cells the second screen covers),
 * `radio-luma` (its frame) and `radio-props` (the object on show: name, triangles, draw calls); probes
 * `eye:<mark>-on-screen`: where the cell of a mark lies on the floating screen.
 */
import { Group, type Object3D, Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { Builder, fence, house, island, streetLamp } from '@/kit';
import { type EnvOverrides, LOOK_SCALE, type ShadowSetup, col } from '@/style';
import { SAMPLE_PLAN, buildYardProps } from '@radio/shared/models';
import { EYE_COLS, EYE_ROWS, createEye, createScreen, lumaAround } from '@radio/shared/screen';
import { SANDBOX } from './index';

/** The two marks (cube centres), mirror-wise about the eye's axis: a flipped frame swaps them. */
const MARKS = { light: new Vector3(-1.2, 1.2, 5.5), dark: new Vector3(1.2, 1.2, 5.5) } as const;
type Mark = keyof typeof MARKS;
const MARK_SIZE = 0.6;
const EYE_AT = new Vector3(0, 2.6, 9);
const EYE_LOOK = new Vector3(0, 1, 0);
const SCREEN = { width: 1.6, height: 1.2, at: new Vector3(4.5, 2.2, 5) } as const;
/**
 * The second screen, in the eye camera's own axes: 3,5 m ahead, up and to the right of the axis, facing the eye
 * (a plane faces its +Z, the camera looks down its −Z). In the world it hangs at about (1,2; 2,5; 5,5), 0,7 m
 * above the dark cube, with nothing between it and the eye; it covers about 31 × 24 cells of the eye's upper right
 * quarter, in front of the house and clear of the marks.
 */
const INNER = { width: 0.8, height: 0.6, at: new Vector3(1.2, 0.5, -3.5) } as const;
const NOTHING: readonly Object3D[] = [];
type Prop = keyof typeof SANDBOX.props;
const PROPS = Object.keys(SANDBOX.props) as Prop[];
/**
 * Where the director looks at each object from (`focusOn` direction: from the object toward the camera): the
 * cameras from in front (they look along −Z), the monitor at its frame (+Z), the cat at its face (−Z), the small props
 * at their +X side, the shed from the camera's side (north, −Z). The house from the north-east and above, into its
 * cut: the hole in the far room's slab lies 0.5 m from the inner faces of `shell-s` and `inner`, so from here the
 * view through it meets those two brick walls of the cellar and the corner between them, with the cellar floor at
 * their foot. The cellar floor and the room floor round the hole are lit alike (the dusk key light, 9° high, reaches
 * neither; only the sky's fill does), so the cellar reads by its walls: from the south the far wall of the cellar is
 * 3.1 m past the hole, and the view through it meets only the cellar floor, the same tone as the room's.
 */
const VIEW: Readonly<Record<Prop, readonly [number, number, number]>> = {
  camera1: [-0.7, 0.45, -1],
  camera2: [0.7, 0.45, -1],
  pole: [1, 0.35, 1.2],
  monitor: [0.45, 0.3, 1],
  wicket: [1.2, 0.35, 0.7],
  fence: [0.55, 0.45, 1],
  shed: [0.45, 0.55, -1],
  garage: [-1, 0.6, 0.5],
  swing: [1, 0.35, 1.2],
  bicycle: [0.35, 0.3, 1],
  cat: [0.35, 0.4, -1],
  tray: [0.6, 1, 0.8],
  phone: [0.5, 1.2, 0.6],
  house: [0.6, 1.3, -1],
  neighbour: [1, 0.25, 0.45],
};
/** The big objects fill the frame more tightly than `focusOn`'s default 1.35 (their insides are what matters). */
const PADDING: Partial<Readonly<Record<Prop, number>>> = { fence: 0.95, house: 0.85 };
/**
 * Step `props` lights the objects as the volume will (VISUAL.md §5, the dusk end of `yard/look.ts`, B13): the
 * engine's `dusk` with its magenta colours replaced and no grade tint or harmony. Without this the grade turns every
 * object violet, and their own muted colours (VISUAL.md §4) cannot be judged on the snapshots.
 */
const PROPS_LOOK: EnvOverrides = {
  mid: col('bg.violet').lerp(col('bg.plum'), 0.5),
  cloudColor: 'bg.plum',
  fogColor: col('bg.indigo').lerp(col('bg.violet'), 0.5),
  sunColor: col('sky').lerp(col('white'), 0.6),
  rimColor: 'blue',
  gradeTintAmount: 0,
  harmony: 0,
  motes: 0,
};
/**
 * The key light's shadow of steps `eye` and `far`: the engine's own default (subject scale 6 × 1.6 round the origin,
 * `style/env/environment.ts:151`), written out so that leaving `props`, which fits the shadow to the object on show,
 * puts it back exactly.
 */
const LAB_SHADOW: ShadowSetup = {
  extent: 9.6,
  center: [0, 0, 0],
  softness: 3.5,
};

export default defineScene((ctx) => {
  ctx.env.setScale(14, { adaptFrom: LOOK_SCALE.diorama });
  // the engine's motes swarm round the director's target with a size taken from the main frame
  // (style/env/environment.ts:333-337, shaders.ts:185-201): in the eye they would be big blots that follow the reader
  ctx.env.base({ motes: 0 });
  ctx.post.base({ grain: 0 });

  /* -------------------------------------------------------------------------------------- the yard */
  /** Everything of steps `eye` and `far`: the small yard, the marks, the screens and the eye (hidden in `props`). */
  const lab = new Group();
  ctx.root.add(lab);
  const land = island({ radius: 14 });
  lab.add(land.group);
  land.place(house().group, 0, 0);
  lab.add(
    fence({
      kind: 'picket',
      route: [
        [-6, 4],
        [6, 4],
      ],
      ground: land,
    }).group,
  );
  land.place(streetLamp({ kind: 'park' }).group, -6.2, 5.6);
  const marks = new Builder('eye-marks');
  for (const [name, at] of Object.entries(MARKS))
    marks.box(MARK_SIZE, MARK_SIZE, MARK_SIZE, {
      c: col(name === 'light' ? 'white' : 'ink'),
      at: [at.x, at.y, at.z],
      mid: true,
    });
  lab.add(marks.build().group);

  /* --------------------------------------------------------------------------- the eye and the screen */
  const screen = createScreen({ width: SCREEN.width, height: SCREEN.height });
  screen.object.position.copy(SCREEN.at);
  screen.power = 1;
  lab.add(screen.object);
  const inner = createScreen({ width: INNER.width, height: INNER.height });
  inner.power = 1;
  const hidden = [screen.object, inner.object] as const;
  /** Toggle `hiding`: off, `hide()` gives nothing, and the eye sees the second screen (its check's control). */
  let hiding = true;
  const eye = createEye(ctx, { hide: () => (hiding ? hidden : NOTHING) });
  lab.add(eye.camera);
  eye.camera.position.copy(EYE_AT);
  eye.camera.lookAt(EYE_LOOK);
  eye.camera.add(inner.object);
  inner.object.position.copy(INNER.at);
  eye.camera.updateMatrixWorld();
  /** The eye's last frame (zeros until the first pass). */
  let luma: Uint8Array = new Uint8Array(EYE_COLS * EYE_ROWS);

  /* -------------------------------------------------------------------------- the objects of the yard */
  const props = buildYardProps(SAMPLE_PLAN, ctx.random.fork('props'));
  const showcase = new Group();
  showcase.visible = false;
  for (const name of PROPS) {
    props[name].group.visible = false;
    showcase.add(props[name].group);
  }
  ctx.root.add(showcase);
  /** The object on show (null outside step `props`, so that coming back frames it again). */
  let shown: Prop | null = null;

  /* ------------------------------------------------------------------------------- steps and shots */
  ctx.camera.shots({
    eye: { position: [7, 3, 9.5], target: [3, 1.7, 5.2], fit: { center: [2, 1.8, 5], radius: 4 } },
    far: { position: [-11, 7.5, 19], target: [1, 1.6, 3.5], fit: { center: [0.5, 1.8, 3.5], radius: 7.5 } },
    props: { position: [3, 2, 4], target: [0, 0.3, 0], fit: { center: [0, 0.3, 0], radius: 1 } },
  });
  ctx.stage.define({
    eye: { camera: 'eye' },
    far: { camera: 'far' },
    props: { camera: 'props', envTune: PROPS_LOOK },
  });
  const ui = stepUi(ctx);
  const controls = [
    { type: 'toggle', id: 'eye', label: SANDBOX.labels.eye, value: true },
    { type: 'toggle', id: 'inner', label: SANDBOX.labels.inner, value: true },
    { type: 'toggle', id: 'hiding', label: SANDBOX.labels.hiding, value: true },
  ] as const;
  ui.define({
    eye: { controls },
    far: { controls },
    props: {
      controls: [
        {
          type: 'segmented',
          id: 'prop',
          label: SANDBOX.labels.prop,
          items: PROPS.map((id) => ({ id, label: SANDBOX.props[id] })),
          value: PROPS[0],
        },
        { type: 'toggle', id: 'shown', label: SANDBOX.labels.shown, value: true },
      ],
    },
  });

  /* ------------------------------------------------------------------------------------- QA hooks */
  const seen = (mark: Mark) => {
    const cell = eye.project(MARKS[mark]);
    return cell
      ? { cell, ...lumaAround(luma, cell.col, cell.row) }
      : { cell: null, luma: null, around: null };
  };
  /** Where the cell the eye sees a mark in lies on the floating screen (row 0 at the top). */
  const onScreen = (mark: Mark): Vector3 | null => {
    const cell = eye.project(MARKS[mark]);
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
    eye.camera.updateMatrixWorld();
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
      seen: { light: seen('light'), dark: seen('dark') },
      inner: { shown: inner.object.visible, hiding, rect: innerRect() },
    };
  });
  ctx.qa.expose('radio-luma', () => Array.from(luma));
  ctx.qa.expose('radio-props', () => ({
    name: shown,
    triangles: shown ? props[shown].triangles : 0,
    drawCalls: shown ? props[shown].drawCalls : 0,
  }));
  ctx.qa.probe('eye:light-on-screen', () => onScreen('light'));
  ctx.qa.probe('eye:dark-on-screen', () => onScreen('dark'));

  return {
    update(dt, t) {
      const inProps = ctx.stage.current === 'props';
      lab.visible = !inProps;
      showcase.visible = inProps;
      if (inProps) {
        const name = ui.value<string>('prop') as Prop;
        if (name !== shown && PROPS.includes(name)) {
          if (shown) props[shown].group.visible = false;
          props[name].group.visible = true;
          shown = name;
          ctx.camera.focusOn(props[name].group, { direction: VIEW[name], padding: PADDING[name] });
          ctx.env.fitShadow(props[name].group); // the buildings (x 19…32) lie outside the default shadow frustum
        }
        if (shown) {
          // toggle `shown` off: the same frame without the object, the mask of its own pixels for `qa/measure.mjs`
          props[shown].group.visible = ui.value<boolean>('shown');
          props[shown].update(dt, t);
        }
        return;
      }
      if (shown) {
        props[shown].group.visible = false;
        ctx.env.setShadow(LAB_SHADOW);
      }
      shown = null;
      inner.object.visible = ui.value<boolean>('inner');
      hiding = ui.value<boolean>('hiding');
      if (!ui.value<boolean>('eye')) return;
      luma = eye.capture();
      screen.show(luma);
      inner.show(luma);
    },
  };
});
