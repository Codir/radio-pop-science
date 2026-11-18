# Черга 2. Модель сигналу

> Розділ плану [`2026-11-18-radio-pilot.md`](../2026-11-18-radio-pilot.md). Обмеження, поправки П1–П21, будова файлів, «Спільний договір» і ворота черги — там; завдання посилаються на них і на інші завдання за номерами.


Ця половина черги дає `app/src/volumes/radio/sim/core/` — увесь перший ланцюг (камера → частотна модуляція → повітря → приймач → екран) чистим TypeScript, еталон на Python і тести, які доводять, що сходинки рівня, злам, зриви рядків і мертва точка виходять із моделі, а не намальовані. Порядок: B2 → B3 → B4 → B5 → B6a → B6b → B7 → B8 → B9a → B9b → B9c → B10, одне за одним: майже кожне дописує ті самі `index.ts` і `README.md`. Еталон (B3, B6a, B9a) пише інший агент, ніж TypeScript того самого модуля: з цього плану й відкритих формул, не відкриваючи `sim/core/*.ts`. Світ (B11–B17) бере звідси лише те, що видає `sim/core/index.ts`.

Спільне для всіх завдань цієї частини:

- Шляхи без каталогу — від `app/src/volumes/radio/sim/core/`. Тести — `__tests__/<модуль>.test.ts`, `describe, expect, it` імпортуємо з `vitest`; назви тестів — як у плані. У блоках тестів `expect` — дослівно; коментар `/* … */` описує, як зібрати вхід, і перелічує решту перевірок із їхніми числами. Спільні помічники — `__tests__/helpers.ts`: числові (`gainDb`, `mean`, `std`, `share`, `argmax`, `spread`, `centre`, `meanPowerDbm`) усі разом пише B2, тестовий кадр додає B3; далі файл не міняється.
- Кожне завдання дописує свій модуль у `index.ts` (`export * from './<модуль>'`) і рядок у `README.md` (модуль — що робить — джерело формул). У списках файлів це не повторюється.
- Усе, що лягає під `app/src/volumes/radio/` (коментарі, назви тестів, `README.md`), пишемо з апострофом `’` і мікро `μ`: правило 4 `docs/volumes/radio/check.py` читає й файли `.ts`.
- Команди — після прелюдії із «Середовища». Один файл: `cd app && pnpm test src/volumes/radio/sim/core/__tests__/<файл>`. «Зелено» — рядки `Test Files  1 passed (1)` і `Tests  N passed (N)` з N із завдання. «Падає» до появи модуля — `Error: Cannot find module '../<модуль>' imported from …` з тим модулем, який імпортує сам файл тесту.
- Перед кожним комітом: `cd app && pnpm typecheck && pnpm lint && pnpm test src/volumes/radio && cd .. && python3 docs/volumes/radio/check.py` — перші дві без виводу, третя без `failed`, остання закінчується рядком `radio check: OK`. З тестами B9b–B9c прогін тому триває до кількох хвилин: тоді його запускаємо у фоні (`run_in_background`, правило «Середовища») і судимо за останніми рядками виводу.
- Кожен блок із пам'яттю має `reset()` і після нього повторює свій вихід біт у біт; `process` не виділяє пам'яті.
- У циклах за відліками не звертаємося до імпортів: сталі й функції інших модулів кладемо в локальні `const` перед циклом. Під vitest кожне звернення до імпорту коштує ≈ 13 ns (виміряно: 576 000 викликів імпортованої функції — 9,1 ms проти 1,45 ms через локальну сталу), у збірці сайту цієї ціни немає; без правила вимір B10 показав би не модель, а vitest.
- «Рівні комірки» — комірки тестового кадру (B3), чиї обидва сусіди в рядку відрізняються від них не більш як на 8; крайні стовпчики до них не належать.

### Завдання B2. Основа: `standard.ts`, `units.ts`, `rng.ts`, `dsp.ts`, тест чистоти

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `standard.ts`, `units.ts`, `rng.ts`, `dsp.ts`, `index.ts`, `README.md`
- Тест: `__tests__/{standard,units,rng,dsp,purity}.test.ts`, `__tests__/helpers.ts`

**Інтерфейси:**
- Бере: нічого з рушія. `standard.ts` — дослівно зі «Спільного договору».
- Дає:

  ```ts
  // units.ts
  export function dbmToAmp(dbm: number): number;   // 10^(dbm/20), √mW
  export function ampToDbm(amp: number): number;   // 20·lg(amp), не нижче −200
  export function powerDbm(x: Float32Array, from?: number, to?: number): number;  // середнє re²+im² пар [from, to), dBm; нулі чи порожньо → −200
  // rng.ts
  export interface Rng { u32(): number; float(): number; gaussFill(out: Float32Array, sigma: number): void; fork(label: number): Rng }
  export function createRng(seed: number): Rng;
  export const GAUSS_TABLE: Float32Array;          // 65 536 квантилів N(0, 1): Φ⁻¹((i + 0,5)/65 536)
  // dsp.ts
  export interface Block { process(x: Float32Array, out: Float32Array): void; reset(): void }
  export function designLowpass(taps: number, cutoff: number): Float32Array;   // cutoff — частка темпу відліків
  export function createFir(h: Float32Array): Block;                           // дійсні → дійсні
  export function createDecimator(h: Float32Array, m: number): Block;          // пари → пари: out[k] = Σ h[i]·x[m·k − i]; m = 1 — просто фільтр пар
  export function createInterpolator(h: Float32Array, l: number): Block;       // пари → пари ×l: y[n] = l·Σ h[n − l·k]·x[k], розмах збережено
  export function mix(x: Float32Array, out: Float32Array, phase: number, step: number): number;   // повертає наступну фазу
  export const DELAY_LATENCY = 5;                                              // відліків; однакова для всіх променів
  export function createDelay(max: number): { add(x: Float32Array, out: Float32Array, delay: number, re: number, im: number): void; reset(): void };
  ```

- [ ] **Крок 1. Тести `standard` і `units`, що падають.** `standard.test.ts` — 4 тести (до появи модуля — `Cannot find module '../standard'`), `units.test.ts` — 3 (`Cannot find module '../units'`):

  ```ts
  it('частини рядка дають 288 відліків', () => { expect(LINE.front + LINE.sync + LINE.back + LINE.active).toBe(288);
    expect(LINE.samples).toBe(288); expect(FRAME_CH).toBe(28_800); expect(FRAME_WB).toBe(144_000); });
  it('білий +72° за відлік, дно синхроімпульсу −77,4°', () => {
    expect((radPerSample(1) * 180) / Math.PI).toBeCloseTo(72, 9); expect((radPerSample(0) * 180) / Math.PI).toBeCloseTo(-77.4, 9); });
  it('справжні темпи — 20 і 100 MHz', () => { expect(shown(FS_CH)).toBe(20e6); expect(shown(FS_WB)).toBe(100e6); });
  it('канали стоять за ±9 і ±27 MHz від середини діапазону', () => expect(CHANNELS.map((f) => f - BAND.centre)).toEqual([-27e6, -9e6, 9e6, 27e6]));
  // units
  it('dBm і розмах', () => { expect(dbmToAmp(0)).toBe(1); expect(dbmToAmp(-20)).toBeCloseTo(0.1, 12); expect(ampToDbm(dbmToAmp(-54))).toBeCloseTo(-54, 9); expect(ampToDbm(0)).toBe(-200); });
  it('потужність блока пар', () => { const x = new Float32Array(200); for (let i = 0; i < 200; i += 2) x[i] = 0.1;
    expect(powerDbm(x)).toBeCloseTo(-20, 4); expect(powerDbm(x, 10, 20)).toBeCloseTo(-20, 4); });
  it('нулі й порожній відтинок дають −200', () => { expect(powerDbm(new Float32Array(8))).toBe(-200); expect(powerDbm(new Float32Array(8), 3, 3)).toBe(-200); });
  ```
- [ ] **Крок 2. Написати `standard.ts` і `units.ts`.** Запуск: 4 і 3 тести зелені. (`shown(FS_CH) === 20e6` у подвійній точності виконується точно — перевірено.)
- [ ] **Крок 3. Тест `rng`, що падає** — 5 тестів. Спершу `helpers.ts` з усіма вісьмома помічниками: `gainDb(h, f) = 20·lg|Σ h[k]·e^(−j2πfk)|`; `mean`, `std`, `share(x, умова)`, `argmax`, `spread` (найбільше мінус найменше) — над масивом чисел; `centre(screen, r)` — центр мас яскравості рядка `r` екрана 128 × 96; `meanPowerDbm(points)` — середнє `re² + im²` пар у dBm:

  ```ts
  it('перші числа закріплено', () => { const r = createRng(1); expect([r.u32(), r.u32(), r.u32()]).toEqual([2693262067, 11749833, 2265367787]); });
  it('те саме зерно — ті самі 1000 чисел, інше — інші; float у [0, 1)', () => { /* createRng(42) двічі: toEqual; createRng(43): перше число інше; 0 ≤ float() < 1 */ });
  it('таблиця квантилів', () => { expect(GAUSS_TABLE.length).toBe(65536); expect(GAUSS_TABLE[0]).toBeCloseTo(-4.32492, 4);
    expect(GAUSS_TABLE[16384]).toBeCloseTo(-0.674466, 5); expect(GAUSS_TABLE[65535]).toBeCloseTo(4.32492, 4); });
  it('gaussFill: середнє, розкид і хвости', () => { const x = new Float32Array(1_000_000); createRng(7).gaussFill(x, 1);
    expect(Math.abs(mean(x))).toBeLessThan(0.005); expect(Math.abs(std(x) - 1)).toBeLessThan(0.01);
    expect(Math.abs(share(x, (v) => Math.abs(v) > 3) - 0.0027)).toBeLessThan(0.0006);
    const y = new Float32Array(100_000); createRng(7).gaussFill(y, 2.5); expect(std(y)).toBeCloseTo(2.5, 1); });
  it('fork — окремий повторюваний потік', () => { /* fork(1) ≠ fork(2); fork(1) двічі однаковий; після fork батьківський u32() той самий, що без нього */ });
  ```
- [ ] **Крок 4. Написати `rng.ts`.** Генератор — mulberry32, як `app/src/engine/random.ts:14-19`, але `u32()` віддає ціле без ділення; зерно 0 замінюємо на `0x9e3779b9`; `float() = u32() / 2³²`. `fork(label)` — `createRng((seed ^ Math.imul(label + 1, 0x9e3779b1)) >>> 0)` від початкового зерна, а не від стану (рішення плану). Таблицю будуємо раз під час завантаження модуля оберненою функцією нормального розподілу за раціональним наближенням Аклама (відносна похибка 1,2·10⁻⁹). `gaussFill`: одне `u32()` дає два відліки — `sigma·T[v >>> 16]` і `sigma·T[v & 0xffff]`. Запуск: 5 тестів зелені.
- [ ] **Крок 5. Тест `dsp`, що падає** — 8 тестів:

  ```ts
  it('фільтр 63 відводи, зріз 0,1', () => { const h = designLowpass(63, 0.1);
    expect(gainDb(h, 0)).toBeCloseTo(0, 5); expect(h[10]).toBeCloseTo(h[52], 7);
    expect(gainDb(h, 0.1)).toBeGreaterThan(-6.2); expect(gainDb(h, 0.1)).toBeLessThan(-5.8);
    for (let f = 0.15; f <= 0.5; f += 0.005) expect(gainDb(h, f)).toBeLessThan(-50); });
  it('потік дорівнює одному шматку', () => { /* createFir(h), createDecimator(h, 5), createInterpolator(h, 5): 2000 чисел із createRng(3).gaussFill
    одним викликом і шматками з межами 10, 70, 640, 1500 — expect(Array.from(pieces)).toEqual(Array.from(whole)) для кожного з трьох */ });
  it('проріджувач пропускає своє й глушить чуже', () => { /* 2000 пар → 400 пар; тон 0,02 відліку: розмах 1 ± 0,01; тон 0,3: нижче −50 dB */ });
  it('інтерполятор зберігає розмах', () => { /* 400 пар → 2000 пар; тон 0,1 на вході виходить тоном 0,02 з розмахом 1 ± 0,01 */ });
  it('інтерполятор і проріджувач разом затримують на 62/5 відліку', () => { /* h = designLowpass(63, 0.1); 100 пар, re[35] = 1, решта нулі; createInterpolator(h, 5) → createDecimator(h, 5); re — праві тіні виходу */
    expect(re.reduce((a, v) => a + v, 0)).toBeCloseTo(1, 4); expect(re.reduce((a, v, k) => a + k * v, 0)).toBeCloseTo(47.4, 2); });   // центр мас — 35 + 62/5; з іншою фазою проріджувача було б 46,6
  it('mix тримає довжину й фазу', () => { /* 1 000 000 пар (1, 0), step = 2π·0,09: кожен |out| = 1 ± 1e-4; повернута фаза = (n·step) mod 2π ± 1e-6;
    два виклики по 500 пар дорівнюють одному на 1000 (± 1e-6) */ });
  it('дробове запізнення на похилій', () => { /* x[n] = (0,001·n, 0), n < 200; add(x, out, 3.3, 1, 0):
    out[2n] = 0,001·(n − DELAY_LATENCY − 3,3) ± 1e-5 для n ≥ 20, out[2n + 1] = 0; з (re, im) = (0, 1) те саме стоїть у out[2n + 1] */ });
  it('запізнення рівне до країв діапазону', () => { /* тони 0,09, 0,27 і 0,37 відліку, delay 3,5: розмах на виході 1 ± 0,02 для n ≥ 20 */ });
  ```
