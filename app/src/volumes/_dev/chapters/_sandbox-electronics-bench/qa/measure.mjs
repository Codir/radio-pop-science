#!/usr/bin/env node
/* global process, console, window, document */
// Browser check and measurements of the sandbox `_dev/_sandbox-electronics-bench` (a dev or preview server up; the
// skeleton — arguments, `report` / `check` / verdict, `open`, `held` — is copied from the radio sandbox's
// `qa/measure.mjs`, electronics/shared/README.md «Копії»; the sections are the bench's own):
//
//   node app/src/volumes/_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs --port 5480 --out <dir>
//        [--only room,…] [--size 1280x720] [--touch]
//
// Sections (`--only`, default all):
//   room  — step `room` on a held page (`?freeze`): the bench's reader `electronics-bench` (204 sockets, 36 rows),
//           draw calls ≤ 350 (the empty board's target ≤ 200), the sockets `a1`, `j17`, `-9` — and all 204 — on screen
//           inside the area the interface leaves free, one pitch in px (VISUAL §8 asks for it to be measured), no
//           board print on the main shot (it would be under 16 px-equivalent), at most four hue families
//           (VISUAL §2), the frame ≤ 8 ms on a desktop (`__app.measure`; a phone's is reported), the console;
//           snapshot `room-<size>.jpg`. With `--touch` the page is a phone's and the bench shows the shot `phone`.
//   shots — steps `board`, `meter`, `scope` on held pages: draw calls, the pitch, the board's print (all 12 texts on
//           `board` and every world text ≥ 16 px-equivalent; none on a phone), the instrument's stand-in inside the
//           free area of its shot (not on a phone, where every shot is `phone`), the console; snapshots
//           `<step>-<size>.jpg`.
//   parts — step `parts` on a held page (E2-4): `electronics-board` lists every part placed with the sockets of its
//           legs and every model shown outside the circuit; each one has a model; draw calls ≤ 350 with all of them on
//           the board; every world text shown ≥ 16 px-equivalent (none on a phone); the hue families (reported);
//           snapshot `parts-<size>.jpg`. On a desktop then every part and permanent thing close (the camera put in
//           front of it and above, from `electronics-parts`; a print too small for that, once more at the print): its
//           print shown whole and ≥ 16 px-equivalent, snapshots `close-<id>[-print]-<size>.jpg` for the reader of the
//           parts' look; the console.
// Every section starts with the check `opened` and goes no further when it fails. The numbers go to
// <out>/measure.json; the last line is `PASS sandbox-electronics-bench — <n> checks` (exit 0) or `FAIL <k> of <n>`
// (exit 1). `--touch` runs a phone-like page (device pixel ratio 3, touch, quality tier picked by the app).
import { writeFileSync } from 'node:fs';
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
import { read } from './helpers.mjs';

const CHAPTER = '_sandbox-electronics-bench';
const route = (step) => `_dev/${CHAPTER}/${step}`;
/** A page that has not opened within this time counts as not opened (an unknown route may never settle). */
const OPEN_TIMEOUT_MS = 180_000;
/** Draw calls: the gate of `chapter-check` and the target for the empty board (VISUAL §10). */
const DRAW_CALLS = { gate: 350, target: 200 };
/** The frame budget of the batch on a desktop, ms. */
const FRAME_MS = 8;
/** The sockets the brief names, and the four corners of the field. */
const NAMED = ['a1', 'j17', '-9'];
const CORNERS = ['+1', '+17', '-1', '-17'];

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
const tag = `${width}x${height}${touch ? '-touch' : ''}`;

/* ------------------------------------------------------------------------------------------- helpers */

/** One held frame: the frozen clock does not move, the engine updates once with dt = 0 and draws the frame. */
const held = (page) => page.evaluate(() => window.__app.step(1 / 60, 0));
const stats = (page) => page.evaluate(() => window.__app.stats());
const position = (page) => page.evaluate(() => window.__app.position());
const round = (v, digits = 2) => (Number.isFinite(v) ? Number(v.toFixed(digits)) : v);

