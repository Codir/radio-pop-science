/**
 * Interface sounds of the DOM regions, as the WebGL controls play them (`ui3d` Control / Button / Pager): a soft
 * `hover` when the pointer enters an enabled button, `tap` on a click (`data-sfx` names another sound, e.g.
 * `page` for the page bar). One delegated listener pair per region.
 */
import { sfx, type UiSound } from '@/ui3d';

const live = (t: EventTarget | null): HTMLButtonElement | null => {
  const b = t instanceof Element ? t.closest('button') : null;
  return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true' ? b : null;
};

export function uiSounds(region: HTMLElement): void {
  region.addEventListener('pointerover', (e) => {
    const b = live(e.target);
    if (!b || e.pointerType !== 'mouse') return;
    // only on entering the button, not when moving between its children
    if (e.relatedTarget instanceof Node && b.contains(e.relatedTarget)) return;
    sfx('hover');
  });
  region.addEventListener('click', (e) => {
    const b = live(e.target);
    if (b) sfx((b.dataset.sfx as UiSound | undefined) ?? 'tap');
  });
}
