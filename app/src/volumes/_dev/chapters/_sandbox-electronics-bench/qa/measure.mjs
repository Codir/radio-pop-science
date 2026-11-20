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
//           over the board) carried to a3 — while it is carried its preview is a3 and a7 with their rows lit; let go,
//           the board does not hold it yet, and 0.35 s of frames later `electronics-board` has R1 in a3 and a7; its leg 1
//           by the ring to a8 — the netlist's key changes; a jumper from the tray to a10 … a14 and its end by the
//           capsule to +5; the speaker's plug `spk+` into c17; a tap on the battery's switch (on a phone, where the shot
//           leaves the switch out, the dock's toggle) flips `SW` and a second one back; R1 by its body off the board —
//           gone (into the tray on a desktop); from the frame of every release on, the camera, the thing moved, the turn
//           of its body and the plugs are sampled frame by frame for jumps (`electronics-motion`); draw calls ≤ 350;
//           the console; snapshots `hand-<what>-<size>.jpg`.
//   meter — the multimeter (E2-6) on held pages, every probe moved by a real pointer (a finger with --touch): step
//           `meter` — the probes at rest and ready, the display «—»; step `divider` (1 kΩ / 2 kΩ, the switch closed) —
//           the dial on V (`__ui.set('meter-mode', 'V', true)`), the red probe by its grip into a7, the black into −3:
//           the display's text «5,997 V» (decimal comma), the same text in the panel's readout `ctl-meter`, the value
//           the model's row 7ae (`electronics-model`) and the circuit's shape untouched by the probes; Ω on the same
//           probes — the divider with its battery out, «2,000 kΩ»; A — the jumper J2's end out of −11 by its capsule,
//           the red probe into a11: the meter closes the branch, 9 / 3001,5 A — «2,998 mA» — text, panel and model
//           agree; the model's last solve dcMs < 1 ms; draw calls ≤ 350; the console; snapshots
//           `meter-<what>-<size>.jpg`.
//   heat  — the model's state on the bench (E2-7) on held pages, the model's time stepped by `__app.step`:
//           step `overload` (100 Ω between the rails) — R1 «гаряча» at once by its load and cold to the eye,
//           then «згоріла» in E1-4's window (τ·ln((L − H) / (L − 1)) from the open page, within a frame), no
//           current after, told once with one wisp that is gone within 1.2 s, its marks shown; draw calls ≤ 350
//           all along, no shader program compiled by the burn, the same five lights; the burnt one by its body
//           into the tray (a real pointer; a phone: off the board, the new one from the dock) and a new 100 Ω
//           from it into b9 — a new id, whole, then «гаряча» again; step `led` — every LED's current the model's
//           (± 1e-9) and its light > 0, the red one's its 330 Ω's by Ohm's law, three lights on the board, the
//           330 Ω of red and green warm (after a minute h ≈ 0.6, barely tinted), of blue ok, the hue families
//           ≤ 4; step `lamp` — the filament at the model's ≈ 1 875 °C lights the room (`light.output` > 0); step
//           `bulged` — its puff of steam; the console everywhere; snapshots `heat-<state>[-close]-<size>.jpg` of
//           «ok», «тепла», «гаряча», the wisp, «згоріла», the new part, the LEDs, the lamp and «здутий».
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

/** Open an app page on a held clock (`freeze` seconds simulated first); resolves with `__app.position()` or rejects
 * (load error, no answer in time). */
