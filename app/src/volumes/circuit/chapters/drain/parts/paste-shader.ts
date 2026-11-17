/**
 * The picture inside the magnifier over the dead battery (`inner`): a slice across the separator, enlarged. Left
 * the zinc's side (gel with a few spent, pale grains), in the middle the separator's paste (dark, faintly fibrous),
 * right the manganese oxide (`ink` grains, paled toward `slate` — the dead state of `battery-section.ts`). Over it
 * the deposit that grew in these hours: pale `mist` lumps with soft shading; a lump a paste particle bumps into
 * glows `orange` for a moment (as an atom hit by an electron, VISUAL §6 «Удар»). Unlit: `uLight` follows the room.
 * Coordinates: `vP` in units of the disc's radius (−1 … 1).
 */
export const BLOBS = 18;

export const PASTE_VERTEX = /* glsl */ `
varying vec2 vP;
uniform float uRadius;
void main() {
  vP = position.xy / uRadius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const PASTE_FRAGMENT = /* glsl */ `
uniform vec4 uBlobs[${BLOBS}]; // xy centre, z radius, w flash 0…1
uniform float uShown;
uniform float uLight;
uniform float uTime;
uniform vec3 uGel;
uniform vec3 uPaste;
uniform vec3 uOxide;
uniform vec3 uOxidePale;
uniform vec3 uDeposit;
uniform vec3 uHot;
varying vec2 vP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
// cellular grains: distance to the nearest jittered point of a cell grid
float grains(vec2 p) {
  vec2 i = floor(p);
  float d = 9.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 c = i + vec2(float(x), float(y));
      vec2 o = c + 0.2 + 0.6 * vec2(hash(c), hash(c + 7.3));
      d = min(d, length(p - o));
    }
  return d;
}
void main() {
  float r = length(vP);
  if (r > 1.0) discard;
  // the three zones, softly joined
  float sepL = smoothstep(-0.55, -0.42, vP.x);
  float sepR = smoothstep(0.38, 0.5, vP.x);
  // the zinc side: gel with spent pale grains
  float zg = smoothstep(0.42, 0.3, grains(vP * 4.2));
  vec3 zinc = mix(uGel, uDeposit * 0.6, zg * 0.45);
  // the separator: dark paste with faint fibres along y
  float fib = noise(vec2(vP.x * 22.0, vP.y * 2.5)) * 0.5 + noise(vec2(vP.x * 41.0, vP.y * 5.0)) * 0.5;
  vec3 paste = uPaste * (0.85 + 0.3 * fib);
  // the oxide: dark grains, paled
  float og = grains(vP * 5.0 + 3.1);
  vec3 oxide = mix(uOxidePale * 0.8, uOxide, smoothstep(0.1, 0.45, og) * 0.7 + 0.3);
  vec3 c = mix(zinc, paste, sepL);
  c = mix(c, oxide, sepR);
  // the deposit: pale lumps, lit from the upper left, a darker rim; a bumped lump glows
  float glow = 0.0;
  for (int i = 0; i < ${BLOBS}; i++) {
    vec4 b = uBlobs[i];
    if (b.z <= 0.0) continue;
    vec2 d = (vP - b.xy) / b.z;
    // lumpy outline
    float wob = 0.12 * sin(atan(d.y, d.x) * 3.0 + b.x * 17.0) + 0.08 * sin(atan(d.y, d.x) * 5.0 + b.y * 11.0);
    float q = length(d) - wob;
    float inside = 1.0 - smoothstep(0.92, 1.0, q);
    float shade = 0.78 + 0.32 * clamp(dot(normalize(d + 1e-4), vec2(-0.6, 0.8)) * (1.0 - q) + 0.2, 0.0, 1.0);
    vec3 lump = uDeposit * shade * mix(0.82, 1.0, smoothstep(1.0, 0.6, q));
    c = mix(c, lump, inside * 0.9);
    glow += b.w * (inside * 0.6 + exp(-max(q - 1.0, 0.0) * 9.0) * (1.0 - inside) * 0.9);
  }
  c += uHot * glow * 0.8;
  // the glass's edge: a soft dark vignette so the picture sits inside the ring
  c *= mix(1.0, 0.55, smoothstep(0.72, 1.0, r));
  gl_FragColor = vec4(c * mix(0.6, 1.0, uLight), uShown * smoothstep(1.0, 0.97, r));
}`;
