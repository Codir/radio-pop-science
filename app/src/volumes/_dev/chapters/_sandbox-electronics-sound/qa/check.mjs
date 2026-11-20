#!/usr/bin/env node
/* global process, console, window, document, URL */
// Browser check of the sandbox `_dev/_sandbox-electronics-sound` (E1-9): the volume's own sound output playing the
// melody through the circuit model. A preview or dev server must be up:
//
//   node app/src/volumes/_dev/chapters/_sandbox-electronics-sound/qa/check.mjs --port <n> --out <dir>
//        [--only sound,settings,filter,noaudio,visits] [--size 1280x720]
//
// The sound starts after the first gesture the engine sees (`ctx.gesture`): the check clicks the scene (a point
// where the canvas is on top) with Playwright's real mouse. Chrome runs with the flags of `tools/qa/lib.mjs`
// (`GPU_ARGS`), which include `--autoplay-policy=no-user-gesture-required`; the check relies on the click for the
// engine's gesture, and on the flag for nothing — it passes without it too (README of `shared/sound`, «QA»). Every
// page but the one of `noaudio` opens without `?noaudio` (the QA helpers add it by default). An init script counts
// every `AudioContext` the page makes (`window.__qaAudio`): the engine's own (one, on the first gesture) and the
// sandbox's.
//
// Sections (`--only`, default all):
//   sound    — the click, then 10 s of sound on the GPU: the output on the context's clock, the model in a background
//              thread, no underrun, at least 90 % of the blocks of 10 s played (10 s / 64 ms = 156), the latency
//              of the output: the sound planned ahead plus the context's own, at most 0.25 s.
//   settings — the engine's settings: the sound off → the output's gain 0 (what it asks for and what the context
//              applies); on again at volume 0.5 → 0.5² × 0.55.
//   filter   — the slider is heard: the level of the speaker's current and its part above 2 kHz over the last 32
//              blocks (2 s) the model computed with each board (`electronics-sound.level`: read from the model's samples,
//              not from a microphone) — straight, through 1 kΩ, through 10 kΩ: the high part falls each time, and
//              its share too; the scope redraws about 30 times a second and shows the speaker's voltage.
//   noaudio  — `?noaudio` and a click: no `AudioContext` is made (neither the engine's nor the sandbox's); the
//              model still plays, silently, on the engine's clock.
//   visits   — three visits to another chapter and back: after each exit no background thread and no live context
//              of the sandbox (the engine's one stays); after each return one thread and the sound running again.
// Every section's page is checked for console errors. The numbers go to <out>/check.json; the last line is
// `PASS sandbox-electronics-sound — <n> checks` (exit 0) or `FAIL <k> of <n>` (exit 1).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  appErrors,
  appUrl,
  baseUrl,
  ensureDir,
  launch,
  openApp,
  parseArgs,
  parseSize,
  screenshot,
} from '../../../../../../../tools/qa/lib.mjs';

const CHAPTER = '_sandbox-electronics-sound';
const STEP = 'filter';
const READER = 'electronics-sound';
/** The chapter the visits go to and come back from: a plain studio scene of `_dev`. */
const ELSEWHERE = '_sandbox-studio';
const OPEN_TIMEOUT_MS = 180_000;
/** How long the sound has to start after the click, and the threads to stop after an exit. */
const WITHIN_MS = 8000;
const LISTEN_S = 10;
/** The share of the blocks of LISTEN_S that must have played. */
const MIN_PLAYED = 0.9;
const MAX_LATENCY_S = 0.25;
const LEVEL_WITHIN_MS = 15_000;
/** Engine settings: the output's gain is volume² × 0.55 (`OUTPUT_LEVEL`). */
const OUTPUT_LEVEL = 0.55;

const args = parseArgs();
if (typeof args.out !== 'string') {
  console.error('check: --out <directory> is required');
  process.exit(2);
}
const [width, height] = parseSize(args.size, [1280, 720]);
const base = baseUrl(args);
const out = ensureDir(args.out);
const q = 'high';

/* ------------------------------------------------------------------------------------------- helpers */

