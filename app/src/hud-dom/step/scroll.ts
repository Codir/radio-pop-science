/**
 * Scroll an element that just opened inside a scroll area into view (an opened section body, a term card):
 * its bottom comes into view, but never so far that the top of `keep` (the section buttons) leaves the area. Runs after the column has re-laid
 * out around the new content (two animation frames: the size change → `ResizeObserver` → the shell's layout
 * pass), only on the area itself (never the page). Smooth unless the clock is frozen or motion is reduced.
 */
export function revealIn(area: HTMLElement, target: HTMLElement, keep: HTMLElement = target): void {
  const run = (): void => {
    if (!target.isConnected || target.hidden) return;
    // layout boxes (a reveal's transform does not count); the area is positioned, so offsets end at it
    const topOf = (el: HTMLElement): number => {
      let y = 0;
      for (let e: HTMLElement | null = el; e && e !== area; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
      return y;
    };
    const top = Math.min(topOf(keep), topOf(target));
    const bottom = topOf(target) + target.offsetHeight;
    const pad = 8;
    let to = area.scrollTop;
    if (bottom + pad > to + area.clientHeight) to = bottom + pad - area.clientHeight;
    if (top - pad < to) to = top - pad;
    to = Math.max(0, Math.round(to));
    if (to === Math.round(area.scrollTop)) return;
    const still = document.documentElement.classList.contains('kd-freeze') || document.documentElement.classList.contains('kd-reduced');
    area.scrollTo({ top: to, behavior: still ? 'auto' : 'smooth' });
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}