async function open(page, step, freeze = 1) {
  const url = appUrl(base, { route: route(step), q, freeze });
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
 * practicum (`circuit/chapters/build/qa/interactions.mjs`, `BOUND.camera`): it drifts gently, it must not jump. `tilt`
 * is the body's own up (a unit vector: the step ≈ the turn in radians): a part takes the board's 15° in 0.25 s and
 * lays it down in 0.4 s, its peak ≈ 1.5 · 15° / 15 ≈ 1.5° (0.026) a frame; a jump would be all 15° (0.26) at once. */
const STRIDE = { camera: 0.35, focus: 0.5, tilt: 0.05, plugs: 0.5 };
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
  /** The moving things just before the last release (`let go`): the release's own frame — the pointer's `up` steps
   * it — is the first one `smooth` measures. */
  let released = null;
  const letGo = async () => {
    released = await read(page, 'electronics-motion');
    await p.up();
  };
  /** Per-frame steps of the moving things over the release's frame and `seconds` after it (frozen clock: the frames are
   * stepped). */
  const smooth = async (what, seconds = 0.6) => {
    const s = await page.evaluate(
      async ([frames, before]) => {
        const big = {};
        const stride = (cur, prev) => {
          for (const k of Object.keys(cur)) {
            const a = cur[k];
            const b = prev[k];
            let d = 0;
            for (let j = 0; j < a.length; j += 3) d = Math.max(d, Math.hypot(a[j] - b[j], a[j + 1] - b[j + 1], a[j + 2] - b[j + 2]));
            big[k] = Math.max(big[k] ?? 0, d);
          }
        };
        let prev = window.__app.read('electronics-motion');
        if (before) stride(prev, before);
        for (let i = 0; i < frames; i++) {
          await window.__app.step(1 / 60, 1);
          const cur = window.__app.read('electronics-motion');
          stride(cur, prev);
          prev = cur;
        }
        return big;
      },
      [Math.round(seconds * 60), released],
    );
    released = null;
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
    await letGo();
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
  // exactly 0.35 s of frames after the release (sampled for jumps on the way), then the board is read
  await smooth('down into a3', 0.35);
  const b1 = await board();
  check('0.35 s after the release: R1 in a3 and a7', JSON.stringify(b1?.parts?.R1?.legs) === '["a3","a7"]', JSON.stringify(b1?.parts));
  const key1 = b1?.key;
  await smooth('down into a3, settling', 0.25);

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

  // 3. a jumper (a phone: the dock) into a10 … a14, then its end by the capsule to +5 (9 P from a14: within its reach of
  // 16 P; a5 … a8 are under R1's body, so the jumper lies right of it)
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
  await carry('leg:J1:0', 'tip:J1:0', 'socket:+5', { mid: (d) => ({ x: d.x * 0.5, y: d.y * 0.5 - 6 }) });
  await smooth('the jumper’s end into +5', 0.4);
  const b4 = await board();
  check('the jumper’s end in +5', JSON.stringify(b4?.parts?.J1?.legs) === '["+5","a14"]', JSON.stringify(b4?.parts?.J1));
  await screenshot(page, tag2('jumper'));

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

  // 5. the switch: a tap closes it, a second opens it — on the slider; on a phone, whose shot leaves the switch out,
  // on the dock's toggle (VISUAL §9)
  const sw = phone
    ? await page.evaluate(() => window.__ui.locate('ctl-battery-switch'))
    : await scr('switch');
  n.switch = sw;
  const control = phone ? 'the dock’s toggle' : 'the slider';
  if (sw && (phone || sw.visible)) {
    const flips = (await hands())?.switchFlips;
    await p.tap(sw.x, sw.y);
    await advance(page, 0.3);
    const on = (await board())?.settings?.SW;
    await p.tap(sw.x, sw.y);
    await advance(page, 0.3);
    const off = (await board())?.settings?.SW;
    const by = (await hands())?.switchFlips - flips;
    check(`a tap on ${control} flips SW, a second one back`, on === 1 && off === 0, `SW ${on} then ${off}; slider taps ${by}`);
  } else check(`${control} is on screen`, false, JSON.stringify(sw));

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
  await letGo();
  await smooth('R1 back to the tray', 0.6);
  const b6 = await board();
  check('R1 off the board: gone', !b6?.parts?.R1 && !b6?.models?.includes('R1'), JSON.stringify(Object.keys(b6?.parts ?? {})));
  await screenshot(page, tag2('end'));

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* ------------------------------------------------------------------------------------- section meter */

/** What the meter must show on the divider (VISUAL §5.1: four significant digits, a decimal comma). */
const METER_TEXT = { V: '5,997 V', ohm: '2,000 kΩ', A: '2,998 mA' };
/** The divider's numbers: 9 V behind the battery's 1.5 Ω; the switch, the jumpers and the meter in A are 1 mΩ each. */
const WIRE = 0.001;
const DIVIDER_V = (9 * (2000 + WIRE)) / (1.5 + 3 * WIRE + 3000);
const BRANCH_A = 9 / (1.5 + 3 * WIRE + 3000);
const plain = (s) => (typeof s === 'string' ? s.replace(/\u00a0/g, ' ') : s);

async function meter(context) {
  const n = (report.sections.meter = {});

  // step `meter`: an empty board, the probes free by the meter
  {
    const page = await context.newPage();
    const pos = await open(page, 'meter').catch((err) => ({ error: String(err) }));
    if (!check('meter: opened', at(pos, 'meter'), where(pos))) {
      await page.close();
      return;
    }
    await advance(page, 0.7);
    const m = (n.free = await read(page, 'electronics-meter'));
    check(
      'meter: the probes free by the meter, the display «—»',
      m?.ready === true && m.red === null && m.black === null && m.text === '—',
      JSON.stringify(m),
    );
    await screenshot(page, join(out, `meter-free-${tag}.jpg`));
    const errors = await appErrors(page);
    check('meter: console', errors.length === 0, consoleText(errors));
    await page.close();
  }

  const page = await context.newPage();
  const pos = await open(page, 'divider').catch((err) => ({ error: String(err) }));
  if (!check('divider: opened', at(pos, 'divider'), where(pos))) {
    await page.close();
    return;
  }
  const p = await pointer(page, touch);
  const scr = async (name) => {
    const v = await locate(page, name);
    if (!v) throw new Error(`probe '${name}' is unknown`);
    return { x: v.x, y: v.y, visible: v.visible };
  };
  const meterNow = () => read(page, 'electronics-meter');
  const modelNow = () => read(page, 'electronics-model');
  /** The panel's readout of the meter as the reader sees it (a phone: the dock's tab «Керування»). */
  const panel = () =>
    page.evaluate(() => document.querySelector('[data-ui="ctl-meter"] output')?.textContent ?? null);
  if (touch) await page.evaluate(() => window.__ui.setSheet({ tab: 'controls' }));
  const mode = async (m) => {
    await page.evaluate((id) => window.__ui.set('meter-mode', id, true), m);
    await advance(page, 0.5);
  };
  /**
   * Press `grab` and drag so that the end `thing` (on the board's face) comes to `target` (a socket probe or a screen
   * point), correcting the pointer on the way by what is left (the hand keeps its grip, so screen moves map to board
   * moves only nearly), then let go and let it arrive.
   */
  const bring = async (grab, thing, target) => {
    const g = await scr(grab);
    const goal = typeof target === 'string' ? () => scr(target) : async () => target;
    const end0 = await scr(thing);
    const t0 = await goal();
    let at = { x: g.x, y: g.y };
    await p.down(at.x, at.y);
    const d = { x: t0.x - end0.x, y: t0.y - end0.y };
    // up and over: a little above the straight way, in 12 moves
    for (let k = 1; k <= 12; k++) {
      const f = k / 12;
      at = { x: g.x + d.x * f, y: g.y + d.y * f - Math.sin(Math.PI * f) * height * 0.04 };
      await p.move(at.x, at.y);
    }
    for (let k = 0; k < 4; k++) {
      const e = await scr(thing);
      const t = await goal();
      const left = { x: t.x - e.x, y: t.y - e.y };
      if (Math.hypot(left.x, left.y) < 0.6) break;
      at = { x: at.x + left.x, y: at.y + left.y };
      await p.move(at.x, at.y);
    }
    await p.up();
    await advance(page, 0.35);
  };

  await mode('V');
  const key0 = (await modelNow())?.key;
  await bring('probe:red', 'end:red', 'socket:a7');
  await bring('probe:black', 'end:black', 'socket:-3');
  await advance(page, 0.5);
  const v = (n.V = { meter: await meterNow(), panel: plain(await panel()), model: await modelNow() });
  check(
    'V: the red probe in a7, the black in −3',
    v.meter?.red === 'a7' && v.meter?.black === '-3',
    `red ${v.meter?.red}, black ${v.meter?.black}`,
  );
  check(
    `V: the display «${METER_TEXT.V}», the panel the same`,
    plain(v.meter?.text) === METER_TEXT.V && v.panel === METER_TEXT.V,
    `display «${plain(v.meter?.text)}», panel «${v.panel}»`,
  );
  check(
    'V: the value is the model’s row 7ae, 9 · 2000 / 3001,5 V',
    Math.abs(v.meter?.value - v.model?.rows?.['7ae']) <= 1e-12 && Math.abs(v.meter?.value - DIVIDER_V) <= 1e-9,
    `meter ${v.meter?.value}, model ${v.model?.rows?.['7ae']}, by hand ${DIVIDER_V}`,
  );
  check('V: the probes take no part in the circuit', v.model?.key === key0, v.model?.key === key0 ? 'same key' : 'key changed');
  await screenshot(page, join(out, `meter-v-${tag}.jpg`));

  await mode('ohm');
  const o = (n.ohm = { meter: await meterNow(), panel: plain(await panel()) });
  check(
    `Ω: the divider with its battery out, «${METER_TEXT.ohm}», the panel the same`,
    plain(o.meter?.text) === METER_TEXT.ohm && o.panel === METER_TEXT.ohm && Math.abs(o.meter?.value / 2000.001 - 1) <= 1e-6,
    `display «${plain(o.meter?.text)}», panel «${o.panel}», value ${o.meter?.value}`,
  );

  // A: the meter in the branch instead of the jumper J2 — its end out of −11, lying beyond the rail; the red probe into
  // a11 (the row 11ae), the black stays on the − rail
  await mode('A');
  const rail = await scr('socket:-12');
  const line = await scr('socket:j12');
  const beyond = { x: rail.x + (rail.x - line.x) * 0.8, y: rail.y + (rail.y - line.y) * 0.8 };
  await bring('leg:J2:1', 'tip:J2:1', beyond);
  const board = await read(page, 'electronics-board');
  check('A: the jumper’s end out of −11', board?.parts?.J2?.legs?.[1] === null, JSON.stringify(board?.parts?.J2));
  await bring('probe:red', 'end:red', 'socket:a11');
  await advance(page, 0.5);
  const a = (n.A = { meter: await meterNow(), panel: plain(await panel()), model: await modelNow() });
  check(
    `A: the meter closes the branch, «${METER_TEXT.A}», the panel the same`,
    a.meter?.red === 'a11' && plain(a.meter?.text) === METER_TEXT.A && a.panel === METER_TEXT.A,
    `red ${a.meter?.red}; display «${plain(a.meter?.text)}», panel «${a.panel}»`,
  );
  check(
    'A: the value is the model’s current through the meter, 9 / 3001,5 A',
    Math.abs(a.meter?.value - a.model?.parts?.METER?.i) <= 1e-15 && Math.abs(a.meter?.value / BRANCH_A - 1) <= 1e-9,
    `meter ${a.meter?.value}, model ${a.model?.parts?.METER?.i}, by hand ${BRANCH_A}`,
  );
  await screenshot(page, join(out, `meter-a-${tag}.jpg`));

  // the model's solve time: one solve of this board is far below the browser's timer step (0.1 ms), so 40 of them are
  // timed — the dial between V and A, each turn a new circuit (the meter's wire in or out) compiled and solved in one
  // frame — and each must be under 1 ms; their mean, under the timer's dither, is the cost of one
  const timing = await page.evaluate(async (k) => {
    const v0 = window.__app.read('electronics-model').version;
    const ms = [];
    for (let i = 0; i < k; i++) {
      window.__ui.set('meter-mode', i % 2 === 0 ? 'V' : 'A', true);
      await window.__app.step(1 / 60, 1);
      ms.push(window.__app.read('electronics-model').dcMs);
    }
    return { ms, solves: window.__app.read('electronics-model').version - v0 };
  }, 40);
  const mean = timing.ms.reduce((s, x) => s + x, 0) / timing.ms.length;
  const most = Math.max(...timing.ms);
  n.dcMs = { mean: round(mean, 4), max: round(most, 3), solves: timing.solves };
  check(
    'the model’s solve dcMs < 1 ms',
    timing.solves === 40 && timing.ms.every((x) => Number.isFinite(x) && x >= 0) && most < 1,
    `${timing.solves} solves: mean ${round(mean, 4)} ms, max ${round(most, 3)} ms`,
  );

  const calls = (n.drawCalls = await drawCalls(page));
  check(
    'draw calls with the meter, its probes and the divider',
    calls.engine > 0 && calls.engine <= DRAW_CALLS.gate,
    `${calls.engine} (gate ≤ ${DRAW_CALLS.gate}); ${calls.triangles} triangles`,
  );
  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* -------------------------------------------------------------------------------------- section heat */

/** E1-4's resistor: τ 10 s, 0.25 W (sim/core/README.md, «Limits»). */
const RESISTOR_TAU = 10;
/** The red LED with 330 Ω from the 9 V battery against ngspice (sim/core/README.md: 21.24 mA). */
const RED_LED_A = 0.02124;
/** Close-ups for the reader of the look: the part's sphere filling a narrow frame from the front and above. */
const NEAR = { dir: [0, 0.62, 0.78], fill: 4.2, least: 0.42, fov: 27 };

async function heat(context) {
  const n = (report.sections.heat = {});
  const heatNow = (page) => read(page, 'electronics-heat');
  /** Put the camera close in front of a world point and draw two held frames (as the parts section does). */
  const close = async (page, at, d) => {
    const k = d / Math.hypot(...NEAR.dir);
    await page.evaluate(({ shot }) => window.__app.engine.runtime.director.go(shot, { instant: true }), {
      shot: {
        position: [at[0] + NEAR.dir[0] * k, at[1] + NEAR.dir[1] * k, at[2] + NEAR.dir[2] * k],
        target: at,
        fov: NEAR.fov,
      },
    });
    await held(page);
    await held(page);
  };
  /** The step's own shot back (the director's, by name). */
  const back = async (page, shot) => {
    await page.evaluate((s) => window.__app.engine.runtime.director.go(s, { instant: true }), shot);
    await held(page);
  };
  const snap = (what) => join(out, `heat-${what}-${tag}.jpg`);

  /* ---- step `overload`: hot at once, warmer, burnt in E1-4's window, a gap; a new one from the tray */
  {
    const page = await context.newPage();
    const pos = await open(page, 'overload').catch((err) => ({ error: String(err) }));
    if (!check('overload: opened', at(pos, 'overload'), where(pos))) {
      await page.close();
      return;
    }
    const phone = (await read(page, 'electronics-bench'))?.phone === true;
    const shotName = phone ? 'phone' : 'stand';
    const h0 = await heatNow(page);
    const r0 = h0?.parts?.R1;
    n.open = r0;
    check(
      'overload: R1 hot at once (its load), cold yet to the eye',
      r0?.condition === 'hot' && r0.load > 3 && r0.load < 3.3 && r0.surface?.tint === 0,
      `condition ${r0?.condition}, load ${round(r0?.load, 3)}, heat ${round(r0?.heat, 3)}, tint ${r0?.surface?.tint}`,
    );
    // when it must burn from here (E1-4: dH/dt = (L − H) / τ, burnt at H = 1)
    const left = RESISTOR_TAU * Math.log((r0.load - r0.heat) / (r0.load - 1));
    n.burnIn = round(left, 4);
    const parts = await read(page, 'electronics-parts');
    const centre = parts?.R1?.center;
    const radius = Math.max(parts?.R1?.radius ?? 0.4, NEAR.least);
    const shot = async (what) => {
      await screenshot(page, snap(what));
      if (!phone && centre) {
        await close(page, centre, radius * NEAR.fill);
        await screenshot(page, snap(`${what}-close`));
        await back(page, shotName);
      }
    };
    await shot('ok');
    const calls0 = await drawCalls(page);
    const programs0 = calls0.programs;
    // frames of 1/60 s, a look at the heat on the way (the snapshots of «тепла» and «гаряча»)
    let frames = 0;
    let state = r0;
    const pics = [
      { heat: 0.75, name: 'warm' },
      { heat: 0.97, name: 'hot' },
    ];
    while (state?.condition !== 'burnt' && frames < 60 * 12) {
      await page.evaluate(() => window.__app.step(1 / 60, 1));
      frames++;
      state = (await heatNow(page))?.parts?.R1;
      if (pics.length && state?.heat >= pics[0].heat && state.condition !== 'burnt') {
        n[pics[0].name] = state;
        await shot(pics.shift().name);
      }
    }
    const t = frames / 60;
    n.burntAfter = round(t, 4);
    check(
      'overload: «згоріла» in E1-4’s window, τ·ln((L − H) / (L − 1)) from the open page, within a frame',
      state?.condition === 'burnt' && t >= left - 1e-9 && t < left + 1 / 60 + 1e-9,
      `burnt after ${round(t, 3)} s; E1-4 says ${round(left, 3)} s`,
    );
    const h1 = await heatNow(page);
    const m1 = await read(page, 'electronics-model');
    n.burnt = h1?.parts?.R1;
    check(
      'overload: no current through it after, none in the loop; told once, one wisp, its marks shown',
      h1?.parts?.R1?.i === 0 &&
        Math.abs(m1?.parts?.J1?.i ?? 1) < 1e-9 &&
        h1?.burns?.length === 1 &&
        h1.burns[0].id === 'R1' &&
        h1.smoke?.fired === 1 &&
        h1.smoke?.active === 1 &&
        h1.parts.R1.marks === true,
      `i ${h1?.parts?.R1?.i}, J1 ${m1?.parts?.J1?.i}; burns ${JSON.stringify(h1?.burns)}; smoke ${JSON.stringify(h1?.smoke)}`,
    );
    // the wisp in the air (0.45 s: a third of its way), then gone
    await page.evaluate(() => window.__app.step(1 / 60, 27));
    const calls1 = await drawCalls(page);
    await shot('burning');
    await page.evaluate(() => window.__app.step(1 / 60, 81));
    const calls2 = await drawCalls(page);
    const h2 = await heatNow(page);
    n.programs = { before: programs0, wisp: calls1.programs, after: calls2.programs };
    n.drawCalls = { before: calls0.engine, wisp: calls1.engine, after: calls2.engine };
    check(
      'overload: the wisp gone within 1.2 s, the tint too; it stays burnt',
      h2?.smoke?.active === 0 && h2?.smoke?.fired === 1 && h2?.parts?.R1?.condition === 'burnt' && h2.parts.R1.surface.tint === 0,
      `smoke ${JSON.stringify(h2?.smoke)}, ${h2?.parts?.R1?.condition}, tint ${h2?.parts?.R1?.surface?.tint}, char ${h2?.parts?.R1?.surface?.char}`,
    );
    check(
      'overload: draw calls ≤ 350 all along',
      [calls0, calls1, calls2].every((c) => c.engine > 0 && c.engine <= DRAW_CALLS.gate),
      `${calls0.engine} hot, ${calls1.engine} with the wisp, ${calls2.engine} burnt`,
    );
    check(
      'overload: no shader program compiled by the burn',
      calls1.programs === programs0 && calls2.programs === programs0,
      `${programs0} before, ${calls1.programs} with the wisp and the marks, ${calls2.programs} after`,
    );
    check(
      'overload: the lights stay the same lights',
      h2?.lights === h0?.lights && h0?.lights === 5,
      `${h0?.lights} lights before, ${h2?.lights} after`,
    );
    await shot('burnt');

    // the burnt one by its body into the tray (a phone: off the board), and a new 100 Ω from it into b9
    const p = await pointer(page, touch);
    const scr = async (name) => {
      const v = await locate(page, name);
      if (!v) throw new Error(`probe '${name}' is unknown`);
      return v;
    };
    const drag = async (from, to, steps = 12) => {
      await p.down(from.x, from.y);
      for (let k = 1; k <= steps; k++) {
        const f = k / steps;
        await p.move(from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f - Math.sin(Math.PI * f) * height * 0.04);
      }
      await p.up();
    };
    let off;
    if (phone) {
      const a = await scr('socket:j9');
      const b = await scr('socket:-9');
      off = { x: b.x + (b.x - a.x) * 1.6, y: b.y + (b.y - a.y) * 1.6 };
    } else off = await scr('tray:resistor-100');
    await drag(await scr('part:R1'), off);
    await advance(page, 0.6);
    const b1 = await read(page, 'electronics-board');
    check('overload: the burnt R1 taken off the board', !b1?.parts?.R1, JSON.stringify(Object.keys(b1?.parts ?? {})));
    if (phone) {
      await page.evaluate(() => window.__ui.setSheet({ tab: 'controls' }));
      await advance(page, 0.3);
      const button = await page.evaluate(() => window.__ui.locate('ctl-tray-resistor-100'));
      if (button) await p.tap(button.x, button.y);
      await advance(page, 0.3);
    }
    const id = Object.keys((await read(page, 'electronics-board'))?.parts ?? {}).find((k) => k.startsWith('R'));
    const grab = phone ? await scr(`part:${id}`) : await scr('tray:resistor-100');
    const thing = phone ? await scr(`tip:${id}:0`) : grab;
    const target = await scr('socket:b9');
    // a part from the tray comes with leg 0 under the hand (a finger: LIFT below it); from the air the hand keeps its grip
    const dy = touch && !phone ? LIFT : 0;
    await drag(grab, { x: grab.x + target.x - thing.x, y: grab.y + target.y - thing.y + dy }, 14);
    await advance(page, 0.4);
    const b2 = await read(page, 'electronics-board');
    const fresh = Object.entries(b2?.parts ?? {}).find(([, v]) => v.spec === 'resistor-100');
    const h3 = await heatNow(page);
    const r3 = fresh ? h3?.parts?.[fresh[0]] : null;
    n.fresh = { id: fresh?.[0], legs: fresh?.[1]?.legs, look: r3 };
    // whole: its heat is what a cold part gathers in the ≈ 0.4 s it has been in the circuit, far under the burnt one's 1
    check(
      'overload: a new 100 Ω from the tray in b9 … b13: a new id, whole — «ok» to the eye — and hot by its load',
      fresh &&
        fresh[0] !== 'R1' &&
        JSON.stringify(fresh[1].legs) === '["b9","b13"]' &&
        r3?.condition === 'hot' &&
        r3.heat < 0.25 &&
        r3.surface?.tint === 0 &&
        r3.surface?.char === 0 &&
        r3.marks === false,
      `${fresh?.[0]} ${JSON.stringify(fresh?.[1]?.legs)}: ${r3?.condition}, heat ${round(r3?.heat, 3)}, tint ${r3?.surface?.tint}, char ${r3?.surface?.char}`,
    );
    await screenshot(page, snap('fresh'));
    // and «гаряча» to the eye again as its heat passes half the limit
    await page.evaluate(() => window.__app.step(1 / 60, 150));
    const r4 = fresh ? (await heatNow(page))?.parts?.[fresh[0]] : null;
    check(
      'overload: 2.5 s later the new one is «гаряча» to the eye too: tinted and scorching, not burnt',
      r4?.condition === 'hot' && r4.heat > 0.5 && r4.surface?.tint > 0 && r4.surface?.scorch > 0 && r4.marks === false,
      `heat ${round(r4?.heat, 3)}, tint ${round(r4?.surface?.tint, 3)}, scorch ${round(r4?.surface?.scorch, 3)}`,
    );
    const errors = await appErrors(page);
    check('overload: console', errors.length === 0, consoleText(errors));
    await page.close();
  }

  /* ---- step `led`: every LED by the model's current, the three lights, at most four hue families */
  {
    const page = await context.newPage();
    const pos = await open(page, 'led').catch((err) => ({ error: String(err) }));
    if (!check('led: opened', at(pos, 'led'), where(pos))) {
      await page.close();
      return;
    }
    const h = await heatNow(page);
    const m = await read(page, 'electronics-model');
    const ids = ['LED1', 'LED2', 'LED3'];
    n.led = { leds: Object.fromEntries(ids.map((id) => [id, h?.parts?.[id]])), lights: h?.leds };
    check(
      'led: each LED’s current is the model’s (± 1e-9), and it gives light',
      ids.every((id) => Math.abs(h?.parts?.[id]?.i - m?.parts?.[id]?.i) <= 1e-9 && h.parts[id].light > 0),
      ids.map((id) => `${id} ${round(h?.parts?.[id]?.i * 1000, 3)} mA, b ${round(h?.parts?.[id]?.light, 3)}`).join('; '),
    );
    // the red LED's current is its resistor's, by Ohm's law across the 330 Ω (3ae → 3fj): a little under the 21.24 mA it
    // takes alone (sim/core/README.md), the three branches sharing the battery's 1.5 Ω
    const ohm = (m?.rows?.['3ae'] - m?.rows?.['3fj']) / 330;
    check(
      'led: the red one takes its 330 Ω’s current (Ohm’s law ± 1e-6), a little under 21.24 mA alone',
      Math.abs(m?.parts?.LED1?.i / ohm - 1) <= 1e-6 && m.parts.LED1.i < RED_LED_A && m.parts.LED1.i > 0.98 * RED_LED_A,
      `${round(m?.parts?.LED1?.i * 1000, 4)} mA; by Ohm’s law ${round(ohm * 1000, 4)} mA`,
    );
    check(
      'led: the three LEDs light the board, each light > 0',
      h?.leds?.lit?.length === 3 && h.leds.intensity.every((x) => x > 0),
      JSON.stringify(h?.leds),
    );
    check(
      'led: the 330 Ω of red and green warm (≈ 0.15 W of 0.25 W), of blue ok (17.7 mA, ≈ 0.10 W)',
      h?.parts?.R1?.condition === 'warm' && h?.parts?.R2?.condition === 'warm' && h?.parts?.R3?.condition === 'ok',
      ['R1', 'R2', 'R3'].map((id) => `${h?.parts?.[id]?.condition} (load ${round(h?.parts?.[id]?.load, 3)})`).join(', '),
    );
    const calls = (n.ledCalls = await drawCalls(page));
    check('led: draw calls ≤ 350', calls.engine > 0 && calls.engine <= DRAW_CALLS.gate, `${calls.engine}`);
    const png = decodePng(await page.screenshot({ type: 'png' }));
    const hue = (n.ledHue = hueFamilies(png));
    check('led: hue families ≤ 4 with three colours lit', hue.families.length <= 4, `${hue.families.join(', ')} ${JSON.stringify(hue.shares)}`);
    await screenshot(page, snap('led'));
    const parts = await read(page, 'electronics-parts');
    if (!touch && parts?.LED1) {
      await close(page, parts.LED1.center, Math.max(parts.LED1.radius, NEAR.least) * NEAR.fill * 1.6);
      await screenshot(page, snap('led-close'));
      await back(page, 'board');
    }
    // a minute of the model's time: the resistors as warm as they get (h → 0.6), the snapshot of «тепла» at its load
    await page.evaluate(() => window.__app.step(1 / 15, 900));
    const hw = await heatNow(page);
    n.ledWarm = hw?.parts?.R1;
    check(
      'led: after a minute the 330 Ω stays warm and barely tinted (h ≈ 0.6, t ≈ 0.2)',
      hw?.parts?.R1?.condition === 'warm' && Math.abs(hw.parts.R1.heat - 0.6) < 0.02 && hw.parts.R1.surface.tint < 0.08,
      `heat ${round(hw?.parts?.R1?.heat, 3)}, tint ${round(hw?.parts?.R1?.surface?.tint, 3)}`,
    );
    if (!touch && parts?.R1) {
      await close(page, parts.R1.center, Math.max(parts.R1.radius, NEAR.least) * NEAR.fill);
      await screenshot(page, snap('warm-load-close'));
    }
    const errors = await appErrors(page);
    check('led: console', errors.length === 0, consoleText(errors));
    await page.close();
  }

  /* ---- step `lamp`: the filament at the model's temperature lights the room */
  {
    const page = await context.newPage();
    const pos = await open(page, 'lamp').catch((err) => ({ error: String(err) }));
    if (!check('lamp: opened', at(pos, 'lamp'), where(pos))) {
      await page.close();
      return;
    }
    const h = await heatNow(page);
    n.lamp = { lamp: h?.lamp, thing: h?.things?.lamp, R1: h?.parts?.R1, R2: h?.parts?.R2 };
    const celsius = h?.things?.lamp?.kelvin - 273.15;
    check(
      'lamp: the filament at the model’s ≈ 1 875 °C (≈ 5.9 V), warm; the lamp lights the room',
      celsius > 1850 && celsius < 1900 && h.things.lamp.condition === 'warm' && h.lamp.output > 0 && h.lamp.intensity > 0,
      `${round(celsius, 0)} °C, level ${round(h?.lamp?.level, 3)}, glow ${round(h?.lamp?.glow, 3)}, output ${round(h?.lamp?.output, 3)}`,
    );
    check(
      'lamp: the two 15 Ω warm (0.15 W each), no more',
      h?.parts?.R1?.condition === 'warm' && h?.parts?.R2?.condition === 'warm',
      `${h?.parts?.R1?.condition}, ${h?.parts?.R2?.condition}`,
    );
    const calls = await drawCalls(page);
    check('lamp: draw calls ≤ 350', calls.engine > 0 && calls.engine <= DRAW_CALLS.gate, `${calls.engine}`);
    await screenshot(page, snap('lamp'));
    const errors = await appErrors(page);
    check('lamp: console', errors.length === 0, consoleText(errors));
    await page.close();
  }

  /* ---- step `bulged`: the look under the state's name, for the reader */
  {
    const page = await context.newPage();
    const pos = await open(page, 'bulged', 0.4).catch((err) => ({ error: String(err) }));
    if (!check('bulged: opened', at(pos, 'bulged'), where(pos))) {
      await page.close();
      return;
    }
    const h = await heatNow(page);
    check('bulged: its puff of steam in the air', h?.smoke?.fired === 1 && h.smoke.active === 1, JSON.stringify(h?.smoke));
    await screenshot(page, snap('bulged'));
    const parts = await read(page, 'electronics-parts');
    const can = parts?.['C-bulged'];
    if (!touch && can) {
      await close(page, can.center, Math.max(can.radius, NEAR.least) * NEAR.fill * 1.4);
      await screenshot(page, snap('bulged-close'));
    }
    const errors = await appErrors(page);
    check('bulged: console', errors.length === 0, consoleText(errors));
    await page.close();
  }
}

/* ---------------------------------------------------------------------------------------------- run */

const SECTIONS = { room, shots, parts, hand, meter, heat };
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
