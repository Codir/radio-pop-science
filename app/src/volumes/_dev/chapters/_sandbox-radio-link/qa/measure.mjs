#!/usr/bin/env node
/* global process, console, window, document, requestAnimationFrame, performance */
// Browser check and measurements of the sandbox `_dev/_sandbox-radio-link` (preview or dev server up; batch 2,
// Block Q builds the full tree, serves it on 5377 and runs this):
//
//   node app/src/volumes/_dev/chapters/_sandbox-radio-link/qa/measure.mjs --port 5377 --out <dir>
//        [--only eye,…] [--size 1280x720] [--touch]
//
// Sections (`--only`, default all):
//   eye   — the camera's eye (B1b): the extra renderer pass, the orientation of its frame, the floating screen, its
//           independence of the director's camera and of the engine's draw-call counter, `hide()` (a screen in
//           front of the eye stays out of its frame), its cost on a live frame (the gate of decision 24), leaks and
//           the console; snapshots `eye-<size>.jpg` and `far-<size>.jpg` (the same scene from step `far`). On a
//           page with the reader `radio-world` (the sandbox on the world, B16) the checks `drawCalls`, `hide`,
//           `budget` and `leaks` are left out: the world never switches the eye off and has no second screen in
//           front of it, and on a held page it takes an eye frame only when the line, the probe, the dusk or the
//           wicket changed, so the toggles of a second screen would never reach `radio-luma` (nor would held frames
//           time a pass: `heldMs` is not taken either); `hide()` on the same yard and the pass's cost there are B13's,
//           the leaks are section `leaks`.
//   yard  — the yard of the volume (B13) from its eight shots: draw calls, triangles and hue families of each, a
//           snapshot `yard-<shot>.jpg`; the camera's antenna and the monitor's antenna and screen where the model's
//           numbers put them; what the eye sees of the white wall, the nook and the cat's spot and the tones of its
//           frame (the cat's body against the gravel, pickets against gaps) at dusk 0.2 and 1; the monitor's screen in
//           clear view in `screen` and `route` along the route; the cellar's floor through the cut; no grain and
//           `both` within four hue families at dusk 0, 0.5 and 1; every control on screen; the console.
//   whereami — the miniature «where are we» (B15) in step `where`, with the controls a chapter has: a DOM widget, not
//           the platform's placeholder; the monitor's dot where `whereAt` puts it, the name of the nearest stop, the
//           hollow dot in the cellar; the tick of the nudge scale; the current depth mark; with `--touch`, the plan
//           and the route and nudge sliders whole in the phone's sheet; the console. Snapshot `where-<size>.jpg`.
//   ladder — the stops of the route on a held page (B16, step `still`, `?freeze=1`): the line synchronous (П11);
//           at each of the five stops a new `still` frame of the model, the monitor's screen in view and clear,
//           the level within ± 1.5 dB of −54 / −62 / −70 / −78 / −88 dBm, and the screen snowing more and more from
//           the kitchen to the cellar (`screenNoise` strictly up from stop 1 to 4); the console; snapshots
//           `still-route-<r>.jpg`.
//   repeat — the same held page opened twice: the model in the browser depends only on the seed, the state and the
//           frame (`stillHash` of a frame made by formula), the eye repeats itself, and the monitor shows the same.
//   live  — step `live` on the live clock: the model in a background thread within 5 s, its frames on the monitor;
//           the gate of a computer — the mean `modelMs` of 20 of the thread's replies ≤ 100 ms; the console;
//           snapshot `live-<size>.jpg`.
//   bench — the model's frame on the main thread (`radio-bench`) as it is and under a 4× CPU slowdown — the gate
//           of a phone, `frameMs` ≤ 250 (П10: the slowdown does not reach the background thread).
//   leaks — three visits to another chapter from step `live`: no geometry, texture or program left behind, the
//           thread made and stopped each time (one left within 5 s), the console.
// Every section starts with the check `opened` and goes no further when it fails. The numbers go to
// <out>/measure.json; the last line is `PASS sandbox-radio-link — <n> checks` (exit 0) or `FAIL <k> of <n>`
// (exit 1). `--touch` runs a phone-like page (device pixel ratio 3, touch, quality tier picked by the app).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  appErrors,
  appUrl,
  baseUrl,
  decodePng,
  ensureDir,
  hueFamilies,
  launch,
  openApp,
  parseArgs,
  parseSize,
  screenshot,
} from '../../../../../../../tools/qa/lib.mjs';

const CHAPTER = '_sandbox-radio-link';
const route = (step) => `_dev/${CHAPTER}/${step}`;
/** A page that has not opened within this time counts as not opened (an unknown route may never settle). */
const OPEN_TIMEOUT_MS = 180_000;
/**
 * The one console message the check `console` leaves out: `leaks` visits `_dev/_sandbox-ui`, which shows a
 * WebGL-only custom control on purpose (`_sandbox-ui/parts/dom-widgets.ts`, id 'legacy'), and the DOM interface warns
 * about it on every visit (`hud-dom/custom/index.ts`). Only this warning is left out; everything else counts.
 */
const VISIT_WARNING = "hud-dom: custom control 'legacy' has no 'dom' widget";
const visitWarning = (m) => m.level === 'warn' && m.message.startsWith(VISIT_WARNING);

const args = parseArgs();
if (typeof args.out !== 'string') {
  console.error('measure: --out <directory> is required');
  process.exit(2);
}
const [width, height] = parseSize(args.size, [1280, 720]);
const touch = args.touch === true;
const q = touch ? 'auto' : 'high';
const base = baseUrl(args);
const out = ensureDir(args.out);

/* ------------------------------------------------------------------------------------------- helpers */

/** One held frame: the frozen clock does not move, the engine updates once with dt = 0 and draws the frame. */
const held = (page) => page.evaluate(() => window.__app.step(1 / 60, 0));

/**
 * How many cells of two eye frames (`radio-luma`) differ by more than 2 levels: all of them if the sizes differ, and
 * Infinity (never «the same frame») if either is not a frame at all — not an array, or empty.
 */
function lumaDiff(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return Infinity;
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 2) n++;
  return n;
}

/** `lumaDiff` over the cells of `rect` only (`{ col0, row0, col1, row1 }`, inclusive; frames 128 cells wide). */
function lumaDiffIn(a, b, rect, cols = 128) {
  let n = 0;
  for (let r = rect.row0; r <= rect.row1; r++)
    for (let c = rect.col0; c <= rect.col1; c++) if (Math.abs(a[r * cols + c] - b[r * cols + c]) > 2) n++;
  return n;
}

/** State the chapter exposed with `ctx.qa.expose(name, …)`. */
const read = (page, name) => page.evaluate((n) => window.__app.read(n), name);
const stats = (page) => page.evaluate(() => window.__app.stats());
const position = (page) => page.evaluate(() => window.__app.position());
const mean = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : NaN);
const round = (v, digits = 2) => (Number.isFinite(v) ? Number(v.toFixed(digits)) : v);

