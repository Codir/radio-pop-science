/**
 * The breadboard in 3D against the board as data (docs/volumes/electronics/VISUAL.md §3): every mouth and every QA
 * probe `socket:<id>` lies where `sim/board`'s layout puts the socket, carried by the board's frame on the tilted base
 * (Box3 / Vector3 only, no WebGL); the body's size, the channel, the print and where the print can be read.
 */
import { readFileSync } from 'node:fs';
import { Box3, Matrix4, Vector3, type Mesh, type Object3D } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ChapterContext } from '@/engine/api';
import { CameraDirector, type Shot } from '@/engine/camera/director';
import { setFontData, type FontJson } from '@/text';
import { createLayout } from '@electronics/sim/board';
import { createBase } from '../base';
import { BOARD_LOOK, createBoardView } from '../board-view';
import { PLACES } from '../layout';
import { STAGE_SHOTS, boardToWorld } from '../shots';

/** A chapter context with only what the board view uses: QA probes, the device and the viewport. */
function stubContext(formFactor: 'desktop' | 'phone' = 'desktop') {
  const probes = new Map<string, () => Object3D | Vector3 | null>();
  const disposers: (() => void)[] = [];
  const ctx = {
    clock: { dt: 0, time: 0 },
    onDispose: (fn: () => void) => disposers.push(fn),
    onResize: () => () => {},
    qa: {
      expose: () => () => {},
      probe: (name: string, target: () => Object3D | Vector3 | null) => (probes.set(name, target), () => {}),
    },
    device: { formFactor },
    viewport: { width: 1920, height: 1080, aspect: 1920 / 1080, dpr: 1 },
  } as unknown as ChapterContext;
  return { ctx, probes };
}

/** The board on the base, where `mountBench` puts it. */
function mounted(formFactor: 'desktop' | 'phone' = 'desktop') {
  const { ctx, probes } = stubContext(formFactor);
  const layout = createLayout();
  const base = createBase();
  const view = createBoardView(ctx, layout);
  view.group.position.set(PLACES.breadboard.x, PLACES.breadboard.height, PLACES.breadboard.z);
  base.frame.add(view.group);
  base.group.updateMatrixWorld(true);
  return { layout, base, view, probes };
}

/** Where a socket must be in the world: its place in the board's frame, on the breadboard, on the tilted base. */
const expected = (s: { x: number; z: number }) =>
  boardToWorld(PLACES.breadboard.x + s.x, PLACES.breadboard.height, PLACES.breadboard.z + s.z);

describe('the sockets of the 3D board are the sockets of the layout', () => {
  it('one probe `socket:<id>` per socket, at the layout’s place under the frame transform', () => {
    const { layout, probes } = mounted();
    expect(layout.sockets).toHaveLength(204);
    expect([...probes.keys()].filter((k) => k.startsWith('socket:'))).toHaveLength(204);
    for (const s of layout.sockets) {
      const at = probes.get(`socket:${s.id}`)!() as Vector3;
      expect(at.distanceTo(expected(s)), s.id).toBeLessThan(1e-9);
    }
    // the corners and the names QA asks for
    for (const id of ['a1', 'j17', '-9', '+1', '-17']) expect(probes.has(`socket:${id}`)).toBe(true);
  });

  it('one instanced mouth per socket, in the layout’s order, on the board’s top face', () => {
    const { layout, view } = mounted();
    expect(view.mouths.count).toBe(204);
    const m = new Matrix4();
    const p = new Vector3();
    layout.sockets.forEach((s, i) => {
      view.mouths.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      // instance matrices are 32-bit floats
      expect(p.x).toBeCloseTo(s.x, 6);
      expect(p.y).toBeCloseTo(0, 6);
      expect(p.z).toBeCloseTo(s.z, 6);
      // carried to the world by the board's group, it is the probe's point
      expect(p.applyMatrix4(view.mouths.matrixWorld).distanceTo(expected(s)), s.id).toBeLessThan(1e-6);
    });
    expect(view.socketWorld('j17').distanceTo(expected(layout.socket('j17')!))).toBeLessThan(1e-9);
    expect(() => view.socketLocal('k3')).toThrow(RangeError);
  });

  it('the mouth: a dark square 0.12 (0.4 P) with a lighter rim, flat on the face and casting no shadow', () => {
    const { view } = mounted();
    const box = new Box3().setFromBufferAttribute(view.mouths.geometry.getAttribute('position') as never);
    expect(box.max.x - box.min.x).toBeCloseTo(BOARD_LOOK.mouth.side + 2 * BOARD_LOOK.mouth.rim, 6);
    expect(box.max.y).toBeLessThan(0.01);
    expect(box.min.y).toBeGreaterThan(0);
    expect(BOARD_LOOK.mouth.side).toBeCloseTo(0.4 * 0.3, 12);
    expect(view.mouths.castShadow).toBe(false);
  });
});

