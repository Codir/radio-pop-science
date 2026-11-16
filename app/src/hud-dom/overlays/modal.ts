/**
 * Frame of the DOM modal overlays (settings, help, glossary, quiz; docs/HUD_DOM.md §3, §14): a scrim that dims
 * the scene and closes on click, a centred hologlass dialog (`role=dialog`, `aria-modal`) with a title bar and a
 * scrolling body. Focus moves into the dialog on open, stays inside it (Tab / Shift+Tab wrap) and returns where it
 * was on close (`Hud.close`); Esc closes through the HUD's key routing (`Overlay.key` gets it first). Reveal and
 * conceal on the engine clock (`presence`), flat 2D (DECISIONS §59 p).
 */
import type { OverlayName } from '@/hud/context';
import type { Overlay } from '@/hud/shell';
import type { IconName } from '@/ui3d';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { presence } from '../core/motion';

export interface DomModalSpec {
  readonly name: OverlayName;
  readonly title: string;
  readonly icon: IconName;
  /** Preferred dialog width in units (shrinks to the screen). */
  readonly width: number;
  /** Fill the body: on first open, or on every open with `fresh`. `arg` is what `hud.open(name, arg)` passed. */
  build(body: HTMLElement, arg: unknown): void;
  readonly fresh?: boolean;
  /** Where focus goes on open (default: the first control of the body, else the close button). */
  focus?(): HTMLElement | null;
  /** Keys while open (the HUD routes them here first); true = consumed. */
  key?(e: KeyboardEvent): boolean;
  onOpen?(arg: unknown): void;
  onClose?(): void;
}

export interface DomModal extends Overlay {
  readonly el: HTMLElement;
  readonly panel: HTMLElement;
  readonly body: HTMLElement;
}

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"]), [role="radio"][tabindex="0"]';

/** Focusable elements of `root` in document order (rendered ones only). */
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (e) => e.offsetParent !== null || e === document.activeElement,
  );
}

/** Drop focus held inside `root` (a view that is closing); `Hud.close` then returns it where it was. */
export function blurInside(root: HTMLElement): void {
  const a = document.activeElement;
  if (a instanceof HTMLElement && root.contains(a)) a.blur();
}

let serial = 0;

export function domModal(dom: DomHud, spec: DomModalSpec): DomModal {
  const hud = dom.hud;
  const titleId = `ov-title-${++serial}`;
  const close = h(
    'button.btn.icon.sm.ov-close',
    {
      type: 'button',
      'aria-label': 'Закрити (Esc)',
      'data-tip': 'Закрити (Esc)',
      'data-ui': `${spec.name}-close`,
    },
    icon('close'),
  );
  close.addEventListener('click', () => hud.close());
  const body = h('div.ov-body.kd-scroll');
  const panel = h(
    'section.kd.ov-panel',
    {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      tabindex: -1,
      style: `--w: ${spec.width}`,
    },
    h(
      'header.ov-bar',
      null,
      icon(spec.icon, 'ov-icon'),
      h('h2.ov-title', { id: titleId }, spec.title),
      close,
    ),
    body,
  );
  const scrim = h('div.ov-scrim', { 'aria-hidden': 'true' });
  scrim.addEventListener('click', () => hud.close());
  const el = h('div.ov-modal', { 'data-ui': `overlay-${spec.name}`, hidden: true }, scrim, panel);
  el.classList.add(`ov-${spec.name}`);
  // the engine leaves keys in a form field alone (a slider, a text field): Esc still closes from there
  panel.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Escape' && !e.defaultPrevented && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
      e.preventDefault();
      hud.close();
    }
  });
  // keep Tab inside the dialog while it is open
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const list = focusables(panel);
    if (list.length === 0) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const at = document.activeElement;
    if (e.shiftKey && (at === first || !panel.contains(at))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (at === last || !panel.contains(at))) {
      e.preventDefault();
      first.focus();
    }
  });
  dom.layers.modal.append(el);
  const shown = presence(el);
  const lift = presence(panel);
  let built = false;
  return {
    el,
    panel,
    body,
    fullscreen: false,
    key: spec.key,
    open(arg) {
      if (!built || spec.fresh) {
        body.replaceChildren();
        spec.build(body, arg);
        built = true;
      }
      spec.onOpen?.(arg);
      body.scrollTop = 0;
      shown.reveal({ dx: 0, dy: 0, scale: 1, duration: 0.2 });
      // the panel rises a little into place (the WebGL modal: 16 units, scale 0.94, `back.out`)
      lift.conceal({ instant: true });
      lift.reveal({ dy: -16, scale: 0.94, duration: 0.32 });
      // the dialog itself by default: no control looks picked before the reader acts; Tab enters the body
      const target = spec.focus?.() ?? panel;
      target.focus({ preventScroll: true });
    },
    close() {
      spec.onClose?.();
      // focus must not stay in a dialog that is fading out (a text field there would swallow the next keys)
      blurInside(el);
      shown.conceal({ dx: 0, dy: 0, scale: 1 });
    },
  };
}
