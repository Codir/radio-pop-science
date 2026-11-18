/**
 * The pole scale «бракує · порівну · забагато» (script `battery/poles`, `inside`, `balance`: one instrument): a
 * small dark card standing at a world point — an upright bar, `coral` at the bottom (lack), a quiet middle
 * (equal), `cyan` at the top (surplus), three ticks with their names and a bright pointer that glides to the level.
 * It faces the camera, keeps its size on the screen (like the interface's labels: the names are ≥ 16 CSS px on
 * every screen) and is drawn on the overlay layer, so the depth of field never blurs it.
 */
import {
  BufferAttribute,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  type PerspectiveCamera,
  PlaneGeometry,
  Vector3,
  type Camera,
} from 'three';
import { damp, toOverlay } from '@/engine/api';
import { G } from '@/kit';
import { col } from '@/style';
import { Text3D, textViewport } from '@/text';

export interface PoleScale {
  group: Group;
  /** −1 … 1: the level the pointer shows (± `mark` = the outer ticks). Set every frame; the pointer glides. */
  level: number;
  /** The level the outer ticks stand for (the battery's mark). */
  mark: number;
  /** 0 hidden … 1 shown (fades). */
  shown: number;
  /** Which names are shown: [lack, equal, surplus] (≤ 3 labels in the frame: a step may need room). */
  names: [boolean, boolean, boolean];
  /** The lowest level the bar shows (−1 the whole scale; a step about the minus alone shows −0.25 … 1). */
  low: number;
  /** Where the pointer is now (−1 … 1). */
  readonly pointer: number;
  /**
   * Stand the card at a world point: `corner` = which corner of the card touches it (−1 … 1 on x and y;
   * (−1, −1) = its lower left corner, the card extends up and right; values in between slide it across).
   */
  place(at: Vector3, camera: Camera, corner?: [number, number]): void;
  /** Snap the pointer and the fades (deep links). */
  snap(): void;
  update(dt: number): void;
}

/** Height of the bar on the screen, px-eq (1 px-eq = 1 CSS px at 1080p); everything else in units of it. */
const BAR_PX = 132;
/** The names: 24 px-eq (16 CSS px at 1280×720) — never smaller than 16 CSS px. */
const NAME_PX = 24;
const BAR_W = 0.065;
const PAD = 0.1;

