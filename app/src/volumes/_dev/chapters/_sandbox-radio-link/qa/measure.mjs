#!/usr/bin/env node
/* global process, console, window, document, requestAnimationFrame */
// Browser check and measurements of the sandbox `_dev/_sandbox-radio-link` (preview or dev server up; batch 2,
// Block Q builds the full tree, serves it on 5377 and runs this):
//
//   node app/src/volumes/_dev/chapters/_sandbox-radio-link/qa/measure.mjs --port 5377 --out <dir>
//        [--only eye,…] [--size 1280x720] [--touch]
//
// Sections (`--only`, default all):
//   eye — the camera's eye (B1b): the extra renderer pass, the orientation of its frame, the floating screen, its
//         independence of the director's camera and of the engine's draw-call counter, its cost on a live frame
//         (the gate of decision 24), leaks and the console.
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

/** How many cells of two eye frames (`radio-luma`) differ by more than 2 levels (all of them if sizes differ). */
function lumaDiff(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return Math.max(a?.length ?? 0, b?.length ?? 0, 1);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 2) n++;
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
    await pd.close();
    return;
  }

  // Д: the same engine time as З below (1 s of freeze hold + 30 steps), its eye frame, then the page goes
  await pd.evaluate(() => window.__app.step(1 / 60, 30));
  await held(pd);
  const lumaD = await read(pd, 'radio-luma');
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

  // the cost of a held pass (it also redraws the shadow map): a number for the report, not a gate
  const heldSamples = [];
  for (let i = 0; i < 20; i++) {
    await held(pz);
    heldSamples.push((await read(pz, 'radio-eye')).lastMs);
  }
  n.heldMs = round(mean(heldSamples));
  n.heldSamples = heldSamples.map((v) => round(v));

  // three visits to another chapter: no geometry, texture or program stays behind. What the console gets while
  // `_sandbox-ui` is being opened is that chapter's own (it shows a WebGL-only control under the DOM interface on
  // purpose, and the DOM interface warns about it): it is kept apart from this chapter's messages
  const memory = [];
  const visiting = []; // [from, to) indices of `__app.errors()` logged while `_sandbox-ui` was being opened
  for (let i = 0; i < 3; i++) {
    const from = (await appErrors(pz)).length;
    await pz.evaluate(() => window.__app.goto('_sandbox-ui'));
    visiting.push([from, (await appErrors(pz)).length]);
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
  const logZ = await appErrors(pz);
  const visit = (k) => visiting.findIndex(([from, to]) => k >= from && k < to);
  n.visitMessages = logZ.flatMap((m, k) => (visit(k) < 0 ? [] : [{ visit: visit(k) + 1, ...m }]));
  errors.push(...logZ.flatMap((m, k) => (visit(k) < 0 ? [{ page: 'З', ...m }] : [])));
  await pz.close();

  // Ж: the live clock; the gate of decision 24
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

  n.errors = errors;
  check(
    'console',
    errors.length === 0,
    (errors.length
      ? `${errors.length}: [${errors[0].page}] ${errors[0].level} ${errors[0].message.slice(0, 160)}`
      : 'pages З, Д, Ж clean') +
      `; ${n.visitMessages.length} message(s) of _sandbox-ui while it was opened kept apart`,
  );
}

/* ---------------------------------------------------------------------------------------------- run */

const SECTIONS = { eye };
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
