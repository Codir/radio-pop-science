import { defineChapter } from '@/engine/api';

/**
 * Sandbox of the radio volume's world (P7: a chapter of `_dev`, never on the site): the shared pieces of
 * `@radio/shared/**` in a real browser, with the measurements of `qa/measure.mjs`. Batch 2 grew it step by step;
 * B1b: the camera's eye (decision 24) feeding a floating screen, from two director shots; B13: all of it on the real
 * yard (`@radio/shared/yard`), and the yard itself from its eight shots, at any dusk, with the monitor anywhere on its
 * route (step `yard`); B15: the miniature «where are we» with the route and nudge sliders, as a chapter sets them
 * (step `where`); B16: the whole of it on the world (`@radio/shared/world`) — the monitor shows only what the line to
 * the signal model returned — with every knob of the line on a live screen (step `live`) and the stops of the route
 * on a held page (step `still`).
 * All the text of the sandbox is here; the scene has no words of its own.
 */
export const SANDBOX = {
  steps: {
    eye: {
      title: 'Око камери',
      blurb:
        'Камера на стовпі дивиться на подвір’я окремим проходом. Плаваючий екран показує її кадр, а монітор на кухні — те, що дійшло до нього крізь лінію.',
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
    live: {
      title: 'Живий екран',
      blurb:
        'Монітор показує те, що модель лінії порахувала з кадру камери. Несіть його крізь дім: за стінами картинка береться зерном, у льоху сніжить. Тут усі ручки лінії.',
    },
    still: {
      title: 'Сходинки маршруту',
      blurb:
        'Зупинений кадр: камера йде за монітором, а модель рахує один кадр на кожне його місце. Від подвір’я до льоху — чиста картинка, зерно, іскри, сніг.',
    },
  },
  labels: {
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
    /** The knobs of the line (steps `live`, `still`) and its meters. */
    on: 'Монітор увімкнено',
    power: 'Сила передавача',
    channel: 'Канал',
    router: 'Роутер сусіда',
    oven: 'Мікрохвильова піч',
    sync: 'Синхроімпульси камери',
    line: 'Довжина рядка монітора',
    samples: 'відліків',
    detector: 'Детектор',
    detectors: { slope: 'на схилі', angle: 'кута' },
    limiter: 'Обмежувач',
    rxDbm: 'Рівень на антені',
    cnrDb: 'Хвиля над шумом',
    syncLost: 'Зірвано рядків',
    fps: 'Кадрів моделі за секунду',
    /** Units of the knobs and meters (international symbols). */
    units: { mW: 'mW', dBm: 'dBm', dB: 'dB', percent: '%' },
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
