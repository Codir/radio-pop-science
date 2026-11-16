/**
 * Palette colours for Canvas2D marks. The WebGL painter works on linear colours (`rgba()` of `ui3d`) and
 * brightens them by scaling the linear value (`lit(c, k)`); the canvas wants sRGB, so the same scaling is done
 * in linear space and converted back — a `lit(c, 1.2)` curve has the same colour in both renderers.
 */
import { Color } from 'three';
import { col, type ColorLike } from '@/style';

const tmp = new Color();
const cache = new Map<string, string>();

/**
 * CSS colour of a palette token (or any `ColorLike`) with alpha, optionally brightened like `lit(c, k)`.
 * `over` = what it is painted over, which decides how the linear-light alpha maps to canvas alpha: `dark` (the
 * plates — the default), `light` (a dark veil over a bright field, e.g. the heat-map marker) or `raw` (alpha as
 * given: a light line over a bright field, where both blends come out alike).
 */
export function cssColor(c: ColorLike, alpha = 1, lit = 1, over: 'dark' | 'light' | 'raw' = 'dark'): string {
  const key = typeof c === 'string' || typeof c === 'number' ? `${c}|${alpha}|${lit}|${over}` : null;
  const hit = key ? cache.get(key) : undefined;
  if (hit) return hit;
  col(c, tmp);
  tmp.setRGB(Math.min(tmp.r * lit, 1), Math.min(tmp.g * lit, 1), Math.min(tmp.b * lit, 1));
  tmp.convertLinearToSRGB();
  // The WebGL HUD blends in linear light: a colour at alpha a over a near-black plate reaches the screen as
  // (a·C)^(1/2.2) = a^(1/2.2)·C_sRGB. Canvas blends in sRGB, so the same look needs alpha a^(1/2.2). A dark
  // veil over a bright field B leaves ((1−a)·B)^(1/2.2): canvas alpha 1 − (1−a)^(1/2.2).
  const k = Math.min(Math.max(alpha, 0), 1);
  const a = over === 'dark' ? Math.pow(k, 1 / 2.2) : over === 'light' ? 1 - Math.pow(1 - k, 1 / 2.2) : k;
  const out = `rgb(${Math.round(tmp.r * 255)} ${Math.round(tmp.g * 255)} ${Math.round(tmp.b * 255)} / ${a.toFixed(3)})`;
  if (key) {
    if (cache.size > 500) cache.clear();
    cache.set(key, out);
  }
  return out;
}

/** CSS colour of a linear `Rgba` of the WebGL painter (`rgba()`, `lit()` of `@/ui3d`), over a dark plate. */
export function cssRgba(c: readonly [number, number, number, number]): string {
  tmp.setRGB(Math.min(c[0], 1), Math.min(c[1], 1), Math.min(c[2], 1));
  tmp.convertLinearToSRGB();
  const a = Math.pow(Math.min(Math.max(c[3], 0), 1), 1 / 2.2);
  return `rgb(${Math.round(tmp.r * 255)} ${Math.round(tmp.g * 255)} ${Math.round(tmp.b * 255)} / ${a.toFixed(3)})`;
}

/** The chapter accent of an element's subtree (`--accent`, a hex colour set by the DOM core), as a token. */
export function accentHex(el: Element): string {
  return getComputedStyle(el).getPropertyValue('--accent').trim() || '#00e5ff';
}
