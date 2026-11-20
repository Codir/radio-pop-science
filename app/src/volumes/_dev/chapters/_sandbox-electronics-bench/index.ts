import { defineChapter } from '@/engine/api';

/**
 * Sandbox of the bench of the volume «Радіоелектроніка» (a chapter of `_dev`, never on the site): the shared pieces
 * of `@electronics/shared/**` in a real browser, with the measurements of `qa/measure.mjs`. Batch E2 grows it step by
 * step; E2-3: the dark room, the base with the breadboard, the magnifier in its holder and the stand-ins of the
 * permanent things, from the bench's shots (steps `room`, `board`, `meter`, `scope`); E2-4: the parts with their real
 * marks on the board (step `parts`).
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
      blurb: 'Заготовка мультиметра виїжджає ліворуч від основи; у кадрі вона й уся плата.',
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
  },
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