/** Open an app page on a held clock; resolves with `__app.position()` or rejects (load error, no answer in time). */
async function open(page, step) {
  const url = appUrl(base, { route: route(step), q, freeze: 1 });
  const gpu = await Promise.race([
    openApp(page, url, { timeout: OPEN_TIMEOUT_MS }),
    sleep(OPEN_TIMEOUT_MS).then(() => {
      throw new Error(`no answer from ${url} within ${OPEN_TIMEOUT_MS / 1000} s`);
    }),
  ]);
  report.gpu ??= gpu;
  await page.evaluate(() => window.__app.settled());
  // the web fonts are in before anything is measured
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await held(page);
  return position(page);
}

const at = (pos, step) => pos?.chapterId === CHAPTER && pos?.stepId === step;
const where = (pos) => (pos?.error ? pos.error : `${pos?.chapterId ?? '—'}/${pos?.stepId ?? '—'}`);

/**
 * Where probes are on screen against the area the interface leaves free (`hud.insetFractions()`): for each, its CSS
 * px and its reach from the middle of the free area as a share of the half-width / half-height (≤ 1 = inside).
 */
const onScreen = (page, names) =>
  page.evaluate((list) => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const i = window.__app.engine.hud.insetFractions();
    const free = { x0: i.left * W, x1: (1 - i.right) * W, y0: i.top * H, y1: (1 - i.bottom) * H };
    const cx = (free.x0 + free.x1) / 2;
    const cy = (free.y0 + free.y1) / 2;
    return {
      free,
      probes: Object.fromEntries(
        list.map((n) => {
          const p = window.__app.locate(n);
          if (!p) return [n, null];
          const rx = Math.abs(p.x - cx) / ((free.x1 - free.x0) / 2);
          const ry = Math.abs(p.y - cy) / ((free.y1 - free.y0) / 2);
          return [n, { x: p.x, y: p.y, visible: p.visible && p.shown, rx, ry, inside: rx <= 1 && ry <= 1 }];
        }),
      ),
    };
  }, names);

/** One pitch near the middle of the board in CSS px: the sockets `e9` and `e10`. */
async function pitchPx(page) {
  const s = await onScreen(page, ['socket:e9', 'socket:e10']);
  const a = s.probes['socket:e9'];
  const b = s.probes['socket:e10'];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : NaN;
}

const consoleText = (errors) =>
  errors.length === 0 ? 'clean' : errors.map((e) => `${e.level}: ${e.message}`.slice(0, 160)).join(' | ');

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

/** Draw calls of a held frame, from the engine and from the bench's reader (they must agree). */
async function drawCalls(page) {
  await held(page);
  const s = await stats(page);
  const r = await read(page, 'electronics-bench');
  return { engine: s.drawCalls, reader: r?.drawCalls, triangles: s.triangles, programs: s.programs };
}

/* -------------------------------------------------------------------------------------- section room */