export function createPoleScale(names: { surplus: string; equal: string; lack: string }): PoleScale {
  const group = new Group();
  group.name = 'battery:pole-scale';
  const body = new Group();
  group.add(body);

  // the bar: a vertical gradient coral → slate → cyan over the levels it shows (`low` … 1; level v at y = v / 2)
  const bar = new PlaneGeometry(BAR_W, 1, 1, 16);
  const pos = bar.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  bar.setAttribute('color', new BufferAttribute(colors, 3));
  const lack = col('coral');
  const mid = col('slate').lerp(col('mist'), 0.3);
  const high = col('cyan');
  const c = new Color();
  const paintBar = (lo: number): void => {
    for (let i = 0; i < pos.count; i++) {
      const v = lo + (pos.getY(i) + 0.5) * (1 - lo);
      if (v < 0) c.copy(mid).lerp(lack, Math.min(-v * 1.15, 1));
      else c.copy(mid).lerp(high, Math.min(v * 1.15, 1));
      colors.set([c.r, c.g, c.b], 3 * i);
    }
    bar.getAttribute('color').needsUpdate = true;
  };
  const mats: MeshBasicMaterial[] = [];
  const mat = (o: ConstructorParameters<typeof MeshBasicMaterial>[0], order: number): MeshBasicMaterial => {
    const m = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, ...o });
    m.userData.alpha = m.opacity;
    m.userData.order = order;
    mats.push(m);
    return m;
  };
  const mesh = (geo: ConstructorParameters<typeof Mesh>[0], m: MeshBasicMaterial): Mesh => {
    const x = new Mesh(geo, m);
    x.renderOrder = 60 + (m.userData.order as number);
    body.add(x);
    return x;
  };
  // the names, right of the ticks (local units: the bar is 1 high)
  const label = (text: string, color: string): Text3D => {
    const t = new Text3D(text, {
      font: 'display',
      size: NAME_PX / BAR_PX,
      color,
      anchorX: 'left',
      anchorY: 'middle',
      halo: false,
      rich: false,
      depthTest: false,
      depthWrite: false,
    });
    t.renderOrder = 64;
    body.add(t);
    return t;
  };
  const labels = [label(names.lack, 'coral'), label(names.equal, 'mist'), label(names.surplus, 'cyan')];
  const textX = BAR_W / 2 + 0.09;
  const width = Math.max(...labels.map((t) => t.metrics.width));
  const plateW = PAD + 0.07 + BAR_W + 0.09 + width + PAD;
  const left = -BAR_W / 2 - 0.07 - PAD;
  const plate = mesh(
    G.rbox(plateW, 1, 0.001, 0.09, 4),
    mat({ color: col('bg.void').lerp(col('bg.indigo'), 0.35), opacity: 0.82 }, 0),
  );
  const barMesh = mesh(bar, mat({ vertexColors: true }, 1));
  let shaped = Number.NaN;
  /** The card for the levels `lo` … 1: bar, plate (the plate's rounded box is rebuilt for its height). */
  const shape = (lo: number): void => {
    if (lo === shaped) return;
    shaped = lo;
    paintBar(lo);
    const h = (1 - lo) / 2;
    const centre = (1 + lo) / 4;
    barMesh.scale.y = h;
    barMesh.position.y = centre;
    size.h = h + 2 * PAD + 0.06;
    size.centre = centre;
    plate.geometry.dispose();
    plate.geometry = G.rbox(plateW, size.h, 0.001, 0.09, 4);
    plate.position.set(left + plateW / 2, centre, -0.01);
  };
  // the ticks at −mark, 0, +mark (placed in `update`: the mark may change)
  const ticks = [0, 1, 2].map(() =>
    mesh(new PlaneGeometry(BAR_W + 0.06, 0.016), mat({ color: col('white'), opacity: 0.9 }, 2)),
  );
  // the pointer: a small triangle left of the bar, pointing at it, and a bright line across it
  const pointerGroup = new Group();
  const tri = new Mesh(new CircleGeometry(0.055, 3), mat({ color: col('white') }, 3));
  tri.position.set(-BAR_W / 2 - 0.06, 0, 0);
  tri.renderOrder = 63;
  const line = new Mesh(new PlaneGeometry(BAR_W + 0.04, 0.028), mat({ color: col('white') }, 3));
  line.renderOrder = 63;
  pointerGroup.add(tri, line);
  body.add(pointerGroup);
  toOverlay(group);

  const size = { w: plateW, h: 1, left, centre: 0 };
  shape(-1);
  const forward = new Vector3();
  const toAt = new Vector3();
  let fade = 0;
  let pointer = 0;
  const nameFade = [1, 1, 1];
  const scale: PoleScale = {
    group,
    level: 0,
    mark: 0.75,
    shown: 0,
    names: [true, true, true],
    low: -1,
    get pointer() {
      return pointer;
    },
    place(at, camera, corner = [-1, -1]) {
      // world size of one CSS px at this depth; px-eq → CSS px as the interface scales, the names never < 16 px
      camera.getWorldDirection(forward);
      const depth = Math.max(toAt.copy(at).sub(camera.position).dot(forward), 0.05);
      const p11 = (camera as PerspectiveCamera).projectionMatrix.elements[5]!;
      const cssPx = (2 * depth) / (p11 * textViewport.cssHeight);
      const pxPerEq = Math.max(textViewport.pxPerUnit, 16 / NAME_PX);
      group.position.copy(at);
      group.quaternion.copy(camera.quaternion);
      group.scale.setScalar(cssPx * pxPerEq * BAR_PX);
      // the chosen corner of the card at `at`
      // continuous in between: a card that changes sides slides across instead of jumping
      body.position.set(
        -size.left - (size.w * (corner[0] + 1)) / 2,
        -size.centre - (size.h * corner[1]) / 2,
        0,
      );
    },
    snap() {
      pointer = scale.level;
      fade = scale.shown;
      scale.names.forEach((on, i) => (nameFade[i] = on ? 1 : 0));
    },
    update(dt) {
      fade = damp(fade, scale.shown, 6, dt);
      if (Math.abs(fade - scale.shown) < 1e-3) fade = scale.shown;
      pointer = damp(pointer, scale.level, 6, dt);
      group.visible = fade > 0.004;
      if (!group.visible) return;
      shape(scale.low);
      const m = scale.mark;
      [-m, 0, m].forEach((v, i) => {
        ticks[i]!.position.y = v / 2;
        ticks[i]!.visible = v >= scale.low;
        labels[i]!.position.set(textX, v / 2, 0);
      });
      pointerGroup.position.y = Math.max(scale.low, Math.min(1, pointer)) / 2;
      for (const mt of mats) mt.opacity = (mt.userData.alpha as number) * fade;
      labels.forEach((t, i) => {
        nameFade[i] = damp(nameFade[i]!, scale.names[i] ? 1 : 0, 6, dt);
        t.opacity = fade * nameFade[i]!;
        t.visible = t.opacity > 0.004;
      });
    },
  };
  return scale;
}
