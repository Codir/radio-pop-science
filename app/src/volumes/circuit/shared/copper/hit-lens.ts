/**
 * «Лупа з лічильником ударів» (VISUAL §5.7; `resistance/balance`, later `drain/inner`): the ordinary magnifier with a
 * thin strip on its rim that fills by how often the electrons hit atoms in the place under it — nearly empty over a
 * wire, full and pulsing `orange` over the lamp — and a frosted glass for the places the lens may not look into
 * yet (the lamp before chapter 6). No digits, no separate instrument.
 *
 * Add `group` to the lens's ring frame (`tools.lens.group`: ring in local XY, facing +z, handle along −y). The
 * strip runs over the top of the ring, filling from the left; the frost lies on the glass, over anything drawn in
 * the lens window. Everything is unlit: pass the room's light (`light`). Set the numbers, call `update(dt, t)`.
 */
import { AdditiveBlending, CircleGeometry, Group, Mesh, RingGeometry, ShaderMaterial } from 'three';
import { col } from '@/style';

/** The strip's arc: from 160° (upper left) clockwise to 20° (upper right), just outside the ring of radius 0.45. */
const ARC = { from: (160 * Math.PI) / 180, to: (20 * Math.PI) / 180, inner: 0.468, outer: 0.515 } as const;
/** Draw after the lens window's copper (render orders 900–901). */
const ORDER = 950;
/** The strip pulses once it is fuller than this. */
const FULL = 0.9;

const VERT = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const STRIP_FRAG = /* glsl */ `
uniform float uFill;
uniform float uPulse;
uniform float uShown;
uniform float uLight;
uniform vec3 uTrack;
uniform vec3 uHot;
varying vec2 vP;
const float FROM = ${ARC.from.toFixed(5)};
const float SPAN = ${(ARC.from - ARC.to).toFixed(5)};
void main() {
  // share of the arc from its left end (0) to its right end (1)
  float a = atan(vP.y, vP.x);
  float s = clamp((FROM - a) / SPAN, 0.0, 1.0);
  float r = length(vP);
  float mid = (r - ${ARC.inner.toFixed(4)}) / ${(ARC.outer - ARC.inner).toFixed(4)};
  // rounded ends and soft long edges
  float edge = smoothstep(0.0, 0.18, mid) * smoothstep(1.0, 0.82, mid);
  float w = fwidth(s) * 1.5;
  float on = 1.0 - smoothstep(uFill - w, uFill + w, s);
  vec3 c = mix(uTrack * 0.55, uHot * (1.0 + 0.55 * uPulse), on);
  float alpha = mix(0.55, 1.0, on) * edge * uShown;
  gl_FragColor = vec4(c * mix(0.55, 1.0, uLight), alpha);
}`;

const FROST_FRAG = /* glsl */ `
uniform float uFrost;
uniform float uLight;
uniform vec3 uTint;
varying vec2 vP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
void main() {
  float r = length(vP) / ${(0.45 - 0.06).toFixed(4)};
  // ground glass: a fine grain and a milky veil, a little brighter toward the upper left where the light falls
  float grain = noise(vP * 160.0) * 0.6 + noise(vP * 52.0) * 0.4;
  float sheen = 0.5 + 0.5 * dot(normalize(vP + 1e-4), normalize(vec2(-0.6, 0.8))) * smoothstep(0.2, 1.0, r);
  vec3 c = uTint * (0.5 + 0.14 * grain + 0.16 * sheen) * mix(0.45, 0.85, uLight);
  // denser toward the rim, as ground glass seen at a slant; still a veil, not a lid
  float alpha = uFrost * (0.86 + 0.06 * grain + 0.08 * r * r) * smoothstep(1.0, 0.96, r);
  gl_FragColor = vec4(c, alpha);
}`;

