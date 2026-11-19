# Черга 2. Світ

> Розділ плану [`2026-11-18-radio-pilot.md`](../2026-11-18-radio-pilot.md). Обмеження, поправки П1–П21, будова файлів, «Спільний договір» і ворота черги — там; завдання посилаються на них і на інші завдання за номерами.


Ця половина черги дає все, що стоїть між моделлю і главою: око камери й екран монітора, зв'язок сцени з моделлю, предмети, подвір'я, світ як одну точку входу, мініатюру «де ми» і пісочницю з вимірами. Порядок: **B1a → B1b — перші завдання черги взагалі** (рішення 24: якщо додатковий прохід не вкладається в межу, чергу перепланувати до того, як писати решту); B12 — після B1b, паралельно з моделлю (B2–B10): від моделі не залежить; B11 — після B9b (`createFmLink`); B13 — після B6b (`site.ts`) і B12; B15 — після B13; B14 — після B1b, B11, B13; B16 — після B14, B15 і B10; B17 — ворота черги. Пісочницю `_sandbox-radio-link` правлять B1b, B12, B13, B15, B16 — у цьому порядку, ніколи паралельно.

Спільне для завдань цієї частини:

- **Подвір'я числами** — `Site`, `SITE`, `routePoint`, `Material` зі Спільного договору (B6b; джерело — `site.json`). Стіни дому вертикальні, без меж по висоті; земля — `z = 0`. Сараю, гаража, вікон, телефона й об'єктива в `Site` немає: їх ставить `yard/layout.ts`. `sim/core/index.ts` віддає кожен модуль через `export *`, тож `SITE`, `Site`, `routePoint`, `COLS`, `ROWS` імпортуємо з `@radio/sim/core`.
- **Кроки пісочниці** — одна сцена на всі кроки: `eye` і `far` (B1b: око й плаваючий екран; `far` — та сама сцена й стан з іншого ракурсу), `props` (B12, прибирає B13: предмети по одному), `yard` (B13: ракурси, сутінки, маршрут), `where` (B15: мініатюра з керуванням, як у главі), `live` і `still` (B16: живий екран; сходинки маршруту на зупиненому кадрі).
- **Кадри ока порівнюємо з допуском**, бо програмний рендер не повторюється біт у біт («Середовище»): помічники `held` і `lumaDiff` скрипта `measure.mjs` (B1b); «той самий кадр» — це `lumaDiff ≤ 12`.

**Блок Q — перевірка пісочниці в браузері.** Пісочниця живе в томі `_dev`, якого немає у збірці сайту, тому її перевіряємо на повному дереві. Завдання нижче посилаються на цей блок і міняють лише аргументи `measure.mjs`. Блок іде одним викликом оболонки (функції й змінні `qa-env.sh` між викликами не живуть) і завжди у фоні (`run_in_background`): під програмним рендером розділ триває хвилини, а без `--only` — довше, ніж живе команда переднього плану. Вердикт — останній рядок `measure.mjs`, коли команда закінчиться.

```bash
. tools/site/qa-env.sh && mkdir -p "$QA_OUT"            # прелюдія, QA_ALLOW_SOFTWARE=1, замінники ImageMagick, site_stop (завдання A7)
(cd app && pnpm build)
(cd app && setsid nohup pnpm preview --host 127.0.0.1 --port 5377 --strictPort > "$QA_OUT/preview-5377.log" 2>&1 < /dev/null &)
curl -fsS --retry 60 --retry-connrefused --retry-delay 1 -o /dev/null http://127.0.0.1:5377/
node app/src/volumes/_dev/chapters/_sandbox-radio-link/qa/measure.mjs --port 5377 --out "$QA_OUT/sandbox-link" --only <розділи>; rc=$?
site_stop 5377; exit $rc                                # site_stop чекає, доки порт звільниться; код виходу — від measure.mjs
```

### Завдання B1a. Око камери й екран

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `app/src/volumes/radio/shared/screen/eye.ts`, `…/screen/screen.ts`, `…/screen/index.ts` (реекспорт обох)
- Тест: `app/src/volumes/radio/shared/screen/__tests__/eye.test.ts`, `…/__tests__/screen.test.ts`