async function room(context) {
  const n = (report.sections.room = {});
  const page = await context.newPage();
  const pos = await open(page, 'room').catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'room'), where(pos))) {
    await page.close();
    return;
  }
  const bench = await read(page, 'electronics-bench');
  n.bench = bench;
  check(
    'reader',
    bench?.sockets === 204 && bench?.rows === 36 && bench?.phone === touch,
    `sockets ${bench?.sockets}, rows ${bench?.rows}, phone ${bench?.phone}`,
  );

  const calls = (n.drawCalls = await drawCalls(page));
  check(
    'draw calls',
    calls.engine > 0 && calls.engine <= DRAW_CALLS.gate && calls.reader === calls.engine,
    `${calls.engine} (reader ${calls.reader}; gate ≤ ${DRAW_CALLS.gate}, target ≤ ${DRAW_CALLS.target}: ` +
      `${calls.engine <= DRAW_CALLS.target ? 'met' : 'missed'}); ${calls.triangles} triangles, ${calls.programs} programs`,
  );

  const all = await page.evaluate(() => window.__app.probes().filter((p) => p.startsWith('socket:')));
  const seen = await onScreen(page, all);
  n.free = seen.free;
  const named = [...NAMED, ...CORNERS].map((id) => [id, seen.probes[`socket:${id}`]]);
  n.named = Object.fromEntries(
    named.map(([id, p]) => [
      id,
      p && { x: round(p.x, 1), y: round(p.y, 1), rx: round(p.rx), ry: round(p.ry) },
    ]),
  );
  check(
    'sockets a1, j17, -9',
    named.slice(0, NAMED.length).every(([, p]) => p?.visible && p.inside),
    named
      .slice(0, NAMED.length)
      .map(
        ([id, p]) =>
          `${id} ${p ? `(${round(p.x, 0)}, ${round(p.y, 0)}) ${p.inside ? 'in' : 'OUT'}` : 'missing'}`,
      )
      .join(', '),
  );
  const probes = Object.values(seen.probes).filter(Boolean);
  const rx = Math.max(...probes.map((p) => p.rx));
  const ry = Math.max(...probes.map((p) => p.ry));
  Object.assign(n, { sockets: probes.length, reach: { x: round(rx), y: round(ry) } });
  check(
    'all sockets in the free area',
    probes.length === 204 && probes.every((p) => p.visible && p.inside),
    `${probes.length} probes; reach ${round(rx)} × ${round(ry)} of the free half-area`,
  );
  n.pitchPx = round(await pitchPx(page), 1);
  check('pitch measured', Number.isFinite(n.pitchPx) && n.pitchPx > 0, `P ${n.pitchPx} px`);
  check('no board print on the main shot', bench?.print === 0, `${bench?.print} texts shown`);

  const png = decodePng(await page.screenshot({ type: 'png' }));
  const hue = hueFamilies(png);
  n.hue = hue;
  check(
    'hue families ≤ 4',
    hue.families.length <= 4,
    `${hue.families.join(', ')} (${hue.coloured} coloured px)`,
  );
  await screenshot(page, join(out, `room-${tag}.jpg`));

  // the frame budget of the batch: ≤ 8 ms on a desktop (GPU-inclusive, `__app.measure`); a phone's page is reported
  const t = await page.evaluate(() => window.__app.measure(120));
  n.frame = { frameAvg: round(t.frameAvg), cpuAvg: round(t.cpuAvg), gpuAvg: round(t.gpuAvg ?? NaN) };
  if (touch) check('frame time (reported)', Number.isFinite(t.frameAvg), `${n.frame.frameAvg} ms`);
  else
    check(
      `frame ≤ ${FRAME_MS} ms`,
      t.frameAvg <= FRAME_MS,
      `${n.frame.frameAvg} ms (cpu ${n.frame.cpuAvg}, gpu ${n.frame.gpuAvg})`,
    );

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* ------------------------------------------------------------------------------------- section shots */

