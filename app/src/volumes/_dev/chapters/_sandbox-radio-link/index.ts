import { defineChapter } from '@/engine/api';

/**
 * Sandbox of the radio volume's world (P7: a chapter of `_dev`, never on the site): the shared pieces of
 * `@radio/shared/**` in a real browser, with the measurements of `qa/measure.mjs`. Batch 2 grows it step by step;
 * B1b: the camera's eye (decision 24) feeding a floating screen, from two director shots, and a second screen in
 * front of the eye that `hide()` keeps out of its frame; B13: all of it on the real yard (`@radio/shared/yard`), and
 * the yard itself from its eight shots, at any dusk, with the monitor anywhere on its route (step `yard`); B15: the
 * miniature «where are we» with the route and nudge sliders, as a chapter sets them (step `where`).
 * All the text of the sandbox is here; the scene has no words of its own.
 */
export const SANDBOX = {
  steps: {
    eye: {
      title: 'Око камери',
      blurb:
        'Камера на стовпі дивиться на подвір’я окремим проходом, і її кадр одразу йде на плаваючий екран. Другий екран висить просто перед нею, але на її кадрі його немає.',
    },
    far: {
      title: 'Той самий кадр згори',
      blurb: 'Та сама сцена згори: картинка на екрані не залежить від того, звідки дивиться читач.',
    },
    yard: {
      title: 'Подвір’я',
      blurb:
        'Подвір’я з восьми ракурсів: сутінки від раннього вечора до ночі, монітор будь-де на маршруті, хвіртка, ворота гаража й деко.',
    },
    where: {
      title: 'Де ми',
      blurb:
        'Мініатюра «де ми», як у главі: план подвір’я й дому з маршрутом монітора, цятка там, де він зараз, а поруч — повзунки маршруту й антени.',
    },
  },
  labels: {
    eye: 'Око камери',
    inner: 'Екран перед оком',
    hiding: 'Ховати екрани від ока',
    shot: 'Ракурс',
    dusk: 'Сутінки',
    route: 'Маршрут',
    nudge: 'Посунути антену',
    wicket: 'Хвіртка',
    gate: 'Ворота гаража',
    tray: 'Деко',
    centimetre: 'см',
    depth: 'Глибина',
    /** The miniature «where are we» (`@radio/shared/whereami`): its title, the five stops, the three depths. */
    whereami: {
      title: 'Де ми',
      stops: ['подвір’я', 'кухня', 'коридор', 'дальня кімната', 'льох'],
      depth: ['подвір’я', 'стенд', 'під лупою'],
    },
  },
  /** The eight shots of the yard, in the order of the control. */
  shots: {
    both: 'Обидва',
    yard: 'Подвір’я',
    pole: 'Стовп',
    window: 'Вікно',
    screen: 'Екран',
    antenna: 'Прутик',
    route: 'Дім',
    top: 'Згори',
  },
} as const;

export default defineChapter({
  id: '_sandbox-radio-link',
  order: 9020,
  group: 'em',
  title: 'Пісочниця: лінія тому «Радіо»',
  subtitle: 'Око камери, екран і виміри',
  axisLabel: '10¹ m',
  axisValue: 1,
  theme: { accent: 'sky', sky: 'dusk', mood: 'diorama' },
  steps: Object.entries(SANDBOX.steps).map(([id, s]) => ({ id, title: s.title, blurb: s.blurb })),
  load: () => import('./scene'),
  dev: true,
});
