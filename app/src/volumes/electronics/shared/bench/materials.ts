/**
 * Materials of the bench, copied from `circuit/shared/stage/materials.ts` (shared/README.md, «Копії»).
 * Everything is a K material; the two wide matte surfaces that carry the lamp's light
 * (the board's face and the table top) use `surface()` — K.toon with one extra term.
 *
 * Why the extra term: the K lighting model is `colour = base × light`, so a warm lamp on a dark violet board
 * only makes the violet brighter — the pool of light would not read as warm. A matte painted surface also
 * reflects a little of the light whatever its own hue (scatter); `scatter` adds that share of the direct light,
 * tinted warm, to the result. Shadows stay `base × fill` (cool, tinted), the lit pool takes the lamp's own colour, and the
 * result is still clamped to 1, so the board never blooms (docs/volumes/electronics/VISUAL.md §1: only the LEDs and
 * the lamp glow).
 */
import { ShaderChunk, Vector4 } from 'three';
import { K, col, type ColorLike, type KToonMaterial, type ToonParams } from '@/style';

export interface SurfaceParams extends ToonParams {
  /** Share of the direct light added as scatter (0 = plain K.toon). Default 0.1. */
  scatter?: number;
  /** Tint of the scatter: what the surface makes of the lamp's light. Default a warm cream. */
  scatterTint?: ColorLike;
  /** Soft shoulder for strong light, so the pool under the lamp keeps its colour instead of clipping. Default 0.3. */
  shoulder?: number;
  /** 0…1: how far the pool of light is gathered into soft steps. Default 0.8. */
  pool?: number;
}

const BASE_LINE = 'vec3 color = base * light;';
// `keyS`: the direct light with a soft shoulder, its brightness gathered into three soft steps above the
// moon's level — the lamp's pool on the board reads as a designed shape (core, ring, fringe), not as a vague
// gradient, and shadows cut through it with the same soft edge
const PATCH = /* glsl */ `
  vec3 keyS = key / ( 1.0 + uScatter.w * kLuma( key ) );
  float kl = kLuma( keyS );
  float kStep = min( kl, 0.4 )
    + 0.35 * smoothstep( 0.42, 0.62, kl )
    + 0.6 * smoothstep( 0.95, 1.3, kl )
    + 0.95 * smoothstep( 1.9, 2.5, kl );
  keyS *= mix( 1.0, kStep / max( kl, 1e-3 ), uPool );
  vec3 color = base * ( fill + keyS - fill * min( keyS, vec3( 1.0 ) ) ) + keyS * uScatter.rgb;`;

/** Taps of the point-light shadow filter on `surface()` (three's own is 5: visible grain on wide penumbras). */
const POINT_SHADOW_TAPS = 16;

/**
 * The lamp's shadows fall on the board and the table with a wide penumbra; three's cube-shadow filter takes 5
 * rotated taps, which shows as grain at 4K. The surfaces that carry those shadows get the same filter with
 * more taps: the chunk is inlined with its loop widened (throws if three changes the chunk).
 */
function softPointShadows(fragment: string): string {
  const chunk = ShaderChunk.shadowmap_pars_fragment;
  const loop = 'for ( int i = 0; i < 5; i ++ )';
  const sample = 'vogelDiskSample( i, 5, phi )';
  const norm = 'shadow *= 0.2;';
  const include = '#include <shadowmap_pars_fragment>';
  if (![loop, sample, norm].every((t) => chunk.includes(t)) || !fragment.includes(include)) {
    throw new Error(
      'stage/surface: three.js point-shadow chunk changed — the soft-shadow patch no longer applies',
    );
  }
  const n = POINT_SHADOW_TAPS;
  return fragment.replace(
    include,
    chunk
      .replace(loop, `for ( int i = 0; i < ${n}; i ++ )`)
      .replace(sample, `vogelDiskSample( i, ${n}, phi )`)
      .replace(norm, `shadow *= ${(1 / n).toFixed(6)};`),
  );
}