describe('the body (VISUAL §3)', () => {
  /** The plastic of the body alone: the `matte` mesh of the builder (the posts are `metal` and `gloss`). */
  const plastic = (view: ReturnType<typeof mounted>['view']) => {
    let found: Mesh | null = null;
    view.group.traverse((o) => {
      if ((o as Mesh).isMesh && o.name === 'breadboard:matte') found = o as Mesh;
    });
    return found! as Mesh;
  };

  it('is 5.7 × 0.3 × 4.3 around the field of sockets: 0.3 left of column 1, 0.6 right of 17, 0.2 past the rails', () => {
    const { view } = mounted();
    const box = new Box3().setFromBufferAttribute(plastic(view).geometry.getAttribute('position') as never);
    expect(box.min.x).toBeCloseTo(-2.7, 6);
    expect(box.max.x).toBeCloseTo(3.0, 6);
    expect(box.min.z).toBeCloseTo(-2.15, 6);
    expect(box.max.z).toBeCloseTo(2.15, 6);
    expect(box.min.y).toBeCloseTo(-PLACES.breadboard.height, 6);
    expect(box.max.y).toBeLessThan(0.005); // the stripes and signs are flat on the face
  });

  it('has the channel along z = 0: no top face between the lines e and f, its floor 0.06 down', () => {
    const { view } = mounted();
    const pos = plastic(view).geometry.getAttribute('position');
    const half = BOARD_LOOK.channel.width / 2;
    let top = 0;
    let floor = 0;
    let floorWidth = 0;
    for (let i = 0; i < pos.count; i++) {
      const z = Math.abs(pos.getZ(i));
      if (z < half - 1e-6 && pos.getY(i) > -1e-6) top++;
      if (Math.abs(pos.getY(i) + BOARD_LOOK.channel.depth) < 1e-6) {
        floor++;
        floorWidth = Math.max(floorWidth, z);
      }
    }
    expect(top).toBe(0);
    expect(floor).toBeGreaterThan(0);
    // the floor runs under the channel and a hair under its lips, never out to the sockets e and f
    expect(floorWidth).toBeGreaterThanOrEqual(half);
    expect(floorWidth).toBeLessThan(half + 0.02);
  });

  it('carries the two power posts on the right end of the rails, beyond column 17', () => {
    const { layout, view } = mounted();
    const steel = view.group.getObjectByName('breadboard:metal') as Mesh;
    const box = new Box3().setFromBufferAttribute(steel.geometry.getAttribute('position') as never);
    expect(box.min.x).toBeGreaterThan(layout.socket('+17')!.x + BOARD_LOOK.mouth.side / 2);
    expect(box.max.x).toBeLessThan(3.0);
    expect(box.min.z).toBeCloseTo(BOARD_LOOK.post.z - BOARD_LOOK.post.radius * 1.6, 6);
    expect(box.max.z).toBeCloseTo(-BOARD_LOOK.post.z + BOARD_LOOK.post.radius * 1.6, 6);
  });
});

describe('the print (VISUAL §3)', () => {
  beforeAll(() => {
    const json = JSON.parse(
      readFileSync(new URL('../../../../../../public/fonts/fonts.json', import.meta.url), 'utf8'),
    ) as FontJson;
    setFontData(json);
  });

  it('names the lines at both ends and the columns 1, 5, 10, 15 above a and below j', () => {
    const { layout, view } = mounted();
    expect(view.print.map((t) => t.text.replaceAll('\n', ''))).toEqual([
      'abcde',
      'fghij',
      'abcde',
      'fghij',
      '1',
      '5',
      '10',
      '15',
      '1',
      '5',
      '10',
      '15',
    ]);
    const letters = view.print.slice(0, 4);
    expect(letters.map((t) => t.position.x)).toEqual([-2.62, -2.62, 2.62, 2.62]);
    expect(letters[0]!.position.z).toBeCloseTo(layout.socket('c1')!.z, 12);
    expect(letters[1]!.position.z).toBeCloseTo(layout.socket('h1')!.z, 12);
    // one line of print per line of sockets
    for (const t of letters) expect(t.metrics.lineHeight).toBeCloseTo(0.3, 9);
    for (const t of view.print.slice(4)) {
      expect(Math.abs(t.position.z)).toBeCloseTo(1.72, 12);
      expect(t.position.x).toBeCloseTo(layout.socket(`a${t.text}`)!.x, 12);
      expect(t.fontSize).toBe(0.16);
    }
  });

  /** The board seen from a shot at 1920 × 1080 with the DOM interface's panels (as the browser has them). */
  const seenFrom = (shot: Shot, formFactor: 'desktop' | 'phone' = 'desktop') => {
    const { base, view } = mounted(formFactor);
    const d = new CameraDirector();
    d.setViewport(1920, 1080);
    d.setInsets({ left: 0.0398, right: 0.2677, top: 0.1091, bottom: 0.113 }, true);
    d.go(shot, { instant: true });
    d.camera.updateMatrixWorld();
    base.group.updateMatrixWorld(true);
    view.update(d.camera, 1);
    return view.print.filter((t) => t.visible).length;
  };

  it('is not drawn on the main shot (under 16 px-equivalent) and drawn whole on `board`; never on a phone', () => {
    expect(seenFrom(STAGE_SHOTS.stand)).toBe(0);
    expect(seenFrom(STAGE_SHOTS.board)).toBe(12);
    expect(seenFrom(STAGE_SHOTS.board, 'phone')).toBe(0);
  });
});
