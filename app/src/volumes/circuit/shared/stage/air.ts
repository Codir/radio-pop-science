/**
 * The air of the room (VISUAL.md §2, §5.1): dust motes that are visible ONLY in the lamp's light, and the
 * faint cone of light in front of the flashlight's glass while the lamp still sits in its mirror.
 * Both are driven by the lamp's world position and output; with the lamp off there is nothing to see.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { ChapterContext } from '@/engine/api';
import { G } from '@/kit';
import { kGlobals } from '@/style';

const MOTES_VERTEX = /* glsl */ `
uniform float uKTime;
uniform vec3 uLamp;
uniform vec4 uBeam;   // xyz = beam axis (world), w = cos of the half-angle (−1 = the lamp shines all around)
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
  vec3 toMote = world.xyz - uLamp;
  float d = length( toMote );
  float cone = uBeam.w < -0.99 ? 1.0 : smoothstep( uBeam.w - 0.05, uBeam.w + 0.12, dot( toMote / d, uBeam.xyz ) );
  // the lamp's own falloff, without the glare right at the glass
  vLight = uPower * cone * smoothstep( 0.35, 0.8, d ) / ( 1.0 + d * d * d * 0.22 ) * ( 0.35 + 0.65 * aSeed.w * aSeed.w );
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

const BEAM_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying float vAlong;
void main() {
  vAlong = uv.y;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  vNormal = normalize( normalMatrix * normal );
  vView = normalize( -mv.xyz );
  gl_Position = projectionMatrix * mv;
}`;
// a hollow cone passes for a volume of lit dust when it is brightest where its skin faces the eye (the middle,
// where a real beam is deepest) and dies at the silhouette and along its length; no texture, no noise
const BEAM_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
varying vec3 vNormal;
varying vec3 vView;
varying float vAlong;
void main() {
  float facing = abs( dot( normalize( vNormal ), vView ) );
  float a = pow( facing, 1.4 ) * ( 1.0 - vAlong ) * ( 1.0 - vAlong ) * smoothstep( 0.0, 0.08, vAlong ) * uPower;
  gl_FragColor = vec4( uColor * a, 1.0 );
}`;

export interface Air {
  motes: Points;
  /** The cone of light; add it to the flashlight's glass frame (apex side at the origin, axis +x). */
  beam: Mesh;
  /**
   * @param lamp   world position of the filament
   * @param color  colour of the lamp's light
   * @param power  0…1 light output
   * @param axis   world direction of the flashlight's beam, or null when the lamp shines all around
   * @param beam   0…1: how much of the cone in front of the glass is left (0 once the mirror has gone)
   */
  set(lamp: Vector3, color: Color, power: number, axis: Vector3 | null, beam: number): void;
}

export function createAir(ctx: ChapterContext, count = 260): Air {
  const n = ctx.quality.count(count, 160);
  const position = new Float32Array(n * 3);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    // a slab of air over the stand: wide, and up to 3 units above the board
    position.set(
      [ctx.random.range(-4.6, 4.6), ctx.random.range(0.7, 4.4), ctx.random.range(-3.6, 3.8)],
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
      uBeam: { value: [1, 0, 0, -1] },
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

  // cone: apex cut off at the glass (radius 0.6), opening 34° per side, 4.4 long; uv.y runs along it
  const beamMaterial = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uPower: { value: 0 } },
    vertexShader: BEAM_VERTEX,
    fragmentShader: BEAM_FRAGMENT,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    side: DoubleSide,
  });
  const cone = G.lathe(
    [
      [0.6, 0],
      [3.4, 4.4],
    ],
    { seg: 56 },
  );
  cone.rotateZ(-Math.PI / 2);
  const beam = new Mesh(cone, beamMaterial);
  beam.name = 'air-beam';
  beam.renderOrder = 5;
  beam.frustumCulled = false;
  return {
    motes,
    beam,
    set(lamp, color, power, axis, amount) {
      const u = motesMaterial.uniforms;
      (u.uLamp!.value as Vector3).copy(lamp);
      (u.uColor!.value as Color).copy(color);
      u.uPower!.value = power * 0.85;
      const b = u.uBeam!.value as number[];
      if (axis) b.splice(0, 4, axis.x, axis.y, axis.z, Math.cos(1.0));
      else b[3] = -1;
      (beamMaterial.uniforms.uColor!.value as Color).copy(color);
      beamMaterial.uniforms.uPower!.value = 0.16 * power * amount;
      beam.visible = power * amount > 0.004;
    },
  };
}
