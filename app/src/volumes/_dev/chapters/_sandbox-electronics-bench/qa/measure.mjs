#!/usr/bin/env node
/* global process, console, window, document */
// Browser check and measurements of the sandbox `_dev/_sandbox-electronics-bench` (a dev or preview server up; the
// skeleton — arguments, `report` / `check` / verdict, `open`, `held` — is copied from the radio sandbox's
// `qa/measure.mjs`, docs/volumes/electronics/REUSE.md «Копії»; the sections are the bench's own):
//
//   node app/src/volumes/_dev/chapters/_sandbox-electronics-bench/qa/measure.mjs --port 5480 --out <dir>
//        [--only room,…,film,plates,roll] [--size 1280x720] [--touch]
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
//   parts — step `parts` on a held page (E2-4, E2-M): `electronics-board` lists every part placed with the sockets of
//           its legs — one of every kind of the model's catalog, the capacitors and the transistor too — and nothing
//           shown outside the circuit; each one has a model; the model solves the board with all of them (`ok`, every
//           number finite, every part in its netlist); draw calls ≤ 350 with all of them on the board; every world text
//           shown ≥ 16 px-equivalent (none on a phone), and no print shown under something that covers it (rays from
//           the camera, `electronics-parts`); the hue families (reported); snapshot `parts-<size>.jpg`. On a desktop
//           then every part and permanent thing close (the camera put in front of it and above, from
//           `electronics-parts`; a print too small or covered there, once more at the print): its print shown whole,
//           seen with nothing drawn in front of it, and ≥ 16 px-equivalent, snapshots `close-<id>[-print]-<size>.jpg`
//           for the reader of the parts' look; the console.
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
//           probes — «—» while the switch is closed (no resistance on a live circuit, plan E3 decision 5), and with the
//           switch opened by the dock's toggle `battery-switch` the divider with its battery out, «2,000 kΩ» (closed
//           again after); A — the jumper J2's end out of −11 by its capsule, the red probe into a11: the meter closes
//           the branch, 9 / 3001,5 A — «2,998 mA» — text, panel and model agree; the model's last solve dcMs < 1 ms;
//           draw calls ≤ 350; the console; snapshots `meter-<what>-<size>.jpg`.
//   heat  — the model's state on the bench (E2-7) on held pages, the model's time stepped by `__app.step`:
//           step `overload` (100 Ω between the rails) — R1 «гаряча» at once by its load and cold to the eye,
//           then «згоріла» in E1-4's window (τ·ln((L − H) / (L − 1)) from the open page, within a frame), no
//           current after, told once with one wisp that is gone within 1.2 s, its marks shown; draw calls ≤ 350
//           all along, no shader program compiled by the burn, the same five lights; the burnt one by its body
//           into the tray (a real pointer; a phone: off the board, the new one from the dock) and a new 100 Ω
//           from it into b9 — in the hand, before it closes the circuit, a new id «ok», cold, no current, whole to
//           the eye; seated, the same id «гаряча» by its load at once, then to the eye too; step `led` — every
//           LED's current the model's (± 1e-9) and its light > 0, the red one's its 330 Ω's by Ohm's law, three
//           lights on the board, the 330 Ω of red and green warm (after a minute h ≈ 0.6, barely tinted), of blue
//           ok, the hue families ≤ 4; step `lamp` — the filament at the model's ≈ 1 875 °C lights the room
//           (`light.output` > 0); step `bulged-look` — the look alone, nothing let out (no model event behind it);
//           the console everywhere; snapshots `heat-<state>[-close]-<size>.jpg` of «ok», «тепла», «гаряча», the
//           wisp, «згоріла», the new part, the LEDs, the lamp and «здутий».
//   loupe — the magnifier as the door (E2-8) on a held page, step `loupe` (a 4.7 kΩ in a5 … a9, shot `board`): on the
//           board's shot the door is ready, no ladder, the lens in its holder, and a real press takes R1 (laid back);
//           the slider set to the dive's stops (`__ui.set`, the flight waited out) — rail 0: the lens at work, its ring
//           22–26 % of the safe frame's height; 0.5: the ladder «деталь», the bands ≥ 12 px at 1280 × 720; 0.7: the
//           body ≥ 35 % of the width, whole; 1: «усередині», the cut open; draw calls there; a press on R1 down there
//           takes nothing; back at 0 the camera is the board's again. Then the slider dragged by a real pointer 1 px a
//           frame down to the end and back: the frame's step per frame ≤ 0.06 of the viewing distance and no spike,
//           the floor and the DOM ladder what the rail's position says (`part` from 0.5, `inside` from 1) every frame,
//           the hand off whenever the camera is off the board's shot; back at 0 the board's shot, the lens in its
//           holder, no ladder. A tap on the track's end: the whole flight 1.6–2.2 s, with reduced motion ≈ 0.6 s
//           (`page.emulateMedia`); a tap on the resting lens lays it over R1; the console; snapshots
//           `loupe-<board|door|part|close|inside|back>-<size>.jpg`.
//   film  — inside the resistor (E3-5, `shared/inside/film.ts`) on a held page, step `film` (the red LED's loop with
//           330 Ω, the switch closed, shot `board`): on the board's shot the film is closed and the LED takes the
//           model's 21.2 mA; the slider set to its end (the flight waited out) — the floor `inside`, the cut open with
//           the magnifier's dive, the groove's turns those of `filmTurns(330)`, electrons shown, the whole view (the
//           part's lacquer, bands and legs with the inside) ≤ 8 draw calls and the frame ≤ 350, the callouts' points (`film:film`, `film:groove`, `film:rod`) on screen; the
//           electrons' speed is the model's current through R1 times one number (the readers, not pixels); the dock's
//           switch to 10 kΩ — a new R1 of that value, more turns, a narrower and longer strip, the model's 0.73 mA and
//           the speed that current times the same number, 29 times slower; back at 0 the film closed; the hue families
//           (reported), the console; snapshots `film-<330|10k|board>-<size>.jpg`.
//   plates — inside an electrolytic (E4-I, `shared/inside/plates.ts`) on a held page, step `plates` (the board of
//           `capacitor/store`: the LED's loop and C1 470 μF across the rails, the switch closed, shot `board`): on the
//           board's shot the cut is closed and the view already knows the model's voltage across the capacitance
//           (8.968 V); the slider set to its end — the floor `inside`, the can cut in half, `chargeCount` of that
//           voltage on each plate (60), the print taken with the cut half, the whole view ≤ 9 draw calls and the inside's
//           ≤ 6, the frame ≤ 350, the callouts' points (`plates:plus`, `plates:minus`, `plates:insulator`) on screen in
//           the free area, the legs' electrons at the speed of the model's current; the dock's toggle opens the switch
//           while the camera is inside — the charges follow what the model keeps then, and the closed switch brings
//           them back; the dock's switch puts each can (10, 100, 470, 1000 μF) in C1's sockets — open, 60 charges, the
//           calls within bounds; the dock's toggle `plates-flip` stands the 470 μF the other way round — the model
//           bulges it within seconds: no charges, the insulator cracked (its crack in the inside's meshes), the calls
//           within bounds; turned back, a whole can with 60 charges; back at 0 the can whole; the hue families ≤ 4; the
//           console; snapshots `plates-<board|470|open|10u|100u|1000u|bulged>-<size>.jpg`.
//   roll  — inside a film capacitor (E4-I, `shared/inside/roll.ts`) on a held page, step `roll` (C1 1 μF alone in
//           e8/e10, shot `board`): on the board's shot the cut is closed; the floor `part` (rail 0.7) with the box whole;
//           the slider set to its end — the floor `inside`, the box cut in half but for the corner by leg 1 (whose face
//           across the winding shows the turns), three turns, the print taken with the cut half, the whole view ≤ 4
//           draw calls and the inside's 2, the callouts' points (`roll:metal`, `roll:film`) on screen in the free area;
//           back at 0 the box whole; the hue families ≤ 4; the console; snapshots
//           `roll-<board|part|inside>-<size>.jpg`.
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