/** Wait for `n` frames of the page's own animation loop (live clock: `__app.step` would stop it). */
const frames = (page, n) =>
  page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) await new Promise((r) => requestAnimationFrame(r));
  }, n);

/** `__app.read(name)[key]` once per animation frame, for `n` frames. */
const perFrame = (page, name, key, n) =>
  page.evaluate(
    async ({ reader, field, count }) => {
      const values = [];
      for (let i = 0; i < count; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        values.push(window.__app.read(reader)[field]);
      }
      return values;
    },
    { reader: name, field: key, count: n },
  );

/** Open an app page; resolves with `__app.position()` or rejects (load error, no answer in time). */
async function open(page, step, freeze) {
  const url = appUrl(base, { route: route(step), q, freeze });
  const gpu = await Promise.race([
    openApp(page, url, { timeout: OPEN_TIMEOUT_MS }),
    sleep(OPEN_TIMEOUT_MS).then(() => {
      throw new Error(`no answer from ${url} within ${OPEN_TIMEOUT_MS / 1000} s`);
    }),
  ]);
  report.gpu ??= gpu;
  // the web fonts are in before anything is measured, whatever interface runs (openApp waits only under `dom`)
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return position(page);
}

const at = (pos, step) => pos?.chapterId === CHAPTER && pos?.stepId === step;
const where = (pos) => (pos?.error ? pos.error : `${pos?.chapterId ?? '—'}/${pos?.stepId ?? '—'}`);

/** RGB of one pixel of a decoded PNG at CSS position (x, y). */
function pixel(png, x, y, scale) {
  const px = Math.min(png.width - 1, Math.max(0, Math.round(x * scale)));
  const py = Math.min(png.height - 1, Math.max(0, Math.round(y * scale)));
  const i = (py * png.width + px) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

/**
 * An estimate of the floating screen's rectangle in PNG pixels, from where two of its cells are seen: cells are
 * square (1,6 m / 128 = 1,2 m / 96), so the horizontal distance of the two cells gives the cell size (`cell`, px).
 * Shrunk by `inset` cells on every side, so that a screen seen at an angle keeps the box on its glass. Null if the
 * two cells share a column.
 */
function screenBox(a, b, cellA, cellB, scale, inset = 8) {
  if (cellA.col === cellB.col) return null;
  const cell = ((b.x - a.x) * scale) / (cellB.col - cellA.col);
  const left = a.x * scale - (cellA.col + 0.5) * cell;
  const top = a.y * scale - (cellA.row + 0.5) * cell;
  return {
    x: left + inset * cell,
    y: top + inset * cell,
    w: (128 - 2 * inset) * cell,
    h: (96 - 2 * inset) * cell,
    cell,
  };
}

function crop(png, box) {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const w = Math.max(0, Math.min(png.width, Math.round(box.x + box.w)) - x0);
  const h = Math.max(0, Math.min(png.height, Math.round(box.y + box.h)) - y0);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * png.width + x0) * 4;
    data.set(png.data.subarray(from, from + w * 4), y * w * 4);
  }
  return { width: w, height: h, data };
}

/** `EYE_SAMPLES` of `radio/shared/screen/eye.ts` — the tree Block Q has just built. */
function eyeSamples() {
  const src = readFileSync(join(import.meta.dirname, '../../../../radio/shared/screen/eye.ts'), 'utf8');
  const m = /export const EYE_SAMPLES = (\d+);/.exec(src);
  return m ? Number(m[1]) : null;
}

/* -------------------------------------------------------------------------------------------- checks */

