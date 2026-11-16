/**
 * DOM toasts (WebGL twin `ToastStack` of `hud/shell.ts`): `hud.toast` / `ui.toast` messages and the onboarding
 * hints as a centred stack under the header (`role=status`, they announce themselves). Tones `info` (accent),
 * `ok`, `warning`, `alarm`; reveal / conceal and lifetime on the engine clock.
 *
 * Hybrid: the shell owns the stack (`Hud.toasts`); the DOM takes over its `push` / `flush` on the instance (the
 * shell's placement — `toasts.float` — is followed), so every caller of `hud.toast` reaches the DOM unchanged.
 */
import type { Hud } from '@/hud/shell';
import { sfx, STATUS, type IconName, type ToastOptions } from '@/ui3d';
import { h, setStyle } from '../core/dom';
import { icon } from '../core/icons';
import { presence } from '../core/motion';
import { applyAccent } from '../core/tokens';

export interface DomToasts {
  readonly el: HTMLElement;
  /** Follow the shell's placement of the stack (desktop: centred, 96 units from the top). */
  place(): void;
}

export function createDomToasts(hud: Hud): DomToasts {
  const el = h('div.kd-toasts', { role: 'status', 'aria-live': 'polite', 'data-ui': 'toasts' });
  const push = (text: string, opts: ToastOptions = {}): (() => void) => {
    const tone = opts.tone && opts.tone !== 'info' ? opts.tone : null;
    const ic: IconName = opts.icon ?? (tone === 'warning' || tone === 'alarm' ? 'warning' : tone === 'ok' ? 'check' : 'info');
    const t = h('div.kd-toast', { 'data-ui': 'toast' }, icon(ic), h('span.toast-text', null, text));
    if (tone) applyAccent(t, STATUS[tone]);
    setStyle(t, 'max-width', `calc(${(opts.maxWidth ?? 520) + 58} * var(--u))`);
    t.hidden = true;
    el.append(t);
    const p = presence(t);
    p.reveal({ dy: -18, scale: 0.9 });
    sfx('hint');
    let gone = false;
    const dismiss = (): void => {
      if (gone) return;
      gone = true;
      p.conceal({ dy: 12, onDone: () => t.remove() });
    };
    const life = opts.duration ?? 4.5;
    if (life > 0) hud.host.tweens.delay(life, dismiss);
    return dismiss;
  };
  hud.toasts.push = push;
  hud.toasts.flush = () => {
    for (const t of [...el.children]) presence(t as HTMLElement).conceal({ onDone: () => t.remove() });
  };
  return {
    el,
    place() {
      const f = hud.toasts.float;
      setStyle(el, '--dx', `${(f?.dx ?? 0).toFixed(1)}`);
      setStyle(el, '--dy', `${(f?.dy ?? 96).toFixed(1)}`);
    },
  };
}
