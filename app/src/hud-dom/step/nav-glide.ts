/**
 * The step bar never jumps (F-navbar-glide): where its place or width must change while it is seen, it glides
 * there on the engine clock (deterministic under `?freeze`); while it is unseen, on a resize or under reduced
 * motion it is set at once. Its place is a horizontal `--shift` inside its `transform` (step.css), its width
 * follows the «Далі» label: old text out, width eased, new text in.
 */
import { setStyle, setText } from '../core/dom';
import { MOTION } from '@/style/motion';
import type { Hud } from '@/hud/shell';

/** Seconds of a glide; the HUD's panel easing. */
export const GLIDE = { duration: 0.45, ease: MOTION.panel.ease } as const;
/** Seconds the «Далі» label takes to fade out before its width changes, and in after it. */
export const LABEL_FADE = { out: 0.12, in: 0.15 } as const;

export interface NavGlide {
  /** Move toward a horizontal shift (CSS px); `instant` sets it at once. */
  shift(px: number, instant: boolean): void;
  /** Change the «Далі» label; its width eases unless `instant`. */
  label(text: string, instant: boolean): void;
}

type Kill = { kill(): void } | null;

export function createNavGlide(hud: Hud, el: HTMLElement, labelEl: HTMLElement): NavGlide {
  const pos = { x: 0 };
  let goal: number | null = null;
  let move: Kill = null;
  const place = (): void => setStyle(el, '--shift', `${pos.x.toFixed(1)}px`);

  const look = { w: 0, o: 1 };
  let want = labelEl.textContent ?? '';
  let steps: { kill(): void }[] = [];
  const fit = (): void => setStyle(labelEl, 'width', `${look.w.toFixed(1)}px`);
  const shade = (): void => setStyle(labelEl, 'opacity', look.o >= 1 ? '' : look.o.toFixed(3));
  const done = (): void => {
    steps = [];
    setStyle(labelEl, 'width', '');
    shade();
  };

  return {
    shift(px, instant) {
      if (goal !== null && Math.abs(px - goal) < 0.25 && !(instant && move)) return;
      goal = px;
      move?.kill();
      move = null;
      if (instant || Math.abs(px - pos.x) < 0.5) {
        pos.x = px;
        return place();
      }
      move = hud.host.tweens.to(pos, { x: px }, {
        ...GLIDE,
        onUpdate: place,
        onComplete: () => (move = null),
      });
    },
    label(text, instant) {
      if (want === text) return;
      want = text;
      for (const t of steps) t.kill();
      steps = [];
      const from = labelEl.getBoundingClientRect().width;
      const shown = labelEl.textContent ?? '';
      setText(labelEl, text);
      setStyle(labelEl, 'width', '');
      if (instant || from <= 0) {
        look.o = 1;
        return setStyle(labelEl, 'opacity', '');
      }
      // the new width, then back to the old picture: the old text fades out, the button eases to the new width
      // with no text in it, the new text fades in once it fits — never a word cut by the clip
      const to = labelEl.getBoundingClientRect().width;
      setText(labelEl, shown);
      look.w = from;
      fit();
      const t = hud.host.tweens;
      const fadeIn = (): void => {
        steps = [t.to(look, { o: 1 }, { duration: LABEL_FADE.in, ease: 'sine.out', onUpdate: shade, onComplete: done })];
      };
      const resize = (): void => {
        setText(labelEl, text);
        steps = [t.to(look, { w: to }, { ...GLIDE, onUpdate: fit, onComplete: fadeIn })];
      };
      steps = [t.to(look, { o: 0 }, { duration: LABEL_FADE.out, ease: 'sine.in', onUpdate: shade, onComplete: resize })];
    },
  };
}