- [ ] **Крок 6. Написати `dsp.ts`.** `designLowpass`: `h[k] = 2c·sinc(2c·(k − (N − 1)/2))·(0,54 − 0,46·cos(2πk/(N − 1)))`, потім ділимо на суму. Блоки з фільтром тримають останні `N − 1` входів і сумують відводи в тому самому порядку за будь-якого поділу на шматки (звідси точна рівність у тесті); проріджувач видає вихід `k` для входу `m·k` від початку потоку (`reset()` повертає лічильник до нуля), вхід, не кратний `m` пар, — `RangeError`. Інтерполятор — `l` гілок, гілка `p` бере відводи `h[p + l·j]·l`. `mix`: таблиця 4096 пар (cos, sin), індекс — `round(phase/2π·4096) & 4095`, фаза в подвійній точності в межах [0, 2π). `createDelay` (рішення плану): 12 відводів `g[k] = sinc(k − D)·(0,54 + 0,46·cos(π(k − D)/6))`, `D = 5 + дробова частина delay`, сума зведена до 1; ціла частина — зсув індексу; відводи перераховуємо лише коли `delay` змінилося. Чому не лінійна інтерполяція (так було в попередньому варіанті плану): вона на каналах 1 і 4 (±27 MHz зі 100) слабшає на 3–3,6 dB, і мертва точка в сигналі розійшлася б із розрахунком `trace` на 4 dB; у цієї похибка нижча за −40 dB до ±37 MHz. Запуск: 8 тестів зелені.
- [ ] **Крок 7. Тест чистоти `purity.test.ts`** — 2 тести (П14). Тест читає тексти через `readdirSync(new URL('../..', import.meta.url), { recursive: true, encoding: 'utf8' })` і `readFileSync` (без `encoding` типи дають `string | Buffer`, і `pnpm typecheck` падає); коментарі теж читає, тож заборонених слів не пишемо навіть у них. Запуск: 2 тести зелені (файли вже є); перевірка самого тесту: тимчасово дописати `Math.random();` у `units.ts` — другий тест падає з `core/units.ts: Math.random`; рядок прибрати.

  ```ts
  // violations(text, file): string[] — порушення в тексті одного файла; file — шлях від sim/
  it('ловить підкинуте', () => {
    expect(violations("import { Vector3 } from 'three';", 'core/a.ts')).toEqual(['three']);
    expect(violations("import { Rng } from '@/engine/random';", 'core/a.ts')).toHaveLength(1);
    expect(violations("import { x } from '../../shared/link';", 'core/a.ts')).toHaveLength(1);     // вихід за межі sim/
    for (const bad of ['Math.random()', 'Date.now()', 'performance.now()', 'setTimeout(f, 1)', 'setInterval(f, 1)', 'document.body', 'window.x'])
      expect(violations(bad, 'core/a.ts')).toHaveLength(1);
    expect(violations("import { K } from './standard';\nimport site from './site.json';", 'core/a.ts')).toEqual([]);
  });
  it('у sim/ чисто', () => { expect(files.length).toBeGreaterThanOrEqual(4); expect(found).toEqual([]); });   // усі *.ts під sim/, крім __tests__/
  ```
- [ ] **Крок 8. `index.ts`, `README.md`, повна перевірка.** `cd app && pnpm typecheck && pnpm lint` — без виводу; `pnpm test src/volumes/radio/sim` — `Test Files  5 passed (5)`, `Tests  22 passed (22)`.
- [ ] **Крок 9. Коміт.** `git add app/src/volumes/radio/sim/core/{standard,units,rng,dsp,index}.ts app/src/volumes/radio/sim/core/README.md app/src/volumes/radio/sim/core/__tests__/{standard,units,rng,dsp,purity}.test.ts app/src/volumes/radio/sim/core/__tests__/helpers.ts` · `git commit -m "Основа моделі сигналу: зменшений стандарт, одиниці, генератор із зерном, фільтри"`

### Завдання B3. Еталон, перша частина: `tools/ref-models/radio/fm_chain.py`

**Виконавець:** Fable 5.2, окремий агент — не той, що пише B4 і B5; у `sim/core/*.ts` не заглядає.

**Файли:**
- Створити: `tools/ref-models/radio/{fm_chain.py,README.md,requirements.txt}`; `app/src/volumes/radio/sim/core/__fixtures__/{standard,test-frame,video-lines,fm-phase,slope-curve,angle}.json` (пише скрипт, П13)
- Змінити: `__tests__/standard.test.ts` (+ 1 тест), `__tests__/helpers.ts` (тестовий кадр)
- Тест: `python3 tools/ref-models/radio/fm_chain.py --selftest`, `… --check <каталог>`

**Інтерфейси:**
- Бере: «Спільний договір» (стандарт, рядок кадру з правилом розтягу, `radPerSample`), формули детекторів із B5 цього плану.
- Дає: команди `--selftest`, `--write <каталог>`, `--check <каталог>`; шість файлів JSON (числа з плаваючою комою — 6 значущих цифр, `json.dumps(…, sort_keys=True, separators=(',', ':'))` і кінець рядка). У `helpers.ts`: `FRAME: Uint8Array` (тестовий кадр), `FLAT: Uint8Array` (1 — рівна комірка), `PLACES` (ключ `places` файла).

Тестовий кадр (рішення плану), стовпчик `c` 0…127, рядок `r` 0…95, пізніше правило перекриває раніше: тло `40 + r`; стіна сараю — рядки 8–39, стовпчики 8–39 → 255; закуток — рядки 8–39, стовпчики 44–59 → 0; штахети — рядки 48–79, стовпчики 8–55: парний 255, непарний 0; сіра драбина — рядки 84–91 → `round(c·255/127)`; кіт — еліпс `((r − 30)/14)² + ((c − 96)/18)² ≤ 1` → 90; цятка на лобі — рядок 24, стовпчик 96 → 255. Сума всіх комірок — 1 291 513. Розтяг рядка комірок на відліки — за «Спільним договором» (рядок кадру); те саме правило бере `encodeFrame` (B4).

Вміст файлів: `standard.json` — усі сталі `standard.ts` під тими самими назвами, `radWhite`, `radSync` і квантилі таблиці шуму `gauss: {"0": −4.32492, "16384": −0.674466, "65535": 4.32492}`; `test-frame.json` — `{cols, rows, luma[12288], places: {wall: [8, 8, 39, 39], nook: [44, 8, 59, 39], pickets: [8, 48, 55, 79], ramp: [0, 84, 127, 91], spot: [96, 24]}}` (стовпчик, рядок); `video-lines.json` — `{lines: {"0": [288], "50": [288], "96": [288]}, noSync: {"0": [288]}}`; `fm-phase.json` — `{u[256], step[256]}`, `u` рівно зростає від 0 до 1; `slope-curve.json` — `{r: 0.2, thetaDeg: 82, gain, offset, u[21], out[21]}` для `u = 0, 0.05, …, 1`; `angle.json` — `{x[128], u[64]}`: 64 пари частотно-модульованого сигналу зі сходинками й шумом (`numpy.random.default_rng(2026)`, розкид 0,05) і вихід формули `u[n] = (angle(x[n]·conj(x[n−1]))·20e6/2π + 4,3e6)/8,3e6`, `x[−1] = 1`.

- [ ] **Крок 1. Побачити, що еталона немає.** `python3 tools/ref-models/radio/fm_chain.py --selftest` → `can't open file`.
- [ ] **Крок 2. Написати `fm_chain.py` (numpy, scipy) з `--selftest`.** Самоперевірка — це `assert` на числа, які план закріплює: сума частин рядка 288; сума комірок кадру 1 291 513, `luma[24][96] == 255`, `luma[60][8] == 255`, `luma[60][9] == 0`, `luma[30][96] == 90`; рядок 0 сигналу: відліки 0–6 = 0,3, 7–27 = 0, 28–53 = 0,3, відлік 54 = 0,4098 ± 1e-4; рядок 50 (штахети; перевіряє правило розтягу): відліки 68–73 = 0,742559, 0,990322, 0,632051, 0,350855, 0,733761, 0,883333 (± 1e-5); рядок 96: відліки 7–261 = 0, 262–287 = 0,3; рядок 0 без синхроімпульсів: найменше значення 0,3; усталений розмах детектора на схилі `1/|1 − r·e^(j(θ − ω))|`: чорне 0,910452, біле 1,244107, дно синхроімпульсу 0,840834 (± 1e-5); після прямої крізь чорне й біле (`gain` 2,097971, `offset` −1,610102): чорне 0,3, біле 1, дно 0,1539 ± 5e-4; крива монотонна на 21 точці; найбільший відхід від прямої між чорним і білим — 6,19 % ± 0,1 % розмаху. Друкує `fm_chain selftest: OK`.
- [ ] **Крок 3. Записати й перевірити зразки.** `python3 tools/ref-models/radio/fm_chain.py --write app/src/volumes/radio/sim/core/__fixtures__` → `fm_chain: wrote 6 file(s)`; `… --check app/src/volumes/radio/sim/core/__fixtures__` → `fm_chain: 6 fixture(s) up to date`, код 0. `--check` пише в тимчасовий каталог і порівнює; на розбіжність — `fm_chain: <файл> differs`, код 1. Те саме другим інтерпретатором: `/usr/bin/python3 tools/ref-models/radio/fm_chain.py --check …` (numpy 1.26, scipy 1.11) → той самий рядок; якщо `angle.json` там інший, шум для нього беремо з власного лінійного генератора в скрипті, а не з numpy.
- [ ] **Крок 4. Звірка сталих у TypeScript.** У `standard.test.ts` — п'ятий тест «сталі збігаються з еталоном»: для кожної числової сталої `expect(ts / json).toBeCloseTo(1, 4)` (зразок має 6 значущих цифр), для `LINE`, `LEVEL`, `CHANNELS` — `toEqual`. `helpers.ts` читає `test-frame.json` (`import frame from '../__fixtures__/test-frame.json'`). Запуск `standard.test.ts`: 5 тестів зелені.
- [ ] **Крок 5. `README.md` і `requirements.txt`.** `requirements.txt`: `numpy>=1.26`, `scipy>=1.11`. `README.md`: команди; таблиця «файл — що в ньому — який тест читає»; відкриті джерела кожної формули (хронометраж рядка телебачення на 625 рядків; правило Карсона; послаблення вільного простору; огинання одного краю; тепловий шум `kTB`); речення: з приватних приймачів узято лише підручникову формулу `angle(x[n]·conj(x[n−1]))` — ні коду, ні записів, ні назв. Ще таблиця «Звірено з відкритими джерелами» (проєкт II §8, п. 5): сітка каналів 2414 / 2432 / 2450 / 2468 MHz і сила передавача в смузі 2400–2483,5 MHz двома рядками — на виході передавача 10 mW (рішення 23) і випромінена з антеною 1,1 dBi: 10 mW + 1,1 dBi ≈ 12,9 mW (11,1 dBm); до кожного рядка — назва відкритого документа, пункт, дата перегляду й опублікована межа, яка стосується саме цієї величини (межу, задану як випромінена потужність, порівнюємо з 12,9 mW, межу на виході передавача — з 10 mW). Якщо джерело дає інше число або межа нижча за число моделі — рядок «розбіжність», а питання йде власникові у звіт черги (B9c, крок 4, «Питання до власника»); сталих моделі не чіпаємо.
- [ ] **Крок 6. Коміт.** `git add tools/ref-models/radio/fm_chain.py tools/ref-models/radio/README.md tools/ref-models/radio/requirements.txt app/src/volumes/radio/sim/core/__fixtures__/{standard,test-frame,video-lines,fm-phase,slope-curve,angle}.json app/src/volumes/radio/sim/core/__tests__/standard.test.ts app/src/volumes/radio/sim/core/__tests__/helpers.ts` · `git commit -m "Еталон моделі на Python: стандарт, тестовий кадр, криві детекторів"`

### Завдання B4. `video.ts` — кадр у сигнал і назад

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `video.ts`
- Тест: `__tests__/video.test.ts`

**Інтерфейси:**
- Бере: `LINE`, `COLS`, `ROWS`, `FRAME_LINES`, `FRAME_CH`, `LEVEL`, рядок кадру з правилом розтягу, знак `lineOffset` і `lineDrift` (`Meters`) — див. Спільний договір; `createRng` (B2); `video-lines.json`, `FRAME`, `FLAT`, `PLACES` (B3).
- Дає:

  ```ts
  export function encodeFrame(luma: Uint8Array, out: Float32Array, opts: { sync: boolean }): void;   // out — FRAME_CH відліків u
  export interface DecoderParams { lineLength: number; trust: number; threshold: number; delay: number }
  export interface DecodeStats { pulses: number; lost: number; lines: number; lineOffset: number; lineDrift: number; lineRow: number }
  export interface VideoDecoder { process(video: Float32Array, p: DecoderParams, screen: Uint8Array): DecodeStats; reset(): void }
  export function createDecoder(seed: number): VideoDecoder;
  ```

  `lines` — скільки рядків відлічив ритм за цей виклик (рішення плану: потрібне для частки `syncLost`). Виклик — один кадр камери: її рядок 0 починається через `delay` відліків після першого відліку виклику (у ланцюзі — `CHAIN_DELAY`, B9b; у тестах B4 — 0). `lineOffset` — на скільки відліків від цієї точки відстає початок найближчого рядка монітора, у межах ±144; `lineRow` — номер цього рядка монітора на екрані (0…99), тобто куди лягає рядок 0 камери; 0, якщо за виклик ритм зустрів четверту кадрову позначку поспіль; `lineDrift` — на скільки відставання росте за рядок. Знак — як у договорі: додатні числа зсувають картинку ліворуч. Якщо за виклик ритм не відлічив жодного рядка, `lineDrift = 0`. `lost` рахує рядки, де синхроімпульс не знайдено ближче ніж за 16 відліків від його місця: за довіри 0,25 ритм тримає картинку нерухомою і з чужою довжиною рядка, але `lost = 0` — лише коли `|lineLength − 288| ≤ 3`.