/** Step `parts` of the scene: every part on the board with the sockets of its legs, one of every kind of the model's
 * catalog that stands on the board. */
const PLACED = {
  LED1: ['a1', 'a2'],
  LED2: ['a4', 'a5'],
  LED3: ['a7', 'a8'],
  LED4: ['a10', 'a11'],
  LED5: ['a13', 'a14'],
  P1: ['d1', 'd3', 'd5'],
  C1: ['d7', 'd9'],
  C2: ['d11', 'd13'],
  C3: ['a16', 'a17'],
  Q1: ['d15', 'd16', 'd17'],
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
    'every part has its model, and nothing is shown outside the circuit',
    ids.every((id) => board?.models?.includes(id)) && board?.shown?.length === 0,
    `models ${board?.models?.length}, shown ${board?.shown?.join(' ') || 'none'}`,
  );
  // the circuit model takes them all: a board with capacitors and transistors compiles and has its operating point
  const model = (n.model = await read(page, 'electronics-model'));
  const numbers = Object.values(model?.parts ?? {}).flatMap((r) => [r.u, r.i, r.p]);
  const missing = ids.filter((id) => !(id in (model?.parts ?? {})));
  const solved = `ok ${model?.ok}, ${Object.keys(model?.parts ?? {}).length} parts`;
  check(
    'the model solves the board with every kind: ok, every part in it, no NaN',
    model?.ok === true && missing.length === 0 && numbers.length > 0 && numbers.every(Number.isFinite),
    `${solved}${missing.length ? `; missing ${missing.join(' ')}` : ''}, dcMs ${round(model?.dcMs, 3)}, issues ${model?.issues?.length}`,
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
  // a resistance is measured without power (plan E3 decision 5): on the live divider the display says «—»
  const live = (n.ohmLive = { meter: await meterNow(), panel: plain(await panel()) });
  check(
    'Ω on the live divider (the switch closed): «—», the panel the same',
    live.meter?.text === '—' && live.panel === '—' && live.meter?.value === null,
    `display «${plain(live.meter?.text)}», panel «${live.panel}», value ${live.meter?.value}`,
  );
  // the switch opened by the dock's toggle (a phone's way to it; on a desk it is hidden but takes the same value)
  const toggle = async (on) => {
    await page.evaluate((v) => window.__ui.set('battery-switch', v, true), on);
    await advance(page, 0.5);
  };
  await toggle(false);
  const o = (n.ohm = { meter: await meterNow(), panel: plain(await panel()) });
  check(
    `Ω: the divider with its battery out (the switch open), «${METER_TEXT.ohm}», the panel the same`,
    plain(o.meter?.text) === METER_TEXT.ohm && o.panel === METER_TEXT.ohm && Math.abs(o.meter?.value / 2000.001 - 1) <= 1e-6,
    `display «${plain(o.meter?.text)}», panel «${o.panel}», value ${o.meter?.value}`,
  );
  await toggle(true);

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
    /** A drag of `steps` moves; `whileHeld` (if given) runs one move before the end, the hand still holding the thing. */
    const drag = async (from, to, steps = 12, whileHeld = null) => {
      await p.down(from.x, from.y);
      for (let k = 1; k <= steps; k++) {
        const f = k / steps;
        await p.move(from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f - Math.sin(Math.PI * f) * height * 0.04);
        if (whileHeld && k === steps - 1) await whileHeld();
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
    // in the hand over the board, one move before it is let go: out of the circuit, so «ok» by the model
    let inHand = null;
    await drag(grab, { x: grab.x + target.x - thing.x, y: grab.y + target.y - thing.y + dy }, 14, async () => {
      const b = await read(page, 'electronics-board');
      const h = await heatNow(page);
      const e = Object.entries(b?.parts ?? {}).find(([, v]) => v.spec === 'resistor-100');
      inHand = e ? { id: e[0], legs: e[1].legs, look: h?.parts?.[e[0]] ?? null } : null;
    });
    n.inHand = inHand;
    const lh = inHand?.look;
    check(
      'overload: the new 100 Ω in the hand, before it closes the circuit: a new id, «ok», cold, no current, whole',
      inHand &&
        inHand.id !== 'R1' &&
        inHand.legs.every((s) => s === null) &&
        lh?.condition === 'ok' &&
        lh.load === 0 &&
        lh.heat === 0 &&
        lh.i === null &&
        lh.surface?.tint === 0 &&
        lh.surface?.char === 0 &&
        lh.marks === false,
      `${inHand?.id} ${JSON.stringify(inHand?.legs)}: ${lh?.condition}, load ${lh?.load}, heat ${lh?.heat}, i ${lh?.i}, tint ${lh?.surface?.tint}, char ${lh?.surface?.char}`,
    );
    await advance(page, 0.4);
    const b2 = await read(page, 'electronics-board');
    const fresh = Object.entries(b2?.parts ?? {}).find(([, v]) => v.spec === 'resistor-100');
    const h3 = await heatNow(page);
    const r3 = fresh ? h3?.parts?.[fresh[0]] : null;
    n.fresh = { id: fresh?.[0], legs: fresh?.[1]?.legs, look: r3 };
    // its heat is what a cold part gathers in the ≈ 0.4 s it has been in the circuit, far under the burnt one's 1
    check(
      'overload: seated in b9 … b13 it closes the circuit: the same id, «гаряча» by its load at once, whole to the eye',
      fresh &&
        fresh[0] === inHand?.id &&
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

  /* ---- step `bulged-look`: the look under the state's name alone, for the reader (E2-9 binds it to the model) */
  {
    const page = await context.newPage();
    const pos = await open(page, 'bulged-look').catch((err) => ({ error: String(err) }));
    if (!check('bulged-look: opened', at(pos, 'bulged-look'), where(pos))) {
      await page.close();
      return;
    }
    const b = await read(page, 'electronics-board');
    const h = await heatNow(page);
    check(
      'bulged-look: the two cans shown outside the circuit, and nothing let out — no model event behind the look',
      ['C-whole', 'C-bulged'].every((id) => b?.shown?.includes(id)) &&
        Object.keys(b?.parts ?? {}).length === 0 &&
        h?.smoke?.fired === 0 &&
        h.smoke.active === 0 &&
        h.burns?.length === 0,
      `shown ${JSON.stringify(b?.shown)}, parts ${JSON.stringify(Object.keys(b?.parts ?? {}))}; smoke ${JSON.stringify(h?.smoke)}; burns ${JSON.stringify(h?.burns)}`,
    );
    await screenshot(page, snap('bulged'));
    const parts = await read(page, 'electronics-parts');
    const can = parts?.['C-bulged'];
    if (!touch && can) {
      await close(page, can.center, Math.max(can.radius, NEAR.least) * NEAR.fill * 1.4);
      await screenshot(page, snap('bulged-close'));
    }
    const errors = await appErrors(page);
    check('bulged-look: console', errors.length === 0, consoleText(errors));
    await page.close();
  }
}

/* ------------------------------------------------------------------------------------- section loupe */

/** The dive (E2-8, `shared/dive`): the depth slider is the door's rail + LENS_LEG, 0 … 1 + LENS_LEG. */
const LENS_LEG = 0.5;
const DEPTH = 1 + LENS_LEG;
/** Where the floors begin on the rail (VISUAL §7: `part` from 0.5, `inside` from 1; `shared/dive/levels.ts`). */
const floorOf = (position, min = -LENS_LEG) =>
  position <= min + 1e-3 ? null : position >= 1 ? 'inside' : position >= 0.5 ? 'part' : 'stand';
/** A frame's change per engine frame while the slider is dragged px by px, relative to the viewing distance. */
const DIVE_STRIDE = 0.06;
/** The whole flight (VISUAL §7): 1.6–2.2 s; with reduced motion 0.6 s. */
const FLIGHT = { from: 1.6, to: 2.2, reduced: 0.6 };
/** The board's shot (`shared/bench/shots.ts`): the step's camera, where the dive starts and ends — on a phone the
 * bench's every shot is `phone`. */
const BOARD_SHOTS = {
  desk: { position: [-0.3, 7.6, 7.7], target: [-0.3, 1.45, 0.35] },
  phone: { position: [-0.3, 10.0, 5.8], target: [-0.3, 1.79, 0.08] },
};
/** The director's idle drift on a held shot (`engine/camera/director.ts`): ±0.016 rad about the target, ±0.009 rad
 * up and down, ±0.8 % in distance — the camera stays within this share of the viewing distance of the shot. */
const DRIFT = 0.016 + 0.009 + 0.008;
/** Whether the camera is the board's shot (`phone` on a phone): its aim the shot's target, its place within the
 * idle drift. */
const onBoardShot = (d, phone) => {
  const shot = phone ? BOARD_SHOTS.phone : BOARD_SHOTS.desk;
  const reach = Math.hypot(...shot.position.map((v, j) => v - shot.target[j]));
  const off = Math.hypot(...d.camera.map((v, j) => v - shot.position[j]));
  const aim = Math.hypot(...d.aim.map((v, j) => v - shot.target[j]));
  return { ok: aim < 1e-6 && off <= DRIFT * reach, off: off / reach, aim };
};

async function loupe(context) {
  const n = (report.sections.loupe = {});
  const page = await context.newPage();
  const pos = await open(page, 'loupe').catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'loupe'), where(pos))) {
    await page.close();
    return;
  }
  const p = await pointer(page, touch);
  const phone = (n.phone = (await read(page, 'electronics-bench'))?.phone === true);
  const dive = () => read(page, 'electronics-dive');
  const hands = () => read(page, 'electronics-hand');
  const board = () => read(page, 'electronics-board');
  const snap = (what) => join(out, `loupe-${what}-${tag}.jpg`);
  /** The ladder «де ми» as the DOM interface draws it: the floor lit, null while it is hidden (a phone hides it). */
  const ladder = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-ui="floor-ladder"]');
      if (!el || el.hidden || window.getComputedStyle(el).display === 'none') return null;
      return el.querySelector('li.on')?.dataset.floor ?? null;
    });
  /** Frames until the dive's rail stops (and the camera is given back on the board's shot), at most `max`. */
  const settle = async (max = 400) => {
    for (let i = 0; i < max; i++) {
      const d = await dive();
      if (!d.moving) return i;
      await page.evaluate(() => window.__app.step(1 / 60, 1));
    }
    return max;
  };
  /** The safe 3 : 2 frame in CSS px, fitted into the area the interface leaves free. */
  const safeFrame = () =>
    page.evaluate(() => {
      const i = window.__app.engine.hud.insetFractions();
      const fw = window.innerWidth * (1 - i.left - i.right);
      const fh = window.innerHeight * (1 - i.top - i.bottom);
      return { w: Math.min(fw, fh * 1.5), h: Math.min(fh, fw / 1.5) };
    });
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  /** The body's share of the safe frame's width, its bands in px, the ring's share of the frame's height. */
  const sizes = async () => {
    const f = await safeFrame();
    const [e0, e1, rt, rb] = await Promise.all(
      ['dive:end0', 'dive:end1', 'dive:ring-top', 'dive:ring-bottom'].map((x) => locate(page, x)),
    );
    const body = dist(e0, e1);
    // the resistor's band is 0.07 of its 0.73 (`shared/parts/resistor.ts`), seen across its axis
    return { body: body / f.w, band: (body * 0.07) / 0.73, ring: dist(rt, rb) / f.h };
  };
  /** Press on a probe and move the pointer 12 px: what the hand holds then (the pointer stays down). */
  const grab = async (probe) => {
    const g = await locate(page, probe);
    await p.down(g.x, g.y);
    for (let k = 1; k <= 4; k++) await p.move(g.x + 3 * k, g.y);
    return { at: g, held: (await hands())?.held ?? null };
  };

  // 0. on the board's shot: the door is ready, the rail rests, no ladder, the lens in its holder, the hand works
  const d0 = await dive();
  n.start = d0;
  check(
    'on the board’s shot: the door ready, the rail at rest, the lens in its holder',
    d0?.ready && !d0.engaged && d0.position === d0.min && d0.floor === null && !d0.flying && d0.atHolder && d0.cut === 0,
    `ready ${d0?.ready}, engaged ${d0?.engaged}, position ${d0?.position}, floor ${d0?.floor}, flying ${d0?.flying}, holder ${d0?.atHolder}`,
  );
  check('no ladder on the board’s shot', (await ladder()) === null);
  const g0 = await grab('part:R1');
  check('on the board’s shot the hand takes R1', g0.held === 'part:R1', `held ${g0.held}`);
  for (let k = 3; k >= 0; k--) await p.move(g0.at.x + 3 * k, g0.at.y);
  await p.up();
  await advance(page, 0.6);
  const legs0 = (await board())?.parts?.R1?.legs;
  check('…and lays it back in a5, a9', JSON.stringify(legs0) === '["a5","a9"]', JSON.stringify(legs0));
  await screenshot(page, snap('board'));

  // 1. the dive's stops, at rest (the slider set as a reader's key would, then the flight waited out)
  const to = async (slider) => {
    await page.evaluate((v) => window.__ui.set('depth', v, true), slider);
    await settle();
    await advance(page, 0.2);
    return dive();
  };
  const door = await to(LENS_LEG);
  const doorSize = await sizes();
  n.door = { position: door.position, floor: door.floor, ...doorSize };
  check(
    'rail 0: the lens over R1, at work — its ring 22–26 % of the frame’s height (VISUAL §7)',
    door.position === 0 && (touch || (doorSize.ring >= 0.22 && doorSize.ring <= 0.26)),
    `ring ${round(doorSize.ring, 3)} of the height, body ${round(doorSize.body, 3)} of the width; floor ${door.floor}`,
  );
  await screenshot(page, snap('door'));
  const part = await to(1);
  const partSize = await sizes();
  n.part = { position: part.position, floor: part.floor, ladder: await ladder(), ...partSize };
  check(
    'rail 0.5: the floor `part` begins — ladder «деталь», the bands ≥ 12 px at 1280 × 720',
    part.floor === 'part' && (touch || n.part.ladder === 'part') && (width !== 1280 || partSize.band >= 12),
    `floor ${part.floor}, ladder ${n.part.ladder}; body ${round(partSize.body, 3)} of the width, band ${round(partSize.band, 1)} px`,
  );
  await screenshot(page, snap('part'));
  const close = await to(1.2);
  const closeSize = await sizes();
  n.close = { position: close.position, floor: close.floor, ...closeSize };
  check(
    'rail 0.7: R1 whole, its body ≥ 35 % of the safe frame’s width (VISUAL §7)',
    close.floor === 'part' && close.cut === 0 && !close.open && closeSize.body >= 0.35,
    `body ${round(closeSize.body, 3)}, band ${round(closeSize.band, 1)} px, cut ${close.cut}`,
  );
  await screenshot(page, snap('close'));
  const inside = await to(DEPTH);
  n.inside = { position: inside.position, floor: inside.floor, ladder: await ladder(), cut: inside.cut };
  check(
    'rail 1: «усередині» — the cut open, the ladder says so',
    inside.position === 1 && inside.floor === 'inside' && inside.cut === 1 && inside.open && (touch || n.inside.ladder === 'inside'),
    `position ${inside.position}, floor ${inside.floor}, ladder ${n.inside.ladder}, cut ${inside.cut}, open ${inside.open}`,
  );
  await screenshot(page, snap('inside'));
  const calls = (n.drawCalls = await drawCalls(page));
  check('draw calls inside', calls.engine > 0 && calls.engine <= DRAW_CALLS.gate, `${calls.engine} (gate ≤ ${DRAW_CALLS.gate})`);
  // while the camera is down there the hand does nothing: a press on R1 takes nothing
  const g1 = await grab('part:R1');
  n.handsBelow = g1.held;
  check('below the board’s shot the hand takes nothing', g1.held === null && inside.flying && inside.bench, `held ${g1.held}, flying ${inside.flying}`);
  await p.up();
  await to(0);
  await advance(page, 0.3);
  const home = await dive();
  const homeShot = onBoardShot(home, phone);
  check(
    'back at 0: the rail lets the camera go on the board’s shot, the lens in its holder, R1 whole',
    !home.engaged && home.position === home.min && home.atHolder && home.cut === 0 && !home.open && !home.flying &&
      homeShot.ok,
    `engaged ${home.engaged}, position ${home.position}, holder ${home.atHolder}, cut ${home.cut}; camera off the shot ` +
      `${round(homeShot.off, 4)} of the distance (drift ≤ ${DRIFT}), aim ${homeShot.aim.toExponential(1)}`,
  );

  // 2. the slider dragged by a real pointer px by px down and back: the frame never jumps; the ladder, the floor and
  // the hand's state follow the rail every frame
  if (touch) {
    const tab = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-ui="sheet-tabs:controls"]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && !el.closest('[hidden]')) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    });
    if (tab) await p.tap(tab.x, tab.y);
    await advance(page, 0.5);
  }
  const track = await page.evaluate(() => {
    const el = document.querySelector('[data-ui="ctl-depth"] input[type="range"]');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y + b.height / 2, w: b.width };
  });
  if (!check('the depth slider is on screen', !!track && track.w > 50, JSON.stringify(track))) {
    await page.close();
    return;
  }
  const xAt = (f) => track.x + track.w * (0.02 + 0.96 * f);
  /** Drag from `a` to `b` (track shares) 1 px a move, one engine frame each; every frame sampled. */
  const drag = async (a, b) => {
    const samples = [];
    await p.down(xAt(a), track.y);
    const px = Math.round(Math.abs(xAt(b) - xAt(a)));
    const dir = Math.sign(b - a);
    for (let k = 1; k <= px + 6; k++) {
      await p.move(xAt(a) + dir * Math.min(k, px + 4), track.y);
      samples.push({ ...(await dive()), ladder: touch ? undefined : await ladder() });
    }
    for (let k = 0; k < 20; k++) {
      await page.evaluate(() => window.__app.step(1 / 60, 1));
      samples.push({ ...(await dive()), ladder: touch ? undefined : await ladder() });
    }
    await p.up();
    return samples;
  };
  const judge = (what, samples) => {
    const steps = [];
    for (let i = 1; i < samples.length; i++) {
      const [a, b] = [samples[i - 1], samples[i]];
      const d = Math.hypot(a.camera[0] - a.aim[0], a.camera[1] - a.aim[1], a.camera[2] - a.aim[2]);
      const move = Math.hypot(...b.camera.map((v, j) => v - a.camera[j])) + Math.hypot(...b.aim.map((v, j) => v - a.aim[j]));
      steps.push(move / d);
    }
    let spike = 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] < 0.004) continue;
      spike = Math.max(spike, steps[i] / Math.max(steps[i - 1] ?? 0, steps[i + 1] ?? 0, 0.002));
    }
    const max = Math.max(0, ...steps);
    (n.drags ??= {})[what] = { frames: samples.length, max: round(max, 4), spike: round(spike, 2), last: samples.at(-1)?.position };
    check(`${what}: no jump`, max <= DIVE_STRIDE && spike < 3, `largest step ${max.toFixed(4)} of the distance, spike ${spike.toFixed(2)}`);
    const wrong = samples.filter((s) => s.floor !== floorOf(s.position, s.min) || (!touch && s.ladder !== s.floor));
    check(
      `${what}: floor and ladder follow the rail (part from 0.5, inside from 1)`,
      wrong.length === 0 && samples.some((s) => s.floor === 'part') && samples.some((s) => s.floor === 'inside'),
      wrong.length ? `first wrong ${JSON.stringify(wrong[0] && { position: wrong[0].position, floor: wrong[0].floor, ladder: wrong[0].ladder })}` : `${samples.length} frames`,
    );
    const loose = samples.filter((s) => s.bench !== s.flying || s.flying !== (s.engaged && (s.moving || s.position > s.min + 1e-6)));
    check(`${what}: the hand is off whenever the camera is off the board’s shot`, loose.length === 0, `${loose.length} frames otherwise`);
  };
  const down = await drag(0, 1);
  judge('slider down', down);
  check('dragged to the end: inside', down.at(-1)?.position === 1 && down.at(-1)?.floor === 'inside', `position ${down.at(-1)?.position}`);
  const up = await drag(1, 0);
  judge('slider back up', up);
  await advance(page, 0.3);
  const back = await dive();
  const backShot = onBoardShot(back, phone);
  check(
    'dragged back to 0: the board’s shot again, the lens in its holder, no ladder, the hand on',
    !back.engaged && back.position === back.min && back.atHolder && !back.flying && (await ladder()) === null &&
      backShot.ok,
    `camera off the shot ${round(backShot.off, 4)} of the distance (drift ≤ ${DRIFT}), aim ` +
      `${backShot.aim.toExponential(1)}; engaged ${back.engaged}, holder ${back.atHolder}, flying ${back.flying}`,
  );
  await screenshot(page, snap('back'));

  // 3. a tap on the track's end: the whole flight in its time, shorter with reduced motion; back the same way
  const flight = async () => {
    await p.down(xAt(1), track.y);
    await p.up();
    const frames = (await settle()) + 2;
    const there = await dive();
    await p.down(xAt(0), track.y);
    await p.up();
    await settle();
    await advance(page, 0.2);
    return { seconds: frames / 60, there: there.position, back: (await dive()).position };
  };
  const normal = await flight();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await flight();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  n.flight = { normal, reduced };
  check(
    'the whole flight 1.6–2.2 s (VISUAL §7)',
    normal.there === 1 && normal.back === -LENS_LEG && normal.seconds >= FLIGHT.from && normal.seconds <= FLIGHT.to,
    `${round(normal.seconds, 2)} s`,
  );
  check(
    'reduced motion shortens it to ≈ 0.6 s',
    reduced.there === 1 && reduced.seconds <= FLIGHT.reduced + 0.1 && reduced.seconds < normal.seconds,
    `${round(reduced.seconds, 2)} s against ${round(normal.seconds, 2)} s`,
  );

  // 4. a tap on the resting lens lays it over R1 (the slider to the end of the lens leg)
  const lens = await locate(page, 'bench:lens');
  if (lens && !touch) {
    await p.down(lens.x, lens.y);
    await p.up();
    await settle();
    const laid = await dive();
    check('a tap on the lens lays it over R1', laid.position === 0 && !laid.atHolder, `position ${laid.position}`);
    await to(0);
  }

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* -------------------------------------------------------------------------------------- section film */