const report = {
  when: new Date().toISOString(),
  base,
  size: `${width}x${height}`,
  touch,
  q,
  gpu: null,
  sections: {},
  checks: [],
  verdict: '',
};
let section = '';
const check = (what, ok, detail = '') => {
  report.checks.push({ section, what, ok: Boolean(ok), detail: String(detail) });
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${section.padEnd(5)} ${what}${detail === '' ? '' : `  [${detail}]`}`,
  );
  return Boolean(ok);
};

/* --------------------------------------------------------------------------------------- section eye */

// Pages: З — step `eye` on the frozen clock (`?freeze`), Д — step `far` on the frozen clock (the same scene and
// state, another director shot), Ж — step `eye` on the live clock. Ж is opened only after З and Д are closed: a
// frozen page still draws every display frame, and two pages would share the machine while Ж is timed.
async function eye(context) {
  const n = (report.sections.eye = { eyeSamples: eyeSamples() });
  const errors = [];
  const pz = await context.newPage();
  const pd = await context.newPage();
  const posZ = await open(pz, 'eye', 1).catch((err) => ({ error: String(err) }));
  const posD = await open(pd, 'far', 1).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(posZ, 'eye') && at(posD, 'far'), `З ${where(posZ)}, Д ${where(posD)}`)) {
    await pz.close();
    await pd.close();
    return;
  }

  // Д: the same engine time as З below (1 s of freeze hold + 30 steps), its eye frame, then the page goes
  await pd.evaluate(() => window.__app.step(1 / 60, 30));
  await held(pd);
  const lumaD = await read(pd, 'radio-luma');
  await screenshot(pd, join(out, `far-${width}x${height}.jpg`));
  errors.push(...(await appErrors(pd)).map((m) => ({ page: 'Д', ...m })));
  await pd.close();

  // З
  await pz.evaluate(() => window.__app.step(1 / 60, 30));
  let e = await read(pz, 'radio-eye');
  check('passes', e.passes > 0, `${e.passes} passes, format ${e.format}`);
  await held(pz);
  e = await read(pz, 'radio-eye');
  const lumaZ = await read(pz, 'radio-luma');
  Object.assign(n, {
    format: e.format,
    passes: e.passes,
    lastCalls: e.lastCalls,
    lumaMin: e.lumaMin,
    lumaMax: e.lumaMax,
    seen: e.seen,
  });
  check('picture', e.lumaMax - e.lumaMin >= 40, `luma ${e.lumaMin}…${e.lumaMax}`);
  const { light, dark } = e.seen;
  check(
    'orientation',
    light.cell && dark.cell && light.luma - dark.luma >= 100,
    `light ${JSON.stringify(light.cell)} ${light.luma}, dark ${JSON.stringify(dark.cell)} ${dark.luma}`,
  );

  // the floating screen in the picture: the cell of each mark lies where the mark is in the scene
  const png = decodePng(await pz.screenshot({ type: 'png' }));
  await screenshot(pz, join(out, `eye-${width}x${height}.jpg`));
  const scale = png.width / width;
  const onL = await pz.evaluate(() => window.__app.locate('eye:light-on-screen'));
  const onD = await pz.evaluate(() => window.__app.locate('eye:dark-on-screen'));
  const rgbL = onL ? pixel(png, onL.x, onL.y, scale) : null;
  const rgbD = onD ? pixel(png, onD.x, onD.y, scale) : null;
  const gap = rgbL && rgbD ? mean(rgbL) - mean(rgbD) : NaN;
  n.screenPixels = {
    light: onL && { at: [round(onL.x), round(onL.y)], rgb: rgbL },
    dark: onD && { at: [round(onD.x), round(onD.y)], rgb: rgbD },
  };
  check(
    'screen',
    onL?.visible && onD?.visible && gap >= 60,
    `light ${rgbL ? rgbL.join(',') : '—'}, dark ${rgbD ? rgbD.join(',') : '—'}, gap ${round(gap, 1)}`,
  );
  const box =
    onL && onD && light.cell && dark.cell ? screenBox(onL, onD, light.cell, dark.cell, scale) : null;
  if (box) {
    // look point (3) in numbers: the clearly coloured pixels on the glass
    n.screenHue = {
      box: { x: round(box.x), y: round(box.y), w: round(box.w), h: round(box.h) },
      cellPx: round(box.cell),
      ...hueFamilies(crop(png, box)),
    };
  }

  // the director's camera does not change what the eye sees
  n.shotsDiff = lumaDiff(lumaZ, lumaD);
  check('shots', n.shotsDiff <= 12, `${n.shotsDiff} of ${lumaZ.length} cells differ by more than 2`);

  // the sandbox on the world (B16): `drawCalls`, `hide`, `budget` and `leaks` are left out, see the header
  n.world = (await read(pz, 'radio-world')) != null;
  if (n.world) n.skipped = ['drawCalls', 'hide', 'budget', 'leaks'];
  else await eyeAlone(pz, n);
  const logZ = await appErrors(pz);
  n.visitMessages = logZ.filter(visitWarning);
  errors.push(...logZ.filter((m) => !visitWarning(m)).map((m) => ({ page: 'З', ...m })));
  await pz.close();

  if (!n.world) errors.push(...(await eyeBudget(context, n)));

  n.errors = errors;
  check(
    'console',
    errors.length === 0,
    (errors.length
      ? `${errors.length}: [${errors[0].page}] ${errors[0].level} ${errors[0].message.slice(0, 160)}`
      : `pages ${n.world ? 'З, Д' : 'З, Д, Ж'} clean`) +
      `; left out: ${n.visitMessages.length} × the known '_sandbox-ui' warning`,
  );
}

/** Page З without the world: the draw-call counter, `hide()`, the cost of a held pass and the leaks. */
async function eyeAlone(pz, n) {
  // the engine's draw-call counter does not see the pass (P9)
  await held(pz);
  const callsOn = (await stats(pz)).drawCalls;
  await pz.evaluate(() => window.__ui.set('eye', false, true));
  await held(pz);
  await held(pz);
  const off = await read(pz, 'radio-eye');
  const callsOff = (await stats(pz)).drawCalls;
  await pz.evaluate(() => window.__ui.set('eye', true, true));
  await held(pz);
  n.drawCalls = callsOn;
  n.drawCallsOff = callsOff;
  check('drawCalls', !off.on && callsOn === callsOff, `with the eye ${callsOn}, without ${callsOff}`);

  // hide() in the browser: the second screen hangs in front of the eye and shows its frame. Hidden from the pass,
  // it leaves the eye's frame as it is with that screen taken away (toggle `inner`); with `hide()` emptied (toggle
  // `hiding`) the eye does see it where `project` puts it — at least a quarter of the cells it covers change — so it
  // really lies in the eye's view, in front of everything else. Back to hiding, the frame is the first one again.
  // A scene without that screen (no `radio-eye.inner`) fails this check by name and the section goes on
  const frame = async () => {
    await held(pz);
    await held(pz);
    return { luma: await read(pz, 'radio-luma'), inner: (await read(pz, 'radio-eye')).inner };
  };
  const hiddenF = await frame();
  if (!hiddenF.inner) {
    n.hide = null;
    check(
      'hide',
      false,
      'radio-eye.inner is missing: the scene must hang a second screen in front of the eye (a child of its camera, ' +
        'in the hide set) with the toggles `inner` and `hiding`, and expose `radio-eye.inner` = { shown, hiding, rect }',
    );
  } else {
    await pz.evaluate(() => window.__ui.set('inner', false, true));
    const withoutF = await frame();
    await pz.evaluate(() => {
      window.__ui.set('inner', true, true);
      window.__ui.set('hiding', false, true);
    });
    const seenF = await frame();
    await pz.evaluate(() => window.__ui.set('hiding', true, true));
    const backF = await frame();
    const rect = hiddenF.inner.rect;
    const cells = rect ? (rect.col1 - rect.col0 + 1) * (rect.row1 - rect.row0 + 1) : 0;
    n.hide = {
      rect,
      cells,
      hiddenDiff: lumaDiff(hiddenF.luma, withoutF.luma),
      seenDiff: rect ? lumaDiffIn(seenF.luma, withoutF.luma, rect) : 0,
      seenDiffAll: lumaDiff(seenF.luma, withoutF.luma),
      backDiff: lumaDiff(backF.luma, hiddenF.luma),
    };
    const toggled =
      hiddenF.inner.shown &&
      hiddenF.inner.hiding &&
      withoutF.inner?.shown === false &&
      seenF.inner?.shown &&
      seenF.inner?.hiding === false &&
      backF.inner?.shown &&
      backF.inner?.hiding;
    check(
      'hide',
      toggled &&
        cells > 0 &&
        n.hide.hiddenDiff <= 12 &&
        n.hide.seenDiff >= cells / 4 &&
        n.hide.backDiff <= 12,
      `second screen over ${cells} cells ${JSON.stringify(rect)}; differ from the frame without it: ` +
        `hidden ${n.hide.hiddenDiff}, not hidden ${n.hide.seenDiff} of its ${cells} ` +
        `(${n.hide.seenDiffAll} in all); hidden again, from the first frame: ${n.hide.backDiff}`,
    );
  }

  // the cost of a held pass (it also redraws the shadow map): a number for the report, not a gate
  const heldSamples = [];
  for (let i = 0; i < 20; i++) {
    await held(pz);
    heldSamples.push((await read(pz, 'radio-eye')).lastMs);
  }
  n.heldMs = round(mean(heldSamples));
  n.heldSamples = heldSamples.map((v) => round(v));

  // three visits to another chapter: no geometry, texture or program stays behind. Every message logged meanwhile
  // counts (this chapter's teardown and re-entry included), except the one known warning of `_sandbox-ui` itself,
  // see VISIT_WARNING
  const memory = [];
  for (let i = 0; i < 3; i++) {
    await pz.evaluate(() => window.__app.goto('_sandbox-ui'));
    await pz.evaluate((c) => window.__app.goto(c, 'eye'), CHAPTER);
    await held(pz);
    const s = await stats(pz);
    memory.push({ geometries: s.geometries, textures: s.textures, programs: s.programs });
  }
  n.leaks = memory;
  const grew = ['geometries', 'textures', 'programs'].filter((k) => memory[2][k] > memory[0][k]);
  check(
    'leaks',
    at(await position(pz), 'eye') && grew.length === 0,
    `after the 1st return ${JSON.stringify(memory[0])}, after the 3rd ${JSON.stringify(memory[2])}`,
  );
}

/** Ж: step `eye` on the live clock, the gate of decision 24. Returns the page's console messages. */
async function eyeBudget(context, n) {
  const errors = [];
  const pl = await context.newPage();
  const posL = await open(pl, 'eye', null).catch((err) => ({ error: String(err) }));
  if (at(posL, 'eye')) {
    await frames(pl, 10); // warm-up after the first frames of the page
    await pl.evaluate(() => window.__app.resetStats());
    const passes0 = (await read(pl, 'radio-eye')).passes;
    const liveSamples = await perFrame(pl, 'radio-eye', 'lastMs', 20);
    const passes1 = (await read(pl, 'radio-eye')).passes;
    const on = await stats(pl);
    await pl.evaluate(() => window.__ui.set('eye', false, true));
    await pl.evaluate(() => window.__app.resetStats());
    await frames(pl, 60);
    const offStats = await stats(pl);
    const liveOff = await read(pl, 'radio-eye');
    Object.assign(n, {
      liveMs: round(mean(liveSamples)),
      liveSamples: liveSamples.map((v) => round(v)),
      livePasses: passes1 - passes0,
      intervalOn: round(on.intervalAvg),
      intervalOff: round(offStats.intervalAvg),
      cpuOn: round(on.cpuAvg),
      cpuOff: round(offStats.cpuAvg),
      live: {
        width: offStats.width,
        height: offStats.height,
        dpr: offStats.dpr,
        resolutionScale: offStats.resolutionScale,
        quality: offStats.quality,
        frameCap: offStats.frameCap,
      },
    });
    check(
      'budget',
      !liveOff.on && n.livePasses > 0 && n.liveMs < 0.25 * n.intervalOff,
      `liveMs ${n.liveMs} over ${n.livePasses} passes, intervalOff ${n.intervalOff} (limit ${round(0.25 * n.intervalOff)})`,
    );
  } else {
    check('budget', false, `the live page is at ${where(posL)}`);
  }
  if (!posL.error) errors.push(...(await appErrors(pl)).map((m) => ({ page: 'Ж', ...m })));
  await pl.close();
  return errors;
}

/* -------------------------------------------------------------------------------------- section yard */

/** The eight shots of step `yard`, in the order of its control (`SANDBOX.shots` of the sandbox's index.ts). */
const SHOTS = ['both', 'yard', 'pole', 'window', 'screen', 'antenna', 'route', 'top'];
const MAX_DRAW_CALLS = 350;
const MAX_TRIANGLES = 1_500_000;
const MAX_HUES = 4;
/** Within 1 mm: the anchors the model's numbers place; the lens may sit up to 0.15 m off (the whip is upright). */
const PLACE_TOLERANCE = 1e-3;
const LENS_TOLERANCE = 0.15;
const COLS = 128;

/** Distance of two points [x, y, z]. */
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * The tones of the eye's frame in the body row of the cat (`r = seen.cat.cell.row + 4`, as `places.row()` of C5):
 * (a) the run of cells round column `seen.cat.cell.col + 3` whose luma stays within 12 of that cell's, and the mean of
 * the five cells right past it on the head's side (smaller columns) against the run's mean; (b) to the right of
 * `seen.wicket.cell.col − 8`, the pairs of neighbouring cells that differ by more than 45 (picket against gap).
 */
function tones(luma, seen) {
  const r = seen.cat.cell.row + 4;
  const at = (c) => luma[r * COLS + c];
  const c0 = seen.cat.cell.col + 3;
  const ref = at(c0);
  let lo = c0;
  let hi = c0;
  while (lo - 1 >= 0 && Math.abs(at(lo - 1) - ref) <= 12) lo--;
  while (hi + 1 < COLS && Math.abs(at(hi + 1) - ref) <= 12) hi++;
  const band = [];
  for (let c = lo; c <= hi; c++) band.push(at(c));
  const past = [];
  for (let c = lo - 5; c < lo; c++) if (c >= 0) past.push(at(c));
  let pairs = 0;
  for (let c = Math.max(0, seen.wicket.cell.col - 8); c + 1 < COLS; c++)
    if (Math.abs(at(c) - at(c + 1)) > 45) pairs++;
  const row = [];
  for (let c = 0; c < COLS; c++) row.push(at(c));
  return {
    row: r,
    from: c0,
    band: { lo, hi, cells: hi - lo + 1, mean: round(mean(band), 1) },
    gravel: { cells: past.length, mean: round(mean(past), 1) },
    pairs,
    luma: row,
  };
}

// One page: step `yard` on the frozen clock. The eight shots (draw calls, triangles, hue families, a snapshot each);
// the anchors where the model's numbers put them; what the eye sees and its tones at dusk 0.2 and 1; the monitor's
// screen in clear view in `screen` and `route` at the five stops; the cellar's floor through the cut; the look at
// dusk 0, 0.5 and 1; the interface and the console.
async function yard(context) {
  const n = (report.sections.yard = { shots: {}, seen: {}, tones: {}, screenClear: {}, look: {} });
  const page = await context.newPage();
  const pos = await open(page, 'yard', 1).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'yard'), where(pos))) {
    await page.close();
    return;
  }
  const set = (id, v) => page.evaluate(([i, x]) => window.__ui.set(i, x, true), [id, v]);
  const advance = (frames) => page.evaluate((k) => window.__app.step(1 / 60, k), frames);
  const locate = (name) => page.evaluate((x) => window.__app.locate(x), name);

  // frames: each shot after 2 s of engine time (the director's move takes 1.8 s)
  for (const k of SHOTS) {
    await set('shot', k);
    await advance(120);
    const s = await stats(page);
    const hues = hueFamilies(decodePng(await page.screenshot({ type: 'png' })));
    await screenshot(page, join(out, `yard-${k}.jpg`));
    const must =
      k === 'yard' ? ['yard:cat', 'yard:wicket'] : k === 'both' ? ['yard:lens', 'yard:monitorScreen'] : [];
    const visible = {};
    for (const name of must) visible[name] = (await locate(name))?.visible === true;
    const shot = (await read(page, 'radio-yard')).shot;
    n.shots[k] = { shot, drawCalls: s.drawCalls, triangles: s.triangles, ...hues, visible };
    check(
      `frame ${k}`,
      shot === k &&
        s.drawCalls <= MAX_DRAW_CALLS &&
        s.triangles <= MAX_TRIANGLES &&
        hues.families.length <= MAX_HUES &&
        Object.values(visible).every(Boolean),
      `${s.drawCalls} draw calls, ${s.triangles} triangles; hues ${hues.families.join(', ') || 'none'} of ` +
        `${hues.coloured} coloured` +
        (must.length ? `; in view ${must.map((m) => `${m} ${visible[m]}`).join(', ')}` : ''),
    );
  }
  await set('shot', 'both');

  // places: the camera's antenna and lens, the monitor's antenna and screen along the route
  await advance(1);
  let y = await read(page, 'radio-yard');
  const antenna = await locate('yard:cameraAntenna');
  const lens = await locate('yard:lens');
  const off = {
    cameraAntenna: distance(antenna.world, y.want.cameraAntenna),
    lens: distance(lens.world, y.want.lens),
    monitor: [],
  };
  for (const route of [0, 1, 2, 3, 4])
    for (const nudge of [-0.15, 0.15]) {
      await set('route', route);
      await set('nudge', nudge);
      await advance(1);
      y = await read(page, 'radio-yard');
      const a = await locate('yard:monitorAntenna');
      const s = await locate('yard:monitorScreen');
      off.monitor.push({
        route,
        nudge,
        antenna: distance(a.world, y.want.monitorAntenna),
        screen: distance(s.world, y.want.monitorScreen),
      });
    }
  await set('route', 1);
  await set('nudge', 0);
  const worst = Math.max(...off.monitor.flatMap((m) => [m.antenna, m.screen]));
  n.places = off;
  check(
    'places',
    off.cameraAntenna <= PLACE_TOLERANCE && off.lens <= LENS_TOLERANCE && worst <= PLACE_TOLERANCE,
    `camera antenna ${off.cameraAntenna.toExponential(1)} m, lens ${round(off.lens, 3)} m, monitor at most ` +
      `${worst.toExponential(1)} m over 5 stops × nudge ±0.15`,
  );

  // seen and tones: what the eye sees at dusk 0.2 and 1
  for (const dusk of [0.2, 1]) {
    await set('dusk', dusk);
    await advance(30);
    const e = await read(page, 'radio-eye');
    const luma = await read(page, 'radio-luma');
    const { light, dark, wicket, cat } = e.seen;
    n.seen[dusk] = e.seen;
    check(
      `seen ${dusk}`,
      light.cell &&
        dark.cell &&
        wicket.cell &&
        cat.cell &&
        light.luma >= 200 &&
        dark.luma <= 70 &&
        cat.luma >= 200 &&
        cat.luma - cat.around >= 60,
      `wall ${light.luma}, nook ${dark.luma}, spot ${cat.luma} (around ${round(cat.around, 1)}), cells wall ` +
        `${JSON.stringify(light.cell)} nook ${JSON.stringify(dark.cell)} wicket ${JSON.stringify(wicket.cell)} ` +
        `cat ${JSON.stringify(cat.cell)}`,
    );
    const t = cat.cell && wicket.cell ? tones(luma, e.seen) : null;
    n.tones[dusk] = t;
    check(
      `tones ${dusk}`,
      t && t.band.cells >= 5 && t.gravel.cells === 5 && t.gravel.mean - t.band.mean >= 40 && t.pairs >= 5,
      t
        ? `row ${t.row}: body ${t.band.cells} cells (cols ${t.band.lo}…${t.band.hi}) mean ${t.band.mean}, gravel ` +
            `past it ${t.gravel.mean}; ${t.pairs} picket edges past col ${wicket.cell.col - 8}`
        : 'no cat or wicket in the frame',
    );
  }
  await set('dusk', 0.2);

  // screenClear: in `screen` and `route`, the monitor's screen in view and clear at each stop
  for (const k of ['screen', 'route']) {
    await set('shot', k);
    const list = [];
    for (const route of [0, 1, 2, 3, 4]) {
      await set('route', route);
      await advance(120);
      const s = await locate('yard:monitorScreen');
      list.push({ route, visible: s?.visible === true, clear: (await read(page, 'radio-yard')).screenClear });
    }
    n.screenClear[k] = list;
    check(
      `screenClear ${k}`,
      list.every((m) => m.visible && m.clear === true),
      list
        .map((m) => `${m.route}: ${m.visible ? 'in view' : 'OUT'}, ${m.clear ? 'clear' : 'BLOCKED'}`)
        .join('; '),
    );
  }

  // cellar: from `route` with the monitor out in the yard, the cellar's floor through the cut in the slab
  await set('shot', 'route');
  await set('route', 0);
  await advance(120);
  n.cellarSeen = (await read(page, 'radio-yard')).cellarSeen;
  await screenshot(page, join(out, 'yard-route-0.jpg'));
  check('cellar', n.cellarSeen === true, `cellarSeen ${n.cellarSeen}`);
  await set('route', 1);

  // look: no grain, and `both` within four hue families at dusk 0, 0.5 and 1
  await set('shot', 'both');
  await advance(120);
  n.grain = (await read(page, 'radio-yard')).grain;
  for (const dusk of [0, 0.5, 1]) {
    await set('dusk', dusk);
    await advance(30);
    const yd = await read(page, 'radio-yard');
    n.look[dusk] = { lantern: yd.lantern, ...hueFamilies(decodePng(await page.screenshot({ type: 'png' }))) };
    await screenshot(page, join(out, `yard-both-dusk-${dusk}.jpg`));
  }
  await set('dusk', 0.2);
  check(
    'look',
    n.grain === 0 && Object.values(n.look).every((l) => l.families.length <= MAX_HUES),
    `grain ${n.grain}; both at dusk ` +
      Object.entries(n.look)
        .map(([d, l]) => `${d}: ${l.families.join(', ') || 'none'} (lantern ${round(l.lantern)})`)
        .join('; '),
  );

  // ui and console
  await advance(1);
  const offscreen = await page.evaluate(() => window.__ui.offscreen());
  const errors = await appErrors(page);
  n.offscreen = offscreen;
  n.errors = errors;
  check(
    'ui',
    offscreen.length === 0 && errors.length === 0,
    (offscreen.length ? `off screen: ${offscreen.map((o) => o.name).join(', ')}` : 'all controls on screen') +
      '; ' +
      (errors.length
        ? `${errors.length}: ${errors[0].level} ${errors[0].message.slice(0, 160)}`
        : 'console clean'),
  );
  await page.close();
}

/* ---------------------------------------------------------------------------------- section whereami */

/**
 * The names of the five stops the sandbox gives the miniature (`SANDBOX.labels.whereami.stops` of its index.ts, the
 * one place of its words) — the tree Block Q has just built; null if they are not found there.
 */
function stopNames() {
  const src = readFileSync(join(import.meta.dirname, '../index.ts'), 'utf8');
  const m = /whereami:\s*\{[^}]*?stops:\s*\[([^\]]*)\]/.exec(src);
  const names = m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : [];
  return names.length === 5 ? names : null;
}

/**
 * What the DOM dock writes instead of a `custom` control that has no `dom` widget, after the control's name
 * (`hud-dom/dock/build.ts`, the platform's own words); null if it is not found there.
 */
function placeholderText() {
  const src = readFileSync(join(import.meta.dirname, '../../../../../hud-dom/dock/build.ts'), 'utf8');
  const m = /h\('p\.dk-fallback', null, `([^`]*)`\)/.exec(src);
  const tail = m
    ? m[1]
        .split('${c.id}')
        .pop()
        .replace(/^[»\s]+/, '')
    : '';
  return tail === '' ? null : tail;
}

/** Box `a` lies wholly within box `b` (both centre + size, CSS px), to half a pixel. */
const within = (a, b) =>
  a.x - a.w / 2 >= b.x - b.w / 2 - 0.5 &&
  a.x + a.w / 2 <= b.x + b.w / 2 + 0.5 &&
  a.y - a.h / 2 >= b.y - b.h / 2 - 0.5 &&
  a.y + a.h / 2 <= b.y + b.h / 2 + 0.5;
const boxText = (b) =>
  b
    ? `${round(b.x - b.w / 2)}…${round(b.x + b.w / 2)} × ${round(b.y - b.h / 2)}…${round(b.y + b.h / 2)}`
    : '—';

// One page: step `where` on the frozen clock, the miniature with the route and nudge sliders and the depth choice.
async function whereami(context) {
  const n = (report.sections.whereami = {});
  const page = await context.newPage();
  const pos = await open(page, 'where', 1).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'where'), where(pos))) {
    await page.close();
    return;
  }
  const set = async (id, v) => {
    await page.evaluate(([i, x]) => window.__ui.set(i, x, true), [id, v]);
    await held(page);
  };
  /** What the plan shows, from its DOM: the dot and the tick are SVG, which `__ui.locate` does not name. */
  const plan = () =>
    page.evaluate(() => {
      const q = (name) => document.querySelector(`[data-ui="${name}"]`);
      const root = q('ctl-whereami');
      const dot = q('ctl-whereami:dot');
      return {
        root: root !== null,
        text: root?.textContent ?? '',
        dot: dot && {
          cx: Number(dot.getAttribute('cx')),
          cy: Number(dot.getAttribute('cy')),
          below: dot.getAttribute('data-below'),
        },
        stop: q('ctl-whereami:stop')?.textContent ?? null,
        nudge: q('ctl-whereami:nudge')?.getAttribute('data-value') ?? null,
        depth: [0, 1, 2].map((i) => q(`ctl-whereami:depth-${i}`)?.getAttribute('aria-current') ?? null),
      };
    });
  await held(page);

  // dom: the chapter's widget, not the platform's placeholder for a control without one
  const placeholder = placeholderText();
  let p = await plan();
  n.start = p;
  check(
    'dom',
    p.root && placeholder !== null && !p.text.includes(placeholder),
    placeholder === null
      ? 'the placeholder text is not found in hud-dom/dock/build.ts'
      : `root ${p.root ? 'found' : 'MISSING'}; text «${p.text.slice(0, 80)}»`,
  );

  // dot: where `whereAt` puts the monitor for the slider's value, the nearest stop's name; hollow in the cellar
  const names = stopNames();
  await set('route', 3);
  p = await plan();
  const at3 = (await read(page, 'radio-sandbox')).where;
  await set('route', 4);
  const p4 = await plan();
  n.dot = { route3: { plan: p.dot, stop: p.stop, where: at3 }, route4: { plan: p4.dot, stop: p4.stop } };
  check(
    'dot',
    names !== null &&
      p.dot &&
      Math.abs(p.dot.cx - at3.x) <= 1e-6 &&
      Math.abs(p.dot.cy + at3.y) <= 1e-6 &&
      p.stop === names[3] &&
      p.dot.below === null &&
      p4.dot?.below === 'true',
    names === null
      ? 'the stop names are not found in the sandbox index.ts'
      : `route 3: dot (${p.dot?.cx}, ${p.dot?.cy}), whereAt (${at3.x}, ${at3.y}), stop «${p.stop}» ` +
          `(want «${names[3]}»), below ${p.dot?.below}; route 4: below ${p4.dot?.below}`,
  );

  // nudge: the scale's tick follows the slider, and the dot moves along the nudge axis
  await set('nudge', 0.15);
  p = await plan();
  n.nudge = { tick: p.nudge, cx: [p4.dot?.cx, p.dot?.cx] };
  check(
    'nudge',
    p.nudge === '0.150' && p.dot && p4.dot && p.dot.cx !== p4.dot.cx,
    `tick ${p.nudge}; dot cx ${p4.dot?.cx} → ${p.dot?.cx}`,
  );

  // depth: the current mark, and only it
  await set('depth', '2');
  p = await plan();
  n.depth = p.depth;
  check(
    'depth',
    p.depth[2] === 'true' && p.depth[0] === null && p.depth[1] === null,
    `aria-current ${p.depth.map((v, i) => `${i}: ${v ?? '—'}`).join(', ')}`,
  );

  // phone: the controls tab of the sheet at full height shows the plan and both sliders whole
  if (touch) {
    await page.evaluate(() => window.__ui.setSheet({ tab: 'controls', snap: 'full' }));
    await page.evaluate(() => window.__app.step(1 / 60, 40));
    const ui = await page.evaluate(() => ({
      plan: window.__ui.locate('ctl-whereami'),
      sheet: window.__ui.locate('sheet'),
      state: window.__ui.sheet(),
      view: {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        w: window.innerWidth,
        h: window.innerHeight,
      },
      cut: window.__ui
        .offscreen({ clipped: true, partial: true })
        .map((o) => o.name)
        .filter((name) => name.startsWith('ctl-route') || name.startsWith('ctl-nudge')),
    }));
    n.phone = ui;
    check(
      'phone',
      ui.plan && ui.sheet && within(ui.plan, ui.view) && within(ui.plan, ui.sheet) && ui.cut.length === 0,
      `sheet ${ui.state?.tab}/${ui.state?.snap} ${boxText(ui.sheet)}, plan ${boxText(ui.plan)} in a ` +
        `${ui.view.w} × ${ui.view.h} window; cut or off screen: ${ui.cut.join(', ') || 'none of route, nudge'}`,
    );
  }
  await screenshot(page, join(out, `where-${width}x${height}.jpg`));

  // console: nothing at all, the warning «has no 'dom' widget» included
  const errors = await appErrors(page);
  n.errors = errors;
  check(
    'console',
    errors.length === 0,
    errors.length
      ? `${errors.length}: ${errors[0].level} ${errors[0].message.slice(0, 160)}`
      : 'console clean',
  );
  await page.close();
}