**Інтерфейси:**
- Бере: `ctx.renderer`, `ctx.scene`, `ctx.track`, `ctx.clock.dt`, `ctx.env.rig` (`style/env/environment.ts:117`); `kGlobals` з `@/style`; `DataUtils.fromHalfFloat` з `three`. `Eye`, `EyeOptions`, `createEye`, `lumaFromPixels` (з п'ятим параметром `cols`), `EYE_COLS`, `EYE_ROWS`, `Screen` (з `luma`), `createScreen` — див. Спільний договір.
- Дає: `EYE_SAMPLES = 4`; `autoExposure(meanY: number): number`; `lumaAround(luma: Uint8Array, col: number, row: number, cols = 128): { luma: number; around: number }` — комірка й середнє її сусідів у межах кадру (до восьми); уніформи матеріалу екрана `tLuma`, `uPower`.

- [ ] **Крок 1. Написати тести ока й екрана**
  ```ts
  // eye.test.ts — fake(o?: { half?: boolean; dt?: number; boom?: boolean; fill?: number; badRead?: boolean }) → { ctx, r, log, hidden, tracked, during, read }
  //   r: capabilities.textureTypeReadable = () => o.half ?? true · shadowMap.autoUpdate = true · info.render.calls = 0 · getActiveCubeFace = getActiveMipmapLevel = () => 0
  //      get/setRenderTarget ведуть r.target (спочатку MAIN) і пишуть у log 'target:eye' | 'target:main'
  //      clear → 'clear' · render → 'render', calls += 7, знімок during = { autoUpdate, hidden: […visible], rim }, за o.boom кидає Error('boom')
  //      readRenderTargetPixels(…, buf) → 'read', buf.fill(o.fill ?? 0), read.buf = buf; за o.badRead перше читання в Uint16Array лишає помилку GL
  //      getContext() → { NO_ERROR: 0, getError() } — віддає 1282 один раз після такого читання, інакше 0
  //   ctx: { renderer: r, scene: new Scene(), clock: { dt: o.dt ?? 1 / 60 }, track: (x) => (tracked.push(x), x),
  //          env: { rig: { rimColor: new Color(1, 0, 0), rimDir: new Vector3(0, 1, 0), lookScale: 2 } } } as unknown as ChapterContext
  //   hidden: [Object3D (visible), Object3D (visible = false)]
  it('стан після capture — як до нього', () => {
    const f = fake(); const rim = kGlobals.uKRimColor.value.clone();
    createEye(f.ctx, { hide: () => f.hidden }).capture();
    expect(f.r.target).toBe(MAIN); expect(f.r.shadowMap.autoUpdate).toBe(true);
    expect(f.hidden.map((o) => o.visible)).toEqual([true, false]);
    expect(kGlobals.uKRimColor.value.equals(rim)).toBe(true); expect(kGlobals.uKLookScale.value).toBe(1); });
  it('…і тоді, коли render кидає виняток', () => { /* fake({ boom: true }); expect(() => eye.capture()).toThrow('boom'); далі ті самі чотири перевірки */ });
  it('один прохід: один clear, один render, одне читання', () => {
    const f = fake(); const eye = createEye(f.ctx, { hide: () => f.hidden }); eye.capture();
    expect(f.log).toEqual(['target:eye', 'clear', 'render', 'read', 'target:main']);
    expect(f.during.hidden).toEqual([false, false]); expect(f.during.rim.equals(new Color(1, 0, 0))).toBe(true);
    expect([eye.passes, eye.lastCalls]).toEqual([1, 7]); expect(eye.lastMs).toBeGreaterThanOrEqual(0); });
  it('capture: середнє → витримка → яскравість, той самий масив', () => {
    const f = fake({ fill: 15360 }); const eye = createEye(f.ctx); const a = eye.capture();      // усі канали 1,0: середнє 1 → витримка 0,5 → 0,5^(1/2,2)·255
    expect(a.length).toBe(12288); expect(a.every((v) => v === 186)).toBe(true); expect(eye.capture()).toBe(a); });
  it('тіні: живий кадр бере готову карту, зупинений оновлює її сам', () => { const live = fake({ dt: 1 / 60 }); createEye(live.ctx).capture(); expect(live.during.autoUpdate).toBe(false);
    const held = fake({ dt: 0 }); createEye(held.ctx).capture(); expect(held.during.autoUpdate).toBe(true); });
  it('запасний формат', () => {
    const a = fake({ half: false }); const eye = createEye(a.ctx); eye.capture();
    expect(eye.format).toBe('byte'); expect(a.read.buf).toBeInstanceOf(Uint8Array); expect(a.read.buf.length).toBe(49152);
    const b = fake(); const half = createEye(b.ctx); half.capture();
    expect(half.format).toBe('half'); expect(b.read.buf).toBeInstanceOf(Uint16Array); expect(b.tracked[0].samples).toBe(EYE_SAMPLES);
    const c = fake({ badRead: true }); const bad = createEye(c.ctx); bad.capture();               // пристрій обіцяв читання половинної точності й відмовив
    expect(bad.format).toBe('byte'); expect(c.read.buf).toBeInstanceOf(Uint8Array); expect(c.tracked).toHaveLength(2); });
  it('lumaFromPixels: рядки перевернуто, витримка, гама', () => {
    const out = new Uint8Array(4);                 // у GL рядок 0 — нижній: [білий, чорний]; верхній: [сірий, червоний]
    const bytes = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255, 255, 0, 0, 255]);
    lumaFromPixels(bytes, 'byte', 1, out, 2); expect([...out]).toEqual([186, 126, 255, 0]);
    lumaFromPixels(bytes, 'byte', 2, out, 2); expect([...out]).toEqual([255, 173, 255, 0]);
    const H1 = 15360, H05 = 14336, H2 = 16384;     // 1.0, 0.5 і 2.0 у половинній точності
    const half = new Uint16Array([H1, H1, H1, H1, 0, 0, 0, H1, H05, H05, H05, H1, H2, 0, 0, H1]);
    lumaFromPixels(half, 'half', 1, out, 2); expect([...out]).toEqual([186, 173, 255, 0]);
    lumaFromPixels(half, 'half', 0.5, out, 2); expect([...out]).toEqual([136, 126, 186, 0]); });
  it('autoExposure', () => { expect(autoExposure(0.45)).toBeCloseTo(1, 9); expect(autoExposure(0.09)).toBeCloseTo(5, 9); expect(autoExposure(0.001)).toBe(8); expect(autoExposure(2)).toBe(0.5); });
  it('lumaAround: комірка й середнє сусідів', () => {
    const l = new Uint8Array(12288).fill(10); l[5 * 128 + 7] = 250;
    expect(lumaAround(l, 7, 5)).toEqual({ luma: 250, around: 10 }); expect(lumaAround(l, 6, 5)).toEqual({ luma: 10, around: 40 });   // (7·10 + 250) / 8
    expect(lumaAround(l, 0, 0)).toEqual({ luma: 10, around: 10 }); });                                                             // у кутку сусідів три
  it('project', () => { const eye = createEye(fake().ctx);                                      // камера в нулі, дивиться вздовж −Z, 40° на 4 : 3
    expect(eye.project(new Vector3(0, 0, -10))).toEqual({ col: 64, row: 48 }); expect(eye.project(new Vector3(-1, 1, -10))).toEqual({ col: 50, row: 34 });
    expect(eye.project(new Vector3(0, 0, 10))).toBeNull(); expect(eye.project(new Vector3(100, 0, -10))).toBeNull(); });
  it('dispose звільняє текстуру', () => { /* слухач 'dispose' на tracked[0] (WebGLRenderTarget) спрацював рівно раз */ });

  // screen.test.ts
  const s = createScreen({ width: 0.32, height: 0.24 });
  const u = (s.object.material as ShaderMaterial).uniforms; const tex = u.tLuma!.value as DataTexture;
  it('текстура: 128 × 96, один канал; збільшення — найближчий сусід, зменшення — мип-рівні; без колірного простору', () => {
    expect([tex.image.width, tex.image.height, tex.format, tex.type]).toEqual([128, 96, RedFormat, UnsignedByteType]);
    expect([tex.magFilter, tex.minFilter, tex.generateMipmaps, tex.mipmapsAutoUpdate, tex.colorSpace]).toEqual([NearestFilter, LinearMipmapLinearFilter, true, true, NoColorSpace]);
    expect((s.object.geometry as PlaneGeometry).parameters).toMatchObject({ width: 0.32, height: 0.24 }); });
  it('текстура оновлюється лише в show', () => {
    const v = tex.version; s.power = 0.3; expect(u.uPower!.value).toBe(0.3); expect(tex.version).toBe(v);
    s.show(new Uint8Array(128 * 96).fill(200)); expect(tex.version).toBe(v + 1); expect(tex.image.data![0]).toBe(200);
    expect(s.luma).toBe(tex.image.data); expect(s.luma).toHaveLength(12288); expect(s.luma[0]).toBe(200); });   // luma — дані текстури, не копія
  ```
- [ ] **Крок 2. Побачити, що тести падають** — `cd app && pnpm test src/volumes/radio/shared/screen` → `Error: Cannot find module '../eye' imported from …/eye.test.ts`, `Test Files  2 failed (2)`.
- [ ] **Крок 3. Написати `eye.ts`**
  - Ціль: `ctx.track(new WebGLRenderTarget(128, 96, { type, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true, generateMipmaps: false, samples: EYE_SAMPLES }))`. `type` — `HalfFloatType`, якщо `ctx.renderer.capabilities.textureTypeReadable(HalfFloatType)`, інакше `UnsignedByteType`; звідси `format`. Чотири проби на комірку (рішення плану): комірка усереднює свою площу, як комірка справжньої пластинки, і дрібні деталі не миготять. Буфер читання (`Uint16Array(49152)` або `Uint8Array(49152)`) і масив яскравості створюються один раз.
  - Відмова читання (рішення плану): three вважає половинну точність читаною, щойно є розширення буфера з плаваючою комою (`WebGLCapabilities.js:40-52`), а пристрій може відмовити. Тому перший прохід у форматі `'half'` обгорнуто: `gl.getError()` перед читанням (спорожнити) і після; якщо після — не `gl.NO_ERROR`, стару ціль звільнити, створити ціль `UnsignedByteType` (теж через `ctx.track`), `format = 'byte'`, прохід повторити. `gl` — `ctx.renderer.getContext()`.
  - Камера: `new PerspectiveCamera(opts.fov ?? 40, 4 / 3, 0.1, 200)` (40° — рішення плану). Шари типові, тож підписів шару `OVERLAY_LAYER` око не бачить само; `hide()` — для речей світового шару.
  - `capture()`, порядок: зберегти (`getRenderTarget()`, `getActiveCubeFace()`, `getActiveMipmapLevel()`, `shadowMap.autoUpdate`, `visible` кожного об'єкта з `hide()`, копії `kGlobals.uKRimColor`, `uKRimDir`, значення `uKLookScale`) → у `try`: якщо `ctx.clock.dt > 0`, то `shadowMap.autoUpdate = false` → сховати → записати в `kGlobals` риг світу з `ctx.env.rig` (`rimDir` нормувати, `lookScale ?? 1`) → `setRenderTarget(ціль)` → `clear(true, true, true)` → рівно один `renderer.render(ctx.scene, camera)` → `readRenderTargetPixels(ціль, 0, 0, 128, 96, буфер)` → у `finally`: відновити все збережене. Лічильник малювань — різниця `renderer.info.render.calls` довкола `render`; час — `performance.now()` довкола всього проходу (лише для звіту).
  - Тіні на зупиненому кадрі (рішення плану): під `?freeze=N` рушій робить `N × 60` оновлень без малювання (`engine/app.ts:478-484`; пісочниця бере `freeze: 1` — 60 оновлень), і карта тіней на зупиненому кадрі застаріла. Тому за `dt === 0` прохід лишає `autoUpdate` як є й перемальовує карту сам; на живому кадрі бере карту попереднього кадру.
  - Яскравість: середнє лінійне `Y` кадру → `autoExposure` = `0.45 / max(meanY, 0.02)`, затиснуте в 0,5…8, щоразу заново → `lumaFromPixels`. `lumaFromPixels`: `Y = 0.2126 R + 0.7152 G + 0.0722 B` з лінійних значень (`'half'` — через `DataUtils.fromHalfFloat`, `'byte'` — `/ 255`), `× exposure`, затиснути в 0…1, `^(1 / 2.2)`, `Math.round(× 255)`; `cols` типово 128, `rows = out.length / cols`; рядок `r` джерела йде в рядок `rows − 1 − r` виходу.
  - `project(world)`: `camera.updateMatrixWorld()`, `world.clone().project(camera)`; `null`, якщо `|x| > 1`, `|y| > 1` або `z` поза −1…1; інакше `col = min(127, floor((x + 1) / 2 · 128))`, `row = min(95, floor((1 − y) / 2 · 96))`.
- [ ] **Крок 4. Написати `screen.ts`**
  `PlaneGeometry(width, height)` + `ShaderMaterial` з уніформами `tLuma` (`DataTexture(new Uint8Array(12288), 128, 96, RedFormat, UnsignedByteType)`; `magFilter = NearestFilter`, `minFilter = LinearMipmapLinearFilter`, `generateMipmaps = true` — усі три ставить `createScreen` до першого малювання: three 0.187 виділяє рівні текстури (`texStorage2D`, `R8`, 8 рівнів для 128 × 96) лише під час першого завантаження, тож пізніше ввімкнені мип-рівні вже не з'являться; `colorSpace` не задаємо — типовий `NoColorSpace`; `VISUAL.md` §5) і `uPower` (початково 0). Фрагмент: `float v = texture2D(tLuma, vec2(vUv.x, 1.0 - vUv.y)).r; gl_FragColor = vec4(vec3(0.015 + 0.985 * uPower * pow(v, 2.2)), 1.0);` — рядок 0 зверху, біле рівно 1,0 (не світиться), темне скло 0,015 (рішення плану). `show(luma)` копіює дані й ставить `needsUpdate` — і більше нічого: під час кожного завантаження three сам перебудовує мип-рівні (`texSubImage2D` рівня 0, потім `generateMipmap`, бо `mipmapsAutoUpdate` лишається типовим `true`); більше ніде `needsUpdate` не чіпаємо. `luma` — масив даних текстури `tLuma` (той самий `Uint8Array`, не копія). `dispose()` звільняє геометрію, матеріал і текстуру.
- [ ] **Крок 5. Побачити, що тести проходять** — `cd app && pnpm test src/volumes/radio/shared/screen` → `Test Files  2 passed (2)`, `Tests  13 passed (13)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 6. Коміт** — `git add app/src/volumes/radio/shared/screen/{eye,screen,index}.ts app/src/volumes/radio/shared/screen/__tests__/{eye,screen}.test.ts` · `git commit -m "Око камери окремим проходом і екран монітора"`

### Завдання B1b. Пісочниця ока й рішення про додатковий прохід

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts`, `…/scene.ts`, `…/qa/measure.mjs`
- Створити: `docs/volumes/radio/reports/batch2-model.md` (заголовок і розділ «1. Око камери»; далі файл доповнюють B9c, B10, B13, B16, B17)
- Тест: `…/qa/measure.mjs`, розділ `eye` (Блок Q з `--only eye`)

**Інтерфейси:**
- Бере: `createEye`, `createScreen`, `lumaAround` (B1a); `island`, `house`, `fence`, `streetLamp`, `Builder` з `@/kit`; `LOOK_SCALE`, `col` з `@/style`; `launch`, `appUrl`, `appErrors`, `decodePng`, `hueFamilies`, `screenshot` з `tools/qa/lib.mjs`.
- Дає: главу `_dev/_sandbox-radio-link` з таблицею `SANDBOX` (назви кроків і підписи) і кроками `eye`, `far`; скрипт `qa/measure.mjs` з помічниками `held(page)` — один зупинений кадр (`__app.step(1 / 60, 0)`) — і `lumaDiff(a, b)` — скільки комірок двох кадрів `radio-luma` різняться більш як на 2 рівні; читачі `radio-eye` → `{ on, format, passes, lastMs, lastCalls, lumaMin, lumaMax, seen }` (`seen` — запис «назва мітки → `{ cell, luma, around }`»: `cell = eye.project(точка)`, решта — `lumaAround` у цій комірці) і `radio-luma` → `Array.from(кадр ока)`; точки `eye:light-on-screen`, `eye:dark-on-screen`; рішення про прохід у звіті.

- [ ] **Крок 1. Написати перевірку пісочниці `qa/measure.mjs` (розділ `eye`)**
  Зразок — `app/src/volumes/circuit/chapters/prologue/qa/{helpers,interactions}.mjs`; імпорт `../../../../../../../tools/qa/lib.mjs`; перший рядок `/* global process, console, window, document, requestAnimationFrame */`. Аргументи: `--port | --base`, `--out <каталог>` (обов'язковий), `--only <розділ,…>` (типово всі), `--size` (типово `1280x720`), `--touch` (тоді `launch({ dpr: 3, touch: true })` і `q: 'auto'`). Числа пише в `<out>/measure.json`, останній рядок — `PASS sandbox-radio-link — <n> checks` (код 0) або `FAIL <k> of <n>` (код 1). Кожен розділ починає з перевірки `opened` і без неї далі не йде. Розділ `eye` відкриває три сторінки: **З** — `appUrl(base, { route: '_dev/_sandbox-radio-link/eye', freeze: 1 })`; **Д** — те саме з кроком `far`; **Ж** — крок `eye` без `freeze` (живий годинник):

  | Перевірка | Сторінка | Умова |
  |---|---|---|
  | `opened` | З, Д | `__app.position()` → `chapterId === '_sandbox-radio-link'`, `stepId === 'eye'` (на Д — `'far'`) |
  | `passes` | З | після `__app.step(1 / 60, 30)`: `radio-eye.passes > 0` |
  | `picture` | З | `lumaMax − lumaMin ≥ 40` (кадр не однорідний) |
  | `orientation` | З | `seen.light.cell` і `seen.dark.cell` не `null`; `seen.light.luma − seen.dark.luma ≥ 100` — прочитаний кадр лежить так, як рахує `project` |
  | `screen` | З | знімок PNG → `decodePng`; обидві точки `__app.locate('eye:…-on-screen')` мають `visible`; середнє R, G, B пікселя в точці `light` щонайменше на 60 більше, ніж у точці `dark` — екран не перевернуто й не віддзеркалено |
  | `shots` | З, Д | `lumaDiff(radio-luma на З, radio-luma на Д) ≤ 12` — картинка ока не залежить від камери режисера |
  | `drawCalls` | З | `__app.stats().drawCalls` однаковий з оком і без (`__ui.set('eye', false, true)`, `held`) — прохід не потрапляє в лічильник рушія (П9) |
  | `budget` | Ж | `liveMs < 0.25 × intervalOff`: `liveMs` — середній `lastMs` за 20 кадрів (чекати через `requestAnimationFrame`; `__app.step` тут не кликати: він зупиняє годинник); `intervalOff` — `stats().intervalAvg` за 60 кадрів без ока після `resetStats()` |
  | `leaks` | З | три рази `goto('_sandbox-ui')` і назад: `geometries`, `textures`, `programs` зі `stats()` після третього повернення не більші, ніж після першого |
  | `console` | усі | `appErrors(page)` порожній |

  Ворота міряємо на живій сторінці, бо на зупиненій кожен прохід ще й перемальовує карту тіней (B1a, крок 3), а живий кадр цього не робить. Ціну зупиненого проходу пишемо поруч як `heldMs` (середній `lastMs` за 20 кадрів `held` на сторінці З) — це число для звіту, не ворота. Зберігає `<out>/eye-1280x720.jpg`.
- [ ] **Крок 2. Запустити й побачити, що перевірка падає** — Блок Q з `--only eye` → `FAIL … opened` (глави ще немає), `FAIL 1 of 1`, код 1.
- [ ] **Крок 3. Написати главу-пісочницю**
  `index.ts`: `defineChapter({ id: '_sandbox-radio-link', order: 9020, group: 'em', axisLabel: '10¹ m', axisValue: 1, theme: { accent: 'sky', sky: 'dusk', mood: 'diorama' }, dev: true, load: () => import('./scene'), … })`; назви кроків і всі підписи — у `export const SANDBOX = { steps: { eye: { title, blurb }, far: { title, blurb } }, labels: { eye: 'Око камери' } } as const` у цьому ж файлі, як у `_sandbox-circuit-crawl` (сцена українських слів не містить). `scene.ts`:
  - Сцена: `island({ radius: 14 })`, `house()`, `fence({ kind: 'picket', route: [[-6, 4], [6, 4]] })`, `streetLamp({ kind: 'park' })` з `@/kit`; дві мітки — куби 0,6 м (`Builder`, `box`): `light` — `col('white')` у `[-1.2, 1.2, 5.5]`, `dark` — `col('ink')` у `[1.2, 1.2, 5.5]`. Вони стоять дзеркально відносно ока: перевернутий чи віддзеркалений кадр міняє їх місцями або зводить різницю до нуля.
  - Середовище: `ctx.env.setScale(14, { adaptFrom: LOOK_SCALE.diorama })`; `ctx.env.base({ motes: 0 })`; `ctx.post.base({ grain: 0 })`. Порошинки рушія вимкнено, бо вони рояться довкола цілі камери режисера й мають розмір із висоти головного кадру (`style/env/environment.ts:333-337`, `shaders.ts:185-201`): в оці це були б великі плями, що залежать від погляду читача.
  - Око в `[0, 2.6, 9]` дивиться на `[0, 1, 0]`; екран 1,6 × 1,2 м у `[4.5, 2.2, 5]`, `power = 1`, він же — єдиний об'єкт у `hide()`. Перемикач `eye` (типово ввімкнено): поки ввімкнений, кожне оновлення (і з `dt === 0`) робить `screen.show(eye.capture())`.
  - Кроки `eye` і `far` — та сама сцена й стан; ракурси `eye` (сцена й екран у кадрі) і `far` (з іншого боку й далі), обидва з `fit`.
  - Читачі з розділу «Дає»; `seen` — для міток `light` і `dark`. Точки `ctx.qa.probe('eye:<мітка>-on-screen', () => …)`: місце комірки `seen.<мітка>.cell` на плаваючому екрані — місцеві `x = ((col + 0.5) / 128 − 0.5) · 1.6`, `y = (0.5 − (row + 0.5) / 96) · 1.2`, далі `screen.object.localToWorld`.
- [ ] **Крок 4. Запустити перевірку й переглянути знімок**
  Блок Q з `--only eye` → `PASS sandbox-radio-link — 10 checks`. На `eye-1280x720.jpg` людина або агент-читач шукає: (1) на плаваючому екрані — будинок, паркан і два куби з місця ока, білий ліворуч, темний праворуч, як у сцені; (2) комірки з різкими краями, без розмиття — ракурс `eye` тримає плаваючий екран вищим за 96 px (менший екран мип-рівні згладжують, `VISUAL.md` §5); (3) екран сірий, без кольору; (4) білий куб на екрані не дає ореолу; (5) самого екрана на його картинці немає; (6) на екрані немає світлих плям, яких немає в сцені.
- [ ] **Крок 5. Записати числа й рішення**
  У `docs/volumes/radio/reports/batch2-model.md`: заголовок «Черга 2 — модель і світ: числа», розділ «1. Око камери» з таблицею з `measure.json` (рядок `gpu.renderer`, розмір, `format`, `EYE_SAMPLES`, `liveMs`, `heldMs`, `lastCalls`, `intervalOff`, `drawCalls`), рядком про порошинки (том їх вимикає — причина з кроку 3; купол неба від камери режисера не залежить: `uViewDir` працює лише в наборах `space` і `studio`, `style/env/shaders.ts:84-99`) і рядком «Рішення: прохід лишається». **Ворота:** якщо `budget` не проходить — поставити `EYE_SAMPLES = 0`, повторити й записати обидва `liveMs`; якщо `budget` не проходить і так або не проходить `passes` — зупинитися й не починати B11–B16: запасний шлях проєкту (малий малювальник на процесорі, проєкт III §4) потребує нового плану.
- [ ] **Крок 6. Коміт** — `git add app/src/volumes/_dev/chapters/_sandbox-radio-link/{index.ts,scene.ts,qa/measure.mjs} docs/volumes/radio/reports/batch2-model.md` (і `app/src/volumes/radio/shared/screen/eye.ts`, якщо змінено `EYE_SAMPLES`) · `git commit -m "Пісочниця лінії: око камери в браузері, виміри проходу й рішення"`

### Завдання B11. Зв'язок із моделлю: `shared/link`

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `app/src/volumes/radio/shared/link/protocol.ts`, `…/link/handler.ts`, `…/link/model.worker.ts`, `…/link/index.ts`
- Тест: `app/src/volumes/radio/shared/link/__tests__/handler.test.ts`, `…/__tests__/link.test.ts`

**Інтерфейси:**
- Бере: `createFmLink`, `DEFAULT_STATE` і типи моделі з `@radio/sim/core` (B9b); `ctx.clock.time`, `ctx.onDispose`; типи повідомлень, `createHandler`, `WorkerLike`, `LinkOptions`, `Link`, `createLink`, `LINK_SYNC_EVERY`, `LINK_MAX_FPS` — див. Спільний договір.
- Дає: поведінку, яку нижче фіксують тести: один запит у дорозі, найсвіжіший стан, не частіше за 25 запитів на секунду, одноразовий перехід на синхронний шлях, одна помилка в консолі за життя лінії, `still` на окремому екземплярі моделі.

- [ ] **Крок 1. Написати `protocol.ts` і тест обробника**
  `protocol.ts` — типи зі Спільного договору дослівно. `handler.test.ts` (`LUMA = Uint8Array.from({ length: 12288 }, (_, i) => (i * 7) % 256)`; `frame(kind, seq)` будує `{ type: 'frame', request: { seq, kind, state: structuredClone(DEFAULT_STATE), luma: LUMA.slice(), probe: null } }`):

  ```ts
  it('init → ready', () => expect(createHandler(() => 0).handle({ type: 'init', seed: 7 })).toEqual({ reply: { type: 'ready' }, transfer: [] }));
  it('frame → той самий кадр, що дає createFmLink(seed).step', () => { const h = ready(7); const ref = createFmLink(7);
    for (let seq = 1; seq <= 3; seq++) { const r = replyOf(h.handle(frame('step', seq))); const want = ref.step(DEFAULT_STATE, LUMA);
      expect(r.seq).toBe(seq); expect(r.screen).toEqual(want.screen); expect(r.meters).toEqual(want.meters); } });
  it('still → той самий кадр, що дає createFmLink(seed).still', () => { /* після двох step; порівняти screen */ });
  it('відповідь несе власні буфери, і вони в transfer', () => { const h = ready(7); const out = h.handle(frame('step', 1))!; const first = replyOf(out); const copy = first.screen.slice();
    expect(out.transfer).toContain(first.screen.buffer); h.handle(frame('step', 2)); expect(first.screen).toEqual(copy); });
  it('ms — різниця показів годинника', () => { /* now() дає 10, потім 35 → reply.ms === 25 */ });
  it('frame до init → error', () => expect(createHandler(() => 0).handle(frame('step', 1))).toEqual({ reply: { type: 'error', message: 'link: frame before init' }, transfer: [] }));
  ```
- [ ] **Крок 2. Побачити, що тест падає** — `cd app && pnpm test src/volumes/radio/shared/link` → `Cannot find module '../handler'`.
- [ ] **Крок 3. Написати `handler.ts`**
  `init` створює `createFmLink(seed)` (повторний — замінює). `frame` кличе `step` або `still` за `request.kind`, `ms = now() після − now() до`; `screen` і масиви `probe` (`lo`, `hi`, `bins`, `points`) копіює в нові буфери, бо масиви моделі живуть лише до наступного виклику; ці буфери й складають `transfer`; `meters` — копія об'єкта. Повідомлення `reset` договір не має: модель із початку — це повторний `init` з тим самим зерном або новий `createLink`. `frame` до `init` і будь-який виняток моделі дають `{ type: 'error', message }`, а не виняток назовні.
- [ ] **Крок 4. Побачити, що тест проходить** — та сама команда → `Tests  6 passed (6)`.
- [ ] **Крок 5. Написати тест лінії**
  ```ts
  // link.test.ts — class FakeWorker implements WorkerLike: posted: { msg, transfer }[]; terminated = 0;
  //   frames() — лише повідомлення 'frame'; emit(data: FromWorker) кличе onmessage; answer(i) рахує відповідь на i-й запит справжнім createHandler
  // ctx = { clock: { time: 0 }, onDispose: (fn) => disposers.push(fn) } as unknown as ChapterContext; tick() — ctx.clock.time = ++k / 60
  // at(route) — DEFAULT_STATE з air.route = route; pumpAt(r) = (tick(), link.pump(at(r), luma, null)); luma = () => LUMA; err — vi.spyOn(console, 'error') без виводу
  it('один запит у дорозі; після перерви — один кадр і один запит', () => {
    const w = new FakeWorker(); let taken = 0; const luma = () => (taken++, LUMA);
    const link = createLink(ctx, { seed: 7, makeWorker: () => w });
    expect(link.mode).toBe('worker'); expect(pumpAt(0)).toBe(false); expect(w.frames()).toHaveLength(0);   // ще не 'ready'
    w.emit({ type: 'ready' });
    for (let i = 0; i < 10; i++) pumpAt(i % 5);
    expect(w.frames()).toHaveLength(1); expect(taken).toBe(1); expect(w.frames()[0].msg.request.state.air.route).toBe(0);
    w.answer(0);
    expect(pumpAt(4)).toBe(true);                                          // прийшов кадр — і пішов запит із НАЙСВІЖІШИМ станом
    expect(w.frames()).toHaveLength(2); expect(w.frames()[1].msg.request.state.air.route).toBe(4); expect(link.frames).toBe(1);
    w.answer(1);                                                           // вкладку сховали: відповідь прийшла, pump не було, час рушія стояв
    expect(link.pump(at(2), luma, null)).toBe(true); expect(link.pump(at(2), luma, null)).toBe(false);
    for (let i = 0; i < 5; i++) pumpAt(2); expect(w.frames()).toHaveLength(3); expect(link.frames).toBe(2); });
  it('кадр камери копіюється й передається', () => { /* після ready і одного pump: */ const sent = w.frames()[0];
    expect(sent.msg.request.luma).not.toBe(LUMA); expect(sent.msg.request.luma).toEqual(LUMA); expect(sent.transfer).toEqual([sent.msg.request.luma.buffer]); });
  it('не частіше за 25 запитів на секунду часу рушія', () => { /* ready; 60 разів pumpAt(1), на кожен новий запит одразу w.answer */ expect(w.frames()).toHaveLength(20); });
  it('падіння потоку → синхронний шлях', () => {
    /* ready, один pump у дорозі */ w.onerror?.(new Error('x')); w.emit({ type: 'error', message: 'y' });
    expect(link.mode).toBe('sync'); expect(w.terminated).toBe(1); expect(err).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 6; i++) pumpAt(1); expect(link.frames).toBe(1); expect(link.frame!.screen).toEqual(createFmLink(7).step(at(1), LUMA).screen); });
  it('конструктор потоку кидає → синхронний шлях', () => { const link = createLink(ctx, { seed: 7, makeWorker: () => { throw new Error('x'); } });
    expect(link.mode).toBe('sync'); expect(err).toHaveBeenCalledTimes(1); for (let i = 0; i < 6; i++) pumpAt(1); expect(link.frames).toBe(1); });
  it('помилка моделі: одна помилка в консолі, останній добрий кадр лишається', () => {
    const link = createLink(ctx, { seed: 7, mode: 'sync' }); for (let i = 0; i < 6; i++) pumpAt(1); const good = link.frame;
    const bad = { ...at(1), monitor: null } as unknown as FmLinkState;       // step кидає виняток (договір: запасних значень немає), обробник віддає 'error'
    for (let i = 0; i < 18; i++) expect((tick(), link.pump(bad, luma, null))).toBe(false);
    expect(link.frame).toBe(good); expect(link.frames).toBe(1); expect(err).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 6; i++) pumpAt(1); expect(link.frames).toBe(2); });
  it('без Worker у середовищі — sync, без запису в консоль', () => { expect(createLink(ctx, { seed: 7 }).mode).toBe('sync'); expect(err).not.toHaveBeenCalled(); });
  it('sync: один кадр моделі на шість оновлень', () => { /* 12 pump: true рівно на 6-му й 12-му; frames === 2 */ });
  it('still дорівнює still моделі й не чіпає живу лінію', () => { /* sync; 6 pump → кадр A */ expect(link.still(at(3), LUMA, null).screen).toEqual(createFmLink(7).still(at(3), LUMA).screen);
    /* ще 6 pump → кадр B дорівнює другому кадрові createFmLink(7).step без жодного still між ними */ });
  it('fps — кадри моделі за секунду часу рушія; нульовий проміжок не ділить на нуль', () => {
    /* запит у час 0; відповіді приходять у час 0,05, 0,05 і 0,15 с */ expect(link.fps).toBeCloseTo(2, 9);   // другий кадр пропущено, третій: 0 + 0,2 · (10 − 0)
    /* нова лінія: 30 відповідей через кожні 0,1 с */ expect(link.fps).toBeGreaterThan(9.5); expect(link.fps).toBeLessThan(10.5); });
  it('dispose зупиняє потік', () => {
    /* ready, pump */ link.dispose(); link.dispose(); expect(w.terminated).toBe(1);
    const n = w.posted.length; expect(pumpAt(0)).toBe(false); expect(w.posted.length).toBe(n);
    w.answer(0); expect(link.frames).toBe(0); });                          // запізніла відповідь нічого не міняє
  ```
- [ ] **Крок 6. Побачити, що тест падає** — та сама команда → `Cannot find module '..'` (тест імпортує `createLink` з `'..'`).
- [ ] **Крок 7. Написати `index.ts` і `model.worker.ts`**
  - Режим: `'worker'`, якщо `opts.mode !== 'sync'` і є `opts.makeWorker` або `typeof Worker !== 'undefined'`; інакше `'sync'`. Потік створюємо в `try`: `opts.makeWorker?.() ?? (new Worker(new URL('./model.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike)`. Приведення типу навмисне: `Worker` із DOM не присвоюється `WorkerLike` (його `onmessage` чекає `MessageEvent`, `tsc` дає TS2322); дослівний `new Worker(new URL(…, import.meta.url), …)` лишаємо, бо саме його впізнає Vite (факти: `sim-worker-lint.md` §4.2); `vite.config.ts` не міняємо. Одразу `{ type: 'init', seed }` (типове зерно 1); запити йдуть лише після `'ready'`.
  - `pump`: після `dispose` — `false`. У режимі потоку запит іде, коли немає запиту в дорозі, `'ready'` вже було і від попереднього запиту минуло щонайменше `1 / LINK_MAX_FPS` с часу рушія (допуск 1e-6; перший запит — одразу): `seq++`, `luma: new Uint8Array(luma())` з передачею буфера. Межа тримає блокувальне читання кадру ока не частішим за 25 разів на секунду й на швидкій машині. Повертає `true` рівно один раз на кожен кадр, що прийшов від попереднього виклику. Відповідь зі старим `seq`, після `dispose` чи після переходу на `sync` ігнорується.
  - Синхронний шлях: власний `createHandler(() => performance.now())` з тим самим зерном; модель рахується на кожному шостому `pump` (`LINK_SYNC_EVERY`), решта повертає `false`.
  - Падіння потоку: `worker.onerror`, повідомлення `'error'` або виняток конструктора → `console.error('[radio/link] worker failed, switching to the main thread: <текст>')`, `terminate()` (якщо потік є), режим `'sync'` назавжди. Те, що `Worker` немає, — не помилка: без запису в консоль (`console.warn` і `console.error` валять `chapter-check`).
  - Помилка моделі на синхронному шляху (обробник повернув `'error'`): `frame` лишається останнім добрим, `pump` повертає `false`, наступна спроба — за шість оновлень; у консоль — `console.error('[radio/link] model failed: <текст>')`. Лінія кличе `console.error` щонайбільше раз за життя: після падіння потоку помилки моделі вже мовчать (Review Focus 2: одна помилка, а не потік).
  - `fps`: коли приходить кадр і `Δt = ctx.clock.time − часПопереднього > 0`, то `fps += 0.2 · (1 / Δt − fps)` і час запам'ятовується; за `Δt = 0` (годинник стоїть, перший кадр після повернення на вкладку) кадр пропускаємо; перший кадр лише запам'ятовує час.
  - `still`: окремий екземпляр `createFmLink(seed)`, створений при першому виклику; відповідь із `seq: -1` і `ms`; `frame` і `frames` не змінює.
  - `dispose` — ідемпотентний; `createLink` сам реєструє його в `ctx.onDispose` (П12).
  - `model.worker.ts` цілком:

    ```ts
    /// <reference lib="webworker" />
    import { createHandler } from './handler';
    import type { ToWorker } from './protocol';
    declare const self: DedicatedWorkerGlobalScope;
    const handler = createHandler(() => performance.now());
    self.onmessage = (e: MessageEvent<ToWorker>) => {
      const out = handler.handle(e.data);
      if (out) self.postMessage(out.reply, { transfer: out.transfer });
    };
    ```
- [ ] **Крок 8. Побачити, що все проходить** — `cd app && pnpm test src/volumes/radio/shared/link` → `Test Files  2 passed (2)`, `Tests  17 passed (17)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 9. Коміт** — `git add app/src/volumes/radio/shared/link/{protocol,handler,model.worker,index}.ts app/src/volumes/radio/shared/link/__tests__/{handler,link}.test.ts` · `git commit -m "Зв'язок сцени з моделлю: фоновий потік, один запит у дорозі, синхронний запасний шлях"`

### Завдання B12. Предмети світу: `shared/models`

**Виконавець:** Fable 5.2 — це візуальна мова тому.

**Файли:**
- Створити: `app/src/volumes/radio/shared/models/{camera,pole,monitor,wicket,fence,kitchen,shed,garage,swing,bicycle,cat,tray,phone,house,index}.ts`
- Тест: `app/src/volumes/radio/shared/models/__tests__/models.test.ts`
- Змінити: `app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts`, `…/scene.ts` (крок `props`), `…/qa/measure.mjs` (розділ `props`)

**Інтерфейси:**
- Бере: `Builder`, `G`, `KitModel`, `island`, `streetLamp`, `trees`, `addRouter` з `@/kit` (факти: `kit-fx-ui3d.md` §1.1); `K`, `col` з `@/style`; `Rng` з `@/engine/api`; кольори — `docs/volumes/radio/VISUAL.md` «Кольори зі змістом»; пісочницю й `measure.mjs` (B1b).
- Дає (усе — з `models/index.ts`; предмети не читають `sim/**`, місця їм дає план):

  ```ts
  export type V3 = readonly [number, number, number];
  export type P2 = readonly [number, number];                    // [x, z] сцени
  export type WallLook = 'brick' | 'wood' | 'glass' | 'slab' | 'iron' | 'white';   // перші п’ять — назви Material договору; 'white' — білі стіни сараю
  export interface WallPlan { id: string; a: P2; b: P2; y0: number; y1: number; look: WallLook; cut?: boolean; windows?: readonly { from: number; to: number; y0: number; y1: number }[] }   // windows: проріз зі склом; from…to — метри вздовж стіни від a
  export interface FenceRun {                                   // відрізок паркану одного вигляду
    route: readonly P2[]; height: number;                       // ламана [x, z] сцени, роги без заокруглень; висота, м
    picket: number; gap: number;                                // ширина штахети й проміжок уздовж паркану, м; gap 0 — глухий
    board: boolean;                                             // пласка верхня дошка (нею ходить кіт)
    open?: readonly (readonly [number, number])[];              // ділянки без паркану, м від початку route (хвіртка)
  }
  export interface YardPlan {
    radius: number; centre: P2; gravel: { a: P2; b: P2 }; fences: readonly FenceRun[]; trees: readonly P2[];   // centre — середина острова; gravel — два протилежні кути утоптаного гравію господарського двору ([x, z] сцени)
    house: { walls: readonly WallPlan[]; slabY: number; slabCut: { min: P2; max: P2 }; sill: V3; microwave: V3; phone: V3 };   // три точки — куди лягають однойменні якорі
    neighbour: { router: V3; yaw: number };                      // подвір’я ставить вікно сусіда якорем router у цю точку
    shed: { walls: readonly WallPlan[]; wall: V3; nook: V3; roofY: number };   // wall — точка якоря wall: середина білої стіни до камери; nook — точка темного закутка (якір nook): північної стіни над нею немає, задня й бічні стінки дровника зсередини — col('ink'); roofY — висота плаского даху з бляхи ('iron')
    garage: { walls: readonly WallPlan[]; gate: { hinge: P2; width: number; y0: number; y1: number; closedYaw: number; openYaw: number } };
  }
  export const MONITOR_SCREEN = { width: 0.32, height: 0.24 } as const;        // метри, 4 : 3
  export const MONITOR_ANTENNA: V3 = [0.17, 0.2, -0.05];                       // якір antenna відносно якоря screen, осі монітора
  export const MONITOR_CASE = { width: 0.40, height: 0.32, depth: 0.10 } as const;   // корпус довкола рамки MONITOR_SCREEN, рамка посередині
  export const CAMERA = { antennaUp: 0.2 } as const;                           // якір antenna над якорем lens, м
  export const CAT = { length: 0.45, spot: 0.06 } as const;                    // тіло без хвоста; біла цятка на лобі, м
  export const HOUSE_SKIRT = { width: 1.4, top: 0.03 } as const;              // вимощення дому: від зовнішнього лиця зовнішніх стін на width назовні, верх — на top над землею, м; width — із сітки острова (крок 5), VISUAL.md «Решта сцени»
  export type YardProps = Record<'island' | 'fence' | 'trees' | 'lantern' | 'pole' | 'camera1' | 'camera2' | 'monitor' | 'wicket'
    | 'shed' | 'garage' | 'swing' | 'bicycle' | 'cat' | 'tray' | 'phone' | 'house' | 'neighbour', KitModel>;
  export function buildYardProps(plan: YardPlan, rng: Rng): YardProps;         // будує кожен предмет один раз; розставляє їх mountYard
  export const SAMPLE_PLAN: YardPlan;                                          // для тестів і кроку props; справжній план дає layout.ts (B13); острів, гравій і стіни дому з висотами — числа VISUAL.md §2 в осях сцени (радіус 23, centre: [14, 1] — це toScene2([14, -1]), центр (14; −1) плану), slabCut — у дальній кімнаті: тести ями й вимощення міряють ту саму сітку острова, що на справжньому подвір’ї
  export function picketFence(runs: readonly FenceRun[]): KitModel;            // усі паркани плану однією моделлю (ключ fence)
  export function addKitchenBlock(b: Builder, o: { length: number }): void;   // кухонний блок тому в поточній рамці, по центру: x від −length/2 до +length/2, задня стінка на z = −0,30, лице на +0,30 (як addKitchen набору); піч на кінці −X
  ```

  | Файл | Функція | Якорі · частини | Розміри, м (рішення плану) | Межа, трикутників |
  |---|---|---|---|---|
  | `camera.ts` | `cameraModel(o?: { on?: boolean })` | `lens` (на передньому склі; локальна вісь −Z — куди дивиться), `antenna` (середина прутика), `cable` · частина `rod` (прутик зі стійкою, вісь X — в основі стійки; якір `antenna` — на ній) | корпус 0,09 × 0,09 × 0,18, початок моделі — середина задньої стінки корпусу; прутик 0,06 (проєкт II §7) на тонкій стійці від верху корпусу; `antenna` (середина прутика) вище за `lens` на `CAMERA.antennaUp` | 3 000 |
  | `pole.ts` | `pole(o?: { height?: number })` (типово 3,2) | `mount1`, `mount2` (на поверхні стовпа з боку +X, на 0,4 і 0,9 нижче верху) | товщина 0,09; початок — на землі на осі | 1 500 |
  | `monitor.ts` | `monitor()` | `screen` (центр рамки; +Z — назовні, +X — праворуч від глядача перед екраном), `antenna` (місце, де модель рахує поле) | корпус `MONITOR_CASE` довкола рамки `MONITOR_SCREEN`, рамка посередині (низ корпусу — на 0,16 нижче за `screen`); прутик 0,06 на верху корпусу, на ніжці 0,01 (низ прутика — на 0,17 над `screen`); `antenna` (середина прутика) − `screen` = `MONITOR_ANTENNA` | 3 000 |
  | `wicket.ts` | `wicket()` | `latch` · частина `leaf` (вісь Y на завісі) | стулка 1,0 × 1,8 у площині YZ, лицем до +X (як решта предметів, дивиться вздовж +X): завіса на z = +0,5, стулка йде від неї до −Z; початок моделі — середина низу стулки; штахетник 14 / 14 см, як західний паркан | 3 000 |
  | `fence.ts` | `picketFence(runs)` | — | кожен відрізок — з плану: висота, штахета й проміжок; `gap` 0 — суцільні дошки; `board` — дошка 0,10 завширшки по всій довжині, її верх — на `height`; дві поперечки; у ділянках `open` немає ні штахет, ні поперечок, ні дошки (там висить хвіртка); нічого не виходить за кінці `route` і вище за `height`; колір `white` | 40 000 |
  | `shed.ts` | `shed(plan: YardPlan['shed'])` | `wall` (у точці `plan.wall` — середина білої стіни до камери), `nook` (у точці `plan.nook` — темний закуток) | стіни з плану; отвір дровника — без північної стіни довкола `nook`; дах на `roofY` | 5 000 |
  | `garage.ts` | `garage(plan: YardPlan['garage'])` | `gate` · частина `gate` (вісь Y на `hinge`; у нульовому куті стулка лежить уздовж +X) | з плану | 8 000 |
  | `swing.ts`, `bicycle.ts` | `swing()`, `bicycle()` | частина `seat`; якір `lamp` | висота 2,2; довжина 1,7 | 3 000 і 8 000 |
  | `cat.ts` | `cat()` | `spot` · частини `head`, `tail`, `spot` | тіло `CAT.length`; цятка `CAT.spot` | 5 000 |
  | `tray.ts`, `phone.ts` | `tray()`, `phone()` | — | 0,40 × 0,02 × 0,30; 0,07 × 0,15 × 0,01 | 600 кожен |
  | `house.ts` | `house(plan: YardPlan['house'])`, `neighbourWindow()` | дім: `sill`, `microwave`, `phone` · частини `floor`, `cellarFloor`, `skirt`; сусід: `window`, `router` | стіни, `slabY`, `slabCut` — з плану; підлога кімнат від `slabY` до 0, підлога льоху — верхом на найнижчому `y0`, вимощення `HOUSE_SKIRT` (крок 4) | 60 000 і 4 000 |
  | `kitchen.ts` | `addKitchenBlock(b, { length })` | `microwave` (центр дверцят печі) | нижні шафи 0,60 завглибшки, стільниця на 0,86; піч 0,48 × 0,28 × 0,36 на кінці −X, дверцятами до +Z, центр дверцят — на 1,00 над підлогою; мийка й варильна поверхня — далі до +X; колір `steel` (`VISUAL.md` §4) | у межі `house` |

- [ ] **Крок 1. Написати тест**
  ```ts
  const props = buildYardProps(SAMPLE_PLAN, new Rng('models-test'));
  const BUDGET: Record<string, number> = { camera1: 3000, camera2: 3000, pole: 1500, monitor: 3000, wicket: 3000, fence: 40000, shed: 5000, garage: 8000,
    swing: 3000, bicycle: 8000, cat: 5000, tray: 600, phone: 600, house: 60000, neighbour: 4000 };
  const ANCHORS: Record<string, readonly string[]> = { camera1: ['lens', 'antenna', 'cable'], pole: ['mount1', 'mount2'], monitor: ['screen', 'antenna'], wicket: ['latch'],
    shed: ['wall', 'nook'], garage: ['gate'], bicycle: ['lamp'], cat: ['spot'], house: ['sill', 'microwave', 'phone'], neighbour: ['window', 'router'] };
  const PARTS: Record<string, readonly string[]> = { camera1: ['rod'], wicket: ['leaf'], garage: ['gate'], swing: ['seat'], cat: ['head', 'tail', 'spot'], house: ['floor', 'cellarFloor', 'skirt'] };
  it.each(Object.keys(BUDGET))('%s: якорі, частини, межа трикутників, матеріали', (name) => {
    const m = props[name as keyof YardProps];
    for (const a of ANCHORS[name] ?? []) expect(() => m.anchor(a)).not.toThrow();
    for (const p of PARTS[name] ?? []) expect(() => m.part(p)).not.toThrow();
    expect(m.triangles).toBeGreaterThan(0); expect(m.triangles).toBeLessThanOrEqual(BUDGET[name]);
    m.group.traverse((o) => { for (const mat of materialsOf(o)) expect('isMeshStandardMaterial' in mat).toBe(false); }); });   // materialsOf: матеріали Mesh масивом
  it('увесь двір — до 400 000 трикутників', () => expect(Object.values(props).reduce((s, m) => s + m.triangles, 0)).toBeLessThanOrEqual(400_000));
  it('об’єктив — найпередніша точка камери', () => { /* Box3 групи camera1: box.min.z ≥ anchorLocal('lens').z − 0.02 */ });
  it('екран монітора 4 : 3', () => expect(MONITOR_SCREEN.width / MONITOR_SCREEN.height).toBeCloseTo(4 / 3, 9));
  it('розміри, на які спираються кадр камери й модель', () => {
    const size = (o: Object3D) => new Box3().setFromObject(o).getSize(new Vector3());
    const up = props.camera1.anchorLocal('antenna').sub(props.camera1.anchorLocal('lens'));
    expect(up.y).toBeCloseTo(CAMERA.antennaUp, 6); expect(Math.hypot(up.x, up.z)).toBeLessThanOrEqual(0.05);
    const d = props.monitor.anchorLocal('antenna').sub(props.monitor.anchorLocal('screen')).toArray();
    for (let k = 0; k < 3; k++) expect(d[k]).toBeCloseTo(MONITOR_ANTENNA[k], 6);
    const c = size(props.cat.group); expect(Math.max(c.x, c.z)).toBeGreaterThanOrEqual(CAT.length); expect(Math.max(c.x, c.z)).toBeLessThanOrEqual(0.75);
    const s = size(props.cat.part('spot')); expect(Math.max(s.x, s.y, s.z)).toBeGreaterThanOrEqual(0.04); expect(Math.max(s.x, s.y, s.z)).toBeLessThanOrEqual(0.08);
    expect(size(props.wicket.part('leaf')).z).toBeCloseTo(1.0, 1); expect(size(props.wicket.part('leaf')).y).toBeCloseTo(1.8, 1);
    const f = picketFence([{ route: [[0, 0], [1.6, 0]], height: 1.1, picket: 0.08, gap: 0.08, board: true }]);
    expect(size(f.group).x).toBeCloseTo(1.6, 2); expect(size(f.group).y).toBeCloseTo(1.1, 2); });
  it('якорі дому й сараю лягають у точки плану', () => { for (const k of ['sill', 'microwave', 'phone'] as const) { const a = props.house.anchorLocal(k), p = SAMPLE_PLAN.house[k];
    expect(Math.hypot(a.x - p[0], a.y - p[1], a.z - p[2])).toBeLessThanOrEqual(0.05); }
    for (const k of ['wall', 'nook'] as const) { const a = props.shed.anchorLocal(k), p = SAMPLE_PLAN.shed[k];
    expect(Math.hypot(a.x - p[0], a.y - p[1], a.z - p[2])).toBeLessThanOrEqual(0.05); }
    const kb = new Builder('kitchen'); addKitchenBlock(kb, { length: 2.4 }); const m = kb.build().anchorLocal('microwave');
    expect(m.y).toBeCloseTo(1.0, 6); expect(m.x).toBeLessThanOrEqual(-2.4 / 2 + 0.5); });
  const H = SAMPLE_PLAN.house, ends = H.walls.flatMap((w) => [w.a, w.b]), cellar = Math.min(...H.walls.map((w) => w.y0));   // підлога льоху — найнижчий y0 стін
  const box = { x0: Math.min(...ends.map((p) => p[0])), x1: Math.max(...ends.map((p) => p[0])), z0: Math.min(...ends.map((p) => p[1])), z1: Math.max(...ends.map((p) => p[1])) };   // обвідний прямокутник ліній стін
  const down = (o: Object3D, x: number, y: number, z: number) => (o.updateMatrixWorld(true), new Raycaster(new Vector3(x, y, z), new Vector3(0, -1, 0)).intersectObject(o, true)[0]?.point.y);
  const groundAt = (x: number, z: number) => down(props.island.group, x - SAMPLE_PLAN.centre[0], 10, z - SAMPLE_PLAN.centre[1])!;   // намальована земля: сітка острова, між вузлами лінійна (heightAt набору — гладка функція, сітки не бачить)
  it('під домом острів поглиблено: земля всередині стін нижча за підлогу льоху, а яма не доходить до низу острова', () => {
    for (let x = box.x0 + 0.1; x <= box.x1 - 0.1 + 1e-9; x += 0.25) for (let z = box.z0 + 0.1; z <= box.z1 - 0.1 + 1e-9; z += 0.25) expect(groundAt(x, z)).toBeLessThan(cellar - 0.05);
    expect(groundAt((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2) - new Box3().setFromObject(props.island.group).min.y).toBeGreaterThanOrEqual(1); });
  it('вимощення — від лиця стін на HOUSE_SKIRT.width, а за ним земля рівна й освітлена як рівна', () => { const s = new Box3().setFromObject(props.house.part('skirt')), d = 0.1 + HOUSE_SKIRT.width;
    expect(s.min.x).toBeCloseTo(box.x0 - d, 3); expect(s.max.x).toBeCloseTo(box.x1 + d, 3); expect(s.min.z).toBeCloseTo(box.z0 - d, 3); expect(s.max.z).toBeCloseTo(box.z1 + d, 3); expect(s.max.y).toBeCloseTo(HOUSE_SKIRT.top, 3);
    for (const e of [d + 0.05, d + 0.5]) { /* точки через 0,25 м по периметру box, розширеного на e: */ expect(Math.abs(groundAt(x, z))).toBeLessThanOrEqual(0.01); }
    let flat = 0, tilted = 0;   // трава довкола ями не світиться як схил: кожна вершина острова з y = 0 має нормаль (0, 1, 0) (крок 5)
    props.island.group.traverse((o) => { if (!(o instanceof Mesh)) return; const p = o.geometry.getAttribute('position'), n = o.geometry.getAttribute('normal');
      for (let i = 0; i < p.count; i++) if (p.getY(i) === 0) { flat++; if (Math.abs(n.getY(i) - 1) > 1e-6) tilted++; } });
    expect(flat).toBeGreaterThan(0); expect(tilted).toBe(0); });
  it('підлога кімнат — від slabY до 0 з вирізом рівно на slabCut, а крізь виріз видно підлогу льоху', () => {
    const f = new Box3().setFromObject(props.house.part('floor')); expect(f.min.y).toBeCloseTo(H.slabY, 3); expect(f.max.y).toBeCloseTo(0, 3);
    /* для кожного краю slabCut, у його середині: на 0,05 м усередину виріза down(props.house.part('floor'), x, 0.5, z) — undefined; на 0,05 м назовні, якщо точка в межах box, — 0 (до 1e-3) */
    expect(down(props.house.group, (H.slabCut.min[0] + H.slabCut.max[0]) / 2, 0.5, (H.slabCut.min[1] + H.slabCut.max[1]) / 2)).toBeCloseTo(cellar, 3); });   // перше, у що влучає промінь крізь виріз, — верх підлоги льоху
  it('кіт рухається за часом, а не за кроками', () => { /* cat.update(0.5, 2) після різної історії викликів дає ту саму rotation голови й хвоста */ });
  ```
- [ ] **Крок 2. Побачити, що тест падає** — `cd app && pnpm test src/volumes/radio/shared/models` → `Cannot find module '..'`.
- [ ] **Крок 3. Побудувати малі предмети** (`camera`, `pole`, `monitor`, `wicket`, `fence`, `swing`, `bicycle`, `cat`, `tray`, `phone`)
  Кожен — `new Builder('<назва>')` → фігури → `build()`; матеріали лише через слоти набору й `K.*`, кольори лише токенами `col('…')`; розміри — з таблиці. Друга камера — `cameraModel({ on: false })`: вічко темне. Рамка монітора порожня: екран туди ставить світ (B14). Кіт: тулуб уздовж локальної +X (з `yaw` 0 він іде на схід), голову повернуто на 90° до локальної −Z — до камери, коли кіт іде поперечним парканом боком до неї (`VISUAL.md`, `places.cat`); біла цятка — окрема частина `spot`, `col('white')`, на лобі, дивиться туди ж (око камери бачить її ≈ 1,9 комірки); `update(dt, t)` гойдає `head` і `tail` як функції `t` довкола цього положення. Малі предмети, крім камер і монітора, дивляться вздовж своєї +X, а початок кожного — середина низу (стовпа — земля на осі): B13 ставить їх у точки `places` з `rotation.y = yaw` (B13, крок 5); камера дивиться вздовж −Z якоря `lens`, монітор — уздовж +Z якоря `screen`. Жодного тексту на предметах.
- [ ] **Крок 4. Побудувати будівлі** (`shed`, `garage`, `house` із `kitchen`, `neighbourWindow`)
  Стіни малюються зі списку `WallPlan` в осях сцени (група будівлі стоїть у нулі): відрізок `a → b`, висоти `y0…y1`, товщина 0,2 м — по 0,1 м з обох боків відрізка, вигляд за `look` (`'slab'` — перекриття й обидві підлоги: бетон кольору гравію, `mix('steel', 'mist', 0.5)`, `VISUAL.md` §4). Вікно (`windows`) — проріз від `from` до `to` уздовж стіни й від `y0` до `y1`, з дерев'яною рамою (`VISUAL.md` §4) і склом, яке вночі не світиться: вікно кухні світить лише білим світлом екрана. Стіна з `cut: true` малюється до висоти 0,6 м над перекриттям (z 0,4: промінь `route` до екрана в льоху перетинає `shell-s` на z 0,66…0,83) зі світлою смугою зрізу зверху; даху над домом немає. Острів під домом поглиблено (крок 5), тож підлоги дім малює сам, трьома частинами (`Builder.part`: вони не рухаються, але тести знаходять їх за назвою): `floor` — підлога кімнат і водночас перекриття над льохом, плита вигляду `'slab'` від `slabY` до 0 на весь обвідний прямокутник ліній стін, із прямокутним вирізом `slabCut` (на її верху стоять перегородка, шафи й кухонний блок); `cellarFloor` — підлога льоху, плита вигляду `'slab'` (як `floor`) 0,05 м завтовшки з верхом на найнижчому `y0` стін (−2,5), на той самий прямокутник: цегляні стіни йдуть від −2,5 до 2,7, тож льох замкнений з усіх чотирьох боків; `skirt` — вимощення, пласка рамка кольору гравію `mix('steel', 'mist', 0.5)` (`VISUAL.md` §4) від зовнішнього лиця зовнішніх стін (обвідний прямокутник ліній стін, розширений на 0,1) на `HOUSE_SKIRT.width` назовні, плита 0,08 м завтовшки з верхом на `HOUSE_SKIRT.top` над землею — вище за траву, тож із землею за глибину не б'ється; вона ховає рваний край ями. Так читач бачить кухню, коридор, дальню кімнату й, крізь виріз, льох (рішення плану). Кухня — `addKitchenBlock` тому (`kitchen.ts`; `addKitchen` набору тут не годиться: його піч стоїть за 1,85 м від кінця блока, а якір `microwave` — на 1,2 м, на верху печі, `kit/home/appliances.ts:46-54`, тож блок із піччю в (19,8; 0,6) заходив би під монітор і вікно, а з якорем на висоті моделі, 1,0 м, стільниця опустилася б до 0,71, а низ шаф — на 0,2 під підлогу). Блок (`length` — від південного кінця печі, y 0,36, до північної стіни, 2,9: 2,5) стоїть на підлозі вздовж західної стіни лицем на схід, кінцем −X на південь, так що його якір `microwave` лягає в точку `plan.microwave`; він же — якір `microwave` дому; `sill` — верх дошки підвіконня: дошка 0,04 м завтовшки вздовж стіни з вікном, від краю вікна, дальнього від `sill`, до 0,3 м за `sill`, углиб кімнати від стіни до 0,25 м за `sill` (на ній стоїть корпус монітора); `phone` — місце телефона на тій самій дошці; обидва в точках плану. Сарай: стіни — зі списку `plan.walls`, кожна — за своїм `look`; якір `wall` — у точці `plan.wall` (середина білої стіни, зверненої до камери: білими можуть бути всі стіни сараю, тож шукати її за `look` не можна), якір `nook` — у точці `plan.nook`; отвір дровника — його північний бік довкола `plan.nook`, де стіни в списку немає, а задня й бічні стінки дровника зсередини — `col('ink')`; над усім прямокутником стін — плаский дах із бляхи (`'iron'`) на висоті `plan.roofY`. Стулка воріт гаража — частина `gate` з віссю на `hinge`; кут ставить подвір'я. `neighbourWindow()` — шматок стіни з вікном і `addRouter`.
- [ ] **Крок 5. Написати `buildYardProps` і побачити, що тест проходить**
  З набору без змін: `island({ radius: plan.radius, wobble: 0, underside: 'slab', relief: 0, features: [трава, гравій, яма] })` (земля плоска лише ближче за 0,9 радіуса: набір закруглює верх у зовнішніх 10 % до 0,5 м униз, `kit/env/terrain.ts:293`; без `wobble: 0` край острова хвилястий, `:214`; `y = 0` сцени — це земля `SITE`), де трава — `{ type: 'pad', x: 0, z: 0, r: 1.2 * plan.radius, color: mix('green', 'steel', 0.7) }` на весь острів, гравій — прямокутний `pad` (`w`, `d`, `corner: 0`, `blend: 0.05`; типовий `corner` набору — 2 м, `kit/env/terrain.ts:130`) на `plan.gravel` із кольором `mix('steel', 'mist', 0.5)` (`VISUAL.md` §4; `mix(a, b, k)` = `col(a).lerp(col(b), k)`; пізніший `pad` фарбує поверх ранішого, тож гравій — другим); яма — третій прямокутний `pad` без `color` під домом: обвідний прямокутник ліній стін `plan.house.walls`, розширений на 0,7 м з кожного боку, `corner: 0`, `blend: 0.05`, `y` — на 0,1 м нижче за найнижчий `y0` стін (−2,6 під підлогою льоху −2,5); пізніший `pad` бере висоту поверх ранішого (`kit/env/terrain.ts:250-256`), тож яма — третьою. Без неї острів — одне поле висот — вкрив би травою підлогу кімнат, перекриття й льох; підлоги дім малює сам (крок 4). Нормалі верху острова набір згладжує й через стінку ями (`kit/env/terrain.ts:348-369`: `computeVertexNormals` зважує грані площею, а грань схилу — до 2,6 м заввишки), тож вершини трави на краю ями дістають нормаль, нахилену до 81°, а трава за краєм вимощення, до 0,6 м від нього, світиться як схил (нахил до 46° біля краю; тон-шейдер ріже смуги світла за нормаллю, `style/materials/chunks.ts:137-146`). Тому `buildYardProps` одразу після `island(…)` обходить меші групи острова й кожній вершині з `position.y === 0` (поза ямою й закругленням краю земля рівно 0, бо `relief: 0`) ставить нормаль `(0, 1, 0)` і `normal.needsUpdate = true`; вершин схилу ями (вони й усі трикутники з ними — під вимощенням, не далі за 1,30 м від лиця стін) і закругленого краю острова це не чіпає. Запас і вимощення — із сітки острова, а не на око: верх острова — 160 променів × 56 кілець (`detail` 1; кільце i — на радіусі `radius · (i/56)^0,88`, `kit/env/terrain.ts:304-321`), між вузлами земля лінійна, тож край ями такий самий грубий (`heightAt` набору — гладка функція, сітки вона не бачить). На острові радіуса 23 із центром (14; −1) плану (`[14, 1]` сцени) найбільша клітинка під кімнатами — 0,60 м по дузі на 0,38 м між кільцями, найдовша сторона її трикутника — 0,70 м. Край ями за 0,7 м від лінії стіни лежить за 0,8 м від її внутрішнього лиця (стіна — по 0,1 м з боків лінії, крок 4), далі за 0,70: кожен трикутник, що зачіпає кімнату, має всі три вузли на дні, і земля в домі всюди на −2,6. Схил ями виходить за її край ще на `blend` і на найдовшу сторону трикутника там, 0,73 м: 0,7 − 0,1 + 0,05 + 0,73 = 1,38 м від зовнішнього лиця стіни (на цій сітці насправді 1,30) — це ховає вимощення `HOUSE_SKIRT.width` = 1,4 м. Низ острова (`underside: 'slab'`) лежить на `depth` = 0,16 · radius = 3,68 м нижче за його край (−0,5), на −4,18; дно ями — на 1,58 м вище, тож `depth` лишаємо типовим. Хто рухає острів (радіус, центр), той так само рахує запас і вимощення заново, а тести кроку 1 і B13 це ловлять; набір будує острів довкола власного нуля, тож координати `pad` — відносно `plan.centre`, а групу острова ставить у `plan.centre` `mountYard`; `streetLamp({ kind: 'park', height: 3.2 })` (ключ `lantern`; типова щогла набору — 3,6 м, `kit/env/props.ts:82`), `trees(plan.trees.map(([x, z]) => ({ x, y: 0, z, tint: mix('green', 'steel', 0.7) })), { rng })` (листя — рецепт `VISUAL.md` §4; без `tint` набір фарбує дерева насиченими `green` і `teal`). Паркани — `picketFence(plan.fences)` (ключ `fence`): `fence` набору дає лише штахету 0,24 м із проміжком ≈ 0,18 м, одну висоту й одну заокруглену ламану на виклик, без верхньої дошки й глухого відрізка (`kit/env/props.ts:24-35`). `cd app && pnpm test src/volumes/radio/shared/models` → `Tests  24 passed (24)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 6. Додати крок `props` у пісочницю й розділ `props` у `measure.mjs`**
  Сцена: група `showcase`, видима лише в кроці `props` (група предметів B1b тоді схована): п'ятнадцять предметів зі списку `BUDGET` з `buildYardProps(SAMPLE_PLAN, ctx.random.fork('props'))`, усі в нулі, видимий один — обраний керуванням `prop` (вибір із п'ятнадцяти назв); на зміну — `ctx.camera.focusOn(обраний.group)`. `ctx.qa.expose('radio-props', () => ({ name, triangles, drawCalls }))`. Розділ `props` (сторінка `…/props`, `freeze: 1`), для кожної назви: `__ui.set('prop', назва, true)`, `__app.step(1 / 60, 120)`; `radio-props.name === назва`; `stats().drawCalls ≤ 350`; `hueFamilies(decodePng(знімок)).families.length ≤ 4`; знімок `props-<назва>.jpg`; наприкінці `appErrors(page)` порожній.
- [ ] **Крок 7. Зняти й переглянути**
  Блок Q з `--only eye,props` → `PASS sandbox-radio-link`. На п'ятнадцяти знімках: (1) кожен предмет упізнається з першого погляду; (2) кольори приглушені, за `VISUAL.md` «Кольори зі змістом»: на предметах немає кольорів радіозору, крім світла фари й вогників роутера; (3) цятка на лобі кота — окрема біла пляма; вічко другої камери темне; (4) рамка монітора порожня, 4 : 3; (5) у домі видно три кімнати з підлогою й, крізь виріз, льох із підлогою; довкола стін — вимощення; зріз стін світлий; (6) без дірок, мерехтіння граней і тексту. Знайдене правимо й знімаємо знову.
- [ ] **Крок 8. Коміт** — `git add app/src/volumes/radio/shared/models/{camera,pole,monitor,wicket,fence,kitchen,shed,garage,swing,bicycle,cat,tray,phone,house,index}.ts app/src/volumes/radio/shared/models/__tests__/models.test.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/{index.ts,scene.ts,qa/measure.mjs}` · `git commit -m "Предмети подвір'я: камера, стовп, монітор, хвіртка, сарай, гараж, кіт, дім у розрізі"`

### Завдання B13. Подвір'я: `shared/yard`

**Виконавець:** Fable 5.2 — композиція, світло й ракурси.

**Файли:**
- Створити: `app/src/volumes/radio/shared/yard/layout.ts`, `…/yard/look.ts`, `…/yard/shots.ts`, `…/yard/index.ts`
- Тест: `app/src/volumes/radio/shared/yard/__tests__/layout.test.ts`, `…/__tests__/look.test.ts`, `…/__tests__/shots.test.ts`
- Змінити: `app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts`, `…/scene.ts` (сцена на подвір'ї, крок `yard`; крок `props` прибрати), `…/qa/measure.mjs` (розділ `yard`; розділ `props` прибрати)
- Змінити: `docs/volumes/radio/VISUAL.md` («Подвір’я», «Ракурси»), `docs/volumes/radio/reports/batch2-model.md` (рядок «подвір'я» в розділі «1. Око камери»)

**Інтерфейси:**
- Бере: `SITE`, `routePoint(site, route)` (B6b) і закон дека — див. Спільний договір. `buildYardProps`, типи плану, `MONITOR_SCREEN`, `MONITOR_ANTENNA`, `MONITOR_CASE`, `CAMERA`, `CAT`, `HOUSE_SKIRT` (B12); `Rng` з `@/engine/api` (тест справжнього острова); `createEye`, `lumaAround` (B1a, для пісочниці); `envPreset`, `LOOK_SCALE`, `EnvOverrides` з `@/style`; `Shot` з `@/engine/api`; `Builder` з `@/kit` (кронштейн камери, крок 5). `Yard`, `RouteStop`, `YARD_SHOTS`, `screenShot`, `mountYard` — див. Спільний договір; `Yard` це завдання оголошує без `catAt` і якорів `shedWall`, `nook` — їх разом із типом додає C3a. Кінці шкали сутінків і правило сірого екрана — `VISUAL.md` «Екран монітора»; що в кадрі кожного ракурсу — `VISUAL.md` «Ракурси».
- Дає:

  ```ts
  // layout.ts — без ctx і без three; разом із whereami/model.ts — єдині читачі SITE у shared/
  export const toScene = (p: V3): V3 => [p[0], p[2], -p[1]];     // SITE (схід, північ, вгору) → сцена (x, y вгору, z = −північ); 1 одиниця = 1 м
  export const toScene2 = (p: readonly [number, number]): P2 => [p[0], -p[1]];
  export const LENS: { position: V3; lookAt: V3; fov: number };  // position — на CAMERA.antennaUp нижче за LAYOUT.tx; fov 40
  export const STOP_YAW: readonly [number, number, number, number, number];   // куди дивиться екран на кожній зупинці, рад
  export function monitorPlace(route: number, nudge: number): { position: V3; yaw: number };   // position — якір monitorAntenna: саме там модель рахує поле
  export function screenPlace(route: number, nudge?: number): V3; // центр екрана: position − R_y(yaw + π/2) · MONITOR_ANTENNA (осі монітора — крок 5)
  export function gateYaw(gate: number): number;                 // 0 → closedYaw, 1 → openYaw, між ними лінійно
  export const LAYOUT: { plan: YardPlan; tx: V3 /* toScene(SITE.tx): антена камери */;
    places: Record<'pole' | 'wicket' | 'cat' | 'shedWall' | 'nook' | 'swing' | 'bicycle' | 'lantern' | 'trayRest', { position: V3; yaw: number }> };
  // look.ts
  export function duskEnv(dusk: number): EnvOverrides;           // поле за полем між envPreset('dusk') (0) і envPreset('night') (1); motes, gradeTintAmount, harmony — завжди 0
  export function lanternLevel(dusk: number): number;            // 0 до 0,4; далі плавно до 1 на 0,5
  // shots.ts
  export function screenShare(shot: Shot, screenAt: V3): number; // частка безпечного кадру, яку займає екран монітора
  export function screenShot(route: number): Shot;               // договір: монітор зблизька на будь-якому місці маршруту
  // index.ts — mountYard, типи Yard і RouteStop; реекспортує YARD_SHOTS, LENS, LAYOUT, monitorPlace, screenPlace, screenShot
  ```

  Ракурси: `both` — стовп із камерою, кіт і вікно кухні з монітором разом («оригінал і копія»); `yard` — подвір'я загалом; `pole` — з-за плеча камери: кіт на паркані, хвіртка, біла стіна й закуток (герой — кіт; стовп і камера — край переднього плану); `window` — вікно кухні знадвору; `screen` — монітор зблизька на кухні, дорівнює `screenShot(1)`; `antenna` — прутик монітора; `route` — дім у розрізі з усіма п'ятьма зупинками; `top` — план згори.

  Початкові числа всього, чого немає в `SITE` (`LENS.lookAt`, кут монітора — `STOP_YAW`, усі `places`, сарай, гараж, `fences`, `trees`, острів, висоти стін, телефон, вікно сусіда, вісім ракурсів; висота підвіконня випливає з монітора, крок 3), дає `VISUAL.md` «Подвір’я» й «Ракурси» (A5). Це завдання добирає їх на знімках, саме вибирає `slabCut` і `SCREEN_VIEW` і записує змінене у `VISUAL.md` (крок 9). Умови вибору — тести кроку 1 і перевірки кроку 7.

- [ ] **Крок 1. Написати тести**
  ```ts
  // layout.test.ts
  it('п’ять зупинок стоять на SITE.route', () => { for (let i = 0; i < 5; i++) expect(monitorPlace(i, 0).position).toEqual(toScene(SITE.route[i])); });
  it('між зупинками — посередині', () => { const m = monitorPlace(1.5, 0).position, a = toScene(SITE.route[1]), b = toScene(SITE.route[2]);
    for (let k = 0; k < 3; k++) expect(m[k]).toBeCloseTo((a[k] + b[k]) / 2, 9); });
  it('nudge зсуває вздовж SITE.nudgeAxis на задані метри', () => { const d = sub(monitorPlace(2, 0.1).position, monitorPlace(2, 0).position);
    const want = toScene([0.1 * SITE.nudgeAxis[0], 0.1 * SITE.nudgeAxis[1], 0]); for (let k = 0; k < 3; k++) expect(d[k]).toBeCloseTo(want[k], 9); });
  it('антена камери — у SITE.tx, об’єктив — на 0,2 м нижче', () => { expect(LAYOUT.tx).toEqual(toScene(SITE.tx));
    expect(LENS.position[0]).toBe(LAYOUT.tx[0]); expect(LENS.position[1]).toBeCloseTo(LAYOUT.tx[1] - 0.2, 9); expect(LENS.position[2]).toBe(LAYOUT.tx[2]); });
  it('стіни дому — це стіни SITE', () => { const h = LAYOUT.plan.house; expect(h.walls).toHaveLength(SITE.walls.length); expect(h.slabY).toBe(SITE.slabZ);
    for (const w of SITE.walls) { const p = h.walls.find((x) => x.id === w.id)!; expect(p.a).toEqual(toScene2(w.a)); expect(p.b).toEqual(toScene2(w.b)); expect(p.look).toBe(w.material);
      expect([p.y0, p.y1]).toEqual(w.material === 'brick' ? [-2.5, 2.7] : w.id === 'partition' ? [0, 2.7] : [0, 2]); } });   // висоти — VISUAL.md «Стіни дому»
  it('піч, роутер і підвіконня — там, де їх має модель', () => { const h = LAYOUT.plan.house, k = monitorPlace(1, 0).position;
    expect(h.microwave).toEqual(toScene(SITE.oven.at)); expect(LAYOUT.plan.neighbour.router).toEqual(toScene(SITE.router.at));
    expect(Math.hypot(h.sill[0] - k[0], h.sill[2] - k[2])).toBeLessThanOrEqual(0.3); expect(h.sill[1]).toBeCloseTo(screenPlace(1)[1] - MONITOR_CASE.height / 2, 3);
    expect(h.phone[1] - h.sill[1]).toBeGreaterThanOrEqual(0); expect(h.phone[1] - h.sill[1]).toBeLessThanOrEqual(0.08); });
  it('відчинена стулка лежить на SITE.gateLeaf', () => { const g = LAYOUT.plan.garage.gate, b = toScene2(SITE.gateLeaf.b);
    const end = (yaw: number): P2 => [g.hinge[0] + g.width * Math.cos(yaw), g.hinge[1] - g.width * Math.sin(yaw)];
    expect(g.hinge).toEqual(toScene2(SITE.gateLeaf.a)); expect(end(gateYaw(1))[0]).toBeCloseTo(b[0], 6); expect(end(gateYaw(1))[1]).toBeCloseTo(b[1], 6);
    expect(gateYaw(0)).toBe(g.closedYaw); expect(gateYaw(0.5)).toBeCloseTo((g.closedYaw + g.openYaw) / 2, 9);
    const shut = toScene2([27.25, -7.23]); expect(end(gateYaw(0))[0]).toBeCloseTo(shut[0], 2); expect(end(gateYaw(0))[1]).toBeCloseTo(shut[1], 2);   // зачинена — уздовж x = 27,25 до (27,25; −7,23)
    expect(Math.abs(g.openYaw - g.closedYaw)).toBeCloseTo(0.639, 2); });   // стулка відчиняється на 36,6°
  it('екран стоїть перед антеною монітора', () => { for (const r of [0, 1, 2.5, 4]) { const { position: a, yaw } = monitorPlace(r, 0), f = yaw + Math.PI / 2, [mx, my, mz] = MONITOR_ANTENNA, s = screenPlace(r);   // +Z монітора — нормаль екрана, +X — праворуч від глядача перед екраном
    expect(s[0]).toBeCloseTo(a[0] - (mx * Math.cos(f) + mz * Math.sin(f)), 9); expect(s[1]).toBeCloseTo(a[1] - my, 9); expect(s[2]).toBeCloseTo(a[2] - (mz * Math.cos(f) - mx * Math.sin(f)), 9); } });
  it('камера бачить кота, хвіртку, білу стіну й темний закуток', () => {
    const cam = new PerspectiveCamera(LENS.fov, 4 / 3, 0.1, 200); cam.position.set(...LENS.position); cam.lookAt(...LENS.lookAt); cam.updateMatrixWorld();
    for (const k of ['cat', 'wicket', 'shedWall', 'nook'] as const) { const p = LAYOUT.places[k].position;
      const v = new Vector3(...p).project(cam); expect(Math.abs(v.x)).toBeLessThanOrEqual(0.75); expect(Math.abs(v.y)).toBeLessThanOrEqual(0.75); expect(v.z).toBeLessThan(1); }
    expect(LAYOUT.plan.shed.wall).toEqual(LAYOUT.places.shedWall.position); expect(LAYOUT.plan.shed.nook).toEqual(LAYOUT.places.nook.position); });   // якорі сараю — у тих самих точках
  it('кіт на кадрі камери — не вужчий за 8 комірок, цятка — не менша за одну', () => {   // ширина — за силуетом: проєкція кінців тулуба
    const cam = new PerspectiveCamera(LENS.fov, 4 / 3, 0.1, 200); cam.position.set(...LENS.position); cam.lookAt(...LENS.lookAt); cam.updateMatrixWorld();
    const { position: p, yaw } = LAYOUT.places.cat, h = CAT.length / 2;
    const colAt = (s: number) => ((new Vector3(p[0] + s * h * Math.cos(yaw), p[1], p[2] - s * h * Math.sin(yaw)).project(cam).x + 1) / 2) * 128;   // кінці тулуба вздовж ходи кота
    expect(Math.abs(colAt(1) - colAt(-1))).toBeGreaterThanOrEqual(8);
    const w = 2 * dist(LENS.position, p) * Math.tan((25.9 * Math.PI) / 180); expect((CAT.spot / w) * 128).toBeGreaterThanOrEqual(1); });
  it('справжнє подвір’я: під домом яма, довкола вимощення, на ньому — лише велосипед', () => {   // ті самі заміри, що в B12 (крок 1), на острові й домі LAYOUT.plan
    const props = buildYardProps(LAYOUT.plan, new Rng('layout-test')), c = LAYOUT.plan.centre, h = LAYOUT.plan.house, cellar = Math.min(...h.walls.map((w) => w.y0));
    const groundAt = (x: number, z: number) => (props.island.group.updateMatrixWorld(true), new Raycaster(new Vector3(x - c[0], 10, z - c[1]), new Vector3(0, -1, 0)).intersectObject(props.island.group, true)[0]!.point.y);
    /* box — обвідний прямокутник кінців h.walls; d = 0,1 + HOUSE_SKIRT.width — зовнішній край вимощення від лінії стін; off(x, z) — L∞-відстань точки сцени від box */
    /* сітка 0,25 м від box.x0 + 0,1 до box.x1 − 0,1 і так само по z: */ expect(groundAt(x, z)).toBeLessThan(cellar - 0.05);
    /* точки через 0,25 м по периметру box, розширеного на d + 0,05 і на d + 0,5: */ expect(Math.abs(groundAt(x, z))).toBeLessThanOrEqual(0.01);
    for (const [k, p] of Object.entries(LAYOUT.places)) if (k !== 'bicycle' && k !== 'trayRest') expect(off(p.position[0], p.position[2])).toBeGreaterThan(d + 0.5);
    const y = monitorPlace(0, 0).position; expect(off(y[0], y[2])).toBeGreaterThan(d + 0.5);
    /* обвідний прямокутник стін гаража й завіса стулки — далі за d + 0,1 від box (стулка відчиняється від дому) */
    const b = LAYOUT.places.bicycle.position; expect(off(b[0], b[2])).toBeGreaterThan(0.1); expect(off(b[0], b[2])).toBeLessThan(d); });   // велосипед — на вимощенні (крок 5)
  // look.test.ts
  it('сутінки: кінці шкали — набори dusk і night рушія, поза 0…1 — затиснуто', () => {
    expect(duskEnv(0).keyIntensity).toBeCloseTo(0.6, 9); expect(duskEnv(1).keyIntensity).toBeCloseTo(0.5, 9);
    expect(duskEnv(0).stars).toBeCloseTo(0.6, 9); expect(duskEnv(0.5).stars).toBeCloseTo(0.8, 9); expect(duskEnv(1).stars).toBe(1);
    expect(duskEnv(-1)).toEqual(duskEnv(0)); expect(duskEnv(2)).toEqual(duskEnv(1)); });
  it('без порошинок, відтінку й гармонії', () => { for (const d of [0, 0.5, 1]) { const e = duskEnv(d); expect(e.motes).toBe(0); expect(e.gradeTintAmount).toBe(0); expect(e.harmony).toBe(0); } });
  it('ліхтар вмикається після 0,4', () => { expect(lanternLevel(0.39)).toBe(0); expect(lanternLevel(0.45)).toBeGreaterThan(0); expect(lanternLevel(0.5)).toBe(1); });
  // shots.test.ts
  const KEYS = ['both', 'yard', 'pole', 'window', 'screen', 'antenna', 'route', 'top'] as const;
  it('вісім ракурсів, кожен із fit', () => { expect(Object.keys(YARD_SHOTS).sort()).toEqual([...KEYS].sort()); for (const k of KEYS) expect(YARD_SHOTS[k].fit).toBeDefined(); });
  it('both: і об’єктив, і монітор на кухні — в кулі fit', () => { /* відстань від fit.center до LENS.position і до monitorPlace(1, 0).position ≤ fit.radius */ });
  it('route: усі п’ять зупинок — у кулі fit', () => { /* те саме для monitorPlace(0…4, 0) */ });
  it('screenShare: екран на відстані 1 м', () => expect(screenShare({ position: [0, 0, 1], target: [0, 0, 0] }, [0, 0, 0])).toBeCloseTo(0.155674, 5));
  it('монітор зблизька: від 6 % до чверті кадру на всьому маршруті', () => { expect(YARD_SHOTS.screen).toEqual(screenShot(1));
    for (const r of [0, 0.5, 1, 2, 3, 3.5, 4]) { const s = screenShare(screenShot(r), screenPlace(r)); expect(s).toBeGreaterThanOrEqual(0.06); expect(s).toBeLessThanOrEqual(0.25); expect(screenShot(r).fit).toBeDefined(); } });
  ```
- [ ] **Крок 2. Побачити, що тести падають** — `cd app && pnpm test src/volumes/radio/shared/yard` → `Cannot find module '../layout'`, `Test Files  3 failed (3)`.
- [ ] **Крок 3. Написати `layout.ts`**
  `monitorPlace` = `toScene(routePoint(SITE, route) + nudge · [nudgeAxis[0], nudgeAxis[1], 0])`; `yaw` — між сусідніми `STOP_YAW` найкоротшою дугою. `LAYOUT.plan`: кожна стіна `SITE.walls` стає `WallPlan` дому з тим самим `id` (`a`, `b` через `toScene2`, `look` — її `material`; `shell-w` дістає вікно кухні з `VISUAL.md` «Подвір’я» (y −1,8…−0,2, z 0,9…2,1): `windows: [{ from: 1.2, to: 2.8, y0: 0.9, y1: 2.1 }]` від `a` = (19,2; −3), а матеріал моделі лишається `brick` (вікон модель не має); висоти — з `VISUAL.md` «Стіни дому», бо модель стін за висотою не обмежує: цегляні `shell-*` і `inner` — від підлоги льоху −2,5 до 2,7 м (нижче нуля — фундамент, видно його лише в льоху крізь виріз), перегородка `partition` — 0…2,7, шафи `cupboard` і `wardrobe-*` — 0…2,0: під підлогою дому дерева немає; розрізану (`cut`) B12 і так малює лише до 0,6 м над перекриттям); розрізані стіни (`cut`) — `shell-s` і `shell-n` (`shell-s` стоїть між читачем і кімнатами в ракурсі `route`, а за `shell-n` у ньому видно зупинку надворі: промінь `route` до її екрана перетинає `shell-n` на z ≈ 2,3); `slabY = SITE.slabZ`; `slabCut` — над зупинкою льоху з боку читача в ракурсі `route`, так, щоб крізь виріз із цього ракурсу було видно підлогу льоху (перевірка `cellar`, крок 7); `microwave`, `neighbour.router` — точки `SITE`; `sill` — точка на верху дошки підвіконня під монітором кухні: x і z — під `monitorPlace(1, 0).position`, висота — низ корпусу на цій зупинці, `screenPlace(1)[1] − MONITOR_CASE.height / 2` (≈ 0,84 м, на 6 см нижче за проріз вікна z 0,9: монітор стоїть на дошці, а не в ній); `phone` — на тій самій дошці перед вікном (у плані (19,45; −0,8)), не вище за 8 см над `sill`; ворота: `hinge = toScene2(gateLeaf.a)`, `width = |b − a|`, `openYaw` — напрям `a → b`, `closedYaw` — стулка в площині передньої стіни гаража, від завіси на південь до (27,25; −7,23) (`VISUAL.md` «Решта сцени»): −π/2. Сарай: стіни сараю x −1,0…2,6 і дровника x 2,6…4,0, y −12…−9, від 0 до 2,4 м (`VISUAL.md` «Решта сцени»), усі `'white'`; біла стіна до камери — північна стіна сараю (−1,0; −9) → (2,6; −9), її середина — `places.shedWall`; північної стіни дровника немає; `wall = LAYOUT.places.shedWall.position`, `nook = LAYOUT.places.nook.position`, `roofY = 2.4`. Гараж довкола стулки, паркани, дерева, решта `places`, `LENS.lookAt` і вісім ракурсів — числа `VISUAL.md` «Подвір’я» й «Ракурси», виправлені на знімках. Паркани — чотири `FenceRun` за `VISUAL.md` «Решта сцени» (точки плану; у `LAYOUT` — через `toScene2`): паркан довкола подвір'я, 1,8 м, — глухий `{ picket: 0.14, gap: 0, board: false }` від (−1,2; −9) до (−1,2; −3,9) і штахетник 14 / 14 см `{ picket: 0.14, gap: 0.14, board: false, open: [[0.2, 1.2]] }` від (−1,2; −3,9) через (−1,2; 12) до (30; 12), де `open` — хвіртка, y −3,7…−2,7 (про північний відрізок `VISUAL.md` мовчить — той самий штахетник); поперечний, 1,1 м, — штахетник 8 / 8 см із верхньою дошкою `{ picket: 0.08, gap: 0.08, board: true }` (−1,2; −3,9) → (4,6; −3,9) і глуха нога `{ picket: 0.08, gap: 0, board: false }` (4,6; −3,9) → (4,6; −9); `board: true` у плані має лише відрізок, яким ходить кіт (його бере C3a). Острів — центр (14; −1) і радіус 23 з `VISUAL.md` «Решта сцени» (`centre = toScene2([14, -1])`): набір закруглює верх острова в зовнішніх 10 % радіуса (B12, крок 5), а найдальший ріг паркану, (30; 12), лежить за 20,6 м від центру; запас ями під домом і ширину вимощення B12 вивів із сітки саме цього острова (B12, крок 5), тож якщо острів рухати, тест «справжнє подвір’я…» (крок 1) покаже, чи їх досі вистачає, а якщо ні — їх рахують заново так само й тим самим комітом правлять `HOUSE_SKIRT` і рядок «вимощення» `VISUAL.md`; гравій — господарський двір між парканами, x −1,2…4,6, y −9…−3,9 (`gravel` — два кути через `toScene2`). У `VISUAL.md` усі ці числа — в осях плану `SITE` (x — схід, y — північ, z — угору; `yaw` — градуси від сходу до півночі), тож у `LAYOUT` і `YARD_SHOTS` ідуть через `toScene`/`toScene2`, а `yaw` — у радіанах. `LAYOUT.tx = toScene(SITE.tx)`. Якщо тест «камера бачить…» не проходить, правимо місця декорацій і `LENS.lookAt`, а не `SITE`.
- [ ] **Крок 4. Написати `look.ts` і `shots.ts`**
  `look.ts` — єдиний власник середовища й пост-обробки тому (глави не кличуть `ctx.env.tune`, `ctx.post.base` і не дають крокам `envTune`). Раз при монтуванні: `ctx.env.setScale(LAYOUT.plan.radius, { adaptFrom: LOOK_SCALE.diorama })`, `ctx.env.setShadow({ extent: LAYOUT.plan.radius, center: [LAYOUT.plan.centre[0], 0, LAYOUT.plan.centre[1]] })`, `ctx.post.base({ grain: 0 })` (П2). Коли `dusk` змінився більш як на 0,005 — `ctx.env.base(duskEnv(dusk))`: `base` переживає вхід у крок, на відміну від `tune` (`style/env/environment.ts:234-242`). `duskEnv` завжди ставить `motes: 0` (порошинки рушія рояться довкола цілі камери оператора й мають розмір під головний кадр: око камери бачило б великі плями, що залежать від погляду читача, а на екрані їх легко сплутати з іскрами моделі — `VISUAL.md` §5, B1b крок 3), `gradeTintAmount: 0` і `harmony: 0` (сіре лишається сірим; решта полів відтінку — з `VISUAL.md` «Екран монітора»). Два `PointLight` стоять у сцені завжди, змінюється лише `intensity` (вимикання `visible` перекомпільовує програми): ліхтар — `lanternLevel(dusk) · LANTERN_LIGHT`, кухня (на якорі `monitorScreen`) — `screenLight · KITCHEN_LIGHT`; обидві сталі підбираються на знімках (початково 2,0 і 1,5). Жарівка ліхтаря — `props.lantern.night = lanternLevel(dusk)`. Так само `props.neighbour.night` і `props.bicycle.night` — `lanternLevel(dusk)`: вікно сусіда й фара світять жовтим разом із ліхтарем (`VISUAL.md` §4); `props.house.night` лишається 0 — вікно кухні світить лише білим світлом екрана.
  `shots.ts`: `YARD_SHOTS` — сталі `Shot`, кожен із `fit: { center, radius }`. `both` і `window` дістають ще `focus: screenPlace(1)`: їхній `target` — не монітор, а різкість має бути на моніторі (`VISUAL.md` §5, «Різкість»); решта — типовий `focus` = `target`. `screenShare` = площа `MONITOR_SCREEN` / площа безпечного кадру (`fov ?? 32`, `frameAspect ?? 1.5`) на відстані від `shot.position` до `screenAt`; нахилом екрана нехтуємо. `screenShot(route)`: `c = screenPlace(route)`, `target = c`, `position = c + R_y(yaw монітора + π/2) · SCREEN_VIEW` (осі монітора, як у `monitorAt`, крок 5), `fit: { center: c, radius: 0.45 }`; `SCREEN_VIEW` — одна стала в осях монітора (початково `[0, 0.25, 1.1]`: за 1,1 м перед екраном і трохи вище — екран тоді ≈ 12 % кадру, як у `VISUAL.md` §5 і §7). У льоху камера стоїть під перекриттям, у самому льоху (рішення плану): крізь виріз льох видно лише з ракурсу `route`.
- [ ] **Крок 5. Написати `index.ts` — `mountYard`**
  `buildYardProps(LAYOUT.plan, ctx.random.fork('yard'))` → розставити під `root` (острів — групою в `[centre[0], 0, centre[1]]`; дім, сарай, гараж, паркани й дерева збудовані вже в осях сцени; малі предмети стоять у своїх `places`), `ctx.root.add(root)`, `ctx.camera.shots(YARD_SHOTS)`. Перша камера: повернута так, що −Z якоря `lens` дивиться з `LENS.position` на `LENS.lookAt`; потім `camera1.part('rod').rotation.x` знімає нахил корпусу: прутик вертикальний (`VISUAL.md`, «прутики … вертикальні»), і лише після цього камеру зсуваємо так, що якір `antenna` лежить рівно в `LAYOUT.tx` — антена намальована там, звідки модель випромінює; якір `lens` тоді лягає не далі як за 0,15 м від `LENS.position`. Стовп — `pole({ height: LAYOUT.tx[1] + 0.2 })` у `places.pole`, `rotation.y = yaw` (−90°: його бік +X з якорями `mount1`, `mount2` дивиться на південь); `places.pole` у `VISUAL.md` — (0; 0,35), на 0,35 м північніше за `tx`, де стоїть прутик першої камери: корпус камери 0,18 м углиб, нахилений на 21°, і прутик лишаються перед стовпом. Від `mount1` до початку першої камери (середина задньої стінки корпусу) — кронштейн: рейка 0,02 м (`Builder`, `rod`, колір стовпа). Друга камера — початком у якорі `mount2`; як і перша, вона дивиться вздовж −Z якоря `lens`, тож її `rotation.y = yaw − π/2` з `yaw` стовпа (−90° → −π: на південь), без нахилу. Якорі: `lens`, `cameraAntenna`, `cable` — якорі `lens`, `antenna`, `cable` першої камери; `monitor` — група монітора; `monitorScreen`, `monitorAntenna` — його `screen`, `antenna`; `wicket` — `latch`; хвіртку ставимо початком у (x, 0, z) точки `places.wicket` (її 0,9 у `VISUAL.md` — середина стулки 1,8 м), `rotation.y = yaw`: стулка лягає в лінію західного паркану, завіса — на південному кінці отвору (y −3,7); телефон — моделлю `phone()` пласко в якір `phone` дому; `cat` — `spot`; кота ставимо так, що його якір `spot` лягає в `places.cat.position` (точка `VISUAL.md` — цятка на 1,3 м), а `rotation.y = places.cat.yaw`; лапи тоді — на верхній дошці поперечного паркану (1,1 м), а якщо ні — на знімках правимо висоту `places.cat`; `garageGate` — `gate`. Кожен якір публікується як `ctx.qa.probe('yard:<назва>', якір, { origin: true })`. Властивості: `dusk` (типово `opts.dusk ?? 0.2`); `wicket` → кут стулки `wicket · 1.05` рад; `garageGate` → `gateYaw`; `tray` → деко їде з `places.trayRest` (0) (серединою низу дека; висота 0,86 — верх стільниці, B12 `kitchen.ts`) до антени монітора плавно по дузі, що не перетинає прямої «`monitorAntenna` → `LAYOUT.tx`»; від `tray = 0,7` воно стоїть упоперек цієї прямої за 0,05 м від антени й висувається так, що його край — на `h = −0,4 + 0,48·tray` м від прямої (закон дека договору; на 1 — 8 см за нею): модель рахує втрати від того самого краю; `screenLight` (типово 0) пише світ (B14); `monitorAt` ставить монітор якорем `antenna` в `monitorPlace(…).position` з `rotation.y = yaw + π/2` (+Z монітора — нормаль екрана, +Y — угору, +X — праворуч від глядача перед екраном; так на кухні з `yaw` −45° прутик стоїть на північний схід від центра екрана, і в `both` центр екрана видно крізь вікно — `VISUAL.md` §7); стовп, кіт, хвіртка, гойдалка, велосипед, ліхтар і деко дивляться вздовж своєї +X (B12, крок 3), тож їхній `rotation.y = yaw` (камери й монітор — правила вище); велосипед стоїть на вимощенні дому (його точка — за 0,5 м від лиця західної стіни, вимощення — 1,4 м, і під ним яма острова), тож його ставимо на верх вимощення: `position.y = HOUSE_SKIRT.top`; решта `places`, зупинка `yard`, гараж і стулка до вимощення не доходять (найближчі — гараж і стулка, за 0,20 і 0,27 м від його краю); `hidden` — порожній масив, у який глави кладуть стенди, мапу й щуп. `update(dt, t)`: `update` предметів (кіт, гойдалка — функції `t`) і світло з `look.ts`.
- [ ] **Крок 6. Побачити, що тести проходять** — `cd app && pnpm test src/volumes/radio/shared/yard` → `Test Files  3 passed (3)`, `Tests  19 passed (19)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 7. Перевести пісочницю на подвір'я; крок і розділ `yard`**
  Сцена: `const yard = mountYard(ctx)`; предмети, мітки-куби, крок `props`, розділ `props` і виклики `ctx.env`, `ctx.post` із B1b і B12 прибрати (середовищем володіє `look.ts`). Око — те саме `createEye(ctx, { fov: LENS.fov, hide: () => (hiding ? yard.hidden : []) })`, його камера — дитина `yard.anchors.lens`; плаваючий екран висить біля стовпа й лежить у `yard.hidden`; перемикач `eye` лишається. Другий екран B1b (0,8 × 0,6 м, показує той самий кадр ока) лишається дитиною камери ока й теж лежить у `yard.hidden`; лишаються й перемикачі `inner` (другий екран є чи прибраний) і `hiding` (вимкнений — `hide()` нічого не ховає) та поле `radio-eye.inner` = `{ shown, hiding, rect }` (`rect` — комірки кадру ока під другим екраном, з `eye.project` його чотирьох кутів, або `null`): на них стоїть перевірка `hide` розділу `eye`, а без поля вона падає. Місце другого екрана в осях камери — як у B1b, (1,2; 0,5; −3,5), якщо на подвір’ї між ним і оком нічого не стоїть, усі чотири його кути лежать у кадрі ока, а в ракурсі `eye` він не закриває плаваючого екрана; інакше — інше місце, де це виконано. Видно його лише в кроках `eye` і `far`, де живуть його перемикачі; в інших кроках він схований, тож у знімки й промені `screenClear` і `cellarSeen` розділу `yard` не потрапляє. Кроки `eye` (власний ракурс пісочниці: стовп із камерою й плаваючий екран у кадрі, екран вищий за 96 px, як у B1b) і `far` (ракурс `top`). Мітки `radio-eye.seen`: `light` — `places.shedWall`, `dark` — `places.nook`, `wicket` — `places.wicket`, `cat` — світове місце якоря `cat`. Розділ `eye` працює без змін — усі одинадцять перевірок, разом із `hide`.
  Крок `yard`, керування: `shot` (вибір із восьми ракурсів; `screen` тут — `screenShot(route)` і йде за монітором: `ctx.camera.go(…, { duration: 0.4 })` на зміну `route`), `dusk` (0…1), `route` (0…4, крок 0,01), `nudge` (−0,15…0,15), `wicket` (−1…1), `gate`, `tray` (0…1); підписи — в `SANDBOX.labels`. `ctx.qa.expose('radio-yard', () => ({ dusk, lantern, shot, grain: ctx.post.params.grain, want, screenClear, cellarSeen }))`: `want` = `{ cameraAntenna: LAYOUT.tx, lens: LENS.position, monitorAntenna: monitorPlace(route, nudge).position, monitorScreen: screenPlace(route, nudge) }`; `screenClear` рахується під час читання — п'ять променів `Raycaster` від `ctx.camera.camera` до центра екрана й чотирьох точок на 40 % його півширини й піввисоти (в осях якоря `monitorScreen`): `true`, якщо жоден видимий меш під `yard.root` не перетинає промінь ближче ніж за 2 см до точки. `cellarSeen` теж рахується під час читання: промінь `Raycaster` від `ctx.camera.camera` крізь середину `LAYOUT.plan.house.slabCut` на висоті підлоги (y 0) — `true`, якщо найближчий видимий меш під `yard.root`, який він перетинає, лежить у групі `yard.root.getObjectByName('cellarFloor')` (частина `cellarFloor` дому, B12, крок 4). Розділ `yard` (сторінка `…/yard`, `freeze: 1`):

  | Перевірка | Умова |
  |---|---|
  | `frames` | для кожного з восьми ракурсів: `__ui.set('shot', k, true)`, `__app.step(1 / 60, 120)`; `stats().drawCalls ≤ 350`, `stats().triangles ≤ 1 500 000`, `hueFamilies(decodePng(знімок)).families.length ≤ 4`; знімок `yard-<ракурс>.jpg`; у `yard` — `__app.locate('yard:cat').visible` і `…('yard:wicket').visible`; у `both` — `yard:lens` і `yard:monitorScreen` |
  | `places` | `__app.locate('yard:cameraAntenna').world` проти `want.cameraAntenna` — до 1e-3 м; `yard:lens` проти `want.lens` — до 0,15 м; для `route` 0…4 і `nudge` ±0,15: `yard:monitorAntenna` і `yard:monitorScreen` проти `want` — до 1e-3 м |
  | `seen` | за `dusk` 0,2 і 1 (після `__app.step(1 / 60, 30)`): усі чотири `seen.*.cell` не `null`; `light.luma ≥ 200` (стіна сараю — біле); `dark.luma ≤ 70` (закуток — чорне); `cat.luma ≥ 200` і `cat.luma − cat.around ≥ 60` (цятку видно) |
  | `tones` | за `dusk` 0,2 і 1, у рядку `r = seen.cat.cell.row + 4` масиву `radio-luma` (рядок тулуба, як `places.row()` C5): (а) смуга довкола стовпчика `seen.cat.cell.col + 3`, де яскравість відходить від тамтешньої не більш як на 12, — ≥ 5 комірок, а середнє п’яти комірок гравію одразу за смугою з боку голови (менші стовпчики) щонайменше на 40 більше за середнє смуги; (б) праворуч від `seen.wicket.cell.col − 8` у рядку `r` щонайменше п’ять пар сусідніх комірок різняться понад 45 (штахета проти проміжку ≥ 90, край ділить комірку навпіл) |
  | `screenClear` | у ракурсах `screen` і `route` для `route` 0…4: `yard:monitorScreen` має `visible`, і `radio-yard.screenClear === true` |
  | `cellar` | у ракурсі `route` за `route` 0 (`__ui.set('shot', 'route', true)`, `__ui.set('route', 0, true)`, `__app.step(1 / 60, 120)`): `radio-yard.cellarSeen === true` — крізь виріз у підлозі видно підлогу льоху |
  | `look`, `ui` | `radio-yard.grain === 0` (П2); три знімки `both` за `dusk` 0, 0,5 і 1, на кожному `hueFamilies(decodePng(знімок)).families.length ≤ 4`; `__ui.offscreen()` порожній; `appErrors(page)` порожній |
- [ ] **Крок 8. Зняти й переглянути**
  Блок Q з `--only eye,yard`, потім із `--only yard --touch --size 390x844` → обидва `PASS sandbox-radio-link`. Рядок «подвір'я» (`liveMs`, `heldMs`, `lastCalls`, `intervalOff`) дописати в розділ «1. Око камери» звіту. **Якщо `eye/budget` на справжньому подвір'ї не проходить** — записати ці числа, зупинитися й доповісти власникові: це ті самі ворота рішення 24, запасний шлях (проєкт III §4) потребує нового плану. На знімках перевіряємо за чек-листом `VISUAL.md` «Чек-лист аудитора кадру» і окремо: (1) на плаваючому екрані кроку `eye` (це те, що бачить камера) читаються кіт на паркані, хвіртка, біла стіна сараю й темний закуток; (2) у `both` видно і стовп, і вікно з монітором; на телефоні — теж, без обрізаних країв; (3) у `route` видно кухню, коридор, дальню кімнату з підлогою й, крізь виріз у перекритті, льох із його підлогою, стіни між ними розрізнювані, і зупинку надворі; трави в домі немає, довкола стін — вимощення, а краю ями не видно; (4) за `dusk` 0,5 і 1 ліхтар горить, кіт і штахети контрастні; (5) нічого не миготить і не «плаває» між двома знімками одного кадру; (6) не більш як чотири родини відтінків. Знайдене правимо в `models/`, `layout.ts`, `look.ts` і знімаємо знову.
- [ ] **Крок 9. Записати вибране у `VISUAL.md`**
  У таблицях A5 «Подвір’я» (рядки `places.*`, сарай, гараж, телефон, острів, `LENS.lookAt`; висоти підвіконня `VISUAL.md` окремо не пише — вона випливає з монітора) і «Ракурси» замінити початкові числа вибраними (рядок `screen` — числа `screenShot(1)`: `target` і `fit.center` — `screenPlace(1)`, `fit.radius` 0,45; куля 0,35 довкола прутика кутів екрана не тримає), переведеними назад в осі плану (точка сцени `[X, Y, Z]` → `[X, −Z, Y]`; `yaw` — у градусах), — ті самі рядки й перші комірки; у рядку зупинок — кут екрана на кожній (`STOP_YAW`); під «Ракурсами» — `SCREEN_VIEW`. `python3 docs/volumes/radio/check.py` → `radio check: OK`.
- [ ] **Крок 10. Коміт** — `git add app/src/volumes/radio/shared/yard/{layout,look,shots,index}.ts app/src/volumes/radio/shared/yard/__tests__/{layout,look,shots}.test.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/{index.ts,scene.ts,qa/measure.mjs} docs/volumes/radio/VISUAL.md docs/volumes/radio/reports/batch2-model.md` (і кожен файл `app/src/volumes/radio/shared/models/…`, який правив крок 3 (`HOUSE_SKIRT`, якщо острів рухали) чи крок 8, поіменно) · `git commit -m "Подвір'я: розкладка з чисел моделі, сутінки, ракурси й крок пісочниці"`

### Завдання B14. Світ: `shared/world`

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `app/src/volumes/radio/shared/world/index.ts`, `app/src/volumes/radio/shared/README.md`
- Тест: `app/src/volumes/radio/shared/world/__tests__/world.test.ts`

**Інтерфейси:**
- Бере: `mountYard`, `LENS` (B13); `createEye`, `createScreen`, `EYE_COLS`, `EYE_ROWS` (B1a); `createLink` (B11); `MONITOR_SCREEN` (B12); `DEFAULT_STATE`, `COLS`, `ROWS` з `@radio/sim/core`; `damp` з `@/engine/api`. `WorldOptions`, `RadioWorld`, `mountWorld`, склад `radio-world` — див. Спільний договір.
- Дає: `createWorld(ctx, parts: { yard: Yard; eye: Eye; screen: Screen; link: Link | null; frozen: boolean }, opts?: WorldOptions): RadioWorld` — та сама логіка на готових частинах, для тестів; `mountWorld` будує частини й кличе її. `fnv1a(bytes: Uint8Array): string` — вісім шістнадцяткових цифр. Реекспорт для глав і пісочниць — перелік під блоком «Світ» Спільного договору (том `_dev` не може імпортувати `@radio/sim/**`, П7).

- [ ] **Крок 1. Написати тест**
  ```ts
  // make({ frozen, link = true }) будує createWorld на підробках і лічить виклики: calls = { capture, still, pump, show, disposed: [] }
  //   eye.capture → calls.capture++ і той самий Uint8Array(12288); link.pump на кожному 4-му виклику бере luma() й повертає true;
  //   link.still → calls.still++ і відповідь із заданим screen; screen.show → calls.show++; tick(dt) ставить ctx.clock.dt і кличе world.update(dt, t)
  it('зупинений кадр: один still, і лише коли щось змінилося', () => { const { world, calls, tick } = make({ frozen: true });
    for (let i = 0; i < 180; i++) tick(1 / 60); expect([calls.capture, calls.still, calls.pump]).toEqual([0, 0, 0]);
    tick(0); expect([calls.capture, calls.still, calls.show]).toEqual([1, 1, 1]);
    tick(0); expect(calls.still).toBe(1);
    world.line.air.route = 3; tick(0); expect(calls.still).toBe(2);
    world.probe = { tap: 'air.rx', view: 'strip', start: 0, span: 1, columns: 256 }; tick(0); expect(calls.still).toBe(3);
    tick(1 / 60); tick(0); expect(calls.still).toBe(4);
    world.yard.wicket = 0.5; tick(0); expect(calls.still).toBe(5); world.yard.dusk = 0.9; tick(0); expect(calls.still).toBe(6); });
  it('жива сторінка: pump раз на оновлення, око й екран — раз на кадр моделі', () => { const { calls, tick } = make({ frozen: false });
    for (let i = 0; i < 60; i++) tick(1 / 60); expect([calls.pump, calls.capture, calls.show, calls.still]).toEqual([60, 15, 15, 0]); });
  it('подвір’я слухає лінію', () => { /* line.air = { route: 2.5, nudge: 0.05, gate: 1, tray: 0.5 } → yard.monitorAt(2.5, 0.05), yard.garageGate === 1, yard.tray === 0.5 */ });
  it('вимкнений монітор гасне, увімкнений світить на кухню', () => { /* on = false, tick(0) → screen.power === 0 і yard.screenLight === 0;
    on = true, екран, де кожна комірка 128, tick(0) → */ expect(world.yard.screenLight).toBeCloseTo(128 / 255, 6); });
  it("link: 'off' → без моделі, екран темний", () => { /* world.link === null, meters === null; після 60 оновлень із типовим line.monitor.on === true: screen.power === 0, calls.capture === 0 */ });
  it('resetLine повертає DEFAULT_STATE, не міняючи об’єкта', () => { const { world } = make({ frozen: false }); const ref = world.line;
    world.line.air.route = 4; world.line.monitor.lineLength = 290; world.resetLine(); expect(world.line).toBe(ref); expect(world.line).toEqual(DEFAULT_STATE); });
  it('звільнення', () => { /* виконати все з ctx.onDispose → calls.disposed toEqual ['link', 'eye', 'screen'] */ });
  it('radio-world: числа для перевірок', () => {
    /* екран із нулів */ expect(read()).toMatchObject({ mode: 'sync', frames: 1, screenHash: '52965dc5', screenMean: 0, screenNoise: 0 });
    /* екран 0, 10, 0, 10, … */ expect(read()).toMatchObject({ screenMean: 5, screenNoise: 10 }); });
  it('кадр ока дорівнює кадрові моделі', () => expect([EYE_COLS, EYE_ROWS]).toEqual([COLS, ROWS]));
  ```
- [ ] **Крок 2. Побачити, що тест падає** — `cd app && pnpm test src/volumes/radio/shared/world` → `Cannot find module '..'`.
- [ ] **Крок 3. Написати `world/index.ts`**
  - `mountWorld`: `frozen = new URLSearchParams(globalThis.location?.search ?? '').has('freeze')` (П11); `yard = mountYard(ctx, { dusk })`; `screen = createScreen(MONITOR_SCREEN)` на якорі `monitorScreen`; `eye = createEye(ctx, { fov: LENS.fov, hide: () => yard.hidden })`, його камера — дитина якоря `lens`; лінія — `opts.link === 'off' ? null : createLink(ctx, { seed: opts.seed ?? 1, mode: frozen || opts.link === 'sync' ? 'sync' : 'auto' })` (на зупиненій сторінці потік не створюємо). `line = structuredClone(DEFAULT_STATE)`.
  - `update(dt, t)`, порядок: (1) `yard.monitorAt(line.air.route, line.air.nudge)`, `yard.garageGate = line.air.gate`, `yard.tray = line.air.tray`, `yard.update(dt, t)` — глави `yard.update` не кличуть; (2) `screen.power` іде до `link !== null && line.monitor.on ? 1 : 0`: `damp(…, 8, dt)`, а за `dt === 0` — одразу; (3) модель: без лінії — нічого; на зупиненій сторінці — `dt > 0` лише ставить позначку «змінилося», а `dt === 0` за наявності позначки або зміни `JSON.stringify([line, probe, yard.dusk, yard.wicket])` дає `screen.show(link.still(line, eye.capture(), probe).screen)` і знімає позначку; на живій — `if (link.pump(line, () => eye.capture(), probe)) screen.show(link.frame.screen)`; (4) `yard.screenLight = screen.power · середнє показаного екрана / 255` (середнє рахується в момент `show`).
  - `meters`, `probeData` — з останньої показаної відповіді; `luma` — масив ока. `resetLine` копіює поля `DEFAULT_STATE` у наявні об'єкти `line.air`, `line.camera`, `line.monitor`.
  - `ctx.qa.expose('radio-world', …)`: `mode` — режим лінії або `'off'`; `frames` — скільки екранів показано; `fps` — `link.fps`; `modelMs` — `ms` останньої відповіді; `screenHash` — `fnv1a` (FNV-1a: початок `0x811c9dc5`, множник `0x01000193`) по 12 288 байтах; `screenMean`; `screenNoise` — середнє `|a[r][c + 1] − a[r][c]|` по всіх рядках; `eye` — чотири числа ока. Хеш і середні рахуються під час читання, не щокадру.
  - Звільнення: один `ctx.onDispose(() => { link?.dispose(); eye.dispose(); screen.dispose(); })` (Review Focus 3).
- [ ] **Крок 4. Побачити, що тест проходить** — та сама команда → `Tests  9 passed (9)`; `pnpm typecheck && pnpm lint` — без виводу.
- [ ] **Крок 5. Написати `shared/README.md`**
  За зразком `app/src/volumes/circuit/shared/world/README.md`: фрагмент «Mount» (`const world = mountWorld(ctx)` у фабриці сцени, `world.update(dt, t)` в `update`, на вході в крок — `world.resetLine()` і власний стан), таблиця параметрів `line` і `yard`, правила («світ володіє середовищем і пост-обробкою», «усе, чого камера у дворі бачити не повинна, — у `yard.hidden`», «екран змінюють лише ручки лінії», «на зупиненій сторінці зміни сцени поза `line`, `probe`, `yard.dusk` і `yard.wicket` доходять до екрана після `__app.step`»), перелік частин `shared/` із чергою кожної: `probe`, `stand`, `map`, `screen/runner`, `screen/inset` — черга 3; «повільний екран» у `screen` — черга 7 (глава `raster`).
- [ ] **Крок 6. Коміт** — `git add app/src/volumes/radio/shared/world/index.ts app/src/volumes/radio/shared/world/__tests__/world.test.ts app/src/volumes/radio/shared/README.md` · `git commit -m "Світ тому: подвір'я, око камери, лінія й екран за однією точкою входу"`

### Завдання B15. Мініатюра «де ми»: `shared/whereami`

**Виконавець:** Opus 5.5

**Файли:**
- Створити: `app/src/volumes/radio/shared/whereami/model.ts`, `…/whereami/dom.ts`, `…/whereami/index.ts`
- Тест: `app/src/volumes/radio/shared/whereami/__tests__/model.test.ts`
- Змінити: `app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts`, `…/scene.ts` (крок `where`), `…/qa/measure.mjs` (розділ `whereami`)

**Інтерфейси:**
- Бере: `SITE`, `Site`, `routePoint` (B6b); `domKit` (`h`, `svg`, `setText`), `Label` — з `@/hud` і `@/ui3d`; `CustomSpec`, `SliderSpec` (`hud/step-ui-types.ts:28-43, 122-136`). `WhereAmIOptions`, `whereami`, `whereAt`, `routeSlider`, `nudgeSlider` — див. Спільний договір.
- Дає:

  ```ts
  // model.ts — чистий; план: x — схід, y — північ, метри
  export type Pt = readonly [number, number];
  export interface PlanPoint { x: number; y: number; below: boolean }          // below — під перекриттям (z < site.slabZ): льох
  export function planOf(site: Site): { box: readonly [number, number, number, number]; walls: readonly { a: Pt; b: Pt }[]; tx: Pt; route: readonly PlanPoint[] };
  export function markerAt(site: Site, route: number, nudge: number): PlanPoint;
  export function nearestStop(route: number): 0 | 1 | 2 | 3 | 4;
  // index.ts — сигнатури зі Спільного договору: whereAt — { x, y } з markerAt(SITE, …), для глав і пісочниць, яким sim/** закрито;
  //   routeSlider ставить позначки на цілих зупинках; nudgeSlider показує сантиметри
  ```

  Повзунки маршруту й «посунути антену» — звичайні `SliderSpec` кроку під планом, а не частина малюнка (П21: кероване поле панелі рушій дає лише такими; факти: `chapter-api.md` §7.4); межі й кроки живуть в одному місці — у двох функціях вище, глава додає свій `onChange`. Ідентифікатор віджета — `whereami`; у DOM: `data-ui="ctl-whereami"` (корінь), `ctl-whereami:dot` (цятка монітора), `ctl-whereami:stop` (назва зупинки), `ctl-whereami:nudge` (риска на шкалі ±15 см; `data-value` — `nudge().toFixed(3)`), `ctl-whereami:depth-0…2`.

- [ ] **Крок 1. Написати тест моделі**
  ```ts
  it('найближча зупинка', () => { expect(nearestStop(-3)).toBe(0); expect(nearestStop(2.49)).toBe(2); expect(nearestStop(2.5)).toBe(3); expect(nearestStop(9)).toBe(4); });
  it('цятка стоїть на зупинках SITE', () => { for (let i = 0; i < 5; i++) expect(markerAt(SITE, i, 0)).toMatchObject({ x: SITE.route[i][0], y: SITE.route[i][1] }); });
  it('льох — під перекриттям, кухня — ні', () => { expect(markerAt(SITE, 4, 0).below).toBe(true); expect(markerAt(SITE, 1, 0).below).toBe(false); });
  it('між зупинками й уздовж nudge', () => { expect(markerAt(SITE, 1.5, 0).x).toBeCloseTo((SITE.route[1][0] + SITE.route[2][0]) / 2, 9);
    expect(markerAt(SITE, 2, 0.15).x - markerAt(SITE, 2, 0).x).toBeCloseTo(0.15 * SITE.nudgeAxis[0], 9); });
  it('план містить усе з полем 1 м', () => { const p = planOf(SITE); expect(p.route).toHaveLength(5); expect(p.walls).toHaveLength(SITE.walls.length);
    expect(p.tx).toEqual([SITE.tx[0], SITE.tx[1]]);   // кружок камери на стовпі — у tx (VISUAL.md §3)
    for (const q of [...p.route, { x: p.tx[0], y: p.tx[1] }]) { expect(q.x).toBeGreaterThanOrEqual(p.box[0] + 1); expect(q.x).toBeLessThanOrEqual(p.box[2] - 1);
      expect(q.y).toBeGreaterThanOrEqual(p.box[1] + 1); expect(q.y).toBeLessThanOrEqual(p.box[3] - 1); } });
  it('повзунки: межі й кроки в одному місці', () => {
    expect(routeSlider({ label: 'a', stops: ['0', '1', '2', '3', '4'] })).toMatchObject({ type: 'slider', id: 'route', min: 0, max: 4, step: 0.01, value: 1 });
    expect(routeSlider({ label: 'a', stops: ['1', '2', '3', '4'], from: 1 })).toMatchObject({ min: 1, marks: [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }] });
    expect(nudgeSlider({ label: 'b', unit: 'u' })).toMatchObject({ id: 'nudge', min: -0.15, max: 0.15, step: 0.005, value: 0, unit: 'u' }); });
  ```
- [ ] **Крок 2. Побачити, що тест падає** — `cd app && pnpm test src/volumes/radio/shared/whereami` → `Cannot find module '../model'`.
- [ ] **Крок 3. Написати `model.ts`, а в `index.ts` — `whereAt` і повзунки** — `markerAt` = `routePoint(site, route) + nudge · [nudgeAxis[0], nudgeAxis[1], 0]`, спроєктоване на план; `box` — обвідна стін, точки `tx` (кружок камери на стовпі) й зупинок плюс 1 м. `nudgeSlider` показує сантиметри: `format: (v) => String(Math.round(v * 100))`. → `Tests  6 passed (6)`.
- [ ] **Крок 4. Написати `dom.ts` і `whereami` в `index.ts`**
  `dom.ts`: `buildWhereAmI(opts): DomWidget`. Корінь — звичайний `h('div', { 'data-ui': 'ctl-whereami' })`; у ньому по черзі: заголовок `labels.title`; `h('div.kd-diagram')` з `style.setProperty('--h', '150')` і єдиною дитиною `<svg>` (клас платформи розтягує свою дитину-`svg` на всю висоту, тому решта рядків стоїть поза ним); назва найближчої зупинки; шкала ±15 см — лише риски, без тексту, з рискою `nudge`; три позначки глибини з `aria-current="true"` на поточній. `<svg viewBox>` — метри плану з північчю вгору: `box[0] −box[3] ширина висота`, точка плану `(x, y)` малюється в `(x, −y)`; стіни — лінії `var(--c-steel)`, камера на стовпі — кружок `var(--c-sky)` у точці `tx` з `planOf` (`VISUAL.md` §3: звідси модель шле хвилю; сам стовп, `places.pole`, стоїть на 0,35 м північніше, і в масштабі плану це та сама точка — мініатюра бере лише `SITE`), маршрут — штрихова ламана `var(--c-mist)`, цятка монітора — `var(--c-yellow)` з `cx = x`, `cy = −y` (коли `below` — порожня, з обведенням, і `data-below="true"`). Свого CSS немає: розміри рядків — інлайн через `var(--u)`. `update()` пише в DOM лише коли змінилися `route()`, `nudge()` чи `depth()`; за вказівником нічого не рухається. `index.ts`: `whereami(ctx, opts)` повертає `{ type: 'custom', id: 'whereami', node, dom: () => buildWhereAmI(opts), update }`, де `node` — `new Label(…)` з назвою найближчої зупинки (інтерфейс WebGL), а `update` оновлює його текст. Усі слова — з `opts.labels`.
- [ ] **Крок 5. Додати крок `where` у пісочницю й розділ `whereami`**
  Крок `where` — набір керування, як у главі: віджет `whereami(ctx, { labels: SANDBOX.labels.whereami, route, nudge, depth })`, під ним `routeSlider` і `nudgeSlider` (вони заступають повзунки `route` і `nudge` кроку `yard`: одні об'єкти керування на обидва кроки) і вибір `depth` (пункти `'0'`, `'1'`, `'2'`); ракурс `route`. `SANDBOX.labels.whereami` = `{ title: 'Де ми', stops: ['подвір’я', 'кухня', 'коридор', 'дальня кімната', 'льох'], depth: ['подвір’я', 'стенд', 'під лупою'] }`. `ctx.qa.expose('radio-sandbox', () => ({ where: whereAt(route, nudge) }))`. Розділ `whereami` (сторінка `…/where`, `freeze: 1`):

  | Перевірка | Умова |
  |---|---|
  | `dom` | корінь `[data-ui="ctl-whereami"]` є, і в ньому немає тексту «ще не має 2D-версії» |
  | `dot` | після `__ui.set('route', 3, true)` і `held`: `cx` і `cy` цятки дорівнюють `where.x` і `−where.y` з `radio-sandbox` (до 1e-6); `ctl-whereami:stop` показує «дальня кімната»; після `route = 4` цятка має `data-below="true"` |
  | `nudge` | після `__ui.set('nudge', 0.15, true)`: `data-value` риски — `'0.150'`, а `cx` цятки змінився |
  | `depth` | після `__ui.set('depth', '2', true)` позначка `ctl-whereami:depth-2` має `aria-current="true"` |
  | `phone` (лише з `--touch`) | після `__ui.setSheet({ tab: 'controls', snap: 'full' })`: прямокутник `__ui.locate('ctl-whereami')` цілком у вікні 390 × 844 і цілком у прямокутнику `__ui.locate('sheet')`; у `__ui.offscreen({ clipped: true, partial: true })` немає імен, що починаються з `ctl-route` чи `ctl-nudge` |
  | `console` | `appErrors(page)` порожній (попередження «has no 'dom' widget» теж є провалом) |
- [ ] **Крок 6. Запустити** — Блок Q з `--only whereami`, потім із `--only whereami --touch --size 390x844` → обидва `PASS sandbox-radio-link`. На знімку телефона план читається в панелі, цятка й назва зупинки видимі разом із повзунком маршруту.
- [ ] **Крок 7. Коміт** — `git add app/src/volumes/radio/shared/whereami/{model,dom,index}.ts app/src/volumes/radio/shared/whereami/__tests__/model.test.ts app/src/volumes/_dev/chapters/_sandbox-radio-link/{index.ts,scene.ts,qa/measure.mjs}` · `git commit -m "Мініатюра «де ми»: план подвір'я й дому з маршрутом монітора"`

### Завдання B16. Пісочниця «живий екран» і виміри

**Виконавець:** Opus 5.5

**Файли:**
- Змінити: `app/src/volumes/_dev/chapters/_sandbox-radio-link/index.ts` (кроки `live`, `still`, підписи), `…/scene.ts` (сцена на `mountWorld`), `…/qa/measure.mjs` (розділи `ladder`, `repeat`, `live`, `bench`, `leaks`)
- Змінити: `docs/volumes/radio/reports/batch2-model.md` (розділи «Машина», «Швидкість», «Вердикт», «Що видно в пісочниці»)

**Інтерфейси:**
- Бере: `mountWorld`, `DEFAULT_STATE`, `fnv1a`, `screenShot`, типи (B14, лише через `@radio/shared/world`); `whereami`, `routeSlider`, `nudgeSlider`, `whereAt` (B15); числа B9c і B10 зі звіту; мірила швидкості — абзац під складом `radio-world` у Спільному договорі.
- Дає: кроки пісочниці `eye`, `far`, `yard`, `where`, `live`, `still`; `__app.read('radio-bench')` → `{ stillMs: number; frameMs: number }`; `radio-sandbox` → `{ where, lumaHash, stillHash }`; заповнений звіт черги.

- [ ] **Крок 1. Дописати розділи `measure.mjs`**

  | Розділ | Сторінка | Перевірки |
  |---|---|---|
  | `ladder` | `…/still`, `freeze: 1` | `radio-world.mode === 'sync'` (П11); для `route` 0…4: `__ui.set('route', r, true)`, `__app.step(1 / 60, 60)`, чекати, поки `radio-world.frames` зросте; `yard:monitorScreen` має `visible`, і `radio-yard.screenClear === true`; `meters.rxDbm` у межах ± 1,5 dB від −54 / −62 / −70 / −78 / −88; `screenNoise` строго росте від зупинки 1 до 4 («сніжить за стіною»); знімки `still-route-<r>.jpg` |
  | `repeat` | та сама адреса, відкрита двічі | (а) `stillHash` однаковий — модель у браузері залежить лише від зерна, стану й кадру; (б) `lumaDiff` двох `radio-luma` ≤ 12 — око повторюється; (в) якщо `lumaHash` однаковий, то й `screenHash` однаковий; якщо різний — `|Δ screenMean| ≤ 1` і `|Δ screenNoise| ≤ 0.5`. У `measure.json` — обидва хеші, `lumaDiff` і найбільша різниця комірок |
  | `live` | `…/live`, без `freeze`, 1280 × 720 | за 5 с: `mode === 'worker'`, `frames > 0`, `meters` не `null`, `yard:monitorScreen` має `visible`; **мірило комп'ютера: середнє `modelMs` за 20 відповідей потоку ≤ 100** (читати `radio-world` через `requestAnimationFrame`, брати число, коли зріс `frames`); записати `fps`, `modelMs`, числа ока |
  | `bench` | `…/live` | `__app.read('radio-bench')` звичайно — `frameMs` лише записати; і після `(await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 })` (потім `rate: 1`) — **мірило телефона: `frameMs ≤ 250`** (П10) |
  | `leaks` | `…/live`, без `freeze` | три рази `goto('_sandbox-ui')` і назад (потік щоразу створюється й зупиняється): `geometries`, `textures`, `programs` після третього повернення не більші, ніж після першого; `mode === 'worker'`; не пізніш як за 5 с `page.workers().length === 1`; `appErrors(page)` порожній |

  Мірила — зі Спільного договору: комп'ютер — `modelMs` фонового потоку, телефон — кадр моделі в основному потоці під чотирикратним сповільненням (сповільнення на потік не діє, П10). Програмний рендер ділить ядра з потоком, тож `modelMs` тут — оцінка згори, у звіт — з приміткою «під програмним рендером»; `frameMs` без сповільнення й `fps` лише записуємо (`fps` упирається в кадр сцени, 75–97 ms, факти: `baseline-checks.md`). Розділ `eye` на сторінці з читачем `radio-world` пропускає `drawCalls`, `hide`, `budget` і `leaks`: світ ока не вимикає й другого екрана перед ним не має, а на зупиненій сторінці знімає кадр ока лише тоді, коли змінилися `line`, `probe`, `yard.dusk` чи `yard.wicket` (B14), тож перемикачі другого екрана до `radio-luma` не дійшли б; `hide()` з `yard.hidden` на тому самому подвір’ї вже перевірив B13, ціну проходу на подвір’ї — теж B13, витоки дивиться розділ `leaks`. Решта сім перевірок `eye` — `opened`, `passes`, `picture`, `orientation`, `screen`, `shots`, `console` — лишається.
- [ ] **Крок 2. Побачити, що нові розділи падають** — Блок Q з `--only ladder` → `FAIL … opened`: кроку `still` ще немає, `FAIL 1 of 1`.
- [ ] **Крок 3. Перебудувати сцену на світі й додати кроки**
  Сцена: `const world = mountWorld(ctx, { seed: 1, dusk: 0.2 })` замість `mountYard` і власного ока; перемикач `eye`, другий екран перед оком і його перемикачі `inner`, `hiding` прибрати (перевірку `hide` розділ `eye` тут пропускає, крок 1). Вхід у будь-який крок: `world.resetLine()`; усі кроки з `reset: true`. Типові значення керування дорівнюють `DEFAULT_STATE` (`reset: true` повертає їх без `onChange`), а сцена в кожному оновленні переписує `ui.value(…)` керування поточного кроку у `world.line` і `world.yard` — так повзунок і лінія не розходяться після повторного входу. Підписи — в `SANDBOX.labels`. Читачі B1b, B13 і B15 лишаються (`radio-eye` — без поля `inner`) й читають `world.eye`, `world.luma`, `world.yard`.
  - `eye`, `far` — ракурси як у B13; плаваючий екран показує `world.luma` (що бачить камера) поруч із монітором (що дійшло крізь лінію); другого `capture()` немає.
  - `yard`, `where` — як у B13 і B15; `route`, `nudge`, `gate`, `tray` тепер ідуть у `world.line.air`.
  - `live` — керування: `view` (вибір: `screen` — типово, камера йде за монітором, як `shot: 'screen'` у кроці `yard`; `both`; `route`), `on` (перемикач → `line.monitor.on`), `route`, `nudge`, `tray`, `gate` (0…1), `power` (0,1…10 mW, `scale: 'log'`, позначки 0,1 · 1 · 10 → `line.air.txPowerMw`), `channel` (вибір 1–4 → `line.air.txChannel`), `router`, `oven` (перемикачі → `line.air`), `sync` (перемикач → `line.camera.sync`), `line` (280…296, крок 0,5 → `line.monitor.lineLength`), `detector` (вибір `slope` | `angle`), `limiter` (перемикач), віджет `whereami`; показники `rxDbm` і `fps`.
  - `still` — камера йде за монітором (`screenShot(route)`); `route`, `nudge` і показники `rxDbm`, `cnrDb`, `syncLost`.
  - `ctx.qa.expose('radio-bench', …)`: десять разів `world.link.still(world.line, world.luma, null)`, середнє поля `ms` відповіді → `stillMs`; `frameMs = stillMs / 2` (кадр `still` — це два кадри моделі: розгін і сам кадр). `performance.now` у файлах глав заборонено лінтом, тому час бере лінія. До `radio-sandbox` додати `lumaHash = fnv1a(world.luma)` і `stillHash = fnv1a(world.link.still(DEFAULT_STATE, PATTERN, null).screen)`, де `PATTERN[i] = (i · 7) % 256` — кадр за формулою, без ока.
- [ ] **Крок 4. Запустити всі розділи**
  Блок Q з `--only eye,yard,whereami,ladder,repeat,live,bench,leaks` → `PASS sandbox-radio-link`; `ls app/dist/assets | grep -c 'model.worker-'` → `1`. Якщо не проходить:
  - `ladder` за рівнями — повернутися до B6a і пересунути стіни в `site.json`; цілі не чіпати. `screenNoise` не росте між кухнею й коридором — записати обидва числа у звіт і повернути B9c: проєкт вимагає «коридор — ледь зерно». `screenClear` — правити `STOP_YAW` чи `SCREEN_VIEW` у B13.
  - `repeat` (а) — модель у браузері не чиста: повернути B2 (тест чистоти) чи B11 (стан між `still`); (в) за однакового `lumaHash` — стан, що не входить у `(зерно, стан, кадр)`: шукати в `world` і `link`; (б) — шукати стан сцени, що залежить не лише від `t` (предмети B12, порядок оновлення). Допуски не розширювати.
  - мірило комп'ютера (`modelMs ≤ 100`) чи телефона (`frameMs ≤ 250`) — прискорення в порядку кроку 3 B10; останній його хід, `createFmLink(seed, { band: 'channel' })`, доходить до лінії лише крізь повідомлення: тоді до `init` у `protocol.ts` додати `opts?: { band?: 'full' | 'channel' }`, провести його через `LinkOptions` і `WorldOptions` і повторити тести обробника й лінії в обох режимах. Якщо й так нижче — зупинитися й доповісти власникові: WebAssembly в цей план не входить.
- [ ] **Крок 5. Перевірити фоновий потік під сервером розробки**
  Блок Q (одним фоновим викликом), у якому замість `pnpm build` і `pnpm preview` стоїть `(cd app && setsid nohup pnpm dev --host 127.0.0.1 --port 5378 --strictPort > "$QA_OUT/dev-5378.log" 2>&1 < /dev/null &)`, а далі порт 5378 у `curl`, `measure.mjs --port 5378 --out "$QA_OUT/sandbox-link-dev" --only live` і `site_stop 5378`. Результат (`PASS` або текст провалу) — рядком у звіт: черга 3 щодня працює саме під `pnpm dev`. Провал тут не зупиняє чергу, а йде власникові у звіті B17.
- [ ] **Крок 6. Переглянути знімки**
  На `still-route-0…4.jpg` (камера йде за монітором): 0 і 1 — чиста картинка: кіт, штахети, хвіртка, біла стіна; 2 — ледь помітне зерно; 3 — зерно з першими іскрами (короткі світлі й темні рисочки вздовж рядків); 4 — сніг, картинка ледве вгадується або рядки рвуться; у льоху екран видно в темряві. Скрізь: екран лише сірий; зерно сидить у комірках 128 × 96, а не в пікселях кадру; на самому кадрі зерна плівки немає; екран займає не більш як чверть кадру й не закритий стіною.
- [ ] **Крок 7. Дописати звіт**
  `docs/volumes/radio/reports/batch2-model.md`: «Машина» (`lscpu | grep 'Model name'`, рядок рендерера з `measure.json`); «Швидкість» — таблиця: кадрів за секунду в Node (B10), `frameMs` в основному потоці, `frameMs` під чотирикратним сповільненням, `modelMs` у фоновому потоці (під програмним рендером), `fps` сцени, результат під `pnpm dev`; «Вердикт» — два рядки проти мірила (комп'ютер: `modelMs ≤ 100` у фоновому потоці, поруч — Node з B10; телефон: `frameMs ≤ 250` під чотирикратним сповільненням) і що з того випливає; «Що видно в пісочниці» — таблиця п'яти зупинок (`rxDbm`, `screenNoise`, що на екрані — словами з кроку 6), числа `repeat`, адреса `#/_dev/_sandbox-radio-link/live` і команда, що знімає знімки заново (Блок Q з `--only ladder`). Знімків у репозиторій не кладемо. Сходинки й злам уже записав B9c; тут додається стовпчик «у пісочниці» з `ladder`.