/** `shared/inside/film.ts`: the groove's turns for a value (`filmTurns`) and the electrons' speed per ampere. */
const filmTurns = (ohms) => Math.min(12, Math.max(1, -1.5 + 2 * Math.log10(ohms)));
const PER_AMP = -6;

async function film(context) {
  const n = (report.sections.film = {});
  const page = await context.newPage();
  const pos = await open(page, 'film').catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'film'), where(pos))) {
    await page.close();
    return;
  }
  const dive = () => read(page, 'electronics-dive');
  const model = () => read(page, 'electronics-model');
  const board = () => read(page, 'electronics-board');
  const snap = (what) => join(out, `film-${what}-${tag}.jpg`);
  const settle = async (max = 400) => {
    for (let i = 0; i < max; i++) {
      const d = await dive();
      if (!d.moving) return i;
      await page.evaluate(() => window.__app.step(1 / 60, 1));
    }
    return max;
  };
  const to = async (slider) => {
    await page.evaluate((v) => window.__ui.set('depth', v, true), slider);
    await settle();
    await advance(page, 0.3);
    return dive();
  };

  // 0. on the board's shot: the film closed, the LED's loop on (the model's current)
  const d0 = await dive();
  const m0 = await model();
  n.board = { open: d0?.inside?.open, amps: m0?.parts?.R1?.i, led: m0?.parts?.LED1?.i };
  check('on the board’s shot the film is closed', d0?.ready && d0.cut === 0 && d0.inside?.open === false, JSON.stringify(n.board));
  check(
    'the LED’s loop: 21.2 mA through R1 and the LED (sim/core)',
    Math.abs(Math.abs(m0?.parts?.LED1?.i ?? 0) - 0.0212351) < 1e-6 && Math.abs(Math.abs(m0?.parts?.R1?.i ?? 0) - 0.0212351) < 1e-6,
    `LED1 ${m0?.parts?.LED1?.i}, R1 ${m0?.parts?.R1?.i}`,
  );
  await screenshot(page, snap('board'));

  // 1. the dive to the end: the floor `inside`, the cut open, the film's numbers
  const inside = await to(DEPTH);
  const f330 = inside.inside;
  const m330 = await model();
  n.r330 = { floor: inside.floor, cut: inside.cut, ...f330 };
  check(
    'inside: the cut opens with the magnifier’s dive — the floor `inside`, the film open',
    inside.position === 1 && inside.floor === 'inside' && inside.cut === 1 && f330?.open === true && f330?.amount === 1,
    `position ${inside.position}, floor ${inside.floor}, cut ${inside.cut}, film ${f330?.open} ${f330?.amount}`,
  );
  check(
    'the groove cut for 330 Ω (`filmTurns`), electrons on the strip',
    Math.abs((f330?.turns ?? 0) - filmTurns(330)) < 1e-9 && f330?.shown > 0,
    `turns ${round(f330?.turns, 3)} (filmTurns ${round(filmTurns(330), 3)}), ${f330?.shown} of ${f330?.electrons} electrons shown`,
  );
  // the whole view: the part's own lacquer, bands and legs with the inside (the rod, caps and strip; the grains; the
  // electrons; the section faces)
  check(
    'the whole view of the opened resistor ≤ 8 draw calls',
    f330?.drawCalls >= 5 && f330?.drawCalls <= 8 && f330?.insideCalls === 4,
    `${f330?.drawCalls} (the inside ${f330?.insideCalls}, the part ${f330?.drawCalls - f330?.insideCalls})`,
  );
  const calls = (n.drawCalls = await drawCalls(page));
  check('draw calls of the frame inside ≤ 350', calls.engine > 0 && calls.engine <= DRAW_CALLS.gate, `${calls.engine}`);
  const amps330 = m330?.parts?.R1?.i;
  check(
    'the electrons’ speed is the model’s current through R1 times one number (330 Ω)',
    f330?.amps === amps330 && Math.abs(f330.speed - PER_AMP * amps330) <= 1e-12,
    `speed ${f330?.speed} units/s at ${amps330} A (×${PER_AMP} = ${PER_AMP * amps330})`,
  );
  const probes = await onScreen(page, ['film:film', 'film:groove', 'film:rod']);
  n.anchors = probes.probes;
  check(
    'the callouts’ points — film, groove, rod — on screen in the free area',
    Object.values(probes.probes).every((p) => p && p.inside),
    Object.entries(probes.probes).map(([k, p]) => `${k} ${p ? `${round(p.x)},${round(p.y)}${p.inside ? '' : ' out'}` : 'none'}`).join('; '),
  );
  const png = decodePng(await page.screenshot({ type: 'png' }));
  const hue = (n.hue = hueFamilies(png));
  check('hue families inside (reported)', true, `${hue.families.join(', ')} ${JSON.stringify(hue.shares)}`);
  await screenshot(page, snap('330'));

  // 2. the dock's switch to 10 kΩ: a new R1 there, more turns, a narrower and longer strip, the electrons crawl
  await page.evaluate(() => window.__ui.set('film-value', 'resistor-10k', true));
  await advance(page, 0.6);
  const d10 = await dive();
  const f10 = d10.inside;
  const m10 = await model();
  const amps10 = m10?.parts?.R1?.i;
  n.r10k = { floor: d10.floor, spec: (await board())?.parts?.R1?.spec, ...f10 };
  check(
    'the switch puts a 10 kΩ in R1’s sockets, the camera still inside',
    n.r10k.spec === 'resistor-10k' && d10.floor === 'inside' && f10?.open === true,
    `R1 ${n.r10k.spec}, floor ${d10.floor}, film open ${f10?.open}`,
  );
  check(
    '10 kΩ: more turns, a narrower and longer strip',
    Math.abs((f10?.turns ?? 0) - filmTurns(10_000)) < 1e-9 && f10.turns > f330.turns && f10.width < f330.width && f10.path > f330.path,
    `turns ${round(f330.turns, 2)} → ${round(f10?.turns, 2)}, width ${round(f330.width, 4)} → ${round(f10?.width, 4)}, path ${round(f330.path, 3)} → ${round(f10?.path, 3)}`,
  );
  check(
    'the model’s 0.73 mA, and the electrons’ speed that current times the same number',
    Math.abs(Math.abs(amps10 ?? 0) - 0.0007336) < 1e-6 && f10?.amps === amps10 && Math.abs(f10.speed - PER_AMP * amps10) <= 1e-12,
    `${amps10} A, speed ${f10?.speed}`,
  );
  n.ratio = { speed: f330.speed / f10.speed, current: amps330 / amps10 };
  check(
    'speed in proportion to the current: 29 times slower with 10 kΩ',
    Math.abs(n.ratio.speed / n.ratio.current - 1) < 1e-9 && n.ratio.current > 28 && n.ratio.current < 30,
    `speed ratio ${round(n.ratio.speed, 3)}, current ratio ${round(n.ratio.current, 3)}`,
  );
  await screenshot(page, snap('10k'));

  // 3. back at 0: the part whole again
  const home = await to(0);
  check('back at 0: the film closed, the part whole', home.cut === 0 && home.inside?.open === false && !home.flying, `cut ${home.cut}, film ${home.inside?.open}`);

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* ---------------------------------------------------------------------------------- sections plates, roll */

