/**
 * DOM settings (twin of `hud/overlays/settings.ts`): reading level «Просто / Докладно» (L1's `readingLevel`; not in a
 * path volume — it has one reader, docs/PATH_FORMAT.md), graphics quality (with `mobile` on touch devices), frame
 * cap (touch), text size, motion, sound and volume, dynamic resolution, reset progress. Everything writes straight
 * to the engine store. The controls are the dock's (`dock/controls`): one look for every form control.
 */
import { clearedProgress, fmtPercent, READING_LEVELS, type ReadingLevel } from '@/content';
import type { Settings } from '@/engine/api';
import type { DomHud } from '../core/context';
import { h } from '../core/dom';
import { icon } from '../core/icons';
import { domSegmented, domToggle } from '../dock/controls/inputs';
import { domSlider } from '../dock/controls/slider';
import { uid, type DomControl } from '../dock/controls/types';
import { domModal, type DomModal } from './modal';

const TIER_NAME: Record<string, string> = {
  low: 'низька',
  medium: 'середня',
  high: 'висока',
  ultra: 'ультра',
  mobile: 'мобільна',
};
const SIZES = [0.9, 1, 1.15, 1.3];

/** A labelled row: caption, control, hint. */
function field(label: string, control: DomControl, hint?: string): HTMLElement {
  const id = uid('ov-field');
  const group = control.el.matches('[role=radiogroup]')
    ? control.el
    : control.el.querySelector('[role=radiogroup]');
  group?.setAttribute('aria-labelledby', id);
  group?.removeAttribute('aria-label');
  return h(
    'div.ov-field',
    null,
    h('span.ov-label', { id }, label),
    control.el,
    hint ? h('p.ov-hint', null, hint) : null,
  );
}

/** Segmented control named `<name>:<item>` for QA (the WebGL tabs' names). */
function segments(
  name: string,
  items: readonly { id: string; label: string }[],
  value: string,
  onChange: (id: string) => void,
): DomControl {
  const c = domSegmented({ type: 'segmented', id: name, items }, value, undefined, onChange);
  c.el.dataset.ui = name;
  c.el
    .querySelectorAll<HTMLElement>('[role=radio]')
    .forEach((b, i) => (b.dataset.ui = `${name}:${items[i]!.id}`));
  return c;
}