async function shots(context) {
  const n = (report.sections.shots = {});
  for (const step of ['board', 'meter', 'scope']) {
    const m = (n[step] = {});
    const page = await context.newPage();
    const pos = await open(page, step).catch((err) => ({ error: String(err) }));
    if (!check(`${step}: opened`, at(pos, step), where(pos))) {
      await page.close();
      continue;
    }
    const calls = (m.drawCalls = await drawCalls(page));
    check(`${step}: draw calls`, calls.engine > 0 && calls.engine <= DRAW_CALLS.gate, `${calls.engine}`);
    m.pitchPx = round(await pitchPx(page), 1);
    const bench = await read(page, 'electronics-bench');
    const texts = await page.evaluate(() => window.__app.textSizes());
    m.texts = texts.map((t) => ({ text: t.text, pxEq: round(t.pxEq, 1) }));
    const smallest = texts.length ? Math.min(...texts.map((t) => t.pxEq)) : Infinity;
    if (step === 'board')
      check(
        'board: print',
        touch ? bench?.print === 0 && texts.length === 0 : bench?.print === 12 && smallest >= 16,
        `${bench?.print} texts shown, smallest ${round(smallest, 1)} px-eq; P ${m.pitchPx} px`,
      );
    else
      check(
        `${step}: world texts ≥ 16 px-eq`,
        smallest >= 16,
        `${texts.length} texts, smallest ${round(smallest, 1)}`,
      );
    if (step !== 'board' && !touch) {
      const s = await onScreen(page, [`bench:${step}`]);
      const p = s.probes[`bench:${step}`];
      m.instrument = p && { x: round(p.x, 0), y: round(p.y, 0), rx: round(p.rx), ry: round(p.ry) };
      check(`${step}: the instrument in the free area`, p?.visible && p.inside, JSON.stringify(m.instrument));
    }
    await screenshot(page, join(out, `${step}-${tag}.jpg`));
    const errors = await appErrors(page);
    check(`${step}: console`, errors.length === 0, consoleText(errors));
    await page.close();
  }
}

/* ------------------------------------------------------------------------------------- section parts */

/** Step `parts` of the scene: every part on the board with the sockets of its legs, and the models shown outside the
 * circuit (the kinds the model's catalog gains in E1-5, E1-6). */
const PLACED = {
  LED1: ['a1', 'a2'],
  LED2: ['a4', 'a5'],
  LED3: ['a7', 'a8'],
  LED4: ['a10', 'a11'],
  LED5: ['a13', 'a14'],
  P1: ['d1', 'd3', 'd5'],
  R1: ['f1', 'f5'],
  R2: ['f7', 'f11'],
  R3: ['f13', 'f17'],
  R4: ['h1', 'h5'],
  R5: ['h7', 'h11'],
  R6: ['h13', 'h17'],
  R7: ['j1', 'j5'],
  D1: ['j7', 'j11'],
  D2: ['j13', 'j17'],
  J1: ['f6', 'j6'],
};
const SHOWN = ['C1', 'C2', 'C3', 'Q1'];
/** Close-ups: from the front and above (the direction of the shot `board`), the subject's sphere filling the frame;
 * a print too small for that, once more at the print, its em ≈ `printPx` px-equivalent. */
const CLOSE = { dir: [0, 0.62, 0.78], fill: 4.2, least: 0.42, fov: 27, printPx: 30 };