/* -------------------------------------------------------------------------- the world's live screen */

/** The levels of the five stops at 10 mW with the gate shut (the plan's table), dBm, and their tolerance. */
const LADDER_DBM = [-54, -62, -70, -78, -88];
const LADDER_TOLERANCE_DB = 1.5;
/** The gate of a computer: the mean `modelMs` of the background thread over this many replies. */
const DESKTOP_REPLIES = 20;
const DESKTOP_MAX_MS = 100;
/** The gate of a phone: one frame of the model on the main thread under a 4× CPU slowdown (П10). */
const PHONE_SLOWDOWN = 4;
const PHONE_MAX_MS = 250;
/** How long the live page has to show the model's first frame, and to stop the threads of the visits. */
const LIVE_WITHIN_MS = 5000;

const locateOn = (page, name) => page.evaluate((x) => window.__app.locate(x), name);
const consoleText = (errors, clean = 'console clean') =>
  errors.length ? `${errors.length}: ${errors[0].level} ${errors[0].message.slice(0, 160)}` : clean;

/**
 * On a held page: held frames until `radio-world.frames` is above `from` (the world computes a `still` frame on the
 * first held frame after a change), at most `limit` of them; returns the reader then.
 */
async function grown(page, from, limit = 120) {
  let w = await read(page, 'radio-world');
  for (let i = 0; i < limit && !(w?.frames > from); i++) {
    await held(page);
    w = await read(page, 'radio-world');
  }
  return w;
}