export function surface(params: SurfaceParams = {}): KToonMaterial {
  const { scatter = 0.1, scatterTint, shoulder = 0.3, pool = 0.8, ...toon } = params;
  // a wide matte plane lit by a near point light: smooth falloff reads better than a hard cel ring on the board
  const material = K.toon({ bands: 2, softness: 0.32, terminator: 0.3, highlight: 0, rim: 0, ...toon });
  if (!material.fragmentShader.includes(BASE_LINE)) {
    throw new Error('stage/surface: K.toon shader changed — the scatter patch no longer applies');
  }
  material.fragmentShader = softPointShadows(material.fragmentShader)
    .replace('uniform vec4 uBand;', 'uniform vec4 uBand;\nuniform vec4 uScatter;\nuniform float uPool;')
    .replace(BASE_LINE, PATCH);
  const tint = col(scatterTint ?? col('yellow.light').lerp(col('orange'), 0.35)).multiplyScalar(scatter);
  material.uniforms.uScatter = { value: new Vector4(tint.r, tint.g, tint.b, shoulder) };
  material.uniforms.uPool = { value: pool };
  material.name = 'stage.surface';
  return material;
}

export interface SheathParams extends ToonParams {
  /** Opacity where the surface faces the camera / at grazing angles. Defaults 0.4 / 0.92. */
  opacity?: number;
  edgeOpacity?: number;
}

const OUT_LINE = 'gl_FragColor = vec4( color + emissive, diffuseColor.a );';

/**
 * Translucent plastic that is LIT: the wires' sheath. `K.glass` is unlit, so in a dark room it would glow by
 * itself; this is K.toon (lamp light, cel bands, shadows) with a fresnel alpha — denser at the silhouette, so
 * the copper core shows through the middle of the wire.
 */
export function sheath(params: SheathParams = {}): KToonMaterial {
  const { opacity = 0.4, edgeOpacity = 0.92, ...toon } = params;
  const material = K.toon({ gloss: 0.8, highlight: 0.5, rim: 0.6, ...toon, opacity });
  if (!material.fragmentShader.includes(OUT_LINE)) {
    throw new Error('stage/sheath: K.toon shader changed — the fresnel patch no longer applies');
  }
  material.fragmentShader = material.fragmentShader
    .replace('uniform vec4 uBand;', 'uniform vec4 uBand;\nuniform float uEdgeAlpha;')
    .replace(
      OUT_LINE,
      /* glsl */ `float kGraze = 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) );
  gl_FragColor = vec4( color + emissive, mix( diffuseColor.a, uEdgeAlpha, smoothstep( 0.25, 0.95, kGraze ) ) );`,
    );
  material.uniforms.uEdgeAlpha = { value: edgeOpacity };
  material.name = 'stage.sheath';
  return material;
}

const NDL_LINE = 'float ndl = dot( geometryNormal, directLight.direction );';

/**
 * The lamp is a near point light with an intensity far above 1 (it has to reach the far edge of the board).
 * K.toon multiplies `base × light` and clamps afterwards, so right next to the lamp every colour would blow out
 * toward yellow-white — the wires by the socket looked as if they glowed. `tame()` limits each light's
 * contribution to `cap` while keeping its hue: near the lamp things are fully lit in the lamp's colour, never
 * over-exposed. Applied to every lit K material of the stage except `surface()` (whose pool needs the range).
 */
export function tame<T extends KToonMaterial>(material: T, cap = 1.1): T {
  if (material.name === 'stage.surface' || material.userData.tamed) return material;
  const src = material.fragmentShader;
  const start = src.indexOf(NDL_LINE);
  const end = src.indexOf('void RE_IndirectDiffuse_K');
  if (start < 0 || end < start)
    throw new Error('stage/tame: K lighting chunk changed — the patch no longer applies');
  const body = src.slice(start + NDL_LINE.length, end).replaceAll('directLight.color', 'kLightColor');
  const cut = /* glsl */ `
  vec3 kLightColor = directLight.color / max( 1.0, max( directLight.color.r, max( directLight.color.g, directLight.color.b ) ) / ${cap.toFixed(3)} );`;
  material.fragmentShader = src.slice(0, start) + NDL_LINE + cut + body + src.slice(end);
  material.userData.tamed = true;
  return material;
}