export interface HitLens {
  /** Add to the lens's ring frame. */
  group: Group;
  /** The strip's presence 0…1. */
  shown: number;
  /** How full the strip is, 0…1 (follow it with your own easing). Above 0.9 it pulses. */
  fill: number;
  /** 0 clear glass … 1 frosted: nothing under the lens is seen. */
  frost: number;
  /** The room's light 0…1 (unlit materials follow it by hand). */
  light: number;
  update(dt: number, t: number): void;
}

export function createHitLens(): HitLens {
  const group = new Group();
  group.name = 'hit-lens';
  const strip = new ShaderMaterial({
    uniforms: {
      uFill: { value: 0 },
      uPulse: { value: 0 },
      uShown: { value: 0 },
      uLight: { value: 1 },
      uTrack: { value: col('slate') },
      uHot: { value: col('orange') },
    },
    vertexShader: VERT,
    fragmentShader: STRIP_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const band = new Mesh(new RingGeometry(ARC.inner, ARC.outer, 96, 1, ARC.to, ARC.from - ARC.to), strip);
  band.name = 'hit-lens:strip';
  band.position.z = 0.012;
  band.renderOrder = ORDER;
  const frostMaterial = new ShaderMaterial({
    uniforms: {
      uFrost: { value: 0 },
      uLight: { value: 1 },
      uTint: { value: col('mist').lerp(col('sky'), 0.25) },
    },
    vertexShader: VERT,
    fragmentShader: FROST_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const frost = new Mesh(new CircleGeometry(0.45 - 0.06, 64), frostMaterial);
  frost.name = 'hit-lens:frost';
  frost.position.z = 0.04;
  frost.renderOrder = ORDER;
  // a soft glow under the full strip (the lamp's place): additive, so it never darkens what is behind
  const glowMaterial = new ShaderMaterial({
    uniforms: { uAmount: { value: 0 }, uHot: { value: col('orange') } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
uniform float uAmount;
uniform vec3 uHot;
varying vec2 vP;
void main() {
  float r = length(vP);
  float d = abs(r - ${((ARC.inner + ARC.outer) / 2).toFixed(4)});
  float a = atan(vP.y, vP.x);
  float inArc = smoothstep(${(ARC.to - 0.15).toFixed(4)}, ${ARC.to.toFixed(4)}, a) * smoothstep(${(ARC.from + 0.15).toFixed(4)}, ${ARC.from.toFixed(4)}, a);
  gl_FragColor = vec4(uHot * exp(-d * d / 0.0012) * inArc * uAmount, 1.0);
}`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(
    new RingGeometry(ARC.inner - 0.08, ARC.outer + 0.08, 96, 1, ARC.to - 0.2, ARC.from - ARC.to + 0.4),
    glowMaterial,
  );
  glow.name = 'hit-lens:glow';
  glow.position.z = 0.01;
  glow.renderOrder = ORDER;
  group.add(glow, band, frost);
  const lens: HitLens = {
    group,
    shown: 0,
    fill: 0,
    frost: 0,
    light: 1,
    update(_dt, t) {
      const fill = Math.min(Math.max(lens.fill, 0), 1);
      // the full strip breathes, never blinks: a slow pulse that comes in over the last tenth of the strip
      const full = Math.min(Math.max((fill - FULL) / (1 - FULL), 0), 1);
      const pulse = full * (0.5 + 0.5 * Math.sin(t * 5.2));
      const u = strip.uniforms;
      u.uFill!.value = fill;
      u.uPulse!.value = pulse;
      u.uShown!.value = lens.shown;
      u.uLight!.value = lens.light;
      band.visible = lens.shown > 0.004;
      glowMaterial.uniforms.uAmount!.value = lens.shown * full * (0.35 + 0.4 * pulse);
      glow.visible = band.visible && full > 0.002;
      frostMaterial.uniforms.uFrost!.value = lens.frost;
      frostMaterial.uniforms.uLight!.value = lens.light;
      frost.visible = lens.frost > 0.004;
    },
  };
  return lens;
}
