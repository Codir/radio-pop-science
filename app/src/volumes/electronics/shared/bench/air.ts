/**
 * The air of the room (docs/volumes/electronics/VISUAL.md §2: «порошинки — лише у світлі лампи»), copied from
 * `circuit/shared/stage/air.ts` (shared/README.md, «Копії») without the flashlight's beam: dust motes that are
 * visible ONLY in the lamp's light, driven by the lamp's world position and output; with the lamp off there is
 * nothing to see.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { ChapterContext } from '@/engine/api';
import { kGlobals } from '@/style';

const MOTES_VERTEX = /* glsl */ `
uniform float uKTime;
uniform vec3 uLamp;
uniform float uPower;
uniform float uPx;
attribute vec4 aSeed;
varying float vLight;
void main() {
  // slow drift: each mote wanders on its own small loop and sinks a little
  vec3 p = position;
  float t = uKTime * ( 0.05 + 0.05 * aSeed.x ) + aSeed.y * 6.283;
  p += vec3( sin( t ) * 0.22, sin( t * 0.7 + aSeed.z * 6.283 ) * 0.16, cos( t * 0.9 ) * 0.22 );
  vec4 world = modelMatrix * vec4( p, 1.0 );
  float d = length( world.xyz - uLamp );
  // the lamp's own falloff, without the glare right at the glass
  vLight = uPower * smoothstep( 0.35, 0.8, d ) / ( 1.0 + d * d * d * 0.22 ) * ( 0.35 + 0.65 * aSeed.w * aSeed.w );
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * ( 0.6 + 0.8 * aSeed.w ) / max( -mv.z, 0.5 );
}`;
const MOTES_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vLight;
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = ( 1.0 - smoothstep( 0.0, 1.0, r ) );
  a = a * a * vLight;
  if ( a < 0.003 ) discard;
  gl_FragColor = vec4( uColor * a, 1.0 );
}`;

export interface Air {
  motes: Points;
  /**
   * @param lamp   world position of the filament
   * @param color  colour of the lamp's light
   * @param power  0…1 light output
   */
  set(lamp: Vector3, color: Color, power: number): void;
}

export function createAir(ctx: ChapterContext, count = 260): Air {
  const n = ctx.quality.count(count, 160);
  const position = new Float32Array(n * 3);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    // a slab of air over the bench: wide, and up to 3 units above the base
    position.set(
      [ctx.random.range(-5.4, 5.4), ctx.random.range(0.7, 4.4), ctx.random.range(-3.9, 4.2)],
      i * 3,
    );
    seed.set([ctx.random.next(), ctx.random.next(), ctx.random.next(), ctx.random.next()], i * 4);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const motesMaterial = new ShaderMaterial({
    uniforms: {
      uKTime: kGlobals.uKTime,
      uLamp: { value: new Vector3() },
      uPower: { value: 0 },
      uPx: { value: 30 },
      uColor: { value: new Color() },
    },
    vertexShader: MOTES_VERTEX,
    fragmentShader: MOTES_FRAGMENT,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const motes = new Points(geometry, motesMaterial);
  motes.frustumCulled = false;
  motes.name = 'air-motes';
  motes.renderOrder = 6;
  const px = (): void =>
    void (motesMaterial.uniforms.uPx!.value = 0.05 * ctx.viewport.height * ctx.viewport.dpr);
  px();
  ctx.onResize(px);
  return {
    motes,
    set(lamp, color, power) {
      const u = motesMaterial.uniforms;
      (u.uLamp!.value as Vector3).copy(lamp);
      (u.uColor!.value as Color).copy(color);
      u.uPower!.value = power * 0.85;
      // nothing to draw in the dark: the motes are seen only in the lamp's light
      motes.visible = power > 0.004;
    },
  };
}
