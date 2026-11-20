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
//           the board; every world text shown ≥ 16 px-equivalent (none on a phone), and no print shown under something
//           that covers it (rays from the camera, `electronics-parts`); the hue families (reported); snapshot
//           `parts-<size>.jpg`. On a desktop then every part and permanent thing close (the camera put in front of it
//           and above, from `electronics-parts`; a print too small or covered there, once more at the print): its print
//           shown whole, seen with nothing drawn in front of it, and ≥ 16 px-equivalent, snapshots
//           `close-<id>[-print]-<size>.jpg` for the reader of the parts' look; the console.
//   hand  — step `hand` on a held page (E2-5), every gesture by a real pointer (a mouse, or a finger with --touch, the
//           thing then riding `LIFT` px above it): a 1 kΩ from the tray (on a phone from the dock's button: it waits
//           over the board) carried to a3 — while it is carried its preview is a3 and a7 with their rows lit, and after
//           the legs' travel (`advance(0.35)`) `electronics-board` has R1 in a3 and a7; its leg 1 by the ring to a8 —
//           the netlist's key changes; R1 by its body off the board — gone (into the tray on a desktop); a jumper from
//           the tray to a5 and its end by the capsule to +5; the speaker's plug `spk+` into c17; a tap on the battery's
//           switch flips `SW` and a second one back; after every release the camera, the thing moved and the plugs are
//           sampled frame by frame for jumps (`electronics-motion`); draw calls ≤ 350 with all of it; the console;
//           snapshots `hand-<what>-<size>.jpg`.
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
import { advance, pointer, read } from './helpers.mjs';

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
  // a print counts as shown only where the camera sees it: rays from the camera to it meet nothing drawn in front of it
  const covered = Object.entries(models ?? {}).filter(([, m]) => m.printsCovered > 0);
  check(
    'no print shown under something that covers it',
    covered.length === 0,
    covered.map(([id, m]) => `${id} ${m.printsCovered}`).join(', ') || 'none',
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
    /** Every print of the thing shown, and seen: the rays from the camera to each meet nothing drawn in front of it. */
    const whole = (s) => s.printsShown === s.prints && s.printsClear === s.prints;
    for (const [id, m] of Object.entries(models ?? {})) {
      // the whole thing, its sphere filling the frame
      let v = await look(m.center, Math.max(m.radius, CLOSE.least) * CLOSE.fill);
      let where = 'whole';
      await screenshot(page, join(out, `close-${id}-${tag}.jpg`));
      if (!whole(v.seen[id]) && m.printAt) {
        // a print too small for that framing: at the print, from where one em would be ≈ `printPx` px-equivalent in a
        // full frame, and closer step by step while it is still too small (the safe frame is fitted beside the panel)
        let d = (m.printEm * 540) / CLOSE.printPx / Math.tan((CLOSE.fov * Math.PI) / 360);
        for (let k = 0; k < 4; k++, d *= 0.6) {
          v = await look(m.printAt, d);
          if (whole(v.seen[id])) break;
        }
        where = `print, ${round(d)} away`;
        await screenshot(page, join(out, `close-${id}-print-${tag}.jpg`));
      }
      const s = v.seen[id];
      n.close[id] = {
        where,
        prints: s.prints,
        shown: s.printsShown,
        clear: s.printsClear,
        smallest: round(v.least, 1),
      };
      check(
        `close ${id}: print whole, seen, ≥ 16 px-eq`,
        whole(s) && v.least >= 16,
        `${where}: ${s.printsShown}/${s.prints} shown, ${s.printsClear}/${s.prints} with nothing in front; texts in frame ${v.count}, smallest ${round(v.least, 1)}`,
      );
    }
  }

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}


/* -------------------------------------------------------------------------------------- section hand */

/** The largest step a moving thing may take in one frame (world units at 60 fps): the fastest travel of the hand is a
 * part let go on the board with no place flying back into the tray in 0.4 s — across the whole bench, ≈ 7 eased, its
 * peak ≈ 1.5 · 7 / 24 ≈ 0.45 per frame; a jump would be a whole travel in one frame. The camera as in the circuit's
 * practicum (`circuit/chapters/build/qa/interactions.mjs`, `BOUND.camera`): it drifts gently, it must not jump. */
const STRIDE = { camera: 0.35, focus: 0.5, plugs: 0.5 };
/** A finger carries the thing this many CSS px above it (`LIFT` of the hand, VISUAL §6). */
const LIFT = 48;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const locate = (page, name) => page.evaluate((n) => window.__app.locate(n), name);