/** The largest difference of two eye frames over all cells (Infinity when either is not a frame of the same size). */
function maxCellDiff(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return Infinity;
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

// One page: step `still` on the frozen clock. The monitor goes from the yard to the cellar; at each stop the world
// computes one `still` frame on the main thread, and the director's camera follows the monitor (`screenShot`).
async function ladder(context) {
  const n = (report.sections.ladder = { stops: [] });
  const page = await context.newPage();
  const pos = await open(page, 'still', 1).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'still'), where(pos))) {
    await page.close();
    return;
  }
  const w0 = await read(page, 'radio-world');
  n.mode = w0?.mode;
  check('mode', w0?.mode === 'sync', `mode ${w0?.mode} (a held page needs no background thread, П11)`);

  for (const r of [0, 1, 2, 3, 4]) {
    const before = (await read(page, 'radio-world')).frames;
    await page.evaluate((v) => window.__ui.set('route', v, true), r);
    await page.evaluate(() => window.__app.step(1 / 60, 60));
    const w = await grown(page, before);
    const s = await locateOn(page, 'yard:monitorScreen');
    const y = await read(page, 'radio-yard');
    await screenshot(page, join(out, `still-route-${r}.jpg`));
    n.stops.push({
      route: r,
      want: LADDER_DBM[r],
      frames: [before, w.frames],
      visible: s?.visible === true,
      clear: y.screenClear,
      meters: w.meters,
      screenMean: round(w.screenMean),
      screenNoise: round(w.screenNoise, 3),
      screenHash: w.screenHash,
    });
  }
  const stops = n.stops;
  check(
    'frames',
    stops.every((s) => s.frames[1] > s.frames[0]),
    stops.map((s) => `${s.route}: ${s.frames[0]} → ${s.frames[1]}`).join('; '),
  );
  check(
    'screen',
    stops.every((s) => s.visible && s.clear === true),
    stops
      .map((s) => `${s.route}: ${s.visible ? 'in view' : 'OUT'}, ${s.clear ? 'clear' : 'BLOCKED'}`)
      .join('; '),
  );
  const off = (s) => Math.abs((s.meters?.rxDbm ?? NaN) - s.want);
  check(
    'levels',
    stops.every((s) => off(s) <= LADDER_TOLERANCE_DB),
    stops
      .map((s) => `${s.route}: ${round(s.meters?.rxDbm)} dBm (want ${s.want} ± ${LADDER_TOLERANCE_DB})`)
      .join('; '),
  );
  const noise = stops.map((s) => s.screenNoise);
  check(
    'snow',
    noise[1] < noise[2] && noise[2] < noise[3] && noise[3] < noise[4],
    `screenNoise ${noise.join(' / ')} at stops 0…4 (strictly up from 1 to 4)`,
  );
  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