- [ ] **Крок 8. Коміт** — `git add app/src/volumes/_dev/chapters/_sandbox-radio-link/{index.ts,scene.ts,qa/measure.mjs} docs/volumes/radio/reports/batch2-model.md` (і кожен файл, змінений запасним ходом кроку 4, поіменно) · `git commit -m "Пісочниця з живим екраном і виміри швидкості моделі"`

### Завдання B17. Ворота черги 2, надсилання, звіт власникові

**Виконавець:** Opus 5.5

**Файли:**
- Змінити: `docs/volumes/radio/reports/batch2-model.md` (розділ «Підсумок»)

**Інтерфейси:**
- Бере: блок «Ворота черги» зі Спільного договору; Блок Q; `tools/site/smoke.mjs --url` (A7); спосіб стежити за запуском Pages (A9, крок 3).
- Дає: чергу 2 в `main`, оновлений сайт і звіт.

- [ ] **Крок 1. Пройти ворота**
  `git branch --show-current` → `main` (інакше спершу `git checkout main && git merge --ff-only <гілка>`; якщо злиття відмовлене, бо `main` пішла вперед, — у гілці `git rebase main`, потім знову `--ff-only`). Блок «Ворота черги» зі Спільного договору цілком, із двома перевірками зразків еталона черги 2: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — зелено; `doccheck: ALL GREEN`; `radio check: OK`; `python3 docs/volumes/radio/test_check.py 2>&1 | tail -1` → `OK`; `PASS site smoke`; `fm_chain: 8 fixture(s) up to date`; `link_budget: 2 fixture(s) up to date`; `git status --short` порожній. Додатково: рядок чисел `python3 docs/volumes/radio/check.py` (перед `radio check: OK`) — `radio check: journey 37 · path 20 · ledger terms 41 · links 8 · chapter documents 0 · cards 72`; `git log --first-parent --no-merges 63fd42c..HEAD --format=%B | grep -ciE 'co-authored-by|generated with|claude\.ai'` → `0` (лише наші коміти в `main`, як в A9).
