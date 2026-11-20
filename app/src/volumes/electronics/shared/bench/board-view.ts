/**
 * The breadboard in 3D (docs/volumes/electronics/VISUAL.md §3): a light plastic body with the channel down its
 * middle, the 204 socket mouths as one instanced model, the rail stripes (`coral` behind the far rail `+`, `blue`
 * outside the near rail `−`) with their signs, the two power posts on the right end of the rails and the printed
 * letters and numbers. The numbers of the board are `sim/board/layout.ts`'s: this file only draws them.
 *
 * Local frame of `group` = the board's own frame (`sim/board`): origin in the middle of the field of sockets on the
 * board's top face, +x right, +y up out of the board, +z toward the reader. `mountBench` puts the group into the base
 * frame at `PLACES.breadboard`.
 *
 * Draw calls: the body is one Builder (≤ 3 calls: the plastic with its stripes and signs, the posts' steel, their
 * collars), the mouths one instanced model (1 call for all 204); the print — 12 small texts — is drawn only where it
 * can be read (≥ 16 px-equivalent, the rule of `chapter-check`): not on the main shot, not on phones.
 */
import { Group, ShapeGeometry, Vector3, type Camera, type InstancedMesh } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, G, instanced } from '@/kit';
import { col } from '@/style';
import { Text3D, fontsReady } from '@/text';
import type { BoardLayout, SocketId } from '@electronics/sim/board';
import { PLACES } from './layout';

const mix = (a: string, b: string, k: number) => col(a).lerp(col(b), k);

/** The look of the board (VISUAL §3). */
export const BOARD_LOOK = {
  /** Corner radius of the body in plan. */
  corner: 0.12,
  /** The channel along z = 0: its width and depth. */
  channel: { width: 0.14, depth: 0.06 },
  /** A socket's mouth: a square of this side with rounded corners, and the lighter rim around it. */
  mouth: { side: 0.12, corner: 0.02, rim: 0.016 },
  /** The rail stripes: width, and how far from the board's middle (z) they run, behind each rail. */
  stripe: { width: 0.04, z: 2.08 },
  /** The power posts on the right end of the rails (board frame x, z of the `+` one; `−` is mirrored). */
  post: { x: 2.75, z: -1.95, radius: 0.08, height: 0.3 },
  /** The print: letters of the lines at x = ∓`lettersX`, the column numbers at z = ∓`numbersZ`, 1 em high. */
  print: { lettersX: 2.62, numbersZ: 1.72, size: 0.16, columns: [1, 5, 10, 15] },
  /**
   * The rails' «+» and «−» (VISUAL §3, the rails' signs): not print but marks of the body, like the stripes — flat
   * geometry in the rail's colour, about the size of the display font's «+» at the print's 0.16, always shown. At the
   * left end in line with the letters, at the right end between column 17 and the power post.
   */
  signs: { x: [-2.62, 2.55], size: 0.1 },
} as const;

/**
 * px-equivalent per em of the print: hidden below `MIN`, full from `FULL` (the circuit's lamp print fades in up to
 * 20; the board's print is ≈ 18 px-equivalent on the shot `board`, measured, so it is full from 18).
 */
const LEGIBLE = { MIN: 16, FULL: 18 } as const;

export interface BoardView {
  /** The breadboard; its local frame is the board's own frame (see the file comment). */
  readonly group: Group;
  readonly layout: BoardLayout;
  /** The instanced mouths, one instance per socket in `layout.sockets` order. */
  readonly mouths: InstancedMesh;
  /** The print's texts (empty where fonts are not loaded: unit tests). */
  readonly print: readonly Text3D[];
  /** The middle of a socket's mouth on the board's top face, in the board's own frame. */
  socketLocal(id: SocketId, out?: Vector3): Vector3;
  /** The same in world space (the group's current world matrix). */
  socketWorld(id: SocketId, out?: Vector3): Vector3;
  /**
   * Every frame: the print shows only where it can be read from this camera (≥ 16 px-equivalent per em), never on a
   * phone. `room` 0…1 is the room's light: the print is unlit and follows it.
   */
  update(camera: Camera, room: number): void;
}

