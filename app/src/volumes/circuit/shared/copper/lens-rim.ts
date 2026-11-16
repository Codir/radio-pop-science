/**
 * The rim of the magnifier, as it stays on screen below the stand (VISUAL §3): after the flight through the ring
 * «обідок розходиться за краї кадру й лишається тонкою cyan-дугою в кутах» — the reader keeps seeing that this
 * is still the view through the lens lying on the wire. Drawn in screen space on the overlay layer (crisp, never
 * blurred), so it needs no camera maths: `open` 0.3 is a ring in the middle of the frame (the door), 0.97 the
 * four arcs in the corners.
 */
import { Mesh, NormalBlending, PlaneGeometry, ShaderMaterial } from 'three';
import { toOverlay } from '@/engine/api';
import { col } from '@/style';

const VERT = /* glsl */ `
varying vec2 vP;
varying float vDiag;
void main() {
  // the aspect ratio of the viewport is in the projection matrix; work in units of half the frame height
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  vP = position.xy * 2.0 * vec2(aspect, 1.0);
  vDiag = length(vec2(aspect, 1.0));
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uDark;
uniform float uOpen;
uniform float uAmount;
varying vec2 vP;
varying float vDiag;
void main() {
  float px = fwidth(vP.y);                 // one pixel, in units of half the frame height
  float d = length(vP) - uOpen * vDiag;    // signed distance to the rim
  float line = 1.0 - smoothstep(1.1 * px, 2.4 * px, abs(d));
  float glow = exp(-abs(d) / (0.018 + 5.0 * px)) * 0.32;
  float rim = max(line, glow);
  float outside = smoothstep(0.0, 0.12, d) * 0.55;   // beyond the glass the frame sinks into the dark
  float a = clamp(rim + outside, 0.0, 1.0) * uAmount;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uDark, uColor * 1.2, clamp(rim / max(rim + outside, 1e-4), 0.0, 1.0)), a);
}`;

export interface LensRim {
  mesh: Mesh;
  /** 0…1 presence. */
  amount: number;
  /** Radius of the rim as a share of the frame's half-diagonal (≈ 0.3 a ring in the frame … 0.97 corner arcs). */
  open: number;
}

export function createLensRim(): LensRim {
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: col('cyan') },
      uDark: { value: col('bg.void') },
      uOpen: { value: 0.97 },
      uAmount: { value: 1 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.name = 'lens-rim';
  mesh.frustumCulled = false;
  mesh.renderOrder = 50;
  toOverlay(mesh);
  return {
    mesh,
    get amount() {
      return material.uniforms.uAmount!.value as number;
    },
    set amount(v: number) {
      material.uniforms.uAmount!.value = v;
      mesh.visible = v > 0.004;
    },
    get open() {
      return material.uniforms.uOpen!.value as number;
    },
    set open(v: number) {
      material.uniforms.uOpen!.value = v;
    },
  };
}