Рішення плану про розтяг і складання. У кадр сигналу — правило розтягу з договору. У растр: кожен відлік накриває відтинок рядка комірок і ділиться між ними за довжиною накриття. Причина: при 1,83 відліку на комірку «найближча комірка» дає муар на дрібних деталях і стрибки яскравості від зсуву в соту частку відліку; так зсув на 0,1 відліку міняє комірку на межі яскравості щонайбільше на 14 рівнів. Ціна: туди й назад не тотожне — штахети в одну комірку повертаються з контрастом ≈ 40 % (176 і 79 замість 255 і 0), цятка — 212 з 255. Тому «кожна комірка ± 3» (вимога попереднього варіанта плану) ставимо лише рівним коміркам.

Алгоритм приймального боку (його не визначають ні сигнатура, ні тести). Стан після `reset()`: `ph = 0`, `line = 0`, `run = 0`, `marks = 0`, `wander = 0`, `prev = 0,3`, `n = 0`.

```
на початку виклику: pulses, lost, lines, drift, pull = 0;  held = ні;  n₀, ph₀, line₀ — n, ph, line перед першим відліком
на кожен відлік v (P = lineLength + wander):
  якщо v < threshold:
    run += 1
    якщо run = 1:  frac = prev > v ? (prev − threshold)/(prev − v) : 0,5      // де між двома відліками сигнал перетнув поріг
    якщо run = 10: err = (ph − 9,5 + frac) − LINE.front, зведене до ±P/2      // початок імпульсу проти свого місця
                   ph −= trust·err;  pull += trust·err;  pulses += 1;  якщо |err| ≤ 16: found = так
    якщо run = 65: якщо marks = 3: held = так                               // кадрова позначка; чотири поспіль дають рядки 96…99
                   line = 96 + marks;  marks = min(marks + 1, 3)
  інакше:
    якщо 10 ≤ run < 65: marks = 0
    run = 0
  prev = v
  якщо line < 96: відлік накриває відтинок [(ph − 54)·128/234, (ph − 53)·128/234); кожній комірці c з накриттям w: acc[c] += v·w, weight[c] += w
                  (комірки поза 0…127 пропускаємо)
  ph += 1;  n += 1
  якщо ph ≥ P:
    ph −= P;  для комірок із weight > 0,25: screen[line·128 + c] = clamp(round((acc/weight − 0,3)/0,7·255), 0, 255);  acc, weight = 0
    якщо не found: lost += 1;   found = ні;  lines += 1;  line = (line + 1) mod 100;  drift += P − 288
    wander = clamp(wander + (rng.float() − 0,5)·0,02, −0,05, +0,05);  P = lineLength + wander
lineOffset = (n₀ mod 288) − ph₀ − delay + 288·k, де ціле k кладе його в ±144;   lineRow = held ? 0 : (line₀ + k) mod 100 (0…99)
lineDrift = (drift + pull)/lines, а якщо lines = 0 — нуль
```

`lineLength` обмежуємо до 240…336, `trust` — до 0…1. Комірки, яких цей кадр не торкнувся, тримають старе значення.

- [ ] **Крок 1. Тест, що падає** — `video.test.ts`, 10 тестів; `decode(stream, params, frames)` у тесті — новий `createDecoder(1)`, екран із нулів, `frames` викликів `process` з `{ delay: 0, ...params }`, повертає екран і останні `DecodeStats`; до появи модуля — `Cannot find module '../video'`:

  ```ts
  it('рядок складено з поличок, синхроімпульсу й видимої частини', () => { /* encodeFrame(FRAME, u, { sync: true }) */
    expect(Array.from(u.subarray(0, 7))).toEqual(Array(7).fill(Math.fround(0.3))); expect(Math.max(...u.subarray(7, 28))).toBe(0);
    expect(u[28]).toBeCloseTo(0.3, 6); expect(u[53]).toBeCloseTo(0.3, 6); expect(u[54]).toBeCloseTo(0.4098, 4);
    const m = 96 * 288; expect(Math.max(...u.subarray(m + 7, m + 262))).toBe(0); expect(u[m + 262]).toBeCloseTo(0.3, 6);
    /* sync: false */ expect(Math.min(...noSync)).toBeCloseTo(0.3, 6); });
  it('збігається з еталоном', () => { /* рядки 0, 50, 96 і noSync.0 з video-lines.json: кожен відлік ± 1e-4 */ });
  it('кадр туди й назад', () => { const { screen, stats } = decode(u, { lineLength: 288, trust: 0.25, threshold: 0.15 }, 3);
    expect(stats.lost).toBe(0); expect(stats.pulses).toBe(100); expect(Math.abs(stats.lines - 100)).toBeLessThanOrEqual(1);   // межа рядка падає то на останній відлік виклику, то на перший наступного
    expect(stats.lineRow).toBe(0);
    /* рівні комірки: |screen − FRAME| ≤ 3; штахети: світлі ≥ 160, темні ≤ 95; цятка ≥ 190, її сусіди в рядку ≤ 140 */ });
  it('без синхроімпульсів рядки пливуть', () => { /* кадр «біла смуга»: стовпчики 40–59 = 255, решта 0; sync: false; lineLength 288.5; 1 виклик */
    expect(stats.pulses).toBe(0); expect(stats.lost).toBe(stats.lines); expect(Math.abs(stats.lineDrift - 0.5)).toBeLessThan(0.06);
    expect(centre(screen, 10) - centre(screen, 30)).toBeGreaterThan(4.87); expect(centre(screen, 10) - centre(screen, 30)).toBeLessThan(6.07); });   // 20 рядків · 0,2735 комірки
  it('підстроювання тримає чужу довжину рядка', () => { /* sync: true, lineLength 290, trust 0.25, 4 виклики */
    expect(stats.lost).toBe(0); expect(stats.lineOffset).toBeGreaterThan(5); expect(stats.lineOffset).toBeLessThan(7); expect(Math.abs(stats.lineDrift)).toBeLessThan(0.05); });
  it('вікно захоплення за довіри 0,25 — три відліки на рядок', () => { /* sync: true, trust 0.25, 4 виклики; at(n) — DecodeStats останнього з lineLength n */
    for (const n of [285, 291]) expect(at(n).lost).toBe(0); for (const n of [283, 293]) { expect(at(n).lost).toBe(at(n).lines); expect(Math.abs(at(n).lineDrift)).toBeLessThan(0.05); } });   // картинка стоїть, але зсунута більш як на 16 відліків
  it('без довіри синхроімпульси видно, але ритм їх не слухає', () => { /* sync: true, lineLength 288.5, trust 0, 6 викликів */
    expect(stats.pulses).toBe(100); expect(meanLostShare).toBeGreaterThan(0.5); expect(Math.abs(stats.lineDrift - 0.5)).toBeLessThan(0.06); });
  it('чорний і білий кадр тримають ритм', () => { /* усі 0; усі 255; 3 виклики */ expect(stats.lost).toBe(0); /* стовпчики 1…126: 0 ± 1 і 255 ± 1 */ });
  it('кадрова позначка ставить рядки на місце', () => { /* потік, зсунутий на 30 рядків (8640 відліків), 3 виклики: рівні комірки ± 3 проти FRAME */ expect(stats.lineRow).toBe(0);
    /* без позначки: FRAME із sync: false, новий декодер, { lineLength: 288, trust: 0.25, threshold: 0.15, delay: 0 }; process(перші 8640 відліків), потім process(увесь кадр) */ expect(s2.lineRow).toBe(30); });
  it('крайні довжини рядка й довіра', () => { /* lineLength 280 і 296 × trust 0 і 1, 3 виклики: без винятку, усі числа DecodeStats скінченні; з trust 1 lost = 0; виклик із порожнім буфером — lines 0 і lineDrift 0 */ });
  ```
- [ ] **Крок 2. Написати `encodeFrame`.** Розкладка рядка, кадрової позначки й розтяг — зі «Спільного договору». Запуск: перші два тести зелені.
- [ ] **Крок 3. Написати `createDecoder`** за алгоритмом вище. Запуск: `Tests  10 passed (10)`.
- [ ] **Крок 4. Коміт.** `git add app/src/volumes/radio/sim/core/video.ts app/src/volumes/radio/sim/core/__tests__/video.test.ts app/src/volumes/radio/sim/core/index.ts app/src/volumes/radio/sim/core/README.md` · `git commit -m "Модель: кадр у сигнал із синхроімпульсами і растр із власним ритмом рядків"`

### Завдання B5. `fm.ts` — модулятор, обмежувач, два детектори

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `fm.ts`
- Тест: `__tests__/fm.test.ts`

**Інтерфейси:**
- Бере: `radPerSample`, `DEVIATION` — див. Спільний договір; `Block`, `createFir`, `designLowpass` (B2); `fm-phase.json`, `slope-curve.json`, `angle.json` (B3).
- Дає:

  ```ts
  export const SLOPE = { r: 0.2, theta: (82 * Math.PI) / 180 } as const;
  export const SYNC_THRESHOLD = { slope: 0.226, angle: 0.15 } as const;   // посередині між дном синхроімпульсу й чорним
  export const LIMITER_FLOOR_DBM = -100;                                  // найменший розмах, із яким працює обмежувач (рішення плану)
  export const VIDEO_TAPS = 31, VIDEO_CUTOFF = 0.275;                      // 5,5 MHz з 20
  export function slopeStatic(u: number): number;                         // усталений вихід детектора на схилі для сталого u
  export function createModulator(): Block;        // u → пари, |x| = 1; фаза неперервна між викликами
  export function limit(x: Float32Array, floor: number): void;            // на місці
  export function createSlopeDetector(): Block;    // пари → дійсні
  export function createAngleDetector(): Block;    // пари → дійсні
  export function createVideoFilter(): Block;      // createFir(designLowpass(VIDEO_TAPS, VIDEO_CUTOFF))
  ```

- [ ] **Крок 1. Тест, що падає** — `fm.test.ts`, 7 тестів (до появи модуля — `Cannot find module '../fm'`):

  ```ts
  it('модулятор: крок фази дорівнює radPerSample(u)', () => { /* u зі fm-phase.json; кут x[n]·conj(x[n−1]) = radPerSample(u[n]) ± 1e-6 і = step[n] ± 1e-5 (зразок має 6 значущих цифр); |x| = 1 ± 1e-6;
    два виклики по 128 дають те саме, що один на 256 */ });
  it('детектор кута повертає u', () => { /* на виході модулятора: |out[n] − u[n]| ≤ 1e-4 для n ≥ 1; на angle.json: |out − u| ≤ 1e-5 */ });
  it('детектор на схилі: чорне, біле, дно синхроімпульсу', () => { /* сталий u, 64 відліки, беремо останній */
    expect(Math.abs(tone(0.3) - 0.3)).toBeLessThan(0.002); expect(Math.abs(tone(1) - 1)).toBeLessThan(0.002); expect(Math.abs(tone(0) - 0.153)).toBeLessThan(0.01); });
  it('крива схилу монотонна й майже пряма', () => { /* 21 значення u: кожне наступне більше; для u ≥ 0,3 |tone(u) − u| ≤ 0.056 (8 % розмаху 0,7);
    |tone(u) − out| ≤ 1e-3 проти slope-curve.json; |slopeStatic(u) − tone(u)| ≤ 1e-4 */ });
  it('обмежувач знімає брижі розмаху й не чіпає фазу', () => { /* x = модулятор(u = 0,65)·(1 + 0,5·sin(2πn/40)); limit(x, 0.01):
    ||x| − 1| < 1e-6, кут той самий ± 1e-6; пара з |x| = 0,005 стає довжиною 0,5; (0, 0) лишається (0, 0) */ });
  it('без обмежувача брижі проходять у картинку', () => { /* той самий x: розмах виходу детектора на схилі > 0.3; після limit — < 0.004 (n ≥ 20) */ });
  it('фільтр відеосигналу: 5,5 MHz', () => { const h = designLowpass(VIDEO_TAPS, VIDEO_CUTOFF);
    expect(gainDb(h, 0)).toBeCloseTo(0, 5); expect(Math.abs(gainDb(h, 0.275) + 6)).toBeLessThan(0.3); expect(gainDb(h, 0.4)).toBeLessThan(-40); });
  ```
- [ ] **Крок 2. Написати модулятор і детектор кута.** Модулятор: фаза в подвійній точності, `φ += radPerSample(u[n])`, зведена до ±π; вихід `(cos φ, sin φ)` через `Math.cos` і `Math.sin` (28 800 відліків на кадр — таблиця не потрібна). Детектор кута: `u = (atan2(…)·20e6/2π − DEVIATION.atSync)/DEVIATION.span` від `x[n]·conj(x[n−1])`, попередній відлік після `reset()` — `(1, 0)`.
- [ ] **Крок 3. Написати обмежувач, детектор на схилі й фільтр.** `limit`: `|x| ≥ floor` → довжина 1; нижче → `x/floor`. Детектор: `y[n] = x[n] + r·e^(jθ)·y[n−1]`, вихід `gain·|y| + offset`; `gain` і `offset` рахуємо під час завантаження модуля з усталених значень `1/|1 − r·e^(j(θ − radPerSample(u)))|` для `u = 0,3` і `u = 1` (вийде 2,097971 і −1,610102; у код ці числа не вписуємо). Запуск: `Tests  7 passed (7)`.
- [ ] **Крок 4. Коміт.** `git add app/src/volumes/radio/sim/core/fm.ts app/src/volumes/radio/sim/core/__tests__/fm.test.ts app/src/volumes/radio/sim/core/index.ts app/src/volumes/radio/sim/core/README.md` · `git commit -m "Модель: частотний модулятор, обмежувач, детектори на схилі й кута"`