// The page of `ladder` (step `still`, `?freeze=1`) opened twice, one after the other: 1 s of hold and 60 steps, then
// what the world computed and what the eye saw on each.
async function repeat(context) {
  const n = (report.sections.repeat = {});
  const visit = async () => {
    const page = await context.newPage();
    const pos = await open(page, 'still', 1).catch((err) => ({ error: String(err) }));
    if (!at(pos, 'still')) {
      await page.close();
      return { pos };
    }
    const before = (await read(page, 'radio-world')).frames;
    await page.evaluate(() => window.__app.step(1 / 60, 60));
    const w = await grown(page, before);
    const sandbox = await read(page, 'radio-sandbox');
    const luma = await read(page, 'radio-luma');
    const errors = await appErrors(page);
    await page.close();
    return { pos, w, sandbox, luma, errors };
  };
  const a = await visit();
  const b = await visit();
  if (!check('opened', at(a.pos, 'still') && at(b.pos, 'still'), `1 ${where(a.pos)}, 2 ${where(b.pos)}`))
    return;

  const pick = (v) => ({
    lumaHash: v.sandbox.lumaHash,
    stillHash: v.sandbox.stillHash,
    screenHash: v.w.screenHash,
    screenMean: v.w.screenMean,
    screenNoise: v.w.screenNoise,
    frames: v.w.frames,
  });
  n.pages = [pick(a), pick(b)];
  n.lumaDiff = lumaDiff(a.luma, b.luma);
  n.maxCellDiff = maxCellDiff(a.luma, b.luma);
  const [p, q] = n.pages;
  check(
    'model',
    typeof p.stillHash === 'string' && p.stillHash === q.stillHash,
    `stillHash ${p.stillHash} / ${q.stillHash}`,
  );
  check(
    'eye',
    n.lumaDiff <= 12,
    `${n.lumaDiff} of ${a.luma.length} cells differ by more than 2; the largest difference ${n.maxCellDiff}; ` +
      `lumaHash ${p.lumaHash} / ${q.lumaHash}`,
  );
  const sameLuma = p.lumaHash === q.lumaHash;
  n.screenMeanDiff = Math.abs(p.screenMean - q.screenMean);
  n.screenNoiseDiff = Math.abs(p.screenNoise - q.screenNoise);
  check(
    'screen',
    sameLuma ? p.screenHash === q.screenHash : n.screenMeanDiff <= 1 && n.screenNoiseDiff <= 0.5,
    sameLuma
      ? `same eye frame → screenHash ${p.screenHash} / ${q.screenHash}`
      : `eye frames differ → |Δ screenMean| ${round(n.screenMeanDiff, 3)} (≤ 1), |Δ screenNoise| ` +
          `${round(n.screenNoiseDiff, 3)} (≤ 0.5); screenHash ${p.screenHash} / ${q.screenHash}`,
  );
  const errors = [...a.errors, ...b.errors];
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors, 'both pages clean'));
}

