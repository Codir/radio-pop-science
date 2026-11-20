import { defineChapter } from '@/engine/api';

/**
 * Sandbox of the bench of the volume «Радіоелектроніка» (a chapter of `_dev`, never on the site): the shared pieces
 * of `@electronics/shared/**` in a real browser, with the measurements of `qa/measure.mjs`. Batch E2 grows it step by
 * step; E2-3: the dark room, the base with the breadboard, the magnifier in its holder and the stand-ins of the
 * permanent things, from the bench's shots (steps `room`, `board`, `meter`, `scope`); E2-4: the parts with their real
 * marks on the board (step `parts`); E2-5: the hand, the tray, the plug leads and the switch (step `hand`); E2-6: the
 * circuit model on the bench and the multimeter with its probes (steps `meter`, `divider`).
 * All the text of the sandbox is here; the scene has no words of its own.
 */
export const SANDBOX = {
  steps: {
    room: {
      title: 'Кімната й стенд',
      blurb:
        'Темна кімната, основа з макетною платою, лупа в тримачі, лоток спереду. Головний план; на телефоні — лише поле гнізд.',
    },
    board: {
      title: 'Плата зблизька',
      blurb: 'Поле гнізд крупно: лінії a–j, жолоб, шини зі смугами, затискачі живлення й друк плати.',
    },
    meter: {
      title: 'Мультиметр на столі',
      blurb:
        'Мультиметр виїжджає ліворуч від основи, щупи лежать біля нього вільно. Плата порожня, тож показ — «—». Щуп беруть за ручку й ставлять у будь-яке гніздо; режим і число — у панелі.',
    },
    scope: {
      title: 'Осцилограф на столі',
      blurb: 'Заготовка осцилографа виїжджає праворуч позаду; у кадрі її лице й уся плата.',
    },
    parts: {
      title: 'Деталі на платі',
      blurb:
        'По одній деталі кожного виду й ряд резисторів від 1 Ω до 1 MΩ: смужки за номіналом, полярність, друк. Конденсатори й транзистор стоять на платі, але поза схемою, доки їх немає в каталозі моделі.',
    },
    hand: {
      title: 'Рука й лоток',
      blurb:
        'Порожня плата, у лотку резистори, перемичка й світлодіоди, дроти динаміка, плеєра й лампи лежать вільно. Деталь несуть цілою — з лотка на плату, з місця на місце, назад у лоток; клацання по деталі перевертає її. Ніжку переставляють за кільце чи язичок, кінець перемички чи штекер — за капсулу. Дотик до вимикача перемикає батарею.',
    },
    divider: {
      title: 'Подільник і мультиметр',
      blurb:
        'Від шини «+» перемичка, 1 kΩ, 2 kΩ і друга перемичка до шини «−», вимикач замкнено. Червоний щуп у середній ряд, чорний на «−» — і мультиметр показує напругу; так само струм, коли прилад стоїть замість перемички, і опір.',
    },
  },
  /** The names under the pointer (tooltips) and on the dock's buttons of the tray (a phone). */
  names: {
    kinds: {
      resistor: 'Резистор',
      jumper: 'Перемичка',
      led: 'Світлодіод',
      diode: 'Діод',
      pot: 'Змінний резистор',
    },
    leg: 'Ніжка',
    end: 'Кінець перемички',
    leds: { red: 'Червоний', yellow: 'Жовтий', green: 'Зелений', blue: 'Синій', white: 'Білий' },
    leads: {
      'spk+': 'Дріт «+» динаміка',
      'spk-': 'Дріт «−» динаміка',
      'pl+': 'Сигнальний дріт плеєра',
      'pl-': 'Спільний дріт плеєра',
      lamp1: 'Дріт лампи',
      lamp2: 'Дріт лампи',
    },
    switch: 'Вимикач батареї',
    probes: { red: 'Червоний щуп', black: 'Чорний щуп' },
  },
  /** The multimeter in the panel: its number, the dial's switch (V, A, Ω are symbols; «off» is a word). */
  meter: { readout: 'Мультиметр', mode: 'Режим', off: 'Вимкнено' },
} as const;

export default defineChapter({
  id: '_sandbox-electronics-bench',
  order: 9031,
  group: 'em',
  title: 'Пісочниця: стенд «Радіоелектроніки»',
  subtitle: 'Кімната, основа й макетна плата',
  axisLabel: '10⁻¹ m',
  axisValue: -1,
  theme: { accent: 'teal', sky: 'studio', mood: 'studio' },
  steps: Object.entries(SANDBOX.steps).map(([id, s]) => ({ id, title: s.title, blurb: s.blurb })),
  load: () => import('./scene'),
  dev: true,
});
