import { defineChapter } from '@/engine/api';

/**
 * Sandbox of the electronics volume's sound output (E1-9; a chapter of `_dev`, never on the site): the volume's
 * melody through the circuit model — the player, a low-pass filter, the amplifier, the speaker — played by
 * `@electronics/shared/sound` in a real browser, with the checks of `qa/check.mjs`.
 * All the text of the sandbox is here; the scene has no words of its own.
 */
export const SANDBOX = {
  steps: {
    filter: {
      title: 'Мелодія крізь фільтр',
      blurb:
        'Плеєр грає мелодію тому через фільтр нижніх частот — резистор і конденсатор 100 nF — у підсилювач, а той у динамік. Усе, що чути й видно на графіку, порахувала модель кола. Звук вмикається після першого клацання по сцені. Що більший опір фільтра, то глухіше звучить.',
    },
  },
  labels: {
    path: 'Шлях сигналу',
    paths: { direct: 'Напряму', filter: 'Через фільтр' },
    ohms: 'Опір фільтра',
    played: 'Блоків зіграно',
    underruns: 'Недоборів',
    latency: 'Затримка',
    scope: 'Напруга на динаміку',
    /** The scope's axes and trace (international symbols). */
    axes: { t: 't, ms', u: 'U, V' },
    trace: 'U',
    /** Units of the controls and readouts (international symbols). */
    units: { ohm: 'Ω', ms: 'ms' },
  },
} as const;

export default defineChapter({
  id: '_sandbox-electronics-sound',
  order: 9030,
  group: 'em',
  title: 'Пісочниця: звук тому «Радіоелектроніка»',
  subtitle: 'Мелодія крізь модель кола',
  axisLabel: '10⁻¹ m',
  axisValue: -1,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  steps: Object.entries(SANDBOX.steps).map(([id, s]) => ({ id, title: s.title, blurb: s.blurb })),
  load: () => import('./scene'),
  dev: true,
});