### Завдання B6a. Подвір'я числами й еталон бюджету лінії

**Виконавець:** Fable 5.2, окремий агент — не той, що пише B6b. Стіни рухає саме він: еталон рахує за секунду.

**Файли:**
- Створити: `site.json`; `tools/ref-models/radio/link_budget.py`; `__fixtures__/{ladder,notches}.json` (пише скрипт)
- Змінити: `docs/volumes/radio/VISUAL.md` (розділ «Подвір’я»: три речення під таблицями; самі числа — лише якщо їх довелося рухати), `tools/ref-models/radio/README.md`
- Тест: `python3 tools/ref-models/radio/link_budget.py --site app/src/volumes/radio/sim/core/site.json`

**Інтерфейси:**
- Бере: таблицю «Числа, які модель мусить видати» і фізику під нею — див. Спільний договір; розділ «Подвір’я» з `VISUAL.md` (A5): числа моделі (`tx`, зупинки, стіни, `slabZ`, стулка, вісь, роутер, піч) і прямокутники сараю й гаража.
- Дає: `site.json` — єдине джерело геометрії для моделі, еталона і сцени (рішення плану: файл даних, а не сталі в `site.ts`, щоб еталон читав ті самі числа, не читаючи TypeScript). Метри; осі — як у `VISUAL.md`: `x` — схід, `y` — північ, `z` — угору, початок — земля під камерою; дім стоїть на схід від стовпа:

  ```json
  { "tx": [0, 0, 3.0], "route": [[19.0, 6.0, 1.2], [19.8, 0, 1.2], [23.2, 0, 1.2], [27.2, 0, 1.2], [26.6, 0, -1.5]], "nudgeAxis": [0.866025, -0.5],
    "walls": [
      { "id": "shell-w", "a": [19.2, -3], "b": [19.2, 3], "material": "brick" }, { "id": "shell-s", "a": [19.2, -3], "b": [28.6, -3], "material": "brick" },
      { "id": "shell-n", "a": [19.2, 3], "b": [28.6, 3], "material": "brick" },  { "id": "shell-e", "a": [28.6, -3], "b": [28.6, 3], "material": "brick" },
      { "id": "partition", "a": [21.4, -3], "b": [21.4, 3], "material": "wood" }, { "id": "cupboard", "a": [21.7, -3], "b": [21.7, 3], "material": "wood" },
      { "id": "inner", "a": [25.0, -3], "b": [25.0, 3], "material": "brick" }, { "id": "wardrobe-doors", "a": [21.7, -2.4], "b": [25.0, -2.4], "material": "wood" },
      { "id": "wardrobe-back", "a": [21.7, -2.7], "b": [25.0, -2.7], "material": "wood" } ],
    "slabZ": -0.2, "gateLeaf": { "a": [27.25, -4.8], "b": [25.8, -6.75] },
    "router": { "at": [12, 14, 2], "mw": 10 }, "oven": { "at": [19.8, 0.6, 1.0], "leakMw": 0.1 } }
  ```

  Це ті самі числа, що в таблицях A5: план подвір'я один (рішення плану), запасного немає, частинами його ні з чим не змішуємо. `gateLeaf.a` — завіса стулки, `b` — її вільний кінець, коли ворота відчинено. План пораховано прототипом і тричі незалежно перераховано; його числа: сходинки −54,05 / −62,00 / −69,36 / −78,74 / −88,65 dBm; поле за 20 м — 0,0311 V/m; ворота відчинено, зупинка 2, найгірша точка (`nudge` +0,0725): зайва дорога 10,46 м (на `nudge` 0 — 10,59, як у перевірці A5), 34,9 ns, провали що 28,5–28,75 MHz, мертва точка −10,16 dB, крок між ними 7,0–7,25 см; у ній канал 3 — −79,5 dBm, канал 1 — −67,7; ворота на 0,45 / 0,6 / 0,75 — −70,4 / −73,1 / −77,0 dBm; деко: 0 dB до 0,74, далі 3,6 на 0,8, 10,9 на 0,9, 16,5 на 1 (кухня з деком — −78,5 dBm); відбитий промінь є на маршруті 1,56…2,40 (коридор) і 0…0,34 (там він іде крізь шість стін і на 34 dB слабший за прямий).
- Дає: `ladder.json` — `{stops: [{d, walls: [id…], gainDb, rxDbm10, rxDbm1, fieldVm}×5]}` (`walls` — у порядку `site.json`, перекриття — `"slab"` останнім); `notches.json` — `{route: 2, extraM, delayNs, a, worstNudge, nudge[121], rxDbm[121], notchMhz[], tray: {"0.75": …, "0.8": …, "0.9": …, "1": …}, gate: {"0.45": …, "0.6": …, "0.75": …}, rayCount[17]}`: `nudge` від −0,15 до 0,15 кроком 0,0025; рівні — канал 3, 10 mW; `tray` — втрати на зупинці 1, dB; `gate` — рівень на зупинці 2 у `worstNudge`; `rayCount` — скільки променів на маршруті 0, 0,25, …, 4 з відчиненими воротами.

Правила геометрії (їх повторює B6b). Стіни вертикальні й без меж по висоті (льох має ті самі стіни — фундамент). Промінь платить за стіну, коли його слід на плані перетинає її відрізок: точка перетину лежить строго всередині променя (`0 < t < 1`) і на відрізку стіни разом із кінцями (`0 ≤ u ≤ 1`); за перекриття — коли кінці променя по різні боки `slabZ`. Стулка — дзеркало на плані: уявне джерело за її прямою, точка відбиття мусить лежати на відрізку `a–b`; довжина відбитого променя — `√(довжина на плані² + різниця висот²)`, висота точки відбиття ділить різницю висот у тій самій частці, що й шлях на плані; відбитий промінь платить за стіни на обох плечах. Ворота: розмах відбитого множимо на `s²(3 − 2s)`, `s = clamp((gate − 0,3)/0,6, 0, 1)`. Деко (рішення плану): огинання одного краю, де `d₁` — довжина прямого променя, `d₂ = 0,05 м`, край `h = −0,4 + 0,48·tray` м відносно прямої видимості (на `tray = 1` — 0,08 м за нею), `J = 0` для `v < −0,78`; те саме послаблення дістає кожен промінь. Причина числа 0,48: деко мусить дати зерно, а не сніг льоху (проєкт II §2, `prologue/between`), тобто 15…18 dB (таблиця договору). Вікон модель не має: вікно кухні стоїть поруч із місцем, де пряма хвиля проходить стіну (A5). Сарай і гараж — предмети сцени: у модель потрапляє лише відчинена стулка.

Що з чого випливає, якщо подвір'я колись доведеться рухати: сходинка — це `−54,05 − 20·lg(d/20) − сума стін`; провали 27–33 MHz — зайва дорога 9,1–11,1 м; глибина 8–10,5 dB — відношення розмахів відбитого до прямого 0,60–0,70 (за однакових стін це `d/(d + зайва дорога)`); крок 5,5–8 см — промені приходять під кутом понад 100° один до одного (у плані — 119°), а `nudgeAxis` лежить уздовж різниці їхніх напрямків. Межа плану, яку побачить читач: пласка стулка завдовжки 2,43 м кидає відбиту хвилю лише на три метри маршруту — в коридор. На кухню хвиля від її прямої прийшла б крізь дві перегородки (мертва точка −2,8 dB), а до дальньої кімнати — крізь ріг будинку; перебір прямих для дзеркала не дав жодної, що тримає цілі зупинки 2 і водночас дістає до зупинок 1 і 3.

