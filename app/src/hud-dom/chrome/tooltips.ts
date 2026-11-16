/**
 * The one tooltip of the DOM interface (WebGL twin `hud/tooltips.ts`, which keeps the tooltips of 3D objects
 * until D6): any element of `#kd-hud` with `data-tip` shows it after a short delay on the engine clock when the
 * mouse rests on it, or at once when it gets keyboard focus. The bubble is placed next to the element (under it,
 * or above when there is no room) — never at, or following, the pointer (DECISIONS §59 p).
 */
import type { Tween } from '@/engine/api';
import type { Hud } from '@/hud/shell';
import { h, setText } from '../core/dom';

const DELAY = 0.32;
const GAP = 8;

export function createTooltips(hud: Hud, root: HTMLElement): { el: HTMLElement; update(): void } {
  const text = h('span');
  const el = h('div.kd-tip', { role: 'tooltip', id: 'kd-tip', 'data-ui': 'tooltip' }, text);
  el.hidden = true;
  let target: HTMLElement | null = null;
  let pending: Tween | null = null;
  /** The `data-tip` element under the mouse (shown or still waiting). */
  let hover: HTMLElement | null = null;

  const hide = (): void => {
    pending?.kill();
    pending = null;
    if (target?.getAttribute('aria-describedby') === 'kd-tip') target.removeAttribute('aria-describedby');
    target = null;
    el.hidden = true;
  };
  const show = (t: HTMLElement): void => {
    const tip = t.dataset.tip;
    if (!tip || !t.isConnected) return hide();
    target = t;
    setText(text, tip);
    // name and tip differ (icon buttons have both): the tip describes the element for screen readers
    if (t.getAttribute('aria-label') !== tip && !t.hasAttribute('aria-describedby')) t.setAttribute('aria-describedby', 'kd-tip');
    el.hidden = false;
    // placement reads layout once, here (an event / a delayed callback), never per frame
    const r = t.getBoundingClientRect();
    const u = hud.metrics.pxPerUnit;
    const w = el.offsetWidth;
    const hh = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = r.bottom + GAP * u + hh <= vh - 4;
    const x = Math.min(Math.max(r.left + r.width / 2 - w / 2, 4), vw - w - 4);
    const y = below ? r.bottom + GAP * u : Math.max(r.top - GAP * u - hh, 4);
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
  };
  const tipOf = (e: Event): HTMLElement | null =>
    e.target instanceof Element ? (e.target.closest('[data-tip]') as HTMLElement | null) : null;

  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = tipOf(e);
    if (t === hover) return;
    hover = t;
    // moving from one control straight to another: no delay (as the WebGL tooltip)
    const wasShown = !el.hidden;
    hide();
    if (!t) return;
    if (wasShown) show(t);
    else pending = hud.host.tweens.delay(DELAY, () => show(t));
  });
  root.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = tipOf(e);
    const to = e.relatedTarget instanceof Element ? e.relatedTarget.closest('[data-tip]') : null;
    if (t && to !== t) {
      hover = null;
      hide();
    }
  });
  root.addEventListener('focusin', (e) => {
    const t = tipOf(e);
    if (t && t === e.target && t.matches(':focus-visible')) show(t);
    else hide();
  });
  root.addEventListener('focusout', hide);
  // a click acts: the tip of what was clicked goes away (it may have moved or changed)
  root.addEventListener('pointerdown', () => {
    hover = null;
    hide();
  });
  // touch (F5, docs/MOBILE.md): a finger held still for 480 ms shows the tip and does not activate the element; the
  // tip leaves by itself. Real time for the press (as the engine's input), the engine clock for the stay.
  let press: { t: HTMLElement; x: number; y: number; timer: number } | null = null;
  let held = false;
  const release = (): void => {
    if (press) window.clearTimeout(press.timer);
    press = null;
  };
  root.addEventListener(
    'touchstart',
    (e) => {
      release();
      held = false;
      const t = tipOf(e);
      const p = e.touches[0];
      if (!t || !p || e.touches.length !== 1) return;
      const timer = window.setTimeout(() => {
        held = true;
        show(t);
        pending = hud.host.tweens.delay(2.4, hide);
      }, 480);
      press = { t, x: p.clientX, y: p.clientY, timer };
    },
    { passive: true },
  );
  root.addEventListener(
    'touchmove',
    (e) => {
      const p = e.touches[0];
      if (press && p && Math.hypot(p.clientX - press.x, p.clientY - press.y) > 9) release();
    },
    { passive: true },
  );
  root.addEventListener('touchcancel', release);
  root.addEventListener(
    'touchend',
    (e) => {
      release();
      // the press was a long one: no click follows
      if (held && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  root.addEventListener('contextmenu', (e) => tipOf(e) && e.preventDefault());
  return {
    el,
    // the element under the tip left the page (a step change rebuilt the panel): the tip goes too
    update: () => void (target && (!target.isConnected || target.closest('[inert]')) && hide()),
  };
}