async function hand(context) {
  const n = (report.sections.hand = {});
  const page = await context.newPage();
  const pos = await open(page, 'hand').catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'hand'), where(pos))) {
    await page.close();
    return;
  }
  const p = await pointer(page, touch);
  const board = () => read(page, 'electronics-board');
  const hands = () => read(page, 'electronics-hand');
  /** Probes on screen (CSS px); a missing one fails the check that needs it. */
  const scr = async (name) => {
    const v = await locate(page, name);
    if (!v) throw new Error(`probe '${name}' is unknown`);
    return { x: v.x, y: v.y, visible: v.visible };
  };
  /** Per-frame steps of the moving things for `seconds` after a release (frozen clock: the frames are stepped). */
  const smooth = async (what, seconds = 0.6) => {
    const s = await page.evaluate(
      async ([frames]) => {
        const big = {};
        let prev = window.__app.read('electronics-motion');
        for (let i = 0; i < frames; i++) {
          await window.__app.step(1 / 60, 1);
          const cur = window.__app.read('electronics-motion');
          for (const k of Object.keys(cur)) {
            const a = cur[k];
            const b = prev[k];
            let d = 0;
            for (let j = 0; j < a.length; j += 3) d = Math.max(d, Math.hypot(a[j] - b[j], a[j + 1] - b[j + 1], a[j + 2] - b[j + 2]));
            big[k] = Math.max(big[k] ?? 0, d);
          }
          prev = cur;
        }
        return big;
      },
      [Math.round(seconds * 60)],
    );
    const bad = Object.entries(s).filter(([k, v]) => !(v <= STRIDE[k]));
    (n.strides ??= {})[what] = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, round(v, 4)]));
    check(
      `${what}: no jumps`,
      bad.length === 0,
      Object.entries(s)
        .map(([k, v]) => `${k} ${v.toPrecision(2)}`)
        .join(', '),
    );
  };
  /**
   * Drag from a probe so that the thing it holds moves from where `thing` is to `target` (both probes on the board's
   * face): the hand keeps its grip on the thing, so the pointer moves by the same screen vector (a finger rides `LIFT`
   * above, which the press and the moves share). `hold` runs before the release (checks of the carried state).
   */
  const carry = async (grab, thing, target, { steps = 10, mid = null, hold = null, under = false } = {}) => {
    const g = await scr(grab);
    const d = sub(await scr(target), await scr(thing));
    // a part from the tray comes with leg 0 under the hand: a finger ends LIFT below the socket
    if (under && touch) d.y += LIFT;
    const to = add(g, d);
    const via = mid ? add(g, mid(d)) : null;
    await p.down(g.x, g.y);
    const path = via ? [g, via, to] : [g, to];
    for (let i = 1; i < path.length; i++)
      for (let k = 1; k <= steps; k++) {
        const a = path[i - 1];
        const b = path[i];
        await p.move(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
      }
    if (hold) await hold();
    await p.up();
  };
  const tag2 = (what) => join(out, `hand-${what}-${tag}.jpg`);

  check('the board is empty, the tray full', Object.keys((await board())?.parts ?? {}).length === 0);
  // a phone's page has the tray in the dock and the field of sockets only; a touch tablet has the stand like a desktop
  const phone = (n.phone = (await read(page, 'electronics-bench'))?.phone === true);

  // 1. a 1 kΩ from the tray (a phone: the dock's button, on the panel's tab «Керування») into a3
  if (phone) {
    // the panel's tab «Керування», as a reader picks it (the visible one of the tab rows)
    const tab = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-ui="sheet-tabs:controls"]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && !el.closest('[hidden]')) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    });
    if (tab) await p.tap(tab.x, tab.y);
    await advance(page, 0.5);
    const b = await page.evaluate(() => window.__ui.locate('ctl-tray-resistor-1k'));
    check('the dock has the tray’s buttons', !!b, JSON.stringify(b && { w: round(b.w), h: round(b.h) }));
    if (b) await p.tap(b.x, b.y);
    await advance(page, 0.3);
    check('a part waits in the air over the board', (await board())?.parts?.R1?.legs?.every((s) => s === null));
    await screenshot(page, tag2('offer'));
  }
  const grab1 = phone ? 'part:R1' : 'tray:resistor-1k';
  const thing1 = phone ? 'tip:R1:0' : 'tray:resistor-1k';
  // from the tray leg 0 comes under the hand: the pointer goes to a3; from the air the hand keeps its grip
  await carry(grab1, thing1, 'socket:a3', {
    under: !phone,
    mid: (d) => ({ x: d.x * 0.5, y: d.y * 0.5 - height * 0.05 }),
    hold: async () => {
      const h = await hands();
      n.preview = h;
      check(
        'carried over a3: preview a3, a7, both rows lit',
        h?.held === 'part:R1' && JSON.stringify(h.preview) === '["a3","a7"]',
        `held ${h?.held}, preview ${JSON.stringify(h?.preview)}, rows ${JSON.stringify(h?.rows)}`,
      );
      await advance(page, 0.2);
      const lit = (await hands())?.rows ?? {};
      check('the rows of the preview are lit', lit['3ae'] > 0.5 && lit['7ae'] > 0.5, JSON.stringify(lit));
      await screenshot(page, tag2('preview'));
    },
  });
  const legsNow = (await board())?.parts?.R1?.legs;
  check('let go: the board changes when the legs have arrived, not before', JSON.stringify(legsNow) === '[null,null]', JSON.stringify(legsNow));
  await smooth('down into a3');
  const b1 = await board();
  check('R1 in a3 and a7', JSON.stringify(b1?.parts?.R1?.legs) === '["a3","a7"]', JSON.stringify(b1?.parts));
  const key1 = b1?.key;

  // 2. its leg 1 by the ring from a7 to a8: it clicks in while the hand moves; the key changes
  await carry('leg:R1:1', 'tip:R1:1', 'socket:a8');
  await smooth('leg 1 into a8', 0.4);
  const b2 = await board();
  check(
    'leg 1 in a8, the netlist’s key changed',
    JSON.stringify(b2?.parts?.R1?.legs) === '["a3","a8"]' && b2?.key !== key1,
    `${JSON.stringify(b2?.parts?.R1?.legs)}; key ${b2?.key === key1 ? 'same' : 'changed'}`,
  );
  await screenshot(page, tag2('leg'));

  // 3. a jumper (a phone: the dock) into a10, then its end by the capsule to +10
  if (phone) {
    const b = await page.evaluate(() => window.__ui.locate('ctl-tray-jumper'));
    if (b) await p.tap(b.x, b.y);
    await advance(page, 0.3);
    await carry('part:J1', 'tip:J1:0', 'socket:a10');
  } else
    await carry('tray:jumper', 'tray:jumper', 'socket:a10', {
      under: true,
      mid: (d) => ({ x: d.x * 0.5, y: d.y * 0.5 - height * 0.05 }),
    });
  await advance(page, 0.4);
  const b3 = await board();
  check('the jumper in a10 … a14', JSON.stringify(b3?.parts?.J1?.legs) === '["a10","a14"]', JSON.stringify(b3?.parts?.J1));
  await carry('leg:J1:0', 'tip:J1:0', 'socket:+10', { mid: (d) => ({ x: d.x * 0.5 + 6, y: d.y * 0.5 }) });
  await smooth('the jumper’s end into +10', 0.4);
  const b4 = await board();
  check('the jumper’s end in +10', b4?.parts?.J1?.legs?.[0] === '+10', JSON.stringify(b4?.parts?.J1));

  // 4. the speaker's plug into c17
  await carry('lead:spk+', 'end:spk+', 'socket:c17');
  await smooth('the plug into c17', 0.4);
  const b5 = await board();
  check('the speaker’s plug in c17', b5?.leads?.['spk+'] === 'c17', JSON.stringify(b5?.leads));
  await screenshot(page, tag2('wired'));

  const calls = (n.drawCalls = await drawCalls(page));
  check(
    'draw calls with the parts, the plugs and the grips',
    calls.engine > 0 && calls.engine <= DRAW_CALLS.gate,
    `${calls.engine} (gate ≤ ${DRAW_CALLS.gate}); ${calls.triangles} triangles`,
  );

  // 5. the switch: a tap closes it, a second opens it
  const sw = await scr('switch');
  n.switch = sw;
  if (sw.visible) {
    await p.tap(sw.x, sw.y);
    await advance(page, 0.3);
    const on = (await board())?.settings?.SW;
    await p.tap(sw.x, sw.y);
    await advance(page, 0.3);
    const off = (await board())?.settings?.SW;
    check('a tap on the switch flips SW, a second one back', on === 1 && off === 0, `SW ${on} then ${off}`);
  } else check('the switch is not in the phone’s frame (reported)', true, JSON.stringify(sw));

  // 6. R1 by its body off the board: into the tray (a desktop), gone at once (a phone)
  const below = async () => {
    // beyond the near rail by a step and a half of lines: off the board's body
    const a = await scr('socket:j9');
    const b = await scr('socket:-9');
    return add(b, { x: (b.x - a.x) * 1.6, y: (b.y - a.y) * 1.6 });
  };
  const off = phone ? await below() : await scr('tray:resistor-1k');
  const r1 = await scr('part:R1');
  await p.down(r1.x, r1.y);
  for (let k = 1; k <= 12; k++) await p.move(r1.x + ((off.x - r1.x) * k) / 12, r1.y + ((off.y - r1.y) * k) / 12);
  await p.up();
  await smooth('R1 back to the tray', 0.6);
  const b6 = await board();
  check('R1 off the board: gone', !b6?.parts?.R1 && !b6?.models?.includes('R1'), JSON.stringify(Object.keys(b6?.parts ?? {})));
  await screenshot(page, tag2('end'));

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* ---------------------------------------------------------------------------------------------- run */

const SECTIONS = { room, shots, parts, hand };
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