// Step `live` on the live clock: the background thread, its replies, the gate of a computer.
async function live(context) {
  const n = (report.sections.live = {});
  const page = await context.newPage();
  const pos = await open(page, 'live', null).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'live'), where(pos))) {
    await page.close();
    return;
  }
  // the first frame of the model on the monitor, within LIVE_WITHIN_MS of the page being open
  const first = await page.evaluate(async (limit) => {
    const t0 = performance.now();
    let w = window.__app.read('radio-world');
    while (!(w.mode === 'worker' && w.frames > 0 && w.meters !== null) && performance.now() - t0 < limit) {
      await new Promise((r) => requestAnimationFrame(r));
      w = window.__app.read('radio-world');
    }
    return { w, ms: performance.now() - t0 };
  }, LIVE_WITHIN_MS);
  const s = await locateOn(page, 'yard:monitorScreen');
  n.first = { mode: first.w.mode, frames: first.w.frames, meters: first.w.meters, afterMs: round(first.ms) };
  n.screenVisible = s?.visible === true;
  check(
    'worker',
    first.w.mode === 'worker' && first.w.frames > 0 && first.w.meters !== null && n.screenVisible,
    `mode ${first.w.mode}, ${first.w.frames} frames, meters ${first.w.meters ? 'in' : 'null'} after ` +
      `${round(first.ms)} ms; monitor's screen ${n.screenVisible ? 'in view' : 'OUT'}`,
  );

  // the gate of a computer: `modelMs` of each new reply of the thread, read once per animation frame
  await page.evaluate(() => window.__app.resetStats());
  const replies = await page.evaluate(
    async ({ count, limit }) => {
      const out = [];
      let last = window.__app.read('radio-world').frames;
      const t0 = performance.now();
      while (out.length < count && performance.now() - t0 < limit) {
        await new Promise((r) => requestAnimationFrame(r));
        const w = window.__app.read('radio-world');
        if (w.frames > last) {
          out.push({ frames: w.frames, modelMs: w.modelMs, fps: w.fps, mode: w.mode });
          last = w.frames;
        }
      }
      return out;
    },
    { count: DESKTOP_REPLIES, limit: 30_000 },
  );
  const w = await read(page, 'radio-world');
  const st = await stats(page);
  const ms = replies.map((x) => x.modelMs);
  Object.assign(n, {
    modelMs: round(mean(ms)),
    modelMsMin: round(Math.min(...ms)),
    modelMsMax: round(Math.max(...ms)),
    samples: ms.map((v) => round(v)),
    modes: [...new Set(replies.map((x) => x.mode))],
    fps: round(w.fps),
    frames: w.frames,
    eye: w.eye,
    intervalAvg: round(st.intervalAvg),
    cpuAvg: round(st.cpuAvg),
    renderer: report.gpu?.renderer ?? null,
  });
  check(
    'desktop',
    replies.length === DESKTOP_REPLIES &&
      n.modes.length === 1 &&
      n.modes[0] === 'worker' &&
      n.modelMs <= DESKTOP_MAX_MS,
    `modelMs ${n.modelMs} (${n.modelMsMin}…${n.modelMsMax}) over ${replies.length} replies of the ` +
      `${n.modes.join('/') || '—'} thread (limit ${DESKTOP_MAX_MS}); fps ${n.fps}; scene frame ${n.intervalAvg} ms`,
  );
  await screenshot(page, join(out, `live-${width}x${height}.jpg`));
  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

