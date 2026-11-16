/**
 * `hudLayer(ctx)` — a chapter-owned overlay of the DOM interface (replaces `hudSurface` of `@/ui3d`, HUD_DOM
 * §13): a full-screen element in the `chrome` layer, so it hides with the chrome (map, overlays) exactly like
 * the WebGL HUD surface did, and is removed when the chapter is left. Children are absolutely positioned and
 * take the pointer; the layer itself lets every other pointer through to the scene.
 *
 * Under `?hud=gl` it returns null — the caller keeps its WebGL path. The DOM interface is loaded lazily, so a
 * layer asked for before it has mounted is attached as soon as it has.
 */
import type { ChapterContext } from '@/engine/api';
import { parseFlags } from '@/engine/app';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';

let current: DomHud | null = null;
const waiting = new Set<(dom: DomHud) => void>();

/** @internal Called once by the `custom` area when the DOM interface mounts. */
export function registerDomHud(dom: DomHud): void {
  current = dom;
  for (const fn of waiting) fn(dom);
  waiting.clear();
}

/** Is the DOM interface the one in use (`?hud=dom`)? */
export function domHudActive(): boolean {
  return parseFlags(window.location.search).hud === 'dom';
}

/**
 * A chapter overlay element in the DOM interface's chrome layer, or null under `?hud=gl`.
 * `name` becomes its `data-ui` (QA: `__ui.locate(name)`).
 */
export function hudLayer(ctx: ChapterContext, name = 'chapter-layer'): HTMLElement | null {
  if (!domHudActive()) return null;
  const el = h('div.kd-hud-layer', { 'data-ui': name });
  const attach = (dom: DomHud): void => {
    dom.layers.chrome.append(el);
  };
  if (current) attach(current);
  else waiting.add(attach);
  ctx.onDispose(() => {
    waiting.delete(attach);
    el.remove();
  });
  return el;
}
