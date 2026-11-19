/**
 * The monitor's screen: a 128 × 96 one-channel texture that only the signal model updates (through `show`), on a
 * plain rectangle. Row 0 is at the top; cell 255 gives exactly 1.0 (white does not bloom), a dark screen is glass
 * at 0.015, and scene light does not change it (VISUAL.md §5).
 */
import {
  DataTexture,
  LinearMipmapLinearFilter,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
} from 'three';
// the model's frame: the screen shows what the model computed, so its size comes from there
import { COLS, ROWS } from '@radio/sim/core';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tLuma;
uniform float uPower;
varying vec2 vUv;
void main() {
  float v = texture2D(tLuma, vec2(vUv.x, 1.0 - vUv.y)).r;
  gl_FragColor = vec4(vec3(0.015 + 0.985 * uPower * pow(v, 2.2)), 1.0);
}
`;

export interface Screen {
  /** The screen rectangle; goes on the monitor's anchor. */
  readonly object: Mesh;
  /** 0 — dark glass … 1 — on. */
  power: number;
  /** 128·96 values; the texture is updated here only. */
  show(luma: Uint8Array): void;
  /** What the screen shows now (the texture's own data, not a copy). */
  readonly luma: Uint8Array;
  dispose(): void;
}

export function createScreen(opts: { width: number; height: number }): Screen {
  const data = new Uint8Array(COLS * ROWS);
  const texture = new DataTexture(data, COLS, ROWS, RedFormat, UnsignedByteType);
  // all three before the first draw: three allocates the texture's levels on its first upload only
  texture.magFilter = NearestFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { tLuma: { value: texture }, uPower: { value: 0 } },
  });
  const geometry = new PlaneGeometry(opts.width, opts.height);
  const object = new Mesh(geometry, material);
  const uPower = material.uniforms.uPower!;

  return {
    object,
    get power() {
      return uPower.value as number;
    },
    set power(v: number) {
      uPower.value = v;
    },
    show(luma: Uint8Array): void {
      data.set(luma);
      // every upload rebuilds the mip levels (mipmapsAutoUpdate stays true)
      texture.needsUpdate = true;
    },
    luma: data,
    dispose(): void {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