// Step `live`: `radio-bench` (ten `still` frames on the main thread) as it is, then under a 4× CPU slowdown.
async function bench(context) {
  const n = (report.sections.bench = {});
  const page = await context.newPage();
  const pos = await open(page, 'live', null).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'live'), where(pos))) {
    await page.close();
    return;
  }
  await frames(page, 30);
  n.normal = await read(page, 'radio-bench');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: PHONE_SLOWDOWN });
  try {
    n.slow = await read(page, 'radio-bench');
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await cdp.detach();
  n.slowdown = PHONE_SLOWDOWN;
  check(
    'phone',
    Number.isFinite(n.slow?.frameMs) && n.slow.frameMs <= PHONE_MAX_MS,
    `frameMs ${round(n.slow?.frameMs)} under a ${PHONE_SLOWDOWN}× slowdown (limit ${PHONE_MAX_MS}), ` +
      `${round(n.normal?.frameMs)} without it; stillMs ${round(n.slow?.stillMs)} / ${round(n.normal?.stillMs)}`,
  );
  await page.close();
}

// Step `live` on the live clock: three visits to `_sandbox-ui` and back. Every message logged meanwhile counts,
// except the one known warning of `_sandbox-ui` itself, see VISIT_WARNING.
async function leaks(context) {
  const n = (report.sections.leaks = {});
  const page = await context.newPage();
  const pos = await open(page, 'live', null).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'live'), where(pos))) {
    await page.close();
    return;
  }
  const memory = [];
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__app.goto('_sandbox-ui'));
    await page.evaluate((c) => window.__app.goto(c, 'live'), CHAPTER);
    await frames(page, 10);
    const s = await stats(page);
    memory.push({ geometries: s.geometries, textures: s.textures, programs: s.programs });
  }
  n.memory = memory;
  const grew = ['geometries', 'textures', 'programs'].filter((k) => memory[2][k] > memory[0][k]);
  check(
    'memory',
    at(await position(page), 'live') && grew.length === 0,
    `after the 1st return ${JSON.stringify(memory[0])}, after the 3rd ${JSON.stringify(memory[2])}`,
  );
  // the threads of the visits are stopped: one left, the current mount's, within LIVE_WITHIN_MS
  const t0 = Date.now();
  let workers = page.workers().length;
  while (workers !== 1 && Date.now() - t0 < LIVE_WITHIN_MS) {
    await sleep(100);
    workers = page.workers().length;
  }
  const w = await read(page, 'radio-world');
  Object.assign(n, { workers, afterMs: Date.now() - t0, mode: w?.mode });
  check(
    'worker',
    w?.mode === 'worker' && workers === 1,
    `mode ${w?.mode}; ${workers} worker(s) on the page after ${n.afterMs} ms`,
  );
  const log = await appErrors(page);
  n.visitMessages = log.filter(visitWarning);
  const errors = log.filter((m) => !visitWarning(m));
  n.errors = errors;
  check(
    'console',
    errors.length === 0,
    consoleText(errors) + `; left out: ${n.visitMessages.length} × the known '_sandbox-ui' warning`,
  );
  await page.close();
}

/* ---------------------------------------------------------------------------------------------- run */

const SECTIONS = { eye, yard, whereami, ladder, repeat, live, bench, leaks };
const only =
  typeof args.only === 'string'
    ? args.only
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : Object.keys(SECTIONS);
const unknown = only.filter((s) => !(s in SECTIONS));
if (unknown.length) {
  console.error(
    `measure: unknown section(s) ${unknown.join(', ')}; known: ${Object.keys(SECTIONS).join(', ')}`,
  );
  process.exit(2);
}

const { browser, context, page } = await launch({ width, height, dpr: touch ? 3 : 1, touch });
await page.close(); // every section opens the pages it needs and closes them
try {
  for (const name of only) {
    section = name;
    try {
      await SECTIONS[name](context);
    } catch (err) {
      check(
        'error',
        false,
        String(err?.stack ?? err)
          .split('\n')
          .slice(0, 3)
          .join(' | '),
      );
    }
  }
} finally {
  await browser.close();
}

const failed = report.checks.filter((c) => !c.ok).length;
report.verdict = failed
  ? `FAIL ${failed} of ${report.checks.length}`
  : `PASS sandbox-radio-link — ${report.checks.length} checks`;
writeFileSync(join(out, 'measure.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`  numbers: ${join(out, 'measure.json')}`);
console.log(report.verdict);
process.exit(failed ? 1 : 0);