async function parts(context) {
  const n = (report.sections.parts = {});
  const page = await context.newPage();
  const pos = await open(page, 'parts').catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'parts'), where(pos))) {
    await page.close();
    return;
  }
  const board = (n.board = await read(page, 'electronics-board'));
  const ids = Object.keys(PLACED);
  const wrong = ids.filter((id) => JSON.stringify(board?.parts?.[id]?.legs) !== JSON.stringify(PLACED[id]));
  check(
    'electronics-board lists every part placed',
    wrong.length === 0 && Object.keys(board?.parts ?? {}).length === ids.length,
    `${Object.keys(board?.parts ?? {}).length} parts${wrong.length ? `; wrong: ${wrong.join(', ')}` : ''}`,
  );
  check(
    'every part has its model, the shown ones too',
    ids.every((id) => board?.models?.includes(id)) && SHOWN.every((id) => board?.shown?.includes(id)),
    `models ${board?.models?.length}, shown ${board?.shown?.join(' ')}`,
  );

  const calls = (n.drawCalls = await drawCalls(page));
  check(
    'draw calls with every part on the board',
    calls.engine > 0 && calls.engine <= DRAW_CALLS.gate && calls.reader === calls.engine,
    `${calls.engine} (gate ≤ ${DRAW_CALLS.gate}); ${calls.triangles} triangles, ${calls.programs} programs`,
  );
  const models = (n.models = await read(page, 'electronics-parts'));
  const heavy = Object.entries(models ?? {}).filter(
    ([id, m]) => id in PLACED && m.drawCalls - m.printsShown > 6,
  );
  check(
    'each part ≤ 6 draw calls besides its print',
    heavy.length === 0,
    heavy.map(([id, m]) => `${id} ${m.drawCalls}`).join(', ') || 'all',
  );

  const texts = await page.evaluate(() => window.__app.textSizes());
  n.texts = texts.map((t) => ({ text: t.text, pxEq: round(t.pxEq, 1) }));
  const smallest = texts.length ? Math.min(...texts.map((t) => t.pxEq)) : Infinity;
  if (touch) check('no print on a phone', texts.length === 0, `${texts.length} texts`);
  else
    check(
      'every print shown ≥ 16 px-eq',
      smallest >= 16,
      `${texts.length} texts, smallest ${round(smallest, 1)}: ${texts.map((t) => t.text.replace(/\s+/g, '')).join(' · ')}`,
    );

  const png = decodePng(await page.screenshot({ type: 'png' }));
  const hue = (n.hue = hueFamilies(png));
  check('hue families (reported)', true, `${hue.families.join(', ')} (${hue.coloured} coloured px)`);
  await screenshot(page, join(out, `parts-${tag}.jpg`));

  if (!touch) {
    n.close = {};
    /** Put the camera in front of `at` and above it at distance `d`, and draw two held frames. */
    const look = async (at, d) => {
      const [cx, cy, cz] = at;
      const k = d / Math.hypot(...CLOSE.dir);
      await page.evaluate(({ shot }) => window.__app.engine.runtime.director.go(shot, { instant: true }), {
        shot: {
          position: [cx + CLOSE.dir[0] * k, cy + CLOSE.dir[1] * k, cz + CLOSE.dir[2] * k],
          target: [cx, cy, cz],
          fov: CLOSE.fov,
        },
      });
      await held(page);
      await held(page);
      const seen = await read(page, 'electronics-parts');
      const t = await page.evaluate(() => window.__app.textSizes());
      return { seen, least: t.length ? Math.min(...t.map((x) => x.pxEq)) : Infinity, count: t.length };
    };
    for (const [id, m] of Object.entries(models ?? {})) {
      // the whole thing, its sphere filling the frame
      let v = await look(m.center, Math.max(m.radius, CLOSE.least) * CLOSE.fill);
      let where = 'whole';
      await screenshot(page, join(out, `close-${id}-${tag}.jpg`));
      if (v.seen[id].printsShown < v.seen[id].prints && m.printAt) {
        // a print too small for that framing: at the print, from where one em would be ≈ `printPx` px-equivalent in a
        // full frame, and closer step by step while it is still too small (the safe frame is fitted beside the panel)
        let d = (m.printEm * 540) / CLOSE.printPx / Math.tan((CLOSE.fov * Math.PI) / 360);
        for (let k = 0; k < 4; k++, d *= 0.6) {
          v = await look(m.printAt, d);
          if (v.seen[id].printsShown === v.seen[id].prints) break;
        }
        where = `print, ${round(d)} away`;
        await screenshot(page, join(out, `close-${id}-print-${tag}.jpg`));
      }
      const s = v.seen[id];
      n.close[id] = { where, prints: s.prints, shown: s.printsShown, smallest: round(v.least, 1) };
      check(
        `close ${id}: print whole, ≥ 16 px-eq`,
        s.printsShown === s.prints && v.least >= 16,
        `${where}: ${s.printsShown}/${s.prints} shown; texts in frame ${v.count}, smallest ${round(v.least, 1)}`,
      );
    }
  }

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* ---------------------------------------------------------------------------------------------- run */

const SECTIONS = { room, shots, parts };
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
  : `PASS sandbox-electronics-bench — ${report.checks.length} checks`;
writeFileSync(join(out, `measure-${tag}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(`  numbers: ${join(out, `measure-${tag}.json`)}`);
console.log(report.verdict);
process.exit(failed ? 1 : 0);