/** `shared/inside/plates.ts`: the charges on each plate for the voltage across the capacitance. */
const chargeCount = (v) => (Number.isFinite(v) ? Math.min(60, Math.round((60 * Math.abs(v)) / 9)) : 0);
/** The electrons' speed in the legs: the resistor's own rule, −6 units/s per ampere, held at 0.6. */
const legSpeed = (amps) => {
  const v = 0 + PER_AMP * amps;
  return Math.abs(v) > 0.6 ? Math.sign(v) * 0.6 : v;
};

/** A page of a dive step: its readers and the slider's stops with the flight waited out. */
function diveKit(page) {
  const dive = () => read(page, 'electronics-dive');
  const settle = async (max = 400) => {
    for (let i = 0; i < max; i++) {
      const d = await dive();
      if (!d.moving) return i;
      await page.evaluate(() => window.__app.step(1 / 60, 1));
    }
    return max;
  };
  const to = async (slider) => {
    await page.evaluate((v) => window.__ui.set('depth', v, true), slider);
    await settle();
    await advance(page, 0.3);
    return dive();
  };
  return { dive, to };
}

async function plates(context) {
  const n = (report.sections.plates = {});
  const page = await context.newPage();
  const pos = await open(page, 'plates').catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'plates'), where(pos))) {
    await page.close();
    return;
  }
  const { dive, to } = diveKit(page);
  const model = () => read(page, 'electronics-model');
  const board = () => read(page, 'electronics-board');
  const snap = (what) => join(out, `plates-${what}-${tag}.jpg`);

  // 0. on the board's shot: the cut closed, the model's voltage across C1's capacitance already known to the view
  const d0 = await dive();
  n.board = { open: d0?.inside?.open, volts: d0?.inside?.volts, charges: d0?.inside?.charges };
  check('on the board’s shot the can is whole', d0?.ready && d0.cut === 0 && d0.inside?.open === false, JSON.stringify(n.board));
  check(
    'the model’s voltage across C1’s capacitance with the switch closed: 8.968 V (the script’s model run)',
    Math.abs((d0?.inside?.volts ?? 0) - 8.968) < 0.001,
    `${d0?.inside?.volts} V`,
  );
  await screenshot(page, snap('board'));

  // 1. the dive to the end: the can cut in half, the charges, the calls, the callouts' points, the legs' electrons
  const inside = await to(DEPTH);
  const p470 = inside.inside;
  const m470 = await model();
  n.c470 = { floor: inside.floor, cut: inside.cut, ...p470 };
  check(
    'inside: the cut opens with the magnifier’s dive — the floor `inside`, the can open',
    inside.position === 1 && inside.floor === 'inside' && inside.cut === 1 && p470?.open === true && p470?.amount === 1,
    `position ${inside.position}, floor ${inside.floor}, cut ${inside.cut}, open ${p470?.open} ${p470?.amount}`,
  );
  check(
    'on each plate `chargeCount` of the voltage across the capacitance: 60 at 8.968 V, «+» on the plate over leg 0',
    p470?.charges === chargeCount(p470?.volts) && p470?.charges === 60 && p470?.positive === 'plus',
    `${p470?.charges} of ${p470?.count} at ${p470?.volts} V, «+» on ${p470?.positive}`,
  );
  check('the print goes with the half the cut takes', p470?.printHidden === 1, `${p470?.printHidden} hidden`);
  check(
    'the whole view of the opened can ≤ 9 draw calls, the inside’s ≤ 6',
    p470?.drawCalls >= 7 && p470?.drawCalls <= 9 && p470?.insideCalls >= 5 && p470?.insideCalls <= 6,
    `${p470?.drawCalls} (the inside ${p470?.insideCalls}, the part ${p470?.drawCalls - p470?.insideCalls})`,
  );
  const calls = (n.drawCalls = await drawCalls(page));
  check('draw calls of the frame inside ≤ 350', calls.engine > 0 && calls.engine <= DRAW_CALLS.gate, `${calls.engine}`);
  const amps = m470?.parts?.C1?.i;
  check(
    'the legs’ electrons at the speed of the model’s current into leg 0',
    p470?.amps === amps && Math.abs(p470.speed - legSpeed(amps)) <= 1e-12 && p470?.legElectrons > 0,
    `speed ${p470?.speed} units/s at ${amps} A; ${p470?.legElectrons} shown`,
  );
  const probes = await onScreen(page, ['plates:plus', 'plates:minus', 'plates:insulator']);
  n.anchors = probes.probes;
  check(
    'the callouts’ points — plus, minus, insulator — on screen in the free area',
    Object.values(probes.probes).every((p) => p && p.inside),
    Object.entries(probes.probes).map(([k, p]) => `${k} ${p ? `${round(p.x)},${round(p.y)}${p.inside ? '' : ' out'}` : 'none'}`).join('; '),
  );
  const png = decodePng(await page.screenshot({ type: 'png' }));
  const hue = (n.hue = hueFamilies(png));
  check('hue families inside ≤ 4', hue.families.length <= 4, `${hue.families.join(', ')} ${JSON.stringify(hue.shares)}`);
  await screenshot(page, snap('470'));

  // 2. the battery's switch opened from the dock while the camera is inside: the charges follow the model's voltage
  await page.evaluate(() => window.__ui.set('plates-switch', false, true));
  await advance(page, 1);
  const dOpen = await dive();
  n.open = dOpen.inside;
  check(
    'the switch opened inside (the dock’s toggle works there): the charges are what the model keeps now',
    dOpen.floor === 'inside' && (await read(page, 'electronics-board'))?.settings?.SW === 0 &&
      dOpen.inside?.charges === chargeCount(dOpen.inside?.volts),
    `floor ${dOpen.floor}, ${dOpen.inside?.volts} V, ${dOpen.inside?.charges} charges`,
  );
  await screenshot(page, snap('open'));
  await page.evaluate(() => window.__ui.set('plates-switch', true, true));
  await advance(page, 0.3);
  const dBack = await dive();
  check(
    'closed again: 60 charges back',
    dBack.inside?.charges === 60 && Math.abs(dBack.inside?.volts - 8.968) < 0.001,
    `${dBack.inside?.charges} at ${dBack.inside?.volts} V`,
  );

  // 3. every can in C1's sockets, the camera still inside
  n.cans = {};
  for (const [spec, label] of [
    ['electrolytic-10u-16v', '10u'],
    ['electrolytic-100u-16v', '100u'],
    ['electrolytic-1000u-16v', '1000u'],
  ]) {
    await page.evaluate((v) => window.__ui.set('plates-can', v, true), spec);
    await advance(page, 0.6);
    const d = await dive();
    const p = d.inside;
    n.cans[label] = { spec: (await board())?.parts?.C1?.spec, floor: d.floor, ...p };
    check(
      `${label}: open inside, 60 charges, ≤ 9 calls (the inside ≤ 6)`,
      n.cans[label].spec === spec && d.floor === 'inside' && p?.open && p?.charges === 60 && p?.drawCalls <= 9 && p?.insideCalls <= 6,
      `C1 ${n.cans[label].spec}, floor ${d.floor}, ${p?.charges} charges at ${p?.volts} V, ${p?.drawCalls} calls`,
    );
    await screenshot(page, snap(label));
  }
  await page.evaluate(() => window.__ui.set('plates-can', 'electrolytic-470u-16v', true));
  await advance(page, 0.3);

  // 4. the can the other way round, the switch closed: the model bulges it — no charges, the insulator cracked
  await page.evaluate(() => window.__ui.set('plates-flip', true, true));
  let dBulged = await dive();
  let waited = 0;
  for (; waited < 40 && !dBulged.inside?.bulged; waited++) {
    await advance(page, 0.25);
    dBulged = await dive();
  }
  await advance(page, 0.5);
  dBulged = await dive();
  n.bulged = { seconds: waited * 0.25, floor: dBulged.floor, ...dBulged.inside };
  // (turned round, the can keeps its print on the half the cut leaves, behind: one call more than the view's nine)
  const printKept = dBulged.inside?.printHidden === 0 ? 1 : 0;
  check(
    'turned round, the switch closed: the can bulges inside, no charges, ≤ 9 calls but the print kept (the inside ≤ 6)',
    dBulged.floor === 'inside' && dBulged.inside?.open === true && dBulged.inside?.bulged === true &&
      dBulged.inside?.charges === 0 && dBulged.inside?.drawCalls - printKept <= 9 && dBulged.inside?.insideCalls <= 6,
    `after ${waited * 0.25} s: bulged ${dBulged.inside?.bulged}, ${dBulged.inside?.charges} charges, ` +
      `${dBulged.inside?.drawCalls} calls (the inside ${dBulged.inside?.insideCalls}, the print kept ${printKept})`,
  );
  const bulgedAnchor = await onScreen(page, ['plates:insulator']);
  n.bulged.anchor = bulgedAnchor.probes['plates:insulator'];
  check(
    'the cracked insulator’s point on screen in the free area',
    !!bulgedAnchor.probes['plates:insulator']?.inside,
    JSON.stringify(bulgedAnchor.probes['plates:insulator']),
  );
  await screenshot(page, snap('bulged'));
  await page.evaluate(() => window.__ui.set('plates-flip', false, true));
  await advance(page, 0.3);
  const dWhole = await dive();
  check(
    'turned back: a whole can, 60 charges',
    dWhole.inside?.bulged === false && dWhole.inside?.charges === 60,
    `bulged ${dWhole.inside?.bulged}, ${dWhole.inside?.charges} charges`,
  );

  // 5. back at 0: the can whole
  const home = await to(0);
  check('back at 0: the can whole', home.cut === 0 && home.inside?.open === false && !home.flying, `cut ${home.cut}, open ${home.inside?.open}`);

  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

