/**
 * The magnifier as a PLAIN magnifier (the crawl, DECISIONS §60 s–t): inside the ring the first
 * centimetre of the wire a few times enlarged — the wire leaving the clamp, a millimetre scale along it as long
 * as one spark really gets, sparks darting in the copper, the marked one drifting from 0 to the last tick.
 * A disc just behind the glass with its own picture (`loupe-shader.ts`), turned so that the board's «right» stays
 * right whatever way the magnifier's handle points.
 */
import { CircleGeometry, Group, Mesh, Object3D, Quaternion, ShaderMaterial, Vector2, Vector3 } from 'three';
import { col } from '@/style';
import { Text3D } from '@/text';
import { LENS } from '../layout';
import { LOUPE_FRAGMENT, LOUPE_VERTEX } from './loupe-shader';

/** Millimetres across the glass, where the wire starts in it, the radius of the wire's bend (all mm). */
export const LOUPE = { span: 11, start: [2.9, -1.7], bend: 9, base: 2.45 } as const;

export interface LoupeModel {
  /** Add to the lens's group (it lies in the ring's plane). */
  group: Group;
  /** 0 off (default: the glass is see-through) … 1 the enlarged picture. */
  shown: number;
  /** Times the picture is enlarged against the board's own scale. */
  magnification: number;
  /** Print «0» and «N мм» (default true). */
  labels: boolean;
  /**
   * Places for captions: four points just outside the ring as the reader sees them (top, bottom, left, right),
   * the point on the scale the marked spark has really reached, and the scale's last tick.
   */
  anchors: Record<'lensTop' | 'lensBottom' | 'lensLeft' | 'lensRight' | 'mark' | 'scaleEnd', Object3D>;
  /** `mm` = the marked spark's net advance; `warm` 0…1 the lamp; `lens` = the lens's rotation in the board frame. */
  set(mm: number, warm: number, t: number, lens: Quaternion): void;
}

export function createLoupe(scaleMm: number, unitsPerMm: number): LoupeModel {
  const radius = LENS.radius - 0.062;
  const group = new Group();
  group.name = 'lens:loupe';
  group.position.z = -0.012;
  const material = new ShaderMaterial({
    uniforms: {
      uRadius: { value: radius },
      uSpan: { value: LOUPE.span },
      uStart: { value: new Vector2(...LOUPE.start) },
      uBend: { value: LOUPE.bend },
      uScale: { value: scaleMm },
      uMm: { value: 0 },
      uTime: { value: 0 },
      uWarm: { value: 0 },
      uBoard: { value: col('bg.violet').lerp(col('bg.indigo'), 0.3) },
      uSheath: { value: col('mist').lerp(col('violet'), 0.25) },
      uCopperLow: { value: col('orange.dark').lerp(col('wireBrown'), 0.5) },
      uCopperHigh: { value: col('orange.dark').lerp(col('orange'), 0.7) },
      uSteel: { value: col('steel').lerp(col('mist'), 0.35) },
      uSpark: { value: col('cyan') },
    },
    vertexShader: LOUPE_VERTEX,
    fragmentShader: LOUPE_FRAGMENT,
  });
  // `group` is only turned (the board's «right» stays right); `view` is the picture, opening like an iris
  const view = new Group();
  group.add(view);
  const disc = new Mesh(new CircleGeometry(radius, 72), material);
  disc.name = 'lens:loupe-view';
  view.add(disc);
  // «0» and «N мм» at the outer ends of the first and the last tick
  const perMm = radius / (LOUPE.span / 2);
  const place = (s: number, a: number, out: Vector3): Vector3 => {
    const [sx, sy] = LOUPE.start;
    if (s <= 0) return out.set((sx - s) * perMm, (sy + a) * perMm, 0.004);
    const th = s / LOUPE.bend;
    const rr = LOUPE.bend - a;
    return out.set((sx - rr * Math.sin(th)) * perMm, (sy + LOUPE.bend - rr * Math.cos(th)) * perMm, 0.004);
  };
  const style = { font: 'display', size: 0.075, color: 'white', halo: false, rich: false } as const;
  const zero = new Text3D('0', { ...style, anchorX: 'center', anchorY: 'bottom' });
  place(0, LOUPE.base + 1.25, zero.position);
  const last = new Text3D(`${scaleMm} мм`, { ...style, anchorX: 'center', anchorY: 'bottom' });
  place(scaleMm, LOUPE.base + 1.25, last.position);
  view.add(zero, last);
  const anchor = (x: number, y: number): Object3D => {
    const o = new Object3D();
    o.position.set(x, y, 0);
    group.add(o);
    return o;
  };
  const out = LENS.radius + 0.04;
  const anchors = {
    lensTop: anchor(0, out),
    lensBottom: anchor(0, -out),
    lensLeft: anchor(-out, 0),
    lensRight: anchor(out, 0),
    mark: anchor(0, 0),
    scaleEnd: anchor(0, 0),
  };
  place(scaleMm, LOUPE.base + 1, anchors.scaleEnd.position);
  const white = col('white');
  const x = new Vector3();
  const inverse = new Quaternion();
  const state = { shown: 0, labels: true };
  return Object.assign(state, {
    group,
    anchors,
    magnification: (2 * radius) / (LOUPE.span * unitsPerMm),
    set(mm: number, warm: number, t: number, lens: Quaternion): void {
      // the board's +x, seen in the ring's plane, is the picture's «right»
      x.set(1, 0, 0).applyQuaternion(inverse.copy(lens).invert());
      group.rotation.z = Math.atan2(x.y, x.x);
      place(Math.min(Math.max(mm, 0), scaleMm), LOUPE.base, anchors.mark.position);
      const e = Math.min(Math.max(state.shown, 0), 1);
      view.visible = e > 0.004;
      if (!view.visible) return;
      view.scale.setScalar(Math.max(e * e * (3 - 2 * e), 1e-3));
      const u = material.uniforms;
      u.uMm!.value = mm;
      u.uTime!.value = t;
      u.uWarm!.value = warm;
      zero.color = last.color = white.clone().multiplyScalar(0.45 + 0.55 * warm);
      zero.visible = last.visible = state.labels;
    },
  });
}
