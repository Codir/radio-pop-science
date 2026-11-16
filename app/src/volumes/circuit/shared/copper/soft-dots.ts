/**
 * Soft dots: additive camera-facing blobs without an edge — how an atom's own electrons are drawn when the
 * reader is inside the atom (VISUAL §6: «м'які cyan-кульки … розмитими шарами»). They are deliberately not the
 * crisp marble of a free electron: bound electrons are a blur around the nucleus, and only the outer one, which
 * the story is about, is drawn as the character. One draw call.
 */
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { col, kGlobals, type ColorLike } from '@/style';

const VERT = /* glsl */ `
attribute vec4 aInst;  // xyz centre, w radius
attribute float aGlow; // brightness
varying vec2 vUv;
varying float vGlow;
void main() {
  vUv = position.xy * 2.0;
  vGlow = aGlow;
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(aInst.xyz, 1.0);
  mv.xy += position.xy * 2.0 * aInst.w * scale;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
uniform float uKTime;
varying vec2 vUv;
varying float vGlow;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  // a bright heart inside a wide soft body; nothing that reads as a surface
  float body = exp(-r2 * 3.2) - exp(-3.2);
  float heart = exp(-r2 * 26.0);
  vec3 c = uColor * (body * 0.75 + heart * 1.15) + vec3(heart * 0.35);
  gl_FragColor = vec4(c * vGlow * uFade, 0.0);
}`;

export interface SoftDots {
  mesh: Mesh;
  fade: number;
  /** Place dot i: centre, radius of its soft body, brightness. */
  set(i: number, x: number, y: number, z: number, radius: number, glow: number): void;
  commit(): void;
}

export function createSoftDots(count: number, color: ColorLike): SoftDots {
  const geometry = new InstancedBufferGeometry();
  const quad = new PlaneGeometry(1, 1);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  const inst = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const glow = new InstancedBufferAttribute(new Float32Array(count), 1);
  geometry.setAttribute('aInst', inst);
  geometry.setAttribute('aGlow', glow);
  geometry.instanceCount = count;
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uColor: { value: col(color) }, uFade: { value: 1 }, uKTime: kGlobals.uKTime },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'soft-dots';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return {
    mesh,
    get fade() {
      return material.uniforms.uFade!.value as number;
    },
    set fade(v: number) {
      material.uniforms.uFade!.value = v;
      mesh.visible = v > 0.004;
    },
    set(i, x, y, z, radius, g) {
      inst.setXYZW(i, x, y, z, radius);
      glow.setX(i, g);
    },
    commit() {
      inst.needsUpdate = true;
      glow.needsUpdate = true;
    },
  };
}
