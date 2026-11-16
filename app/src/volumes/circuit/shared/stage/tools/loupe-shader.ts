/**
 * What a PLAIN magnifier shows of the wire's first centimetre (the crawl): the wire leaving the
 * clamp, a millimetre scale along it, and stylised sparks darting inside the copper. All lengths in millimetres.
 * Coordinates (s, a): s along the wire from its start (the way the electrons go), a across it, + toward the
 * inside of the bend. Honest part: the scale and the marked spark's net advance `uMm` are true to scale.
 * Simplified: sparks are drawn huge and few, and their darting is made visible.
 */
export const LOUPE_VERTEX = /* glsl */ `
varying vec2 vP;
uniform float uRadius;
void main() {
  vP = position.xy / uRadius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const HEAD = /* glsl */ `
varying vec2 vP;
uniform float uSpan;  // millimetres across the glass
uniform vec2 uStart;   // where the wire starts (mm from the centre of the glass)
uniform float uBend;   // radius of the wire's bend, mm
uniform float uScale;  // length of the scale, whole mm
uniform float uMm;     // the marked spark's net advance
uniform float uTime;
uniform float uWarm;   // 0 lamp off … 1 lamp on
uniform vec3 uBoard;
uniform vec3 uSheath;
uniform vec3 uCopperLow;
uniform vec3 uCopperHigh;
uniform vec3 uSteel;
uniform vec3 uSpark;

const float SHEATH = 1.8;  // radius of the sheath and of the copper core, mm (3.6 and 1.9 mm across)
const float CORE = 0.95;
const float BASE = 2.45;   // the scale's base line, from the wire's axis
const int SPARKS = 16;

float hash( float n ) { return fract( sin( n ) * 43758.5453123 ); }
vec2 hash2( float n ) { return vec2( hash( n ), hash( n + 17.13 ) ); }

vec2 wireCoords( vec2 p ) {
  vec2 v = p - uStart;
  if ( v.x >= 0.0 ) return vec2( -v.x, v.y );
  vec2 c = v - vec2( 0.0, uBend );
  return vec2( uBend * atan( -c.x, -c.y ), uBend - length( c ) );
}

// darting: straight flights between random waypoints, a new one a few times a second; returns −1 … 1
vec2 dart( float id, float t ) {
  float k = t * ( 3.0 + 2.8 * hash( id * 7.31 ) ) + hash( id * 3.7 ) * 10.0;
  float i = floor( k );
  vec2 a = hash2( id * 13.1 + i * 1.37 );
  vec2 b = hash2( id * 13.1 + ( i + 1.0 ) * 1.37 );
  return mix( a, b, fract( k ) ) * 2.0 - 1.0;
}

float segment( vec2 p, vec2 a, vec2 b ) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length( pa - ba * clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 ) );
}

