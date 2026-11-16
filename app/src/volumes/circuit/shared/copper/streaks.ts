/**
 * Tails of the free electrons: one tapered streak per electron, from where it is back along its flight. Solid
 * shapes (no additive haze): they write depth, so the depth of field focuses them with their electron and an
 * atom in front hides them — a transparent ribbon here took the blur of whatever lay behind it. One draw call.
 */
import {
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { col } from '@/style';

const VERT = /* glsl */ `
attribute vec4 aHead; // xyz position of the electron, w half-width at the head
attribute vec4 aTail; // xyz end of the tail, w brightness
varying vec2 vUv;
varying float vGlow;
void main() {
  // u: 0 at the tail's end … 1 at the electron; v: −1 … 1 across
  vUv = vec2(position.x + 0.5, position.y * 2.0);
  vGlow = aTail.w;
  float scale = length(modelMatrix[0].xyz);
  vec4 head = modelViewMatrix * vec4(aHead.xyz, 1.0);
  vec4 tail = modelViewMatrix * vec4(aTail.xyz, 1.0);
  vec2 along = head.xy - tail.xy;
  float len = max(length(along), 1e-5);
  vec2 across = vec2(-along.y, along.x) / len;
  vec4 mv = mix(tail, head, vUv.x);
  mv.xy += across * vUv.y * aHead.w * scale;
  // a hair behind the electron, so its marble covers the blunt end
  mv.z -= 0.02 * scale;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uDim;
uniform float uFade;
varying vec2 vUv;
varying float vGlow;
void main() {
  // a comet: full width at the electron, a point at the far end
  float half_w = pow(vUv.x, 0.6);
  float edge = fwidth(vUv.y) * 1.2;
  // fading out, a tail thins away (it is a solid shape: darkening it would leave black needles)
  if (abs(vUv.y) > half_w * uFade - edge * 0.5 || vGlow < 0.02) discard;
  vec3 c = mix(uDim, uColor, vUv.x * vUv.x) * mix(0.55, 1.15, vUv.x);
  gl_FragColor = vec4(c * vGlow, 1.0);
}`;

export interface Streaks {
  mesh: Mesh;
  fade: number;
  /** Streak i from `head` back to `tail`; `width` at the head (units), brightness 0…1+. */
  set(
    i: number,
    hx: number,
    hy: number,
    hz: number,
    tx: number,
    ty: number,
    tz: number,
    width: number,
    glow: number,
  ): void;
  commit(): void;
}

export function createStreaks(count: number): Streaks {
  const geometry = new InstancedBufferGeometry();
  const quad = new PlaneGeometry(1, 1, 6, 1);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  const head = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const tail = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  geometry.setAttribute('aHead', head);
  geometry.setAttribute('aTail', tail);
  geometry.instanceCount = count;
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: col('cyan') },
      uDim: { value: col('cyan.dark').lerp(col('cyan'), 0.35) },
      uFade: { value: 1 },
    },
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'electron-streaks';
  mesh.frustumCulled = false;
  return {
    mesh,
    get fade() {
      return material.uniforms.uFade!.value as number;
    },
    set fade(v: number) {
      material.uniforms.uFade!.value = v;
      mesh.visible = v > 0.02;
    },
    set(i, hx, hy, hz, tx, ty, tz, width, glow) {
      head.setXYZW(i, hx, hy, hz, width);
      tail.setXYZW(i, tx, ty, tz, glow);
    },
    commit() {
      head.needsUpdate = true;
      tail.needsUpdate = true;
    },
  };
}