async function roll(context) {
  const n = (report.sections.roll = {});
  const page = await context.newPage();
  const pos = await open(page, 'roll').catch((err) => ({ error: String(err) }));
  if (!check('opened', at(pos, 'roll'), where(pos))) {
    await page.close();
    return;
  }
  const { dive, to } = diveKit(page);
  const snap = (what) => join(out, `roll-${what}-${tag}.jpg`);
  const d0 = await dive();
  check('on the board’s shot the box is whole', d0?.ready && d0.cut === 0 && d0.inside?.open === false, JSON.stringify(d0?.inside));
  await screenshot(page, snap('board'));
  const part = await to(1.2);
  check('the floor `part`: the box whole', part.floor === 'part' && part.cut === 0 && part.inside?.open === false, `floor ${part.floor}, cut ${part.cut}`);
  await screenshot(page, snap('part'));
  const inside = await to(DEPTH);
  const r = inside.inside;
  n.inside = { floor: inside.floor, cut: inside.cut, ...r };
  check(
    'inside: the box cut in half but for the corner by leg 1 — the floor `inside`, open, three turns',
    inside.position === 1 && inside.floor === 'inside' && inside.cut === 1 && r?.open === true && r?.turns === 3,
    `position ${inside.position}, floor ${inside.floor}, cut ${inside.cut}, open ${r?.open}, turns ${r?.turns}`,
  );
  check('the print goes with the half the cut takes', r?.printHidden === 1, `${r?.printHidden} hidden`);
  check(
    'the whole view of the opened box ≤ 4 draw calls, the inside’s 2 (the upright section, the corner’s face)',
    r?.drawCalls >= 3 && r?.drawCalls <= 4 && r?.insideCalls === 2,
    `${r?.drawCalls} (the inside ${r?.insideCalls})`,
  );
  const calls = (n.drawCalls = await drawCalls(page));
  check('draw calls of the frame inside ≤ 350', calls.engine > 0 && calls.engine <= DRAW_CALLS.gate, `${calls.engine}`);
  const probes = await onScreen(page, ['roll:metal', 'roll:film']);
  n.anchors = probes.probes;
  check(
    'the callouts’ points — metal, film — on screen in the free area',
    Object.values(probes.probes).every((p) => p && p.inside),
    Object.entries(probes.probes).map(([k, p]) => `${k} ${p ? `${round(p.x)},${round(p.y)}${p.inside ? '' : ' out'}` : 'none'}`).join('; '),
  );
  const png = decodePng(await page.screenshot({ type: 'png' }));
  const hue = (n.hue = hueFamilies(png));
  check('hue families inside ≤ 4', hue.families.length <= 4, `${hue.families.join(', ')} ${JSON.stringify(hue.shares)}`);
  await screenshot(page, snap('inside'));
  const home = await to(0);
  check('back at 0: the box whole', home.cut === 0 && home.inside?.open === false && !home.flying, `cut ${home.cut}, open ${home.inside?.open}`);
  const errors = await appErrors(page);
  n.errors = errors;
  check('console', errors.length === 0, consoleText(errors));
  await page.close();
}

/* ---------------------------------------------------------------------------------------------- run */

const SECTIONS = { room, shots, parts, hand, meter, heat, loupe, film, plates, roll };
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