- [ ] **Крок 1. Записати `site.json`** — дослівно блок вище — і звірити з таблицями «Подвір’я» у `VISUAL.md`: кожна координата та сама (`nudgeAxis` у `VISUAL.md` записано округлено, (0,866; −0,5), — це не розбіжність); розбіжність — помилка переписування в `VISUAL.md`, правимо її за блоком тим самим комітом. Перевірка файла: `python3 -c "import json; s = json.load(open('app/src/volumes/radio/sim/core/site.json')); print(len(s['walls']), s['route'][2])"` → `9 [23.2, 0, 1.2]`.
- [ ] **Крок 2. Написати `link_budget.py`** (numpy; до появи файла команда з розділу «Тест» дає `can't open file`). Незалежний розрахунок за фізикою зі «Спільного договору» й правилами вище. Без інших ключів скрипт друкує таблицю «ціль — число — вердикт»: рядки таблиці договору (п'ять сходинок, поле; для воріт на зупинці 2 — провали, глибина, крок; деко на 1 — 15…18 dB) і три рядки плану: у найгіршій точці канал 1 щонайменше на 6 dB вищий за канал 3; на зупинці 2 відбитий промінь є для `nudge` −0,15, 0 і +0,15; сума стін на прямому промені — 0 / 8 / 14 / 22 / 32 dB, до кухні — рівно одна цегляна стіна. Окремим рядком без вердикту — де на маршруті є відбитий промінь (крок 0,01). Останній рядок — `link_budget: targets OK` (код 0) або `link_budget: N target(s) missed` (код 1). Ключ `--clear x0,y0,x1,y1` (можна кілька) перевіряє прямокутники плану проти всіх променів моделі — прямих, обох плечей відбитих і променів від роутера й печі, маршрут 0…4 кроком 0,05, `nudge` −0,15, 0, +0,15 — і друкує `link_budget: clear OK` або номер перетнутого прямокутника (код 1).
- [ ] **Крок 3. Запустити.** Команда з розділу «Тест» → `link_budget: targets OK`, а числа таблиці дорівнюють числам плану з «Дає» (± 0,05). Якщо ні — помилка в скрипті: `site.json` не чіпаємо. Стіни, зупинки, стулку й `nudgeAxis` рухаємо лише тоді, коли цього вимагає перший тест `emerges` (B9c) чи B16, — за абзацом «Що з чого випливає» й умовою «14 = 14» з `VISUAL.md` §2: після руху перевірка плану з `VISUAL.md` §2 друкує в другому рядку `walls N = N dB` з однаковими N, а в третьому — обидва x входу в `shell-s` західніші за `inner`. Тим самим комітом оновлюємо зразки, таблиці `VISUAL.md`, блок перевірки плану та його очікуваний вивід; цілі й допуски не чіпаємо.
- [ ] **Крок 4. Записати зразки.** `… --site app/src/volumes/radio/sim/core/site.json --write app/src/volumes/radio/sim/core/__fixtures__` → `link_budget: wrote 2 file(s)`; `… --check …` → `link_budget: 2 fixture(s) up to date`.
- [ ] **Крок 5. Дописати `VISUAL.md`.** Під таблицями розділу «Подвір’я» — три речення: «Джерело чисел моделі — `app/src/volumes/radio/sim/core/site.json`»; «Відбита від стулки хвиля дає мертві точки лише в коридорі (маршрут 1,56…2,40); на маршруті 0…0,34 вона теж доходить, але крізь шість стін і на 34 dB слабша за пряму»; «Сарай і гараж стоять поза променями моделі». Перевірка третього — прямокутники сараю з дровником і гаража з `VISUAL.md`: `python3 tools/ref-models/radio/link_budget.py --site app/src/volumes/radio/sim/core/site.json --clear -1,-12,4,-9 --clear 27.25,-9.7,32,-4.8` → `link_budget: clear OK`; далі `python3 docs/volumes/radio/check.py` → `radio check: OK`.
- [ ] **Крок 6. Коміт.** `git add app/src/volumes/radio/sim/core/site.json tools/ref-models/radio/link_budget.py tools/ref-models/radio/README.md app/src/volumes/radio/sim/core/__fixtures__/{ladder,notches}.json docs/volumes/radio/VISUAL.md` · `git commit -m "Подвір'я числами й еталон бюджету лінії"`

### Завдання B6b. `site.ts`, `channel.ts` — промені, рівні, шум антени

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `site.ts`, `channel.ts`
- Тест: `__tests__/site.test.ts`, `__tests__/channel.test.ts`

**Інтерфейси:**
- Бере: `AirState`, `Ray`, `Air`, `ChannelNo`, `CHANNELS`, `BAND` — див. Спільний договір; `site.json`, `ladder.json`, `notches.json` і «Правила геометрії» (B6a); `createRng`, `createDelay`, `DELAY_LATENCY`, `dbmToAmp` (B2).
- Дає: `Material`, `LOSS_DB`, `Vec2`, `Vec3`, `Wall`, `Site`, `SITE` (`site.ts`) і `routePoint`, `wallsBetween`, `trace` (`channel.ts`) — див. Спільний договір. `SITE` — `site.json` після перевірки форми, хибна форма — виняток під час завантаження; `routePoint` обмежує `route` до 0…4; `wallsBetween` дає id перетнутих стін у порядку `site.json`, перекриття — `'slab'` останнім. Понад договір, у `channel.ts`:

  ```ts
  export const WAVELENGTH = 0.1224, ANTENNA_DBI = 1.1;   // λ на 2450 MHz (канал 3), як у договорі
  export function pathGainDb(site: Site, from: Vec3, to: Vec3): number;              // 2·1,1 − вільний простір − стіни; без дека й відбиттів
  export function responseDb(air: Air, shownHz: number): number;                     // 20·lg|Σ 10^(gainDb/20)·e^(−j2π·f·τ)|
  export function createAir(seed: number): { apply(tx: Float32Array, air: Air, txPowerMw: number, out: Float32Array): void;
    noise(out: Float32Array, sigma: number): void; reset(): void };
  ```

  `trace`: `route`, `nudge` (±0,15), `gate`, `tray` (0…1), `txPowerMw` (0,1…10) обмежуємо. Промінь 0 — прямий, промінь 1 — від стулки (лише коли `gate > 0,3` і точка відбиття на стулці); третього в цьому плані немає. Стіни, стулка, ворота й деко — за «Правилами геометрії» B6a. `delayNs = d/0,299792458`; `phase = −2π·2441e6·delayNs·1e-9`, зведена до [0, 2π). `rxDbm = 10·lg(txPowerMw) + responseDb(air, CHANNELS[txChannel − 1])`. `fieldVm = √(480·π²·P/(λ²·G))`, де `P` — `rxDbm` у ватах, `G = 10^0,11` (рішення плану: поле, яке дало б таку потужність на цій антені). `apply` додає в `out` (темп діапазону) кожен промінь: розмах `dbmToAmp(10·lg(txPowerMw) + gainDb)`, поворот на `phase`, запізнення `(delayNs − delayNs променя 0)·0,1` відліку — це справжнє запізнення, розтягнуте в `K` разів. `noise` додає шум із розкидом `sigma` на кожну тінь.

- [ ] **Крок 1. Тести, що падають.** `site.test.ts` — 3 тести: «форма подвір’я» (п'ять зупинок, `|nudgeAxis| = 1 ± 1e-3`, матеріал кожної стіни є в `LOSS_DB`, `LOSS_DB` дорівнює `{ brick: 8, wood: 3, glass: 1, slab: 10, iron: 30 }`); «зупинка 0 — за 20 м» (`|route[0] − tx| = 20 ± 0,1`); «маршрут» (`routePoint(SITE, 1.5)` — середина між зупинками 1 і 2, `routePoint(SITE, 9)` дорівнює зупинці 4). `channel.test.ts` — 11 тестів; `air(p)` — `trace(SITE, { ...DEFAULT_AIR, ...p })`, де `DEFAULT_AIR` — стан повітря з `DEFAULT_STATE` договору, виписаний у тесті; `worst` — `nudge` із сітки −0,15…0,15 кроком 0,0025, де `air({ route: 2, gate: 1, nudge }).rxDbm` найменший. Запуск: `site.test.ts` — `Cannot find module '../site'`, `channel.test.ts` — `Cannot find module '../channel'`.

  ```ts
  it('сходинки рівня (проєкт II §7)', () => { [-54, -62, -70, -78, -88].forEach((t, r) => {
    expect(Math.abs(air({ route: r }).rxDbm - t)).toBeLessThanOrEqual(1.5);
    expect(air({ route: r, txPowerMw: 1 }).rxDbm).toBeCloseTo(air({ route: r }).rxDbm - 10, 6);
    expect(air({ route: r, txPowerMw: 0.1 }).rxDbm).toBeCloseTo(air({ route: r }).rxDbm - 20, 6); }); });
  it('поле за 20 м — 0,03 V/m', () => { expect(air({ route: 0 }).fieldVm).toBeGreaterThan(0.027); expect(air({ route: 0 }).fieldVm).toBeLessThan(0.033); });
  it('пряма хвиля до кухні проходить одну цегляну стіну', () => { const ids = wallsBetween(SITE, SITE.tx, SITE.route[1]);
    expect(ids).toHaveLength(1); expect(SITE.walls.find((w) => w.id === ids[0])!.material).toBe('brick'); });
  it('відчинені ворота: провали що 30 MHz', () => { const a = air({ route: 2, gate: 1, nudge: worst });
    expect(a.rays).toHaveLength(2); const extra = (a.rays[1].delayNs - a.rays[0].delayNs) * 0.299792458; expect(extra).toBeGreaterThan(9.1); expect(extra).toBeLessThan(11.1);
    /* responseDb(a, f) для f = 2400…2483 MHz кроком 0,25: сусідні мінімуми за 27…33 MHz один від одного */ });
  it('найглибша мертва точка й крок між ними', () => { const closed = air({ route: 2 }).rxDbm, depth = air({ route: 2, gate: 1, nudge: worst }).rxDbm - closed;
    expect(depth).toBeLessThanOrEqual(-8); expect(depth).toBeGreaterThanOrEqual(-10.5);
    /* сусідні мінімуми rxDbm уздовж nudge: за 0,055…0,08 м; на nudge −0,15, 0 і +0,15 — по два промені */ });
  it('ворота діють плавно', () => { /* gate 0 і 0.3: один промінь; на worst рівень не росте, коли gate іде 0.3 → 0.9 кроком 0,05; gate 1 дорівнює gate 0.9; на gate 0.45, 0.6 і 0.75 рівень = notches.json.gate ± 0,3 dB */ });
  it('у мертвій точці інший канал живий', () => expect(air({ route: 2, gate: 1, nudge: worst, txChannel: 1 }).rxDbm - air({ route: 2, gate: 1, nudge: worst }).rxDbm).toBeGreaterThanOrEqual(6));
  it('деко діє лише впритул і дає зерно, а не сніг', () => { const loss = (t: number) => air({ route: 1 }).rxDbm - air({ route: 1, tray: t }).rxDbm;
    expect(loss(0.7)).toBe(0); expect(loss(1)).toBeGreaterThanOrEqual(15); expect(loss(1)).toBeLessThanOrEqual(18);
    /* loss не спадає, коли tray іде 0 → 1 кроком 0,05; на 0.75, 0.8, 0.9 і 1 loss = notches.json.tray ± 0,3 dB */ });
  it('незалежний розрахунок згоден', () => { /* ladder.json, п’ять зупинок: |rxDbm − rxDbm10| ≤ 0.5 і wallsBetween(SITE, SITE.tx, зупинка) дорівнює walls;
    notches.json: найглибша точка ± 0,5 dB, кожен провал ± 0,5 MHz; кількість променів на route 0, 0.25, …, 4 з gate 1 дорівнює rayCount */ });
  it('промені в сигналі дають ту саму мертву точку', () => { /* тон сталого розмаху 1 на зсуві кожного з чотирьох каналів (−0,27, −0,09, 0,09, 0,27 відліку),
    4000 пар; apply(tone, air({ route: 2, gate: 1, nudge: worst }), 10, out): powerDbm(out, 100, 4000) = 10 + responseDb(a, CHANNELS[i]) ± 0,5 */ });
  it('шум антени і крайні стани', () => { /* noise(out, 0.01) на 100 000 пар: powerDbm = 10·lg(2·0,01²) ± 0,1; те саме зерно і reset() — ті самі байти;
    air({ route: -1 }), ({ route: 9 }), ({ nudge: 1 }), ({ gate: 5 }), ({ tray: -1 }), ({ txPowerMw: 0 }), ({ txPowerMw: 100 }): rxDbm і fieldVm скінченні, rays.length ≥ 1 */ });
  ```
- [ ] **Крок 2. Написати `site.ts`.** `import raw from './site.json'`; функція перевірки форми повертає `Site` (довжини масивів, числа скінченні, матеріали відомі). Запуск `site.test.ts`: 3 тести зелені.
- [ ] **Крок 3. Написати `channel.ts`** за «Правилами геометрії» B6a й рішеннями вище; у `site.json` нічого не міняємо. Запуск `channel.test.ts`: `Tests  11 passed (11)`. Якщо падає лише «незалежний розрахунок» — помилка в одному з двох розрахунків: шукаємо її, а не послаблюємо допуск.
- [ ] **Крок 4. Коміт.** `git add app/src/volumes/radio/sim/core/{site,channel}.ts app/src/volumes/radio/sim/core/__tests__/{site,channel}.test.ts app/src/volumes/radio/sim/core/index.ts app/src/volumes/radio/sim/core/README.md` · `git commit -m "Модель: промені, стіни, ворота й деко — рівні на маршруті монітора"`

### Завдання B7. `rf.ts`, `interferers.ts`, `spectrum.ts` — діапазон і приймач до фільтра каналу

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `spectrum.ts`, `rf.ts`, `interferers.ts`
- Тест: `__tests__/{spectrum,rf,interferers}.test.ts`

**Інтерфейси:**
- Бере: `CHANNELS`, `BAND`, `FS_WB`, `OVERSAMPLE`, `shown`, `AirState`, `ChannelNo` — див. Спільний договір; `designLowpass`, `createDecimator`, `createInterpolator`, `mix`, `createRng`, `dbmToAmp`, `powerDbm` (B2); `Site`, `SITE`, `routePoint`, `pathGainDb`, `createAir` (B6b).
- Дає:

  ```ts
  // spectrum.ts
  export interface Fft { readonly size: number; forward(re: Float32Array, im: Float32Array): void }      // на місці, основа 2
  export function createFft(n: 256 | 512 | 1024 | 2048): Fft;
  export function powerSpectrumDb(x: Float32Array, fft: Fft, out: Float32Array): void;   // перші size пар; вікно Ганна; out[0] — найнижча частота; dBm
  // rf.ts
  export const NOISE_DBM_IN_CHANNEL = -92, AMP_CEILING_DBM = -20, SECOND_NOISE_DB = -30;
  export const CHANNEL_FILTER: Float32Array;       // designLowpass(63, 0.1): ±10 MHz зі 100
  export const INPUT_FILTER: Float32Array;         // designLowpass(47, 0.4175): 2399–2483 MHz (рішення плану)
  export const ANTENNA_NOISE_SIGMA: number;        // dbmToAmp(−92)/√(2·Σ CHANNEL_FILTER²) — на кожну тінь на темпі діапазону
  export function createPlacer(): { place(tx: Float32Array, channel: ChannelNo, out: Float32Array): void;
    placeAt(tx: Float32Array, shownHz: number, out: Float32Array): void; reset(): void };          // ×5 і зсув; додає в out
  export interface FrontEnd { process(antenna: Float32Array, channel: ChannelNo, out: Float32Array): void; reset(): void; gainDb: number; inputFilter: boolean }
  export function createFrontEnd(seed: number): FrontEnd;
  // interferers.ts
  export const ROUTER = { centre: 2437e6, bursts: [3, 6], burstLines: [3, 12] } as const;
  export const OVEN = { lo: 2450e6, hi: 2470e6, onLines: 50, sweepLines: 2 } as const;
  export function createInterferers(seed: number): { add(antenna: Float32Array, air: AirState, site: Site): void; reset(): void };
  ```

Рішення плану про приймач. Вхід і вихід `process` — у √mW на антені: підсилення знято, тож рівні на шкалах і поріг обмежувача не залежать від ручки. Порядок: вхідний фільтр (`createDecimator(INPUT_FILTER, 1)`; `inputFilter = false` його обходить) → підсилювач `y = g·x/√(1 + |g·x|²/c²)`, `g = 10^(gainDb/20)` (`gainDb ≤ 0`, типово 0 — повне підсилення), `c = dbmToAmp(−20)` → ділення на `g` → зсув каналу в нуль (`mix`, крок `−2π·(CHANNELS[ch − 1] − BAND.centre)/100e6`) → `createDecimator(CHANNEL_FILTER, 5)` → друге джерело шуму на темпі каналу: `dbmToAmp(−92 − 30)/√2/g` на тінь (за фільтром каналу воно дає в каналі те саме, що дало б перед ним, а коштує вп'ятеро менше). `createPlacer`: `createInterpolator(CHANNEL_FILTER, 5)` і `mix` на зсув каналу. Телефона (≈ 2,55 GHz) у цьому плані немає (див. «Поза цим планом»); стеля й перемикач `inputFilter` для нього вже є.

Рішення плану про завади. Місце антени монітора — `routePoint(site, air.route)` плюс `nudge` уздовж `site.nudgeAxis`; рівень — `10·lg(мВт джерела) + pathGainDb(site, джерело, антена)`. Роутер (`air.router`): 100 рядків кадру діляться на `k` частин (частина `i` — рядки від `⌈100·i/k⌉` до `⌈100·(i + 1)/k⌉ − 1`), `k` — ціле з 3…6 із генератора; у кожній один сплеск із цілих рядків завдовжки 3…12, після якого до кінця частини лишається щонайменше рядок тиші; сплеск — шум на темпі каналу, поставлений `placeAt(…, 2437e6, …)`, з розмахом рівня, поділеним на `√(5·Σ CHANNEL_FILTER²)`: інтерполятор забирає в білого шуму 0,27 dB. Піч (`air.oven`): тон сталого розмаху в рядках 0–49 кожного кадру, частота ходить трикутником 2450 → 2470 → 2450 MHz за 2 рядки; фаза неперервна між кадрами. Чому 2 рядки (пораховано на повторній реалізації ланцюга): за 25 рядків тон половину часу стоїть поза каналом 3, і на екрані виходять три вузькі смуги, разом 29 рядків; за 2 рядки зачеплено кожен рядок, і смуга одна, на всі 50, — як у таблиці договору. Ритм обох прив'язано до кадру моделі (проєкт II §7).

- [ ] **Крок 1. Тест `spectrum`, що падає** — 3 тести: «тон стоїть у своєму стовпчику» (тон `e^(j2π·64n/1024)` з розмахом `dbmToAmp(−30)` крізь `powerSpectrumDb`: найбільший `out` — індекс 512 + 64, значення −30 ± 0,1; далі ніж за 8 стовпчиків усе нижче −100); «рівність Парсеваля» (`forward` на 1024 випадкових парах: `Σ|X|²/1024 = Σ|x|²` з відносною похибкою 1e-4); «розміри» (256, 512, 2048: тон у стовпчику `n/4` стоїть на `n/2 + n/4`). Запуск: `Cannot find module '../spectrum'`.
- [ ] **Крок 2. Написати `spectrum.ts`.** `powerSpectrumDb` ділить на суму вікна: тон, що влучив у стовпчик, показує свою потужність; значення не нижчі за −200. Запуск: `Tests  3 passed (3)`.
- [ ] **Крок 3. Тест `rf`, що падає** — 6 тестів; `through(ch, x)` — `createFrontEnd(1).process` над уже поставленим сигналом, рівень — `powerDbm` виходу без перших 200 пар:

  ```ts
  it('свій канал проходить, чужий — ні', () => { /* тон 0,1 відліку каналу з розмахом dbmToAmp(−60), place(…, 3, …), 4 кадри */
    expect(Math.abs(through(3, x) + 60)).toBeLessThan(0.5); expect(through(1, x)).toBeLessThan(-100); expect(through(2, x)).toBeLessThan(-90); });
  it('шум у фільтрі каналу — −92 dBm', () => { /* createAir(5).noise(antenna, ANTENNA_NOISE_SIGMA), 4 кадри, канал 3 */ expect(Math.abs(level + 92)).toBeLessThan(0.5); });
  it('стеля підсилювача', () => { /* тон у середині каналу 3 */ expect(Math.abs(at(-40) + 40)).toBeLessThan(0.1);
    expect(at(0)).toBeLessThanOrEqual(-20); expect(at(0)).toBeGreaterThan(-21.5); expect(at(-10)).toBeLessThanOrEqual(-20); });
  it('зі скрученим підсиленням хвиля тоне в шумі дальших блоків', () => { /* порожня антена: gainDb 0 → рівень −122 ± 0,7; gainDb −30 → −92 ± 0,7 */ });
  it('вхідний фільтр пропускає всі чотири канали', () => { /* тон −60 dBm у середині кожного каналу: вихід свого каналу −60 ± 0,5 */ });
  it('reset повторює вихід', () => { /* шум, 1 кадр, reset(), той самий вхід: toEqual */ });
  ```
- [ ] **Крок 4. Написати `rf.ts`.** Запуск: `Tests  6 passed (6)`.
- [ ] **Крок 5. Тест `interferers`, що падає** — 5 тестів; антена — нулі, стан — `route: 1`:

  ```ts
  it('вимкнені завади нічого не додають', () => { /* router: false, oven: false → антена лишилась нулями */ });
  it('роутер накриває канали 2 і 3, а 1 і 4 вільні', () => { /* 4 кадри; p[ch] — рівень після createFrontEnd(1).process(…, ch, …) */
    expect(p[2] - p[1]).toBeGreaterThanOrEqual(20); expect(p[3] - p[4]).toBeGreaterThanOrEqual(20); expect(p[2]).toBeGreaterThan(p[3]); });
  it('роутер шле сплесками', () => { /* потужність кожного з 100 рядків (1440 пар); «увімкнено» — понад 25 % найбільшої (хвіст інтерполятора лишає в наступному рядку до 5 %);
    у кожному з 8 кадрів 3…6 груп увімкнених рядків, кожна завдовжки 3…12; середня потужність рядків, сильніших за половину найбільшого, = 10·lg(SITE.router.mw) + pathGainDb(SITE, SITE.router.at, антена) ± 1 dB */ });
  it('піч: половина кадру і лише 2450–2470 MHz', () => { /* рядки 0–49: рівень = 10·lg(SITE.oven.leakMw) + pathGainDb(SITE, SITE.oven.at, антена) ± 0,2; рядки 50–99: −200;
    powerSpectrumDb на шматках по 2048 пар у рядках 0–49: понад 99 % потужності — між 2449 і 2471 MHz */ });
  it('те саме зерно — ті самі сплески', () => { /* два createInterferers(9): антени рівні; після reset() кадр повторюється */ });
  ```
- [ ] **Крок 6. Написати `interferers.ts`.** Запуск: `Tests  5 passed (5)`.
- [ ] **Крок 7. Коміт.** `git add app/src/volumes/radio/sim/core/{spectrum,rf,interferers}.ts app/src/volumes/radio/sim/core/__tests__/{spectrum,rf,interferers}.test.ts app/src/volumes/radio/sim/core/index.ts app/src/volumes/radio/sim/core/README.md` · `git commit -m "Модель: діапазон із чотирьох каналів, приймач до фільтра каналу, роутер і піч"`

### Завдання B8. `probe.ts` — відведення і три вигляди

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `probe.ts`
- Тест: `__tests__/probe.test.ts`

**Інтерфейси:**
- Бере: `TapId`, `ProbeView`, `ProbeRequest`, `ProbeData` — див. Спільний договір; `Fft`, `createFft`, `powerSpectrumDb` (B7); `shown`.
- Дає:

  ```ts
  export const TAP_PAIRS: Readonly<Record<TapId, boolean>>;   // air.rx, rx.shifted, rx.limited — пари; camera.video, rx.detected — дійсні
  export const PROBE_MAX_COLUMNS = 512, PROBE_MIN_SAMPLES = 16;
  export function createProbe(): { read(req: ProbeRequest, taps: Record<TapId, Float32Array>, rates: Record<TapId, number>,
    centres: Record<TapId, number>, fft: Fft): ProbeData };
  ```

  `rates` — темп відведення в Hz моделі; `centres` — справжня частота середини відведення-пар (рішення плану: п'ятий аргумент, бо канал приймача — частина стану, а не сталої). Вікно: `N` — довжина відведення у відліках, `count = clamp(round(span·N), 16, N)`, `first = clamp(floor(start·N), 0, N − count)`. `strip`: стовпчиків `min(columns, count)`; стовпчик `j` — найменше й найбільше з відліків `first + ⌊j·count/C⌋ … first + ⌊(j + 1)·count/C⌋ − 1`; для пар беремо праву тінь (`re`). `scale`: до восьми шматків по `fft.size` відліків, рівно розставлених у вікні (коротше вікно доповнюємо нулями), середня потужність, у стовпчик — найбільше зі стовпчиків перетворення, що в нього потрапили; для пар `fromHz…toHz` = `centre ∓ shown(rate)/2`, для дійсних — `0…shown(rate)/2`. `arrow`: до `columns` пар із кроком `⌈count/columns⌉`; для дійсного відведення `points` порожній. Поля чужих виглядів — масиви завдовжки 0, `fromHz = toHz = 0`. Масиви живуть до наступного `read`.

- [ ] **Крок 1. Тест, що падає** — 6 тестів; відведення в тесті — масиви потрібної довжини (`camera.video` і `rx.detected` — 28 800, `rx.*` — 57 600, `air.rx` — 288 000), `fft = createFft(1024)`; до появи модуля — `Cannot find module '../probe'`:

  ```ts
  it('стрічка пилки', () => { /* camera.video[n] = (n mod 100)/100; { tap: 'camera.video', view: 'strip', start: 0, span: 1, columns: 288 } */
    expect(d.lo).toHaveLength(288); expect(Math.max(...d.lo)).toBe(0); expect(Math.min(...d.hi)).toBe(Math.fround(0.99)); });
  it('шістнадцять відліків — самі відліки', () => { /* air.rx з re[n] = n; span 16/144000, start 0.5 */
    expect(Array.from(d.lo)).toEqual(Array.from({ length: 16 }, (_, i) => 72000 + i)); expect(Array.from(d.hi)).toEqual(Array.from(d.lo)); });
  it('шкала: тон на своєму місці й у справжніх частотах', () => { /* air.rx = dbmToAmp(−60)·e^(j2π·0,09n); view 'scale', columns 500 */
    expect(d.fromHz).toBe(2391e6); expect(d.toHz).toBe(2491e6); const j = argmax(d.bins);
    expect(Math.abs(d.fromHz + ((j + 0.5) / 500) * 100e6 - 2450e6)).toBeLessThan(0.3e6); expect(Math.abs(d.bins[j] + 60)).toBeLessThan(1.5);
    /* стовпчики далі ніж за 5 від j — нижче −95 */ });
  it('шкала дійсного відведення — від нуля до 10 MHz', () => { /* rx.detected = 0,5·cos(2π·0,1n): fromHz 0, toHz 10e6, найбільший стовпчик — на 2 MHz ± 0,1 */ });
  it('стрілка: пари (I, Q)', () => { /* rx.shifted = e^(j2π·0,05n); view 'arrow', columns 512, span 1: крок ⌈28800/512⌉ = 57, тож пар 506 */
    expect(d.points).toHaveLength(1012); /* кожна пара має довжину 1 ± 1e-6; для camera.video points.length = 0 */ });
  it('запити поза межами обтинаються', () => { /* start −1 → 0; start 2, span 0.5 → вікно в кінці; span 0 → 16 відліків; columns 9000 → 512; columns 0 → 1; усе скінченне */ });
  ```
- [ ] **Крок 2. Написати `probe.ts`.** Запуск: `Tests  6 passed (6)`.
- [ ] **Крок 3. Коміт.** `git add app/src/volumes/radio/sim/core/probe.ts app/src/volumes/radio/sim/core/__tests__/probe.test.ts app/src/volumes/radio/sim/core/index.ts app/src/volumes/radio/sim/core/README.md` · `git commit -m "Модель: щуп із трьома виглядами"`

### Завдання B9a. Еталон усього ланцюга

**Виконавець:** Fable 5.2, окремий агент — не той, що пише B9b.

**Файли:**
- Змінити: `tools/ref-models/radio/fm_chain.py` (+ два зразки й перевірки), `tools/ref-models/radio/README.md`
- Створити: `__fixtures__/{link-noiseless,snr-curve}.json` (пише скрипт)
- Тест: `python3 tools/ref-models/radio/fm_chain.py --selftest`, `… --check <каталог>`

**Інтерфейси:**
- Бере: ланцюг `step` зі «Спільного договору» і параметри блоків із B4, B5, B7 цього плану (фільтри 63/0,1, 47/0,4175, 31/0,275; стеля −20 dBm; шум −92 dBm у фільтрі каналу; поріг обмежувача −100 dBm; детектор на схилі; алгоритм приймального боку). Геометрії не бере: рівень на антені задає напряму, один промінь, камера й монітор на каналі 3.
- Дає: `link-noiseless.json` — `{screen[12288]}`: тестовий кадр крізь ланцюг без шуму, типовий монітор (`slope`, обмежувач, довіра 0,25), середнє 16 кадрів після 2 кадрів розгону (один кадр відходить від середнього на рівних комірках до 3,7 рівня: ритм рядків має власний випадковий хід). `snr-curve.json` — `{levels[17], clean[17], syncLost[17], knee, slopeAbove, stops: {levels: [-54, -62, -70, -78, -88], clean[5], syncLost[5]}, frames: 6, seed: 2026}`; `levels` — −60, −62, …, −92 dBm.

Мірило чистоти (те саме в B9c, рішення плану). Зразковий екран — середнє 16 кадрів після 2 кадрів розгону на рівні зупинки 0 (тут — −54 dBm, у B9c — `route 0`, 10 mW). Чистота стану — `10·lg(255²/середній квадрат різниці)` за всіма комірками 6 кадрів, знятих після скидання й 2 кадрів розгону; `syncLost` стану — середнє за тими самими 6 кадрами. `slopeAbove` — нахил прямої найменших квадратів через точки −62…−74; злам `knee` — найвищий рівень сітки, де крива лежить під продовженням цієї прямої більш як на 6 dB.

- [ ] **Крок 1. Дописати перевірки, що падають.** У `--selftest` — нові `assert`: `0,65 ≤ slopeAbove ≤ 1,2`; `−86 ≤ knee ≤ −76`; `clean(−74) − clean(−82) ≥ 12`; `syncLost(−74) < 0,02` і `syncLost(−88) > 0,5`; на рівнях зупинок (проєкт II §0): `clean(−54) ≥ 38`, `clean(−62) ≥ 38`, `syncLost` обох — 0; `32 ≤ clean(−70) ≤ 38` і `clean(−62) − clean(−70) ≥ 3`; `16 ≤ clean(−78) ≤ 28` і `syncLost(−78) ≤ 0,1`; `clean(−88) ≤ 14` і `syncLost(−88) ≥ 0,5`. Запуск `--selftest` падає: функції ланцюга ще немає.
- [ ] **Крок 2. Написати ланцюг в еталоні.** numpy і scipy (`lfilter`, `upfirdn`); шум — `numpy.random.default_rng(seed)`; приймальний бік — цикл за відліками, як у B4. `--selftest` друкує криву й `fm_chain selftest: OK` (близько пів хвилини). Орієнтир (прототип плану й вісім зерен перерахунку): чистота 40,4–42,5 dB на −62, 35,0–35,4 на −70, 20,2–24,3 на −78, 16,9–19,0 на −80, 10,1–12,6 на −88; `slopeAbove` 0,76–0,91; `knee` −78 або −80; `clean(−74) − clean(−82)` 15,2–16,3; `syncLost` 0,000 на −74 і 0,88–0,95 на −88. Умови кроку 1 стоять на три розкиди від цих чисел. Якщо еталон у них не вкладається — зупинка й звіт авторові плану: це означало б, що не сходяться параметри договору, а не подвір'я.
- [ ] **Крок 3. Записати зразки.** `--write app/src/volumes/radio/sim/core/__fixtures__` → `fm_chain: wrote 8 file(s)`; `--check …` → `fm_chain: 8 fixture(s) up to date`. Для `snr-curve.json` `--check` порівнює числа з допуском (чистота ± 0,5 dB, `syncLost` ± 0,03, `knee` точно), решту — байт у байт.
- [ ] **Крок 4. Коміт.** `git add tools/ref-models/radio/fm_chain.py tools/ref-models/radio/README.md app/src/volumes/radio/sim/core/__fixtures__/{link-noiseless,snr-curve}.json` · `git commit -m "Еталон усього ланцюга: чистий екран і крива чистоти"`

### Завдання B9b. `fm-link.ts` — увесь ланцюг і крайні стани

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `fm-link.ts`
- Тест: `__tests__/fm-link.test.ts`, `__tests__/curve.ts` (помічник `S`; мірило чистоти додає B9c)

**Інтерфейси:**
- Бере: `FmLinkState`, `Meters`, `FmLinkFrame`, `FmLink`, `ProbeRequest`, порядок ланцюга — див. Спільний договір; усе з B2–B8.
- Дає: `createFmLink`, `DEFAULT_STATE`, `CHAIN_DELAY` (`export const` у `fm-link.ts`: затримка ланцюга у відліках каналу) — див. Спільний договір. У `curve.ts`: `S(air = {}, monitor = {}, camera = {}): FmLinkState` — копія `DEFAULT_STATE`, у якій поля трьох частин замінено поданими (`S({ route: 3 })`, `S({}, { lineLength: 288.5 }, { sync: false })`).

Рішення плану:

- Зерна: `createRng(seed).fork(k).u32()` — 1 повітря, 2 завади, 3 приймач, 4 ритм рядків. `reset()` скидає кожен блок. `still` = `reset()`, `step`, `step`; повертає другий кадр.
- Канал монітора: `rxChannel ?? air.txChannel`. Камера ставить сигнал на `txChannel`; антену на початку кадру обнуляємо. Шум антени — `ANTENNA_NOISE_SIGMA`; у цьому плані `FrontEnd.gainDb = 0`, `inputFilter = true`.
- Обмежувач: `limit(x, dbmToAmp(LIMITER_FLOOR_DBM))`. Якщо `limiter: false` — сигнал ділимо на розмах самого прямого променя `dbmToAmp(10·lg(txPowerMw) + rays[0].gainDb)`: приймач без обмежувача налаштовано на пряму хвилю, усе інше хитає яскравість. Поріг синхроімпульсу — `SYNC_THRESHOLD[detector]`; `DecoderParams.trust = syncTrust`.
- `CHAIN_DELAY` рахуємо з довжин фільтрів, а не вписуємо числом: `((CHANNEL_FILTER.length − 1) + (INPUT_FILTER.length − 1)/2 + DELAY_LATENCY)/OVERSAMPLE + (VIDEO_TAPS − 1)/2` — зараз (62 + 23 + 5)/5 + 15 = 33, як у договорі. Декодер дістає `delay: CHAIN_DELAY`, тож `lineOffset`, `lineDrift` і `lineRow` (B4) уже рахуються від картинки, що дійшла до монітора, і `meters` бере їх як є; знак — як у договорі (додатне — картинка лівіше). `syncLost = lost/lines` (0, якщо `lines = 0`); `rxDbm`, `fieldVm` — з `trace`; `cnrDb = rxDbm − NOISE_DBM_IN_CHANNEL`.
- `monitor.on === false`: камеру й повітря рахуємо (щуп на антені працює), приймач — ні; екран і відведення `rx.*` — нулі; `syncLost`, `lineOffset`, `lineDrift`, `lineRow` — 0.
- Стан не лагодимо: жодних запасних значень замість полів (`rxChannel ?? air.txChannel` — правило договору, а не запас); зіпсований стан (`monitor: null` тощо) дає виняток — на це спирається B11.
- Відведення для `createProbe`: `camera.video` (28 800 дійсних), `air.rx` (144 000 пар після шуму), `rx.shifted`, `rx.limited` (28 800 пар), `rx.detected` (28 800 дійсних після фільтра відеосигналу); `centres`: `air.rx` — `BAND.centre`, `rx.shifted` і `rx.limited` — `IF` зі `standard.ts` (на шкалі 25–45 MHz, як у проєкті II §7; рахує модель біля нуля, і це те саме); перетворення — `createFft(1024)`. Без запиту `probe` — `null`.

- [ ] **Крок 1. Тест `fm-link`, що падає** — 10 тестів в одному `describe('fm-link', { timeout: 60_000 }, …)`: «крайні стани» рахують понад сто кадрів моделі, а типова межа vitest — 5 с. Спершу `curve.ts` із `S`. Запуск: `Cannot find module '../fm-link'`. Список крайніх станів (Review Focus 4): `lineLength` 280 і 296, кожне з `camera.sync` true і false; `lineLength` 100, 240, 336 і 1000 (модель обмежує до 240…336); `syncTrust` 0 і 1; `txPowerMw` 0,1 на `route` 4; `route` 0, 0,5, 1,5, 2,5, 3,5, 4; `gate` 1 з `nudge` −0,15 і +0,15 на `route` 2; `gate` 0,5; `tray` 1; `router` і `oven` разом; `txChannel` 3 з `rxChannel` 1; `detector: 'angle'`; `limiter: false`; кадр із нулів і кадр із 255.

  ```ts
  it('still залежить лише від зерна, стану й кадру', () => { /* a = createFmLink(7).still(S(), FRAME); b — інший createFmLink(7) після п’яти step з route 3, потім still(S(), FRAME) */
    expect(Array.from(b.screen)).toEqual(Array.from(a.screen)); expect(b.meters).toEqual(a.meters); /* на route 3 екрани still зерен 7 і 8 різні */ });
  it('step продовжує попередній кадр, reset починає спочатку', () => { /* route 3 і route 4: два step поспіль дають різні екрани; reset() і step — як перший step нового createFmLink(7) */ });
  it('типовий стан: рядки стоять, кухня чиста', () => { /* 4 step */ expect(m.syncLost).toBe(0); expect(Math.abs(m.lineOffset)).toBeLessThan(1); expect(Math.abs(m.lineDrift)).toBeLessThan(0.05); expect(m.lineRow).toBe(0);
    expect(Math.abs(m.rxDbm + 62)).toBeLessThanOrEqual(1.5); expect(m.cnrDb).toBeCloseTo(m.rxDbm + 92, 9);
    /* рівні комірки проти FRAME: середній модуль різниці ≤ 6, найбільший ≤ 30 (детектор на схилі гне шкалу сірого до 6 % — це 16 рівнів) */ });
  it('ритм рядків і блок синхроімпульсів: без блока картинка їде ліворуч', () => { /* кадр «біла смуга» (стовпчики 40–59 = 255, решта 0), camera.sync false, lineLength 288.5, still: */
    expect(m.syncLost).toBe(1); expect(Math.abs(m.lineDrift - 0.5)).toBeLessThan(0.1); expect(centre(f.screen, 10) - centre(f.screen, 30)).toBeGreaterThan(3);
    /* FRAME, sync true, lineLength 290, 4 step: */ expect(m2.syncLost).toBe(0); expect(Math.abs(m2.lineOffset - 6)).toBeLessThan(1.5); });
  it('затримка ланцюга дорівнює CHAIN_DELAY', () => { /* still(S({ route: 0 }, { detector: 'angle' }), FRAME, { tap: 'rx.detected', view: 'strip', start: 0, span: 64 / 28800, columns: 64 }) — 64 відліки як є;
    j — перший індекс ≥ 16, де lo[j − 1] ≥ 0.15 > lo[j]; x = j − 1 + (lo[j − 1] − 0.15) / (lo[j − 1] − lo[j]) */
    expect(Number.isInteger(CHAIN_DELAY)).toBe(true); expect(Math.abs(x - (6.5 + CHAIN_DELAY))).toBeLessThanOrEqual(0.5); });   // у camera.video спад синхроімпульсу рядка 0 — між відліками 6 і 7
  it('відведення: кабель камери, антена, канал після зсуву', () => { /* три still(S(), FRAME, запит): d — camera.video, a — air.rx, s — rx.shifted */
    /* camera.video, strip, start 24/100, span 1/100, columns 288 — рядок 24 відлік у відлік: */ expect(Math.max(...d.hi.subarray(7, 28))).toBe(0); expect(d.hi[230]).toBeGreaterThanOrEqual(0.82);   // цятка на лобі кота
    /* air.rx, scale, columns 500: найсильніший стовпчик — не далі ніж за 6 MHz від 2450 MHz, стовпчики далі ніж за 15 MHz від 2450 — щонайменше на 20 dB нижчі; з txChannel 1 — те саме довкола 2414 MHz */
    /* rx.shifted, scale: */ expect(s.fromHz).toBe(25e6); expect(s.toHz).toBe(45e6); });
  it('детектор кута дає ту саму картинку', () => { /* detector 'angle', route 1, середнє 4 step після 2 */ expect(m.syncLost).toBe(0); /* рівні комірки проти FRAME: середній модуль різниці ≤ 2 */ });
  it('монітор на чужому каналі показує сніг', () => { /* txChannel 3, rxChannel 1, 3 step */ expect(m.syncLost).toBeGreaterThanOrEqual(0.9); });
  it('вимкнений монітор — темний екран', () => { /* monitor.on false */ expect(Math.max(...f.screen)).toBe(0); expect(Number.isFinite(f.meters.rxDbm)).toBe(true);
    expect([f.meters.syncLost, f.meters.lineOffset, f.meters.lineDrift, f.meters.lineRow]).toEqual([0, 0, 0, 0]); });
  it('крайні стани', () => { /* цикл за списком із кроку: 3 step і 1 still із запитом щупа { tap: 'rx.detected', view: 'strip', start: 0, span: 1, columns: 256 }: без винятку; кожне число meters скінченне,
    lineRow — ціле 0…99; lo, hi скінченні; для чорного й білого кадру на route 1 — syncLost 0; далі зіпсований стан: */
    expect(() => createFmLink(1).step({ ...S(), monitor: null } as unknown as FmLinkState, FRAME)).toThrow(); });
  ```
- [ ] **Крок 2. Написати `fm-link.ts`.** Порядок обчислення — зі «Спільного договору»; буфери виділяємо один раз у `createFmLink`. Запуск: `Tests  10 passed (10)`.
- [ ] **Крок 3. Коміт.** `git add app/src/volumes/radio/sim/core/fm-link.ts app/src/volumes/radio/sim/core/__tests__/fm-link.test.ts app/src/volumes/radio/sim/core/__tests__/curve.ts app/src/volumes/radio/sim/core/index.ts app/src/volumes/radio/sim/core/README.md` · `git commit -m "Модель: увесь ланцюг частотної модуляції від кадру камери до екрана"`

### Завдання B9c. «Виходить із моделі», звірка з еталоном, числа у звіт

**Виконавець:** Fable 5.2

**Файли:**
- Змінити: `__tests__/curve.ts` (+ мірило чистоти), `docs/volumes/radio/reports/batch2-model.md` (файл створив B1b; + розділ «Модель сигналу»), `docs/volumes/radio/PATH-ledger.md` (числа замість «попередньо»), `docs/volumes/radio/PATH.md` («Докладніше» `air/echo`)
- Тест: `__tests__/{emerges,oracle}.test.ts`

**Інтерфейси:**
- Бере: `createFmLink`, `S` (B9b); `trace`, `SITE` (B6b); мірило чистоти, `link-noiseless.json`, `snr-curve.json` (B9a); `FRAME`, `FLAT`, `meanPowerDbm`, `spread` (`helpers.ts`).
- Дає: у `curve.ts` — `at(dbm): FmLinkState` (стан із першою із зупинок 0, 1, 3, чий рівень `L` на 10 mW дає `L − 20 ≤ dbm ≤ L`, і `txPowerMw = 10·10^((dbm − L)/10)`); `reference(link): Float32Array` (зразковий екран: `reset()`, `route 0`, 10 mW); `measure(link, state, ref): { clean: number; syncLost: number }` (`reset()` перед кожним станом, 2 кадри розгону, 6 у мірило); `curve()` — `{ clean(dbm), syncLost(dbm), slopeAbove, knee }` для рівнів −60…−92 кроком 2, зерно 2026, рахується один раз на процес; `badRows(screen, ref): number[]` — рядки екрана, де середній модуль різниці зі зразковим понад 12. Числа розділу «Модель сигналу» читають B16 і B17.

- [ ] **Крок 1. Написати мірило в `curve.ts` і тест `emerges.test.ts`** — 7 тестів, у кожного `{ timeout: 120_000 }` і в назві рядок проєкту, який він доводить; `link = createFmLink(2026)` і `ref = reference(link)` — спільні для файла:

  ```ts
  it('сходинки рівня збігаються з розрахунком (II §7, III §3)', { timeout: 120_000 }, () => { [-54, -62, -70, -78, -88].forEach((t, r) => {
    const f = link.step(S({ route: r }), FRAME, { tap: 'rx.shifted', view: 'arrow', start: 0, span: 1, columns: 512 });
    expect(Math.abs(f.meters.rxDbm - t)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(meanPowerDbm(f.probe!.points) - 10 * Math.log10(10 ** (f.meters.rxDbm / 10) + 10 ** -9.2))).toBeLessThanOrEqual(1); }); });   // рівень у сигналі, а не лише в розрахунку: хвиля плюс шум −92 dBm
  it('крива чистоти має злам біля межі частотної модуляції (III §3)', { timeout: 120_000 }, () => { const c = curve();
    expect(c.slopeAbove).toBeGreaterThanOrEqual(0.65); expect(c.slopeAbove).toBeLessThanOrEqual(1.2); expect(c.knee).toBeGreaterThanOrEqual(-86); expect(c.knee).toBeLessThanOrEqual(-76);
    expect(c.clean(-74) - c.clean(-82)).toBeGreaterThanOrEqual(12); expect(c.clean(-62)).toBeGreaterThanOrEqual(36); expect(c.clean(-88)).toBeLessThanOrEqual(16); });
  it('нижче межі синхроімпульси губляться, і рядки рвуться (III §3)', { timeout: 120_000 }, () => { const c = curve();
    expect(c.syncLost(-74)).toBeLessThan(0.02); expect(c.syncLost(-88)).toBeGreaterThan(0.5); });
  it('п’ять зупинок: чисто · чисто · ледь зерно · зерно з першими іскрами · сніг; деко — зерно (II §0, §2)', { timeout: 120_000 }, () => {
    /* p[r] = measure(link, S({ route: r }), ref), r = 0…4; tray = measure(link, S({ tray: 1 }), ref) */
    expect(p[0].clean).toBeGreaterThanOrEqual(38); expect(p[1].clean).toBeGreaterThanOrEqual(38); expect(p[0].syncLost + p[1].syncLost).toBe(0);
    expect(p[2].clean).toBeGreaterThanOrEqual(32); expect(p[2].clean).toBeLessThanOrEqual(38); expect(p[1].clean - p[2].clean).toBeGreaterThanOrEqual(3);
    for (const q of [p[3], tray]) { expect(q.clean).toBeGreaterThanOrEqual(16); expect(q.clean).toBeLessThanOrEqual(28); expect(q.syncLost).toBeLessThanOrEqual(0.1); }
    expect(p[4].clean).toBeLessThanOrEqual(14); expect(p[4].syncLost).toBeGreaterThanOrEqual(0.5); });
  it('у мертвій точці перемикання каналу повертає картинку (III §3)', { timeout: 120_000 }, () => { /* route 2, gate 1, nudge — найгірший для каналу 3 за trace */
    expect(rx(3)).toBeLessThanOrEqual(rxClosed - 8); expect(cleanOn(1) - cleanOn(3)).toBeGreaterThanOrEqual(5); });
  it('без обмежувача хитання воріт хитає яскравість, з обмежувачем — ні (II §6, «Чому частота, а не розмах»)', { timeout: 120_000 }, () => {
    /* route 2, nudge — найкращий для каналу 3; gate = 0.6 + 0.3·sin(2πi/8), i = 0…9; m — середня яскравість екрана в кадрах 2…9 */
    expect(spread(mLimited)).toBeLessThanOrEqual(3); expect(spread(mFree)).toBeGreaterThanOrEqual(30); });
  it('піч дає смугу на половину екрана, канали 1 і 2 від неї вільні (II §7)', { timeout: 120_000 }, () => {
    /* S({ oven: true }) — кухня, канал 3: два step розгону, далі для кожного з трьох кадрів n = badRows(f.screen, ref): */
    expect(n.length).toBeGreaterThanOrEqual(40); expect(n.length).toBeLessThanOrEqual(60); expect(Math.max(...n)).toBeLessThanOrEqual(52);
    /* те саме з txChannel 1 (n1) і з txChannel 2 (n2): */ expect(n1.length + n2.length).toBe(0); });
  ```
- [ ] **Крок 2. Запустити `emerges.test.ts`** → `Tests  7 passed (7)`: ланцюг уже написано, тож червоний тест тут — знахідка, а не початок циклу. Орієнтир з перерахунку: чистота на зупинках 42,6–46,7 / 40,5–42,4 / 35,6–36,1 / 19,2–24,4 / 10,1–12,4 dB, `syncLost` 0 / 0 / 0 / 0,02–0,04 / 0,93–0,96; з деком — 19–23 dB і 0,01–0,03; піч — 50 рядків, усі серед рядків 0…49. Пороги чистоти й зривів узято з перерахунку: умова попереднього варіанта плану «понад 2 dB на dB нижче −84 dBm» не виконується — нижче −84 крива лягає на дно 10–12 dB (картинки вже немає), круте падіння стоїть між −74 і −82. Якщо падає перший тест — рухаємо стіни в `site.json` через B6a (крок 3), а не цілі. Якщо тести другий–четвертий промахуються менш як на розкид між зернами (чистота — 2–3 dB біля −60 і до 5 dB на −76…−78; `knee` — один крок сітки; нахил — 0,08), а еталон B9a зелений, — це статистика: записати число у звіт і повернути авторові плану, поріг самому не рухати. Більший промах — помилка в `fm-link.ts`. Якщо смуга печі не вкладається в 40…60 — так само: число у звіт і авторові плану (`OVEN.sweepLines` — рішення плану).
- [ ] **Крок 3. Тест `oracle.test.ts`** — 2 тести, `{ timeout: 120_000 }`: «чистий екран збігається з еталоном» — `reference(link)` проти `link-noiseless.json`: рівні комірки ± 3, будь-яка комірка ± 24, середній модуль різниці ≤ 1,5 (перерахунок: 1,5, 6,2 і 0,5; межі яскравості розходяться, бо еталон має власний випадковий хід ритму рядків); «крива чистоти збігається з еталонною» — `|clean − еталон| ≤ 1,5` на рівнях −66…−74 і `≤ 3` на −60…−64 (там розкид між зернами — до 2,7 dB), `|knee − knee еталона| ≤ 2`. Запуск: `Tests  2 passed (2)`.
- [ ] **Крок 4. Записати підтверджені числа.** У `docs/volumes/radio/reports/batch2-model.md`, розділ «Модель сигналу»: таблиця «що — ціль — модель — еталон» для всіх рядків таблиці договору (сходинки на п'яти зупинках, поле, шум, злам, провали, мертва точка, крок, деко, роутер, смуга печі в рядках); пара гуляння частоти (дно синхроімпульсу −4,3 MHz, розмах 8,3 MHz: чорне −1,81, біле +4,0); чистота й частка зірваних рядків на п'яти зупинках і з деком — словами проєкту й числом; вікно захоплення ритму рядків (`syncLost = 0` лише за `|lineLength − 288| ≤ 3` з довірою 0,25); рядок «діапазон 2,4 GHz, сітку каналів і силу передавача (10 mW на виході, ≈ 12,9 mW випроміненої з антеною 1,1 dBi) звірено з відкритими джерелами — `tools/ref-models/radio/README.md`». Окремим підрозділом «Питання до власника»: відбита від стулки хвиля помітна лише в коридорі (маршрут 1,56…2,40 — рядок `link_budget.py`, який показує ще й 0…0,34, де вона на 34 dB слабша за пряму), а проєкт чекає мертвих точок «від коридору й далі» (II §0) і в дальній кімнаті (`many/hole`, II §2) — до черги з главою `air` вирішити: друга стулка як третій промінь чи перенести ці кроки в коридор. Друге питання — сила передавача: модель має 10 mW на виході й ≈ 12,9 mW випроміненої (10 mW + 1,1 dBi); яка опублікована межа стосується якої з двох величин — таблиця «Звірено з відкритими джерелами» в `tools/ref-models/radio/README.md` (B3); чи «не вища за 10 mW» тому (рішення 23) — про вихід передавача чи про випромінену потужність, вирішує власник; чисел моделі в черзі 2 ця відповідь не змінює. У `docs/volumes/radio/PATH-ledger.md`, розділ «Числа моделі», слово «попередньо» біля сходинок, зламу й пари гуляння («Сходинки рівня (попередньо)»; «точна пара — попередньо» в «Гулянні частоти й ширині каналу»; «пара гуляння — попередньо, як вище» в «Зменшеному стандарті екрана») міняємо на ці числа з приміткою «підтверджено еталоном, черга 2» і дописуємо рядок про межу відбиття. У «Частотах і каналах» речення про ворота разом із дужкою «(попередньо: … цитуватиме числа еталона, а не проєкту)» замінюємо числами еталона на зупинці 2 (`link_budget.py`; на `nudge` 0 вони ті самі, що друкує перевірка плану `VISUAL.md` §2: 10,6 м · 35,3 ns · 28,3 MHz · 7,1 см) з тією самою приміткою: «Ворота (у бік дому відбиває лише відчинена стулка): у коридорі зайва дорога ≈ 10,6 м, запізнення ≈ 35 ns, провали що ≈ 28 MHz, мертві точки що ≈ 7 см (підтверджено еталоном, черга 2; проєкт називав 10 м, 33 ns, 30 MHz і 6 см).» Якщо B6a рухав стіни, числа беремо з нового виводу перевірки плану (рядок `leaf …`), округливши так само. У `docs/volumes/radio/PATH.md`, крок `air/echo`, у «Докладніше» «33 ns; крок 6 см; провали що 30 MHz (числа попередні: «Докладніше» цитує еталон за планом подвір’я — `PATH-ledger.md`, «Числа моделі»)» міняємо на «35 ns; крок 7 см; провали що 28 MHz» (ті самі числа, що в реєстрі). Перевірка: `python3 docs/volumes/radio/check.py` → `radio check: OK`; `grep -n "попередньо" docs/volumes/radio/PATH-ledger.md` показує лише рядок «Цифрова лінія» (її межі підтверджує черга 8); `grep -c "числа попередні" docs/volumes/radio/PATH.md` → `0`.
- [ ] **Крок 5. Коміт.** `git add app/src/volumes/radio/sim/core/__tests__/{emerges,oracle}.test.ts app/src/volumes/radio/sim/core/__tests__/curve.ts docs/volumes/radio/reports/batch2-model.md docs/volumes/radio/PATH-ledger.md docs/volumes/radio/PATH.md` · `git commit -m "Тести «виходить із моделі», звірка з еталоном і підтверджені числа моделі"`

### Завдання B10. Швидкість моделі

**Виконавець:** Fable 5.2

**Файли:**
- Створити: `__tests__/fm-link.bench.ts`
- Змінити: `docs/volumes/radio/reports/batch2-model.md` (рядок «кадрів моделі за секунду, Node»); модулі `sim/core`, `tools/ref-models/radio/fm_chain.py` і зразки — лише якщо спрацював крок 3
- Тест: `cd app && pnpm exec vitest bench src/volumes/radio/sim --run --reporter verbose`

**Інтерфейси:**
- Бере: `createFmLink`, `DEFAULT_STATE` (B9b), `FRAME` (B3).
- Дає: число «кадрів моделі за секунду» для `step` з усім діапазоном у Node. Числа в браузері (фоновий потік, основний потік під чотирикратним сповільненням) знімає B16.

- [ ] **Крок 1. Написати вимір.** У vitest 5.1 `bench` — не імпорт, а поле контексту тесту (перевірено на цій машині: `import { bench } from 'vitest'` дає `TypeError: bench is not a function`). `pnpm test` цей файл не чіпає: він не підпадає під `src/**/*.test.ts`.

  ```ts
  import { describe, expect, it } from 'vitest';
  import { createFmLink, DEFAULT_STATE } from '../fm-link';
  import { FRAME } from './helpers';
  describe('швидкість моделі', () => {
    it('step з усім діапазоном', { timeout: 60_000 }, async ({ bench }) => {
      const link = createFmLink(1); const state = structuredClone(DEFAULT_STATE);
      for (let i = 0; i < 5; i++) link.step(state, FRAME);                       // розгін
      const result = await bench('fm-link step', () => { link.step(state, FRAME); }).run({ time: 3000 });
      expect(result.throughput.mean).toBeGreaterThanOrEqual(16);                 // ≤ 62,5 ms на кадр: запас під мірило modelMs ≤ 100
    });
  });
  ```
- [ ] **Крок 2. Зняти число.** Команда з розділу «Тест» друкує таблицю `name  hz  min  max  mean …`; стовпчик `hz` рядка `fm-link step` — кадри моделі за секунду. Пройдено: `hz ≥ 16`, `Tests  1 passed (1)` і у виводі немає блока `Benchmark Warning … accessed module export getters too many times` (він означає, що якийсь цикл читає імпорт на кожному відліку: vitest назве цей імпорт у списку `Tracked exports` — виправити й повторити). Орієнтир: фільтр пар на 47 відводів над 144 000 пар коштує тут 6,5 ms.
- [ ] **Крок 3. Якщо `hz < 16` — прискорити, у цьому порядку,** після кожного кроку повторюючи вимір і `pnpm test src/volumes/radio/sim` (усе зелене): (1) злити в один цикл підсилювач, ділення на `g` і зсув каналу в `rf.ts`, шум антени й суму променів у `fm-link.ts`; (2) скоротити `INPUT_FILTER` до 37, а якщо мало — до 27 відводів, доки тести B7 зелені (31 не годиться: `CHAIN_DELAY` мусить лишатися цілим, тобто сума затримок на темпі діапазону — кратною 5; фільтр інтерполятора не чіпаємо: формула `CHAIN_DELAY` рахує його з обох боків), ту саму довжину вписати в `fm_chain.py` й повторити там `--selftest`, `--write` і `--check`; числа договору (`CHAIN_DELAY` 33, відставання `rx.shifted` 18) — для 47 відводів: з 37 вони стають 32 і 17, з 27 — 31 і 16, і обидва нові числа йдуть у звіт (на відставання спирається C8); (3) запасний шлях проєкту — `createFmLink(seed, { band: 'channel' })`: для станів без сусідів і завад етап діапазону пропускаємо, шум додаємо на темпі каналу; тоді кожен тест B9b і B9c проходить в обох режимах. WebAssembly в цьому плані немає: якщо не допомогло й (3) — зупинка і звіт.
- [ ] **Крок 4. Записати число у звіт** — рядок «Node 24, `step`, увесь діапазон: N кадрів моделі за секунду (M ms на кадр); процесор …» у розділі «Модель сигналу», і які з кроків прискорення знадобилися.
- [ ] **Крок 5. Зразки відповідають еталонам.** `python3 tools/ref-models/radio/fm_chain.py --check app/src/volumes/radio/sim/core/__fixtures__` → `fm_chain: 8 fixture(s) up to date`; `python3 tools/ref-models/radio/link_budget.py --site app/src/volumes/radio/sim/core/site.json --check app/src/volumes/radio/sim/core/__fixtures__` → `link_budget: 2 fixture(s) up to date`.
- [ ] **Крок 6. Коміт.** `git add app/src/volumes/radio/sim/core/__tests__/fm-link.bench.ts docs/volumes/radio/reports/batch2-model.md`; якщо спрацював крок 3 — ще кожен змінений файл явним шляхом (`app/src/volumes/radio/sim/core/rf.ts`, `app/src/volumes/radio/sim/core/fm-link.ts`, `tools/ref-models/radio/fm_chain.py`, `app/src/volumes/radio/sim/core/__fixtures__/{link-noiseless,snr-curve}.json`) · `git commit -m "Вимір швидкості моделі"`
