/**
 * The states of the showcase: one manifest step each. A state is nothing but parameter values of the copper
 * world — the same values a chapter of `circuit` will set from its own steps and controls.
 */
export interface State {
  title: string;
  blurb: string;
  /** A shot of the library (`COPPER_SHOTS`). */
  camera: 'core' | 'rows' | 'atom' | 'apart' | 'one' | 'pair' | 'row' | 'piece' | 'gate' | 'edge' | 'plastic';
  /** Play the whole dive after entering: depth 0 → 1 in 6 s, a pause, → 2 in 3 s. */
  play?: boolean;
  /** Run depth 0 → 2 → 0 at a steady pace (24 s each way) for the continuity sweep (`qa/…/sweep.mjs`). */
  sweep?: boolean;
  /** `wire/restless`: index of the marked electron; the counter frame. */
  marked?: number;
  gate?: boolean;
  /** `wire/atoms`: the chosen atom (site index; 0 is the atom at the origin). */
  selected?: number;
  /** The atom the dive opens (default 0, the atom at the origin). */
  hero?: number;
  /** `wire/plastic`: the point of the focal plane the camera looks at (the crowd of electrons follows it). */
  look?: [number, number];
  /** `wire/shared`: how many atoms there are (default: the whole crystal) and whether their outer electrons
   *  are shared (1, default) or each circles its own atom (0). */
  atoms?: number;
  shared?: number;
  /** 0 «жила дроту» · 1 «ряди атомів» · 2 «один атом». Default 1. */
  depth?: number;
  /** 0 circuit open · 1 lamp on. Default 0. */
  lamp?: number;
  /** `wire/inside-atom`: electrons moved aside. */
  apart?: number;
  /** `wire/outer`: an electron held away from its place (a near one by index, or the outer one). */
  hold?: { index: number; outer?: boolean; to: [number, number, number] };
}

const TABLE = {
  core: {
    title: 'Жила дроту',
    blurb: 'Кадр, яким стенд передає нас сюди: мідна жила на весь кадр. Лампа світить.',
    camera: 'core',
    depth: 0,
    lamp: 1,
  },
  'core-off': {
    title: 'Жила дроту, коло розімкнене',
    blurb: 'Та сама жила в холодному світлі кімнати.',
    camera: 'core',
    depth: 0,
  },
  dive: {
    title: 'Проліт углиб',
    blurb: 'Суцільний рух: жила дроту → ряди атомів (6 s) → один атом (ще 4 s).',
    camera: 'core',
    depth: 0,
    lamp: 1,
    play: true,
  },
  sweep: {
    title: 'Прогін глибини, лампа світить',
    blurb: 'Глибина рівномірно йде 0 → 2 → 0: перевірка, що ніщо не стрибає.',
    camera: 'rows',
    depth: 0,
    lamp: 1,
    sweep: true,
  },
  'sweep-off': {
    title: 'Прогін глибини, коло розімкнене',
    blurb: 'Те саме в холодному світлі.',
    camera: 'rows',
    depth: 0,
    sweep: true,
  },
  'dive-a': {
    title: 'Углиб: метал уже не суцільний',
    blurb: 'На поверхні міді проступають рівні ряди цяток.',
    camera: 'core',
    depth: 0.42,
    lamp: 1,
  },
  'dive-b': {
    title: 'Углиб: метал розсипається на кульки',
    blurb: 'Цятки ростуть і стають кульками; суцільна мідь тане.',
    camera: 'rows',
    depth: 0.74,
    lamp: 1,
  },
  rows: {
    title: 'Ряди атомів',
    blurb: 'Рівні ряди атомів і вільні електрони між ними. Коло розімкнене: світло холодне.',
    camera: 'rows',
  },
  'rows-lit': {
    title: 'Ряди атомів, лампа світить',
    blurb: 'Той самий кадр із замкненим колом: згори ллється тепле світло.',
    camera: 'rows',
    lamp: 1,
  },
  'rows-touch': {
    title: 'Торкнулися атома',
    blurb: 'Одна з кульок у ряду — атом міді. Її вибрано: вона трохи більша й світліша.',
    camera: 'rows',
    lamp: 1,
    selected: 0,
  },
  atom: {
    title: 'Один атом',
    blurb: 'Ядро в центрі й 29 електронів довкола; зовнішній — далі і яскравіший.',
    camera: 'atom',
    depth: 2,
  },
  'atom-apart': {
    title: 'Атом розсунуто',
    blurb: 'Електрони відійшли вбік, у центрі лишилося ядро.',
    camera: 'apart',
    lamp: 1,
    depth: 2,
    apart: 1,
  },
  'atom-chosen': {
    title: 'Атом, якого торкнулися',
    blurb: 'Проліт відкриває не середній атом, а сусідній, якого вибрав читач.',
    camera: 'atom',
    depth: 2,
    lamp: 1,
    hero: 1,
    selected: 1,
  },
  'outer-near': {
    title: 'Ближній електрон тягнуть',
    blurb: 'Ядро тримає ближній електрон міцно: він ледве піддається і вертається.',
    camera: 'atom',
    depth: 2,
    hold: { index: 14, to: [1.6, 1.1, 0.4] },
  },
  'outer-free': {
    title: 'Зовнішній електрон відірвано',
    blurb: 'Зовнішній електрон тримається ледве-ледве: його легко відтягнути геть.',
    camera: 'atom',
    lamp: 1,
    depth: 2,
    hold: { index: 0, outer: true, to: [1.9, 1.25, 0.2] },
  },
  'shared-1': {
    title: 'Один атом міді',
    blurb: 'Зовнішній електрон кружляє довкола свого атома.',
    camera: 'one',
    atoms: 1,
    shared: 0,
  },
  'shared-2': {
    title: 'Два атоми поруч',
    blurb: 'Зовнішні електрони вже не тримаються свого атома: вони ходять між обома.',
    camera: 'pair',
    lamp: 1,
    atoms: 2,
  },
  'shared-row': {
    title: 'Ряд атомів',
    blurb: 'Що більше атомів поруч, то далі блукають їхні зовнішні електрони.',
    camera: 'row',
    atoms: 5,
  },
  'shared-piece': {
    title: 'Шматочок міді',
    blurb: 'Зовнішні електрони стали спільними — це вільні електрони.',
    camera: 'piece',
    lamp: 1,
    atoms: 15,
  },
  restless: {
    title: 'Безладний рух',
    blurb: 'Один електрон позначено: видно його шлях. Він снує на всі боки — і нікуди не просувається.',
    camera: 'rows',
    marked: 0,
  },
  'restless-count': {
    title: 'Рамка-лічильник',
    blurb: 'Скільки електронів пролетіло крізь рамку ліворуч і скільки праворуч — порівну.',
    camera: 'gate',
    marked: 0,
    gate: true,
    lamp: 1,
  },
  'plastic-edge': {
    title: 'Мідь і пластик',
    blurb: 'Унизу мідна жила, вгорі пластикова оболонка: вільні електрони в пластик не заходять.',
    camera: 'edge',
    look: [0, 14.8],
  },
  plastic: {
    title: 'Усередині пластику',
    blurb: "Атоми ланцюжками; кожен електрон прив'язаний до свого атома й лише коливається.",
    camera: 'plastic',
    lamp: 1,
    look: [0, 23],
  },
} as const satisfies Record<string, State>;

export type StateId = keyof typeof TABLE;
export const STATES: Record<StateId, State> = TABLE;
