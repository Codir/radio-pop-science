import { defineChapter } from '@/engine/api';

/**
 * Sandbox of the bench of the volume «Радіоелектроніка» (a chapter of `_dev`, never on the site): the shared pieces
 * of `@electronics/shared/**` in a real browser, with the measurements of `qa/measure.mjs`. Batch E2 grows it step by
 * step; E2-3: the dark room, the base with the breadboard, the magnifier in its holder and the stand-ins of the
 * permanent things, from the bench's shots (steps `room`, `board`, `meter`, `scope`); E2-4: the parts with their real
 * marks on the board (step `parts`; E2-M: one of every kind of the model's catalog, all in the circuit); E2-5: the hand,
 * the tray, the plug leads and the switch (step `hand`); E2-6: the circuit model on the bench and the multimeter with its
 * probes (steps `meter`, `divider`); E2-7: the light, the heat and the burn from the model's state (steps `led`,
 * `overload`, `lamp`); E2-8: the magnifier as the door from the board to a resistor and into it, with the ladder «де
 * ми» (step `loupe`); E3-5: inside the resistor — the carbon film, its groove for the value, the electrons at the
 * model's current (step `film`); E2-9: the oscilloscope — the player's music before and after a low-pass in front of
 * the amplifier (step `scope`), a capacitor charging through 10 kΩ on a rolling trace (step `rc`) — and an
 * electrolytic the wrong way round, which the model bulges (step `bulged`).
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
      title: 'Осцилограф: музика до й після фільтра',
      blurb:
        'Підсилювач на платі, а між плеєром і регулятором гучності — фільтр: резистор і 100 nF до землі. Щуп каналу 1 — на дроті плеєра, до фільтра; щуп каналу 2 — після фільтра. Перемикач «Резистор фільтра» ставить 1, 4,7 чи 10 kΩ: що більший опір, то менший і гладкіший слід каналу 2. Графік на дошці й екран приладу показують ті самі відліки моделі.',
    },
    rc: {
      title: 'Осцилограф: заряд конденсатора',
      blurb:
        'Від шини «+» перемичка, резистор 10 kΩ і конденсатор 100 μF до шини «−»; вимикач розімкнено. Слід іде прокруткою, новий праворуч. Замкніть вимикач: канал 1 одразу стрибає до 9 V, а канал 2 — напруга на конденсаторі — росте плавно й за секунду, сталу часу 10 kΩ на 100 μF, доходить до 63 % від 9 V.',
    },
    parts: {
      title: 'Деталі на платі',
      blurb:
        'По одній деталі кожного виду з каталогу моделі й ряд резисторів від 1 Ω до 1 MΩ: смужки за номіналом, полярність, друк. Конденсатори й транзистор — такі самі деталі кола, як і решта; вимикач розімкнено.',
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
    led: {
      title: 'Світлодіоди',
      blurb:
        'Три гілки між шинами, у кожній 330 Ω і світлодіод — червоний, зелений, синій; вимикач замкнено. Світлодіоди світять струмом моделі, і кожен кладе на плату слабку пляму свого кольору. Деталі можна брати: світлодіод навиворіт гасне.',
    },
    overload: {
      title: 'Перевантаження',
      blurb:
        '100 Ω просто між шинами: модель дає йому ≈ 0,8 W при межі 0,25 W. Резистор теплішає, за кілька секунд згоряє — одна маленька цівка диму — і далі лишається розривом. У лотку новий 100 Ω: вийміть згорілий і поставте новий.',
    },
    lamp: {
      title: 'Лампа',
      blurb:
        'Лампа 6 V від батареї 9 V через два резистори по 15 Ω: на ній ≈ 5,9 V. Нитка розжарюється до температури, яку дає модель, і лампа освітлює стенд; вимикач її гасить.',
    },
    bulged: {
      title: 'Електроліт навиворіт',
      blurb:
        'Конденсатор 100 μF на 6,3 V стоїть просто між шинами навиворіт: його «−» на плюсі батареї. Вимикач замкнено, і модель за секунду з чимось його здуває: верх випинається, насічка розходиться, з неї раз виходить клубок пари. Він лишається здутим, доки його не вийнято.',
    },
    loupe: {
      title: 'Лупа: до деталі й усередину',
      blurb:
        'Резистор 4,7 kΩ у гніздах a5…a9. Повзунок «Глибина» або дотик до лупи кладе її з тримача на резистор, а далі камера летить крізь кільце: спершу поверх «деталь», де читаються смужки, у кінці — «усередині», де резистор розкрито (крок «Усередині резистора»). Сходинки «Де ми» показують поверх. Поки камера летить, рука не діє; на нулі все вертається на плату.',
    },
    film: {
      title: 'Усередині резистора',
      blurb:
        'Коло світлодіода з резистором 330 Ω, вимикач замкнено. Повзунок «Глибина» веде лупу на резистор і камеру всередину: лак розкривається з боку камери, видно білий керамічний стрижень, вугільну плівку з зернами й гвинтову канавку, ковпачки на кінцях. Електрони біжать доріжкою між витками зі швидкістю від струму моделі; перемикач «Резистор» ставить 10 kΩ — витків більше, доріжка вужча, а електрони повзуть.',
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
    probes: { red: 'Червоний щуп', black: 'Чорний щуп', ch1: 'Щуп каналу 1', ch2: 'Щуп каналу 2' },
  },
  /** The multimeter in the panel: its number, the dial's switch (V, A, Ω are symbols; «off» is a word). */
  meter: { readout: 'Мультиметр', mode: 'Режим', off: 'Вимкнено' },
  /** Step `film`: the switch of the resistor's value (the values are the code's numbers and units). */
  film: { value: 'Резистор' },
  /**
   * The oscilloscope's board (steps `scope`, `rc`): its title, the axes' quantities and the word of a division (the
   * symbols, units and numbers are the code's), the channels of each step, the switch of the filter's resistor.
   */
  scope: {
    board: 'Осцилограф',
    division: 'под.',
    channels: {
      scope: { ch1: 'Канал 1 — до фільтра', ch2: 'Канал 2 — після фільтра' },
      rc: { ch1: 'Канал 1 — до резистора', ch2: 'Канал 2 — на конденсаторі' },
    },
    resistor: 'Резистор фільтра',
  },
  /** The dive (step `loupe`): the depth slider, its marks — the floors where they begin — and the magnifier's name. */
  loupe: {
    depth: 'Глибина',
    floors: { stand: 'стенд', part: 'деталь', inside: 'усередині', atoms: 'атоми' },
    lens: 'Лупа',
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
