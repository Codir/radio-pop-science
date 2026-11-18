/**
 * The counter frame's number (VISUAL §5.7: «число над рамкою», the one number in the scene) and the second it
 * counts: a thin ring that fills around the caption «за 1 с» while the second runs. Both face the camera and stand
 * just above the frame, the number centred over it, the ring at its right end. The count itself is exact: the
 * electrons through the frame in `t` seconds at 0.3 A, the low digits rolling as they would.
 */
import { DoubleSide, Group, Mesh, RingGeometry, ShaderMaterial, Vector3, type Camera } from 'three';
import { col } from '@/style';
import { Text3D } from '@/text';

/** Electrons per second at 0.3 A: 0.3 × 6.241 509 × 10¹⁸ (script: «1 872 000 000 000 000 000»). */
export const PER_SECOND = 1_872_000_000_000_000_000n;
const NBSP = ' ';

/** `n` with its digits in groups of three («1 872 000 …»). */
export function grouped(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Electrons counted after `t` seconds (0…1): exact at 0 and 1, the low digits rolling in between. */
export function countAt(t: number): bigint {
  if (t <= 0) return 0n;
  if (t >= 1) return PER_SECOND;
  const micro = BigInt(Math.floor(t * 1e6));
  // the share below a microsecond: the next electrons in, so the low digits roll instead of standing at zero
  const rest = BigInt(Math.floor(((t * 1e6) % 1) * 1_872_000_000_000));
  return micro * 1_872_000_000_000n + rest;
}

const RING_FRAG = /* glsl */ `
uniform float uProgress;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vP;
void main() {
  // clockwise from the top, like a clock hand
  float a = atan(vP.x, vP.y) / 6.2831853;
  a = a < 0.0 ? a + 1.0 : a;
  float on = step(a, uProgress);
  gl_FragColor = vec4(uColor, uOpacity * mix(0.18, 1.0, on));
}`;
const RING_VERT = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export interface CountDisplay {
  group: Group;
  /** Place above `at` (world), facing `camera`; `lift` = world units above. */
  /**
   * Place above `at` (world), facing `camera`; `lift` = world units above; `side` −1 … 0: how far the block is
   * moved to the left of the frame (0 centred over it, −1 its right end just left of the frame — the free side
   * where the lamp stands to the right).
   */
  place(at: Vector3, camera: Camera, lift: number, side?: number): void;
  /** The number (0 hidden), how loud it is (0.35 dim while carried … 1), the second's progress 0…1. */
  set(count: bigint | null, loud: number, progress: number, shown: number, light: number): void;
}

export function countDisplay(unit: string): CountDisplay {
  const group = new Group();
  group.name = 'flow-count';
  const number = new Text3D('0', {
    font: 'display',
    size: 0.15,
    color: 'white',
    anchorX: 'right',
    anchorY: 'middle',
    halo: { radius: 0.09, color: 'bg.void', opacity: 0.7 },
    rich: false,
  });
  const label = new Text3D(unit, {
    font: 'body',
    size: 0.11,
    weight: 0.02,
    color: 'white',
    anchorX: 'center',
    anchorY: 'middle',
    halo: false,
    rich: false,
  });
  const material = new ShaderMaterial({
    uniforms: { uProgress: { value: 0 }, uColor: { value: col('teal.light') }, uOpacity: { value: 1 } },
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const ring = new Mesh(new RingGeometry(0.255, 0.28, 72), material);
  const unitGroup = new Group();
  unitGroup.add(ring, label);
  group.add(number, unitGroup);
  const white = col('white');
  const right = new Vector3();
  return {
    group,
    place(at, camera, lift, side = 0) {
      group.quaternion.copy(camera.quaternion);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      group.position.copy(at);
      group.position.y += lift;
      // the block (number + ring) is centred over the frame
      const w = number.metrics.width;
      const half = (w + 0.66) / 2;
      // centred: from −half to +half; on the left: its right end 0.3 left of the frame (and a little lower)
      const dx = side * (half + 0.3);
      number.position.set(half - 0.66 + dx, side * 0.35, 0);
      unitGroup.position.set(half - 0.28 + dx, side * 0.35, 0);
    },
    set(count, loud, progress, shown, light) {
      group.visible = shown > 0.004;
      if (!group.visible) return;
      const text = count === null ? '' : grouped(count);
      if (number.text !== text) number.text = text;
      const k = (0.45 + 0.55 * light) * loud;
      number.color = white.clone().multiplyScalar(k);
      label.color = white.clone().multiplyScalar(0.75 * k + 0.1);
      number.opacity = label.opacity = shown;
      material.uniforms.uProgress!.value = progress;
      material.uniforms.uOpacity!.value = shown * (0.5 + 0.5 * loud);
      group.scale.setScalar(Math.max(shown * (2 - shown), 1e-3));
    },
  };
}
