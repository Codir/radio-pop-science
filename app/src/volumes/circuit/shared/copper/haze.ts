/**
 * The haze of an atom's own electrons: a soft camera-facing veil around every atom, densest at the limb of the
 * sphere and gone by 1.7 radii (VISUAL §6: `cyan.dark`, about 15 %). It is what the 28 inner electrons look like
 * from a row away — the dive into one atom resolves the same veil into the shells. With `heat` it turns into
 * the orange rim of a hot, trembling atom. One draw call for the whole crystal.
 */
import {
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { col } from '@/style';
import { ATOM_R } from './layout';

/** Outer radius of the veil in atom radii. */
const REACH = 1.6;

const VERT = /* glsl */ `
attribute vec4 aInst; // xyz centre, w presence
varying vec2 vUv;
varying float vK;
void main() {
  vUv = position.xy * 2.0;
  vK = aInst.w;
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(aInst.xyz, 1.0);
  mv.xy += position.xy * 2.0 * ${(ATOM_R * REACH).toFixed(3)} * scale * (0.6 + 0.4 * aInst.w);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uAmount;
uniform float uHeat;
varying vec2 vUv;
varying float vK;
void main() {
  float r = length(vUv) * ${REACH.toFixed(3)}; // in atom radii
  // dense next to the sphere, thinning outward; the sphere itself hides the middle (it is in front)
  float veil = smoothstep(${REACH.toFixed(3)}, 1.0, r);
  veil = veil * veil * (0.55 + 0.45 * smoothstep(0.75, 1.02, r));
  float a = veil * vK * uAmount * mix(0.17, 0.8, uHeat);
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uColor, uHot, uHeat), a);
}`;

export interface Haze {
  mesh: Mesh;
  /** Overall strength 0…1 and heat 0…1 (orange rim). */
  amount: number;
  heat: number;
  set(i: number, x: number, y: number, z: number, presence: number): void;
  commit(): void;
}

export function createHaze(count: number): Haze {
  const geometry = new InstancedBufferGeometry();
  const quad = new PlaneGeometry(1, 1);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  const inst = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  geometry.setAttribute('aInst', inst);
  geometry.instanceCount = count;
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: col('cyan.dark').lerp(col('cyan'), 0.2) },
      uHot: { value: col('orange') },
      uAmount: { value: 1 },
      uHeat: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'copper-haze';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return {
    mesh,
    get amount() {
      return material.uniforms.uAmount!.value as number;
    },
    set amount(v: number) {
      material.uniforms.uAmount!.value = v;
      mesh.visible = v > 0.004;
    },
    get heat() {
      return material.uniforms.uHeat!.value as number;
    },
    set heat(v: number) {
      material.uniforms.uHeat!.value = v;
    },
    set: (i, x, y, z, presence) => inst.setXYZW(i, x, y, z, presence),
    commit: () => (inst.needsUpdate = true),
  };
}