export function domSettings(dom: DomHud): DomModal {
  const { hud } = dom;
  const { engine } = hud;
  const store = engine.store;
  let fits: DomControl[] = [];
  const modal = domModal(dom, {
    name: 'settings',
    title: 'Налаштування',
    icon: 'settings',
    width: 600,
    fresh: true,
    build(body) {
      const s = store.get().settings;
      const touch = engine.device.formFactor !== 'desktop';
      const set = (patch: Partial<Settings>): void => store.updateSettings(patch);
      const level = segments('reading-level', READING_LEVELS, engine.readingLevel(), (id) =>
        engine.setReadingLevel(id as ReadingLevel),
      );
      // phones and tablets: «Авто» means the mobile tier there and it can be picked by name; no ultra
      const tiers = touch
        ? [
            ['auto', 'Авто'],
            ['mobile', 'Мобільна'],
            ['low', 'Низька'],
            ['medium', 'Середня'],
            ['high', 'Висока'],
          ]
        : [
            ['auto', 'Авто'],
            ['low', 'Низька'],
            ['medium', 'Середня'],
            ['high', 'Висока'],
            ['ultra', 'Ультра'],
          ];
      const quality = segments(
        'settings-quality',
        tiers.map(([id, label]) => ({ id: id!, label: label! })),
        s.quality,
        (id) => engine.setQuality(id as Settings['quality']),
      );
      const frames = segments(
        'settings-frames',
        [
          { id: 'auto', label: 'Авто' },
          { id: '60', label: 'Повна' },
          { id: '30', label: '30 кадрів/с' },
        ],
        String(s.frameCap),
        (id) => set({ frameCap: id === 'auto' ? 'auto' : id === '30' ? 30 : 60 }),
      );
      const size = Math.max(
        0,
        SIZES.findIndex((v) => Math.abs(v - s.textScale) < 0.04),
      );
      const text = segments(
        'settings-text',
        ['Менший', 'Звичайний', 'Більший', 'Великий'].map((label, i) => ({ id: String(i), label })),
        String(size),
        (id) => set({ textScale: SIZES[Number(id)] ?? 1 }),
      );
      const motion = segments(
        'settings-motion',
        [
          { id: 'auto', label: 'Як у системі' },
          { id: 'on', label: 'Менше руху' },
          { id: 'off', label: 'Повна анімація' },
        ],
        s.reducedMotion === 'auto' ? 'auto' : s.reducedMotion ? 'on' : 'off',
        (id) => set({ reducedMotion: id === 'auto' ? 'auto' : id === 'on' }),
      );
      const volume = domSlider(
        {
          type: 'slider',
          id: 'settings-volume',
          label: 'Гучність',
          min: 0,
          max: 1,
          step: 0.05,
          value: s.volume,
          format: (v) => fmtPercent(v),
        },
        s.volume,
        'Гучність',
        (v) => set({ volume: v }),
      );
      volume.setDisabled?.(!s.audio);
      const sound = domToggle(
        { type: 'toggle', id: 'settings-sound', label: 'Звук' },
        s.audio,
        'Звук',
        (on) => {
          set({ audio: on });
          volume.setDisabled?.(!on);
        },
      );
      const dynamic = domToggle(
        { type: 'toggle', id: 'settings-dynamic', label: '' },
        s.dynamicResolution,
        'Знижувати роздільну здатність, якщо кадри не встигають',
        (on) => set({ dynamicResolution: on }),
      );
      const tierNow = TIER_NAME[store.get().quality] ?? store.get().quality;
      fits = [level, quality, frames, text, motion];
      // a path volume has one reader: no level to pick (docs/PATH_FORMAT.md)
      if (hud.volume?.format !== 'path')
        body.append(
          field(
            'Рівень тексту',
            level,
            '«Просто» — коротко і без формул. Де простого тексту ще немає, буде докладний.',
          ),
        );
      body.append(
        field(
          'Якість графіки',
          quality,
          touch
            ? `Зараз: ${tierNow}. «Авто» на телефоні й планшеті — мобільний рівень: менше ефектів, довше тримає заряд.`
            : `Зараз: ${tierNow}. «Авто» обирає рівень за швидкістю відеокарти.`,
        ),
      );
      if (touch)
        body.append(
          field(
            'Частота кадрів',
            frames,
            '30 кадрів/с — рівніше й прохолодніше на слабших пристроях. «Авто» вмикає це саме, якщо кадри не встигають.',
          ),
        );
      body.append(
        field('Розмір тексту', text),
        field('Анімація', motion, '«Менше руху» скорочує польоти камери й переходи.'),
        h('hr.ov-rule'),
        h('div.ov-field', null, sound.el, volume.el),
        dynamic.el,
        h('hr.ov-rule'),
        resetButton(dom),
      );
    },
  });
  // the segmented controls size their items from the label widths once they are in the layout
  const fit = (): void => fits.forEach((c) => c.layout?.());
  const open = modal.open.bind(modal);
  modal.open = (arg) => {
    open(arg);
    requestAnimationFrame(fit);
  };
  engine.hud.onResize(() => hud.overlay === 'settings' && requestAnimationFrame(fit));
  return modal;
}

/** «Скинути прогрес»: the first press arms it (4 s), the second clears the progress. */
function resetButton(dom: DomHud): HTMLElement {
  const { hud } = dom;
  const label = h('span', null, 'Скинути прогрес');
  const b = h(
    'button.btn.ov-reset',
    { type: 'button', 'data-ui': 'settings-reset' },
    icon('resetView'),
    label,
  );
  let armed = false;
  b.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      label.textContent = 'Натисніть ще раз, щоб підтвердити';
      hud.host.tweens.delay(4, () => {
        armed = false;
        label.textContent = 'Скинути прогрес';
      });
      return;
    }
    hud.engine.store.set(clearedProgress());
    armed = false;
    label.textContent = 'Скинути прогрес';
    hud.toast('Прогрес скинуто.', { tone: 'ok', duration: 3 });
  });
  return h('div.ov-row', null, b);
}