void main() {
  vec2 p = vP * uSpan * 0.5;
  vec2 w = wireCoords( p );
  float s = w.x;
  float a = w.y;
  float aa = fwidth( p.x ) + fwidth( p.y );
  float t = mod( uTime, 600.0 );
  vec3 light = mix( vec3( 0.34, 0.42, 0.66 ), vec3( 1.0, 0.94, 0.82 ), uWarm );
  float r = length( vP );

  // the board, the clamp's screw block the wire comes out of, the bare end, the sheath, the copper
  vec3 c = uBoard * ( 0.9 - 0.25 * r * r );
  float block = ( 1.0 - smoothstep( -2.3 - aa, -2.3 + aa, s ) ) * ( 1.0 - smoothstep( 2.5 - aa, 2.5 + aa, abs( a ) ) );
  c = mix( c, uSteel * ( 0.62 + 0.3 * smoothstep( -2.5, 2.5, a ) ), block );
  float inSheath = ( 1.0 - smoothstep( SHEATH - aa, SHEATH + aa, abs( a ) ) ) * smoothstep( -0.9 - aa, -0.9 + aa, s );
  float skin = mix( 0.5, 0.92, smoothstep( 1.0, SHEATH, abs( a ) ) );
  c = mix( c, uSheath * ( 0.72 + 0.28 * smoothstep( -SHEATH, SHEATH, a ) ), inSheath * skin );
  float inCore = ( 1.0 - smoothstep( CORE - aa, CORE + aa, abs( a ) ) ) * ( 1.0 - block );
  float bulge = sqrt( max( 1.0 - ( a / CORE ) * ( a / CORE ), 0.0 ) );
  vec3 copper = mix( uCopperLow, uCopperHigh, 0.25 + 0.75 * bulge );
  copper += uCopperHigh * 0.35 * exp( -pow( ( a - 0.38 ) / 0.16, 2.0 ) );
  c = mix( c, copper * mix( 1.0, 0.86, inSheath ), inCore );
  c *= light;
`;

const TAIL = /* glsl */ `
  // the scale: a base line beside the wire, a tick per millimetre (the first and the last longer)
  float ink = 0.45 + 0.55 * uWarm;
  float k = clamp( floor( s + 0.5 ), 0.0, uScale );
  float ends = max( 1.0 - step( 0.5, k ), step( uScale - 0.5, k ) );
  float len = mix( 0.6, 1.0, ends );
  float tick = ( 1.0 - smoothstep( 0.05 - aa, 0.05 + aa, abs( s - k ) ) )
    * step( BASE, a ) * ( 1.0 - smoothstep( BASE + len - aa, BASE + len + aa, a ) );
  float base = ( 1.0 - smoothstep( 0.04 - aa, 0.04 + aa, abs( a - BASE ) ) )
    * step( -0.05, s ) * step( s, uScale + 0.05 );
  c = mix( c, vec3( 0.92, 0.95, 1.0 ) * ink, max( tick * mix( 0.75, 1.0, ends ), base ) );

  // the marked spark: it darts like the rest, around the point that has really advanced uMm
  vec2 q = vec2( s, a );
  vec2 marked = vec2( uMm, 0.0 ) + dart( 0.0, t ) * vec2( 0.42, 0.52 );
  // its place on the scale: a steady caret on the base line and a thin leader up to the spark
  vec2 tip = vec2( uMm, BASE - 0.1 );
  float caret = 1.0 - smoothstep( -aa, aa, max( abs( q.x - tip.x ) - ( tip.y - q.y ) * 0.55, q.y - tip.y ) );
  caret *= step( tip.y - 0.5, q.y );
  float leader = 1.0 - smoothstep( 0.03, 0.03 + aa, segment( q, tip - vec2( 0.0, 0.45 ), marked ) );
  c = mix( c, mix( uSpark, vec3( 1.0 ), 0.6 ), max( caret, leader * 0.7 ) );

  // the crowd: the same darting, the same common shift; they wrap round outside the glass
  float dots = 0.0;
  float halo = 0.0;
  float span = uSpan + 2.0;
  for ( int i = 1; i < SPARKS; i++ ) {
    float id = float( i );
    float home = mod( id * span / float( SPARKS - 1 ) + hash( id * 5.3 ) * 0.5 + uMm, span ) - 0.3 * span;
    vec2 at = vec2( home, ( hash( id * 9.7 ) - 0.5 ) * 0.9 ) + dart( id, t ) * vec2( 0.55, 0.3 );
    at.y = clamp( at.y, -0.74, 0.74 );
    float d = length( q - at );
    dots = max( dots, 1.0 - smoothstep( 0.14 - aa, 0.14 + aa, d ) );
    halo += exp( -d * d / 0.07 );
  }
  // cyan beads with a soft halo, painted over the copper (not added: on orange they would wash out to white)
  c = mix( c, c * 0.55 + uSpark * 0.5, min( halo, 1.0 ) * 0.5 * inCore );
  c = mix( c, mix( uSpark, vec3( 1.0 ), 0.3 ) * 1.25, dots * inCore );
  // the marked one: a white core in a white ring — the sign it carries on every floor
  float dm = length( q - marked );
  c = mix( c, uSpark * 1.2, 0.6 * exp( -dm * dm / 0.12 ) );
  c = mix( c, vec3( 1.5 ), 1.0 - smoothstep( 0.19 - aa, 0.19 + aa, dm ) );
  c = mix( c, vec3( 1.3 ), 1.0 - smoothstep( 0.04, 0.04 + aa, abs( dm - 0.42 ) ) );

  // the glass darkens toward its rim and carries one soft crescent of light, upper left
  c *= 1.0 - 0.45 * smoothstep( 0.72, 1.0, r );
  float crescent = smoothstep( 0.78, 0.88, r ) * ( 1.0 - smoothstep( 0.9, 0.97, r ) )
    * smoothstep( 0.55, 0.98, dot( vP / max( r, 1e-4 ), normalize( vec2( -0.62, 0.78 ) ) ) );
  c += vec3( 0.75, 0.9, 1.0 ) * crescent * ( 0.1 + 0.12 * uWarm );
  gl_FragColor = vec4( c, 1.0 );
}`;

export const LOUPE_FRAGMENT = HEAD + TAIL;
