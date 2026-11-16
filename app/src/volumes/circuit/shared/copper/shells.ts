/**
 * The blur of an atom's electron layers: three soft bands of light around the nucleus and a fainter fourth where
 * the outer electron lives. Not orbits — nothing is drawn as a line; it is the smear the soft electrons leave as
 * they flow, and what makes 2 · 8 · 18 · 1 read as four layers (VISUAL §6). One camera-facing quad.
 */
import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, Vector4 } from 'three';
import { col, kGlobals } from '@/style';

const VERT = /* glsl */ `
uniform float uReach;
varying vec2 vUv;
void main() {
  vUv = position.xy * 2.0 * uReach;
  float scale = length(modelMatrix[0].xyz);
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * 2.0 * uReach * scale;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec4 uRadii;
uniform float uFade;
uniform float uOuter;
uniform float uKTime;
varying vec2 vUv;
float band(float r, float at, float width) {
  float d = (r - at) / width;
  return exp(-d * d);
}
void main() {
  float r = length(vUv);
  float a = atan(vUv.y, vUv.x);
  // each layer breathes a little and is never evenly bright all the way round
  float w1 = 0.82 + 0.18 * sin(a * 2.0 + uKTime * 0.31);
  float w2 = 0.82 + 0.18 * sin(a * 3.0 - uKTime * 0.23 + 1.7);
  float w3 = 0.82 + 0.18 * sin(a * 2.0 + uKTime * 0.17 + 4.1);
  float g = band(r, uRadii.x, 0.085) * 0.34 * w1
          + band(r, uRadii.y, 0.1) * 0.25 * w2
          + band(r, uRadii.z, 0.12) * 0.2 * w3
          + band(r, uRadii.w, 0.2) * 0.06 * uOuter;
  // a faint fill inside the ion core ties the layers into one body
  g += 0.045 * (1.0 - smoothstep(uRadii.z * 0.6, uRadii.z * 1.25, r));
  if (g * uFade < 0.002) discard;
  gl_FragColor = vec4(uColor * g * uFade, 0.0);
}`;

export interface Shells {
  mesh: Mesh;
  fade: number;
  /** 0…1 presence of the faint fourth layer (the outer electron's). */
  outer: number;
}

export function createShells(radii: readonly [number, number, number, number]): Shells {
  const reach = radii[3] * 1.35;
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: col('cyan').lerp(col('cyan.dark'), 0.35) },
      uRadii: { value: new Vector4(...radii) },
      uReach: { value: reach },
      uFade: { value: 1 },
      uOuter: { value: 1 },
      uKTime: kGlobals.uKTime,
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    premultipliedAlpha: true,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.name = 'atom-shells';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return {
    mesh,
    get fade() {
      return material.uniforms.uFade!.value as number;
    },
    set fade(v: number) {
      material.uniforms.uFade!.value = v;
      mesh.visible = v > 0.004;
    },
    get outer() {
      return material.uniforms.uOuter!.value as number;
    },
    set outer(v: number) {
      material.uniforms.uOuter!.value = v;
    },
  };
}