- [ ] **Крок 2. Тести тому окремо** — `cd app && pnpm test src/volumes/radio` → усі файли `passed`, жодного `failed` чи `skipped`; серед них `purity.test.ts`, `emerges.test.ts`, `oracle.test.ts` (B2, B9c) і шість каталогів `shared/*/__tests__`.
- [ ] **Крок 3. Пісочниця** — Блок Q без `--only` → `PASS sandbox-radio-link`; ще раз із `--only yard,whereami --touch --size 390x844` → `PASS sandbox-radio-link`.
- [ ] **Крок 4. Пісочниці немає на сайті** — `ls tools/site/dist/assets | grep -c sandbox` → `0`; `ls tools/site/dist/assets | grep -cE 'electricity|circuit|_dev|_demo|_path'` → `0` (код виходу `grep` за нуля збігів — 1, це очікувано).
- [ ] **Крок 5. Дописати «Підсумок» у звіт і закомітити**
  Чотири речення: що збудовано; чи пройдено мірило й рішення щодо ока камери; які числа проєкту підтверджено (сходинки, злам) і які змінено; що відкрито для власника. Перед комітом `python3 docs/volumes/radio/check.py` → `radio check: OK`. Далі `git add docs/volumes/radio/reports/batch2-model.md` · `git commit -m "Звіт другої черги: числа моделі, око камери, швидкість"`; `git status --short` — порожньо.
