/**
 * Scene of the radio sandbox (`index.ts` holds its words). One scene for every step:
 *   eye — the camera's eye (`@radio/shared/screen`, decision 24) looks at a small yard (a house behind a picket
 *         fence; the park lamp stands off its frame) and two marks, a white cube on its left and a dark one on its
 *         right, set mirror-wise about its axis; every engine update (`dt = 0` included) its frame goes straight
 *         to a floating screen beside the yard. The director's shot keeps that screen in frame and taller than
 *         96 px (about 2,5 px per cell at 1280 × 720), so its cells stay sharp;
 *   far — the same scene and state from the other side and farther: the eye must see exactly the same.
 * The toggle `eye` stops the pass (the screen keeps its last frame), for the draw-call and frame-time checks of
 * `qa/measure.mjs`. Readers: `radio-eye` (the pass and what the eye sees of the marks) and `radio-luma` (its frame);
 * probes `eye:<mark>-on-screen`: where the cell of a mark lies on the floating screen.
 */
import { Vector3 } from 'three';
import { defineScene } from '@/engine/api';
import { stepUi } from '@/hud';
import { Builder, fence, house, island, streetLamp } from '@/kit';
import { LOOK_SCALE, col } from '@/style';
import { EYE_COLS, EYE_ROWS, createEye, createScreen, lumaAround } from '@radio/shared/screen';
import { SANDBOX } from './index';

/** The two marks (cube centres), mirror-wise about the eye's axis: a flipped frame swaps them. */
const MARKS = { light: new Vector3(-1.2, 1.2, 5.5), dark: new Vector3(1.2, 1.2, 5.5) } as const;
type Mark = keyof typeof MARKS;
const MARK_SIZE = 0.6;
const EYE_AT = new Vector3(0, 2.6, 9);
const EYE_LOOK = new Vector3(0, 1, 0);
const SCREEN = { width: 1.6, height: 1.2, at: new Vector3(4.5, 2.2, 5) } as const;

export default defineScene((ctx) => {
  ctx.env.setScale(14, { adaptFrom: LOOK_SCALE.diorama });
  // the engine's motes swarm round the director's target with a size taken from the main frame
  // (style/env/environment.ts:333-337, shaders.ts:185-201): in the eye they would be big blots that follow the reader
  ctx.env.base({ motes: 0 });
  ctx.post.base({ grain: 0 });

  /* -------------------------------------------------------------------------------------- the yard */
  const land = island({ radius: 14 });
  ctx.root.add(land.group);
  land.place(house().group, 0, 0);
  ctx.root.add(
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
  ctx.root.add(marks.build().group);

  /* --------------------------------------------------------------------------- the eye and the screen */
  const screen = createScreen({ width: SCREEN.width, height: SCREEN.height });
  screen.object.position.copy(SCREEN.at);
  screen.power = 1;
  ctx.root.add(screen.object);
  const hidden = [screen.object] as const;
  const eye = createEye(ctx, { hide: () => hidden });
  eye.camera.position.copy(EYE_AT);
  eye.camera.lookAt(EYE_LOOK);
  eye.camera.updateMatrixWorld();
  /** The eye's last frame (zeros until the first pass). */
  let luma: Uint8Array = new Uint8Array(EYE_COLS * EYE_ROWS);

  /* ------------------------------------------------------------------------------- steps and shots */
  ctx.camera.shots({
    eye: { position: [7, 3, 9.5], target: [3, 1.7, 5.2], fit: { center: [2, 1.8, 5], radius: 4 } },
    far: { position: [-11, 7.5, 19], target: [1, 1.6, 3.5], fit: { center: [0.5, 1.8, 3.5], radius: 7.5 } },
  });
  ctx.stage.define({ eye: { camera: 'eye' }, far: { camera: 'far' } });
  const ui = stepUi(ctx);
  const controls = [{ type: 'toggle', id: 'eye', label: SANDBOX.labels.eye, value: true }] as const;
  ui.define({ eye: { controls }, far: { controls } });

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
    };
  });
  ctx.qa.expose('radio-luma', () => Array.from(luma));
  ctx.qa.probe('eye:light-on-screen', () => onScreen('light'));
  ctx.qa.probe('eye:dark-on-screen', () => onScreen('dark'));

  return {
    update() {
      if (!ui.value<boolean>('eye')) return;
      luma = eye.capture();
      screen.show(luma);
    },
  };
});