/** The body: two halves on either side of the channel, the channel's floor, the stripes, the signs and the posts. */
function body(layout: BoardLayout): Builder {
  const { pitch, columns } = layout.spec;
  const b = new Builder('breadboard');
  const x0 = -((columns - 1) / 2) * pitch - PLACES.breadboard.left;
  const x1 = ((columns - 1) / 2) * pitch + PLACES.breadboard.right;
  const rail = layout.socket('+1')!.z; // the far rail's z (< 0)
  const zEdge = -rail + PLACES.breadboard.beyond;
  const h = PLACES.breadboard.height;
  const gap = BOARD_LOOK.channel.width / 2;
  const plastic = mix('mist', 'steel', 0.35);
  const groove = mix('steel', 'slate', 0.5);
  const r = BOARD_LOOK.corner;
  // shape (x, y) → board (x, −y): the halves in the shape's plane, extruded along y and stood up
  const half = (z0: number, z1: number, radii: readonly number[]) => {
    const g = G.extrude(
      G.polyShape(
        [
          [x0, -z1],
          [x1, -z1],
          [x1, -z0],
          [x0, -z0],
        ],
        radii,
      ),
      h,
      { bevel: 0.02, bevelSeg: 2, curveSeg: 6 },
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, -h / 2, 0);
    return g;
  };
  b.add(half(-zEdge, -gap, [0.004, 0.004, r, r]), { slot: 'matte', c: plastic });
  b.add(half(gap, zEdge, [r, r, 0.004, 0.004]), { slot: 'matte', c: plastic });
  const depth = BOARD_LOOK.channel.depth;
  b.box(x1 - x0 - 0.04, h - depth, gap * 2 + 0.02, {
    at: [(x0 + x1) / 2, -h, 0],
    r: 0,
    slot: 'matte',
    c: groove,
  });
  // the stripes behind the rails and the signs at both ends of each rail (geometry, in the rails' colours)
  const { width: sw, z: sz } = BOARD_LOOK.stripe;
  const along = (x1 - x0) * 0.86;
  const xm = (layout.socket('+1')!.x + layout.socket('+17')!.x) / 2;
  const sign = BOARD_LOOK.signs.size;
  for (const [z, c, plus] of [
    [-sz, 'coral', true],
    [sz, 'blue', false],
  ] as const) {
    b.box(along, 0.004, sw, { at: [xm, 0, z], r: 0, slot: 'matte', c });
    const zr = Math.sign(z) * -rail; // on the rail's own line
    for (const x of BOARD_LOOK.signs.x) {
      b.box(sign, 0.004, sign * 0.2, { at: [x, 0, zr], r: 0, slot: 'matte', c });
      if (plus) b.box(sign * 0.2, 0.004, sign, { at: [x, 0, zr], r: 0, slot: 'matte', c });
    }
  }
  // the two power posts: steel, a coloured collar each (`coral` on the `+` one, `ink` on the `−` one)
  const { x: px, z: pz, radius: pr, height: ph } = BOARD_LOOK.post;
  for (const [z, collar] of [
    [pz, 'coral'],
    [-pz, 'ink'],
  ] as const) {
    b.cyl(pr, ph, { at: [px, 0, z], seg: 18, slot: 'metal', c: ['steel', 'mist'], bevel: 0.02 });
    b.cyl(pr * 1.45, 0.07, { at: [px, ph * 0.45, z], seg: 20, slot: 'gloss', c: collar, bevel: 0.02 });
    b.cyl(pr * 1.6, 0.03, { at: [px, 0, z], seg: 20, slot: 'metal', c: 'steel', bevel: 0.01 });
  }
  return b;
}

/** One socket's mouth: a dark rounded square over a slightly larger, lighter rim — flat, on the top face. */
function mouthModel(): Builder {
  const { side, corner, rim } = BOARD_LOOK.mouth;
  const b = new Builder('socket');
  const flat = (s: number, k: number) => {
    const g = new ShapeGeometry(G.rrectShape(s, s, k), 4);
    g.rotateX(-Math.PI / 2);
    return g;
  };
  b.add(flat(side + 2 * rim, corner + rim), { at: [0, 0.003, 0], slot: 'matte', c: 'steel' });
  b.add(flat(side, corner), { at: [0, 0.005, 0], slot: 'matte', c: 'ink' });
  return b;
}

