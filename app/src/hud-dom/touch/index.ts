/**
 * Area `touch` of the DOM interface (docs/HUD_DOM.md §11, §25): F5's touch shells (docs/MOBILE.md) in HTML / CSS.
 *
 * - Root classes `kd-touch` (sheet or side shell) and `kd-pointer-coarse` next to the core's `kd-shell-*` /
 *   `kd-ff-*`; `--hit` 44 units on phones, 48 on tablets (one unit ≥ 1 CSS px there); `--safe-top/right/bottom/left`
 *   (CSS px, the device's insets) and `--kb` (on-screen keyboard) on `#kd-hud`; `--tch-*` placements (units) for the
 *   compact header, the system buttons and the navigation row (touch.css).
 * - The sheet (`sheet.ts`) hosts the column's parts on touch shells and reports its insets (`hud.touch`).
 * - The menu (`menu.ts`) — overlay `menu` — collects the system functions, «Версія для комп'ютера» among them: the
 *   desktop shell on this device (root class `kd-desk-forced`, «Мобільна версія» in the system bar leads back).
 * - Touch scrolling: the page cancels every `touchmove` (engine/page.ts, no bounce or pull-to-refresh); inside the
 *   DOM interface a move that a scroll area can follow is kept from that listener, so the area scrolls natively.
 */
import type { HudMetrics } from '@/engine/api';
import { TOUCH, sideWidth } from '@/hud/model/sheet';
import { UI } from '@/ui3d';
import type { DomHud } from '../core/context';
import { setClass, setStyle } from '../core/dom';
import { uiSounds } from '../chrome/sounds';
import { domColumnParts } from '../dock';
import { domMenu } from './menu';
import { createDomSheet, type DomSheet } from './sheet';
import './touch.css';

/** Does a touch that started on `target` land in something that scrolls (up to the layer root)? */
function scrolls(target: EventTarget | null, root: Element): boolean {
  for (let p = target instanceof Element ? target : null; p && p !== root; p = p.parentElement) {
    if (!(p instanceof HTMLElement)) continue;
    const cs = getComputedStyle(p);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 1) return true;
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
  }
  return false;
}

/** Keep native scrolling inside the DOM interface; everything else stays cancelled as on the canvas. */
function touchScrolling(root: HTMLElement): void {
  let scrollable = false;
  root.addEventListener('touchstart', (e) => void (scrollable = scrolls(e.target, root)), { passive: true });
  root.addEventListener(
    'touchmove',
    (e) => {
      // the page's listener (document) would cancel the scroll: a move a scroll area can follow stops here
      if (scrollable) e.stopPropagation();
    },
    { passive: true },
  );
}

export function mount(dom: DomHud): void {
  const { hud, root } = dom;
  const parts = domColumnParts();
  if (!parts) return;
  const sheet: DomSheet = createDomSheet(hud, parts);
  uiSounds(sheet.el);
  touchScrolling(root);
  const menu = domMenu(dom);
  hud.domTwin('menu', () => menu);

  /** Root classes and custom properties of the shells (placements in units, device insets in CSS px). */
  const shellVars = (m: HudMetrics): void => {
    const touch = m.shell !== 'desk';
    setClass(root, 'kd-touch', touch);
    setClass(root, 'kd-pointer-coarse', m.pointer === 'coarse');
    // one unit ≥ 1 CSS px on touch devices: 44 / 48 units are at least 44 / 48 real px
    setStyle(root, '--hit', String(touch && m.formFactor === 'tablet' ? 48 : UI.hit));
    const d = hud.engine.device;
    // «Версія для комп'ютера»: the desktop shell on a device that would get a touch shell (`Settings.deskShell`)
    setClass(root, 'kd-desk-forced', !touch && d.formFactor !== 'desktop');
    for (const side of ['top', 'right', 'bottom', 'left'] as const) setStyle(root, `--safe-${side}`, `${d.safeArea[side]}px`);
    setStyle(root, '--kb', `${d.keyboard}px`);
    if (!touch) return;
    const inset = sheet.insets(m);
    const s = m.safeArea;
    const right = (m.shell === 'side' ? inset.right : s.right) + TOUCH.edge;
    setStyle(root, '--tch-top', (s.top + TOUCH.edge).toFixed(2));
    setStyle(root, '--tch-left', (s.left + TOUCH.edge).toFixed(2));
    setStyle(root, '--tch-right', right.toFixed(2));
    setStyle(root, '--tch-load', (inset.bottom + 14).toFixed(2));
    // the navigation: a row under the bottom sheet (its width), or a pill centred in the scene beside the side sheet
    const sheetW = Math.min(m.width, TOUCH.sheetMaxW);
    setStyle(root, '--tch-nav-left', (m.shell === 'side' ? (m.width - inset.right) / 2 : (m.width - sheetW) / 2).toFixed(2));
    setStyle(root, '--tch-nav-w', (m.shell === 'side' ? Math.min(sideWidth(m), m.width - inset.right - 32) : sheetW).toFixed(2));
  };

  dom.claim('sheet');
  dom.region(
    {
      el: sheet.el,
      onStep: (_id, instant) => {
        if (hud.metrics.shell !== 'desk') sheet.enterStep(instant);
      },
      onLayout: (m) => {
        // the column (`hud-dom/dock`, earlier in the pass) took its parts back on the desktop shell
        if (m.shell !== 'desk') {
          sheet.layout(m);
          hud.touch.insets = (metrics) => sheet.insets(metrics);
          hud.touch.sheet = sheet;
          // a hotspot's card (hud/annotations.ts): the DOM sheet draws it from its copy
          hud.touch.card = (_node, onDismiss, opts) => (opts?.text ? sheet.showCard(opts.text, onDismiss) : onDismiss);
        }
        shellVars(m);
      },
    },
    { region: 'sheet' },
  );
}
