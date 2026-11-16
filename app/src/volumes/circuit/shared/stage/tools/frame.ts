/**
 * The counter frame (VISUAL.md §5.7): a thin `teal` frame around the wire that can be carried along the loop,
 * with its number right above it — never a separate instrument with digits.
 * It stands across the wire: local +x = along the wire, the frame lies in the local YZ plane.
 */
import { Group, Mesh, Vector3 } from 'three';
import { G } from '@/kit';
import { K, col } from '@/style';
import { Text3D } from '@/text';
import { LOOP, SEAT } from '../layout';

/** The loop as one closed rounded rectangle (board frame, at the wire's height), dense polyline. */
export function loopPath(): Vector3[] {
  const y = LOOP.y;
  const corners = [
    new Vector3(LOOP.left, y, LOOP.near),
    new Vector3(LOOP.left, y, LOOP.far),
    new Vector3(LOOP.right, y, LOOP.far),
    new Vector3(LOOP.right, y, LOOP.near),
  ];
  // start in the middle of the far side (at the second seat) so that no corner is the path's seam
  const start = new Vector3(SEAT.x, y, LOOP.far);
  const closed = G.roundPath(
    [start, corners[2]!, corners[3]!, corners[0]!, corners[1]!, start.clone()],
    LOOP.corner,
    12,
  );
  return closed;
}

export interface FrameModel {
  group: Group;
  /** Place the frame on the loop: `s` 0…1 along `loopPath()` (clockwise seen from above, from the second seat). */
  setOnLoop(s: number): void;
  /** Place it anywhere: a point on a wire and the wire's direction there (board frame). */
  setAt(point: Vector3, tangent: Vector3): void;
  /** The number above the frame (already formatted; '' hides it). */
  setNumber(text: string): void;
  /** 0 hidden … 1 shown. */
  shown: number;
  /** Brightness of the unlit number 0…1 (follow the room's light). */
  light: number;
}

export function createFrame(): FrameModel {
  const group = new Group();
  group.name = 'counter-frame';
  const SIZE = 0.52;
  const material = K.toon({
    color: 'teal',
    emissive: 'teal',
    emissiveIntensity: 0.3,
    keepHue: true,
    gloss: 0.5,
  });
  // a rounded square of thin tube, standing across the wire, on a small shoe that slides on the board
  const h = SIZE / 2;
  const outline = G.roundPath(
    [
      new Vector3(0, -h + 0.02, 0),
      new Vector3(0, -h + 0.02, h),
      new Vector3(0, h, h),
      new Vector3(0, h, -h),
      new Vector3(0, -h + 0.02, -h),
      new Vector3(0, -h + 0.02, 0),
    ],
    0.09,
    6,
  );
  const frame = new Mesh(G.tube(outline, 0.024, { seg: 10, closed: true }), material);
  frame.castShadow = true;
  frame.name = 'counter-frame:frame';
  const shoe = new Mesh(
    G.rbox(0.16, 0.045, SIZE + 0.12, 0.02, 1),
    K.toon({ color: 'teal.dark', gloss: 0.3 }),
  );
  shoe.position.y = -LOOP.y + 0.0225;
  shoe.castShadow = shoe.receiveShadow = true;
  const number = new Text3D('', {
    font: 'display',
    size: 0.2,
    color: 'white',
    anchorX: 'center',
    anchorY: 'bottom',
    billboard: true,
    halo: { radius: 0.1, color: 'bg.void', opacity: 0.7 },
    rich: false,
  });
  number.position.y = h + 0.1;
  group.add(frame, shoe, number);

  const path = loopPath();
  const total = G.pathLength(path);
  const white = col('white');
  const p = new Vector3();
  const tangent = new Vector3();
  let shown = 1;
  let light = 1;
  const setAt = (point: Vector3, dir: Vector3): void => {
    group.position.copy(point);
    group.rotation.set(0, Math.atan2(-dir.z, dir.x), 0);
  };
  const model: FrameModel = {
    group,
    setAt,
    setOnLoop(s) {
      G.pathAt(path, (((s % 1) + 1) % 1) * total, p, tangent);
      setAt(p, tangent);
    },
    setNumber(text) {
      if (number.text !== text) number.text = text;
      number.visible = text !== '';
    },
    get shown() {
      return shown;
    },
    set shown(v: number) {
      shown = Math.min(Math.max(v, 0), 1);
      group.visible = shown > 0.004;
      group.scale.setScalar(Math.max(shown * (2 - shown), 1e-3));
    },
    get light() {
      return light;
    },
    set light(v: number) {
      light = Math.min(Math.max(v, 0), 1);
      number.color = white.clone().multiplyScalar(0.4 + 0.6 * light);
    },
  };
  model.setOnLoop(0.82);
  return model;
}