const report = {
  when: new Date().toISOString(),
  base,
  size: `${width}x${height}`,
  chrome: process.env.QA_CHROME_ARGS ?? 'GPU_ARGS of tools/qa/lib.mjs',
  gpu: null,
  sections: {},
  checks: [],
  verdict: '',
};
let section = '';
const check = (what, ok, detail = '') => {
  report.checks.push({ section, what, ok: Boolean(ok), detail: String(detail) });
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${section.padEnd(8)} ${what}${detail === '' ? '' : `  [${detail}]`}`,
  );
  return Boolean(ok);
};
const round = (v, digits = 3) => (Number.isFinite(v) ? Number(v.toFixed(digits)) : v);
const consoleText = (errors) =>
  errors.length ? `${errors.length}: ${errors[0].level} ${errors[0].message.slice(0, 160)}` : 'console clean';

/** The sandbox's page: without `?noaudio` unless asked. */
function pageUrl(noaudio) {
  const url = new URL(appUrl(base, { route: `_dev/${CHAPTER}/${STEP}`, q }));
  if (!noaudio) url.searchParams.delete('noaudio');
  return url.toString();
}

const read = (page) => page.evaluate((n) => window.__app.read(n), READER);
const position = (page) => page.evaluate(() => window.__app.position());
const audioCount = (page) =>
  page.evaluate(() => ({
    made: window.__qaAudio.made(),
    live: window.__qaAudio.live(),
    rates: window.__qaAudio.rates(),
  }));
const at = (pos) => pos?.chapterId === CHAPTER && pos?.stepId === STEP;

/** Waits (real time) until `test(value)` holds for `get()`, at most `limit` ms; returns the last value. */
async function until(get, test, limit) {
  const t0 = Date.now();
  let v = await get();
  while (!test(v) && Date.now() - t0 < limit) {
    await sleep(100);
    v = await get();
  }
  return v;
}

async function open(page, noaudio) {
  const url = pageUrl(noaudio);
  const gpu = await Promise.race([
    openApp(page, url, { timeout: OPEN_TIMEOUT_MS }),
    sleep(OPEN_TIMEOUT_MS).then(() => {
      throw new Error(`no answer from ${url} within ${OPEN_TIMEOUT_MS / 1000} s`);
    }),
  ]);
  report.gpu ??= gpu;
  return position(page);
}

/** A real click on the scene: the first point of a coarse grid where the canvas is on top. */
async function clickScene(page) {
  const point = await page.evaluate(() => {
    for (const fy of [0.5, 0.6, 0.4, 0.7, 0.3])
      for (const fx of [0.5, 0.55, 0.45, 0.6, 0.4, 0.65, 0.35]) {
        const x = Math.round(window.innerWidth * fx);
        const y = Math.round(window.innerHeight * fy);
        if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
      }
    return null;
  });
  if (point === null) throw new Error('no point of the scene where the canvas is on top');
  await page.mouse.click(point.x, point.y);
  return point;
}

/** The sandbox's sound running on the context's clock, its model in a thread. */
const running = (r) =>
  r?.state === 'running' && r?.clock === 'audio' && r?.mode === 'worker' && r?.blocks > 3;

/** The page every section but `noaudio` and `visits` shares: opened once, clicked once. */
let shared = null;
async function listening(context) {
  if (shared) return shared;
  const page = await context.newPage();
  const pos = await open(page, false).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos), pos?.error ?? `${pos?.chapterId}/${pos?.stepId}`)) {
    await page.close();
    return null;
  }
  const before = await read(page);
  const click = await clickScene(page);
  const r = await until(() => read(page), running, WITHIN_MS);
  check(
    'started',
    before.state === 'waiting' && running(r),
    `before the click ${before.state}/${before.clock}, ${before.blocks} blocks on the engine clock; after it at ` +
      `(${click.x}, ${click.y}): ${r.state}/${r.clock}, mode ${r.mode}, ${r.blocks} blocks`,
  );
  shared = page;
  return page;
}

/* ------------------------------------------------------------------------------------------ sections */

async function sound(context) {
  const n = (report.sections.sound = {});
  const page = await listening(context);
  if (!page) return;
  const a = await read(page);
  const t0 = Date.now();
  const latencies = [];
  while (Date.now() - t0 < LISTEN_S * 1000) {
    await sleep(250);
    latencies.push((await read(page)).latency);
  }
  const b = await read(page);
  const seconds = (Date.now() - t0) / 1000;
  const blockMs = (1000 * b.block) / b.rate;
  Object.assign(n, {
    seconds: round(seconds, 2),
    blockMs: round(blockMs, 1),
    expected: Math.floor((seconds * 1000) / blockMs),
    played: b.played - a.played,
    underruns: b.underruns - a.underruns,
    underrunsTotal: b.underruns,
    blocks: b.blocks - a.blocks,
    modelMs: round(b.modelMs, 2),
    latency: { min: round(Math.min(...latencies)), max: round(Math.max(...latencies)) },
    audio: await audioCount(page),
    gpu: report.gpu?.renderer ?? null,
  });
  check(
    'no underrun',
    n.underruns === 0 && n.played >= MIN_PLAYED * n.expected && b.state === 'running' && b.mode === 'worker',
    `${n.played} blocks played in ${n.seconds} s (${n.expected} fit in it), ${n.underruns} underruns ` +
      `(${n.underrunsTotal} since the start), the model ${n.modelMs} ms a block of ${n.blockMs} ms, on ${n.gpu}`,
  );
  check(
    'latency',
    n.latency.max <= MAX_LATENCY_S && n.latency.min > 0,
    `${n.latency.min}…${n.latency.max} s (limit ${MAX_LATENCY_S})`,
  );
  check(
    'contexts',
    n.audio.made === 2 && n.audio.live === 2 && n.audio.rates[1] === 24000,
    `${n.audio.made} made, ${n.audio.live} live: the engine's and the sandbox's, at ` +
      `${n.audio.rates.join(' and ')} Hz`,
  );
  await screenshot(page, join(out, `sound-${width}x${height}.jpg`));
}

async function settings(context) {
  const n = (report.sections.settings = {});
  const page = await listening(context);
  if (!page) return;
  const set = (patch) => page.evaluate((p) => window.__app.engine.store.updateSettings(p), patch);
  const original = await page.evaluate(() => window.__app.engine.store.get().settings);
  await set({ audio: false });
  const off = await until(
    () => read(page),
    (r) => r.gain === 0 && Math.abs(r.gainNow) < 1e-3,
    3000,
  );
  n.off = { gain: off.gain, gainNow: round(off.gainNow, 6), state: off.state };
  check(
    'sound off',
    off.gain === 0 && Math.abs(off.gainNow) < 1e-3,
    `gain ${off.gain}, applied ${n.off.gainNow}, context ${off.state}`,
  );
  await set({ audio: true, volume: 0.5 });
  const want = 0.25 * OUTPUT_LEVEL;
  const half = await until(
    () => read(page),
    (r) => Math.abs(r.gainNow - want) < 1e-3,
    3000,
  );
  n.half = { gain: round(half.gain, 6), gainNow: round(half.gainNow, 6) };
  check(
    'volume 0.5',
    Math.abs(half.gain - want) < 1e-9 && Math.abs(half.gainNow - want) < 1e-3,
    `gain ${n.half.gain}, applied ${n.half.gainNow} (want ${want})`,
  );
  await set({ audio: original.audio, volume: original.volume });
}

async function filter(context) {
  const n = (report.sections.filter = {});
  const page = await listening(context);
  if (!page) return;
  const set = (id, value) => page.evaluate(([i, v]) => window.__ui.set(i, v, true), [id, value]);
  /** The level of the board `name`: once the meter's whole window was computed with it. */
  const levelOf = async (name) => {
    const r = await until(
      () => read(page),
      (x) => x.board === name && x.level.revision === x.revision && x.level.fresh >= x.window,
      LEVEL_WITHIN_MS,
    );
    return {
      board: r.board,
      window: r.window,
      ok: r.board === name && r.level.fresh >= r.window,
      ...r.level,
    };
  };
  await set('path', 'direct');
  const direct = await levelOf('direct');
  // the scope in the same two seconds: its redraws and its peak (the speaker's voltage)
  const engineTime = () => page.evaluate(() => window.__app.stats().time);
  const [s0, e0, w0] = [await read(page), await engineTime(), Date.now()];
  await sleep(2000);
  const [s1, e1, w1] = [await read(page), await engineTime(), Date.now()];
  const draws = s1.scope.draws - s0.scope.draws;
  n.scope = {
    perSecond: round(draws / ((w1 - w0) / 1000), 1),
    perEngineSecond: round(draws / (e1 - e0), 1),
    peakV: round(s1.scope.peak),
  };
  await set('path', 'filter');
  await set('ohms', 1000);
  const k1 = await levelOf('filter:1000');
  await set('ohms', 10000);
  const k10 = await levelOf('filter:10000');
  const share = (l) => l.hf / l.rms;
  Object.assign(n, {
    direct: { rms: round(direct.rms, 5), hf: round(direct.hf, 6), share: round(share(direct)) },
    k1: { rms: round(k1.rms, 5), hf: round(k1.hf, 6), share: round(share(k1)) },
    k10: { rms: round(k10.rms, 5), hf: round(k10.hf, 6), share: round(share(k10)) },
  });
  check(
    'boards',
    direct.ok && k1.ok && k10.ok,
    `${direct.board}, ${k1.board}, ${k10.board}: ${direct.window} blocks of each`,
  );
  check(
    'highs fall',
    k1.hf < 0.8 * direct.hf && k10.hf < 0.5 * k1.hf && share(k1) < share(direct) && share(k10) < share(k1),
    `above 2 kHz ${n.direct.hf} → ${n.k1.hf} → ${n.k10.hf} A; share ${n.direct.share} → ${n.k1.share} → ` +
      `${n.k10.share}`,
  );
  check(
    'scope',
    n.scope.perSecond >= 25 && n.scope.perSecond <= 35 && n.scope.peakV > 0.05,
    `${n.scope.perSecond} redraws a second (${n.scope.perEngineSecond} a second of engine time), ` +
      `peak ${n.scope.peakV} V`,
  );
  const r = await read(page);
  check(
    'no underrun',
    r.underruns === 0,
    `${r.underruns} underruns since the start, ${r.played} blocks played`,
  );
  await screenshot(page, join(out, `filter-${width}x${height}.jpg`));
}

async function noaudio(context) {
  const n = (report.sections.noaudio = {});
  const page = await context.newPage();
  const pos = await open(page, true).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos), pos?.error ?? `${pos?.chapterId}/${pos?.stepId}`)) {
    await page.close();
    return;
  }
  await clickScene(page);
  const r = await until(
    () => read(page),
    (x) => x.blocks > 20,
    WITHIN_MS,
  );
  await sleep(1000);
  const audio = await audioCount(page);
  const flags = await page.evaluate(() => window.__app.engine.flags.noaudio);
  Object.assign(n, { audio, state: r.state, clock: r.clock, blocks: r.blocks, mode: r.mode, flags });
  check(
    'no context',
    flags === true && audio.made === 0 && r.state === 'off' && r.clock === 'engine',
    `?noaudio ${flags}: ${audio.made} AudioContext made; output ${r.state} on the ${r.clock} clock`,
  );
  check('plays silently', r.blocks > 20 && r.mode === 'worker', `${r.blocks} blocks of the model, ${r.mode}`);
  const errors = await appErrors(page);
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

async function visits(context) {
  const n = (report.sections.visits = { trips: [] });
  const page = await context.newPage();
  const pos = await open(page, false).catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos), pos?.error ?? `${pos?.chapterId}/${pos?.stepId}`)) {
    await page.close();
    return;
  }
  await clickScene(page);
  const first = await until(() => read(page), running, WITHIN_MS);
  check('started', running(first), `${first.state}/${first.clock}, ${first.mode}`);
  for (let i = 0; i < 3; i++) {
    await page.evaluate((c) => window.__app.goto(c), ELSEWHERE);
    const away = await until(
      async () => ({ workers: page.workers().length, ...(await audioCount(page)) }),
      (x) => x.workers === 0 && x.live === 1,
      WITHIN_MS,
    );
    await page.evaluate(([c, s]) => window.__app.goto(c, s), [CHAPTER, STEP]);
    const back = await until(
      async () => ({ workers: page.workers().length, r: await read(page) }),
      (x) => x.workers === 1 && running(x.r),
      WITHIN_MS,
    );
    n.trips.push({ away, back: { workers: back.workers, state: back.r?.state, mode: back.r?.mode } });
  }
  const audio = await audioCount(page);
  n.audio = audio;
  check(
    'after exits',
    n.trips.every((t) => t.away.workers === 0 && t.away.live === 1),
    n.trips.map((t) => `${t.away.workers} threads, ${t.away.live} live contexts`).join('; '),
  );
  check(
    'after returns',
    n.trips.every((t) => t.back.workers === 1 && t.back.state === 'running') &&
      at(await position(page)) &&
      audio.made === 5 &&
      audio.live === 2,
    `${n.trips.map((t) => `${t.back.workers} thread, ${t.back.state}`).join('; ')}; contexts ${audio.made} made ` +
      `(the engine's and four of the sandbox), ${audio.live} live`,
  );
  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* ---------------------------------------------------------------------------------------------- run */

const SECTIONS = { sound, settings, filter, noaudio, visits };
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
    `check: unknown section(s) ${unknown.join(', ')}; known: ${Object.keys(SECTIONS).join(', ')}`,
  );
  process.exit(2);
}

const { browser, context, page } = await launch({ width, height });
await page.close(); // every section opens the pages it needs
// every AudioContext the pages make, the engine's and the sandbox's
await context.addInitScript(() => {
  const Base = window.AudioContext;
  if (!Base) return;
  const made = [];
  window.AudioContext = class extends Base {
    constructor(...a) {
      super(...a);
      made.push(this);
    }
  };
  window.__qaAudio = {
    made: () => made.length,
    live: () => made.filter((c) => c.state !== 'closed').length,
    rates: () => made.map((c) => c.sampleRate),
  };
});
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
  if (shared) {
    section = 'shared';
    const errors = await appErrors(shared);
    report.sections.shared = { errors };
    check('console', errors.length === 0, consoleText(errors));
  }
} finally {
  await browser.close();
}

const failed = report.checks.filter((c) => !c.ok).length;
report.verdict = failed
  ? `FAIL ${failed} of ${report.checks.length}`
  : `PASS sandbox-electronics-sound — ${report.checks.length} checks`;
writeFileSync(join(out, 'check.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`  numbers: ${join(out, 'check.json')}`);
console.log(report.verdict);
process.exit(failed ? 1 : 0);