- [ ] **Крок 6. Надіслати й перевірити сайт**
  `git push origin main` (без `--force`). Стежити за запуском саме цього коміту — блок команд кроку 3 завдання A9 без змін, у фоні (`run_in_background`): `SHA=$(git rev-parse origin/main)` після надсилання — це `HEAD`, а відбір `select(.head_sha == $s)` не дає прийняти попередній успішний запуск. Очікуване закінчення — `<id> completed success` (на `completed failure` — крок 4 A9: знайти крок, що впав; запасний хід — за таблицею «Якщо потік упав» у `tools/site/README.md`, а не за переліком A8. Для `Site profile` спершу журнал кроку: `site: … failed (work copy kept …)` чи рядки `FAIL` при запущеному браузері — дефект сайту, його відтворюємо тут і виправляємо без `--no-smoke`; `--no-smoke` — лише коли не стартує Chrome (`FAILED site smoke: cannot start Chrome …`) чи немає WebGL2); далі `node tools/site/smoke.mjs --url https://codir.github.io/radio-pop-science/ --volume radio` → `PASS site smoke`. Сайт після черги 2 виглядає як після черги 1 (вестибюль, П4): глав ще немає.
- [ ] **Крок 7. Доповісти власникові**
  Коротко українською: адреса звіту в репозиторії; вердикт проти мірила одним рядком; як подивитися живий екран у себе (`cd app && pnpm build && pnpm preview --host 127.0.0.1 --port 5377 --strictPort`, адреса `http://127.0.0.1:5377/?debug#/_dev/_sandbox-radio-link/live`, повзунок «Маршрут» від кухні до льоху — камера йде за монітором; під `pnpm dev` — результат із звіту, B16, крок 5); що потрібно від нього — швидкість на справжній відеокарті й телефоні (рішення 18), відповіді на питання звіту про відбиття від стулки воріт і про силу передавача (B9c) і згода починати пілот.
