/**
 * Scene and control captions. Those the document quotes in «Інтерактив» are read from the generated export
 * (`steps[].labels`) with `doc(step, wording)`, so a caption changed in the document breaks the build instead
 * of drifting. The rest is plain Ukrainian written here. Panel copy never lives here — see `content.ts`.
 */
import raw from '@alchemy/content/generated/lab.json';
import type { StepId } from './chapter';

/** A UI label of the document, from the export; the caller names it by its wording. */
function doc(step: StepId, wording: string): string {
  const label = raw.steps.find((s) => s.id === step)?.labels?.find((l) => l === wording);
  if (label === undefined) throw new Error(`lab: step '${step}' has no label «${wording}» in the document`);
  return label;
}

export const L = {
  tools: {
    fire: doc('heavy-hydrogen', 'Вистрілити'),
    gammaN: doc('lead-gold', 'γ: вибити нейтрон'),
    gammaP: doc('lead-gold', 'γ: вибити протон'),
    wait: doc('heavy-hydrogen', 'Чекати на розпад'),
    restart: doc('heavy-hydrogen', 'Почати знову'),
    neutral: doc('heavy-hydrogen', 'Нейтралізувати'),
  },
  fission: {
    heavy: doc('fission', 'Продовжити з важким уламком'),
    light: doc('fission', 'Продовжити з легким уламком'),
  },
  chart: {
    full: doc('heavy-hydrogen', 'Уся карта'),
  },
  free: {
    newStart: doc('free', 'Новий старт'),
    take: doc('free', 'Взяти як старт'),
    cancel: doc('free', 'Скасувати'),
    startHere: doc('free', 'Почати звідси'),
  },
  /** Units of time and energy; `day` holds the three plural forms separated by `|`. */
  units: {
    year: 'р.', kiloYear: 'тис. р.', megaYear: 'млн р.', gigaYear: 'млрд р.', day: 'доба|доби|діб',
    hour: 'h', minute: 'min', second: 's', milli: 'ms', micro: 'μs', nano: 'ns', mev: 'MeV', kev: 'keV',
  },
  energy: { released: 'виділилось', needed: 'потрібно', unknown: '—' },
  /** Played decay modes (glossary terms); keys are the model's `PlayedMode`. */
  modes: {
    'b-': 'β⁻-розпад', 'b+': 'β⁺-розпад', 'ec': 'захоплення електрона', 'a': 'α-розпад',
    'p': 'протонний розпад', '2p': 'двопротонний розпад', 'n': 'нейтронний розпад', '2n': 'двонейтронний розпад',
    '2b-': 'подвійний β⁻-розпад', '2b+': 'подвійний β⁺-розпад',
    'b-n': 'β⁻-розпад з вильотом нейтрона', 'b-2n': 'β⁻-розпад з вильотом двох нейтронів',
    'b-3n': 'β⁻-розпад з вильотом трьох нейтронів', 'b-4n': 'β⁻-розпад з вильотом чотирьох нейтронів',
    'b-p': 'β⁻-розпад з вильотом протона', 'b-a': 'β⁻-розпад з вильотом α-частинки',
    'b+p': 'β⁺-розпад з вильотом протона', 'b+2p': 'β⁺-розпад з вильотом двох протонів',
    'b+a': 'β⁺-розпад з вильотом α-частинки', 'sf': 'спонтанний поділ',
    /** The table's `ec/b+` branch before it is played as one or the other. */
    'ec/b+': 'β⁺-розпад або захоплення електрона',
  },
  status: {
    stable: 'Стабільне ядро', longLived: 'Довгоживуче ядро', radioactive: 'Радіоактивне ядро',
    fleeting: 'Нетривке ядро', incomplete: 'Даних замало', halfLife: 'T½', halfLifeUnknown: 'T½ невідомий',
    notObserved: 'розпаду не спостерігали', notInTable: 'Немає в таблиці',
  },
  charge: { neutral: 'нейтральний атом', cation: 'катіон', anion: 'аніон' },
  card: {
    atom: 'Атом', makeup: 'Склад', nucleus: 'Ядро', chargeAndBinding: 'Заряд і зв’язок',
    binding: 'зв’язок', perNucleon: 'на нуклон',
  },
  events: {
    capture: 'Захоплення', fusion: 'Злиття двох протонів', bounce: 'Відскок',
    bounceNote: 'ядро не змінилось', knock: 'γ-квант вибив', neutron: 'нейтрон|нейтрони|нейтронів', proton: 'протон',
    fission: 'Поділ', chooseFragment: 'Оберіть уламок', autoDecay: 'Нетривке ядро розпалося само', elapsed: 'минуло',
    fragment: 'Обрано уламок', electrons: 'Електронів', electronsSame: 'без змін',
  },
  refusal: {
    stable: 'Стабільне ядро не розпадається — чекати марно',
    notObserved: 'Розпаду цього довгоживучого ядра ще не спостерігали',
    noData: 'У таблиці немає придатного розпаду для цього ядра',
    needsElectron: 'Для цього розпаду потрібен електрон оболонки — додайте його лічильником',
    noProductGamma: 'γ-квант нічого не вибив: у ядрі немає такого нуклона, або без нього ядра немає в таблиці',
    noProductFragment: 'Уламка для вибору немає',
    noProduct: 'Для цієї дії немає результату',
    pending: 'Спершу оберіть уламок поділу',
  },
  quest: { done: 'Виконано за', best: 'найкраще', move: 'хід|ходи|ходів' },
} as const;

/** `tools.fire` → text: the flat map handed to `defineContent` (the HUD exposes it as `content.labels`). */
export const FLAT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(L).flatMap(([group, items]) => Object.entries(items).map(([key, text]) => [`${group}.${key}`, text])),
);