export function createBoardView(ctx: ChapterContext, layout: BoardLayout): BoardView {
  const group = new Group();
  group.name = 'breadboard';
  group.add(body(layout).build().group);

  const mouths = instanced(
    mouthModel().build(),
    layout.sockets.map((s) => ({ at: [s.x, 0, s.z] as const })),
  );
  mouths.name = 'sockets';
  const mesh = mouths.children[0] as InstancedMesh;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mouths);

  /* ------------------------------------------------------------------------------------------ print */
  const print: Text3D[] = [];
  if (fontsReady()) {
    const { lettersX, numbersZ, size, columns } = BOARD_LOOK.print;
    const text = (s: string, x: number, z: number, name: string): Text3D => {
      const t = new Text3D(s, {
        font: 'display',
        size,
        lineHeight: layout.spec.pitch / size,
        color: 'slate',
        anchorX: 'center',
        anchorY: 'middle',
        align: 'center',
        halo: false,
        rich: false,
      });
      t.rotation.x = -Math.PI / 2;
      t.position.set(x, 0.006, z);
      t.name = name;
      group.add(t);
      print.push(t);
      return t;
    };
    // the letters of the lines a–e and f–j in two blocks at each end, one line per row of sockets
    for (const x of [-lettersX, lettersX])
      for (const [lines, mid] of [
        ['abcde', 'c'],
        ['fghij', 'h'],
      ] as const)
        text([...lines].join('\n'), x, layout.socket(`${mid}1`)!.z, `print:${lines}`);
    // the column numbers above the line a and below the line j
    for (const z of [-numbersZ, numbersZ])
      for (const c of columns) text(String(c), layout.socket(`a${c}`)!.x, z, `print:${c}`);
  }

  const socketLocal = (id: SocketId, out = new Vector3()): Vector3 => {
    const s = layout.socket(id);
    if (!s) throw new RangeError(`breadboard: no socket '${id}'`);
    return out.set(s.x, 0, s.z);
  };

  const a = new Vector3();
  const b = new Vector3();
  const v = new Vector3();
  /** px-equivalent of one em of `t` on screen, measured as `chapter-check` does (engine/debug/text-sizes.ts). */
  const pxEq = (t: Text3D, camera: Camera): number => {
    const mt = t.metrics;
    const cx = (mt.left + mt.right) / 2;
    const cy = (mt.top + mt.bottom) / 2;
    a.set(cx, cy, 0).applyMatrix4(t.matrixWorld);
    b.set(cx, cy + t.fontSize, 0).applyMatrix4(t.matrixWorld);
    if (v.copy(a).applyMatrix4(camera.matrixWorldInverse).z >= 0) return 0;
    a.project(camera);
    b.project(camera);
    return Math.hypot((b.x - a.x) * ctx.viewport.aspect, b.y - a.y) * 540;
  };
  const socketWorld = (id: SocketId, out = new Vector3()): Vector3 => {
    group.updateWorldMatrix(true, false);
    return socketLocal(id, out).applyMatrix4(group.matrixWorld);
  };
  // QA: every mouth by its real name, `__app.locate('socket:a1')`, `'socket:-9'` (resolved only on demand)
  for (const s of layout.sockets) ctx.qa.probe(`socket:${s.id}`, () => socketWorld(s.id));

  let legible = -1;
  let lastRoom = -1;
  return {
    group,
    layout,
    mouths: mesh,
    print,
    socketLocal,
    socketWorld,
    update(camera, room) {
      if (print.length === 0) return;
      const phone = ctx.device.formFactor === 'phone';
      const light = Math.min(Math.max(room, 0), 1);
      const roomChanged = Math.abs(light - lastRoom) > 1e-3;
      if (roomChanged) lastRoom = light;
      group.updateWorldMatrix(true, true);
      camera.updateMatrixWorld();
      // the print is read as one: shown when its smallest text has 16 px-equivalent, so it never comes in piece by
      // piece while the camera drifts across the threshold
      let smallest = Infinity;
      if (!phone) for (const t of print) smallest = Math.min(smallest, pxEq(t, camera));
      const k = phone ? 0 : Math.min(Math.max((smallest - LEGIBLE.MIN) / (LEGIBLE.FULL - LEGIBLE.MIN), 0), 1);
      if (Math.abs(k - legible) < 1e-3 && !roomChanged) return;
      legible = k;
      // dark print on light plastic: unlit, so it darkens with the room and never shines in the dark (a new colour each
      // time: Text3D re-colours only on a new value)
      const ink = mix('ink', 'slate', 0.35).multiplyScalar(0.6 + 0.4 * light);
      for (const t of print) {
        t.visible = k > 0;
        t.opacity = k;
        t.color = ink;
      }
    },
  };
}
