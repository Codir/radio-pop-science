#!/usr/bin/env node
/* global process, console, window, document, URL */
// Interaction test of chapter `electronics/resistor` (a dev server, a preview or the site profile up), DOM interface:
//
//   node app/src/volumes/electronics/chapters/resistor/qa/interactions.mjs --base <url> [--port <p>] --out <dir>
//        [--size 1280x720] [--touch]
//
// The reader's way through the seven steps on a frozen engine clock, every goal by real pointer input (a mouse, or a
// finger with --touch: real touch events, the dragged thing riding above it): the LED from the tray (a phone: the
// dock's button «червоний») set between the jumpers' ends and the switch closed (a phone: the dock's toggle) — it
// burns; the 330 Ω into the gap — the LED lives at 21,2 mA; the multimeter on «Ω» on the live loop shows «—», the
// resistor carried out of the loop and three resistors read; the slider «Глибина» dragged down into the resistor and
// the value switched to 10 kΩ; three resistors from the tray, one at a time, on the ammeter; three voltages on «V»;
// the amplifier: the meter on «A» across the supply burns the protection diode, «Нові деталі» puts it back, then the
// voltage on 2,2 kΩ and, the jumper taken out, its current. After each goal the panel shows the takeaway and the
// reader numbers are the model's; «Докладніше» opens; the recall links inside the chapter lead there and back; every
// step is arrived at with «Далі» and its camera sampled frame by frame for jumps; the closing card has three lines and
// the bridge, and «Далі» on it is enabled only if `resistor-pick` is built. Goal snapshots `<step>-goal-<size>.jpg`
// in --out; the console must stay free of errors. Last line: `PASS electronics/resistor — <n> checks (<size>)` or
// `FAIL electronics/resistor — <k> of <n> checks (<size>)` (exit 1).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { closingCard } from '../../../../../../../tools/qa/next-chapter.mjs';
import { advance, pointer, press, read, shown, strides } from './helpers.mjs';

const ID = 'electronics/resistor';
/** The volume's floor `inside` as the ladder «де ми» names it (`volume.json`). */
const INSIDE = JSON.parse(readFileSync(new URL('../../../volume.json', import.meta.url), 'utf8')).axis.floors.find(
  (f) => f.id === 'inside',
).label;
/** The steps' titles as the reader sees them (the recall links name them): the generated manifest. */
const TITLES = Object.fromEntries(
  JSON.parse(
    readFileSync(new URL('../../../content/generated/resistor.manifest.json', import.meta.url), 'utf8'),
  ).steps.map((s) => [s.id, s.title]),
);
const args = parseArgs();
if (typeof args.out !== 'string') {
  console.error('interactions: --out <directory> is required');
  process.exit(2);
}
const [width, height] = parseSize(args.size, [1280, 720]);
const touch = args.touch === true;
const out = ensureDir(args.out);
const size = `${width}x${height}${touch ? ', touch' : ''}`;
const tag = `${width}x${height}${touch ? '-touch' : ''}`;
const { browser, page } = await launch({ width, height, dpr: touch ? 3 : 1, touch });
const results = [];
let step = 'boot';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(7)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
  return Boolean(ok);
};
const plain = (s) => (typeof s === 'string' ? s.replace(/\u00a0/g, ' ') : s);
const snap = (name) => screenshot(page, join(out, `${name}-${tag}.jpg`));
/**
 * A tab of the step's sheet in a narrow layout (`text` or `controls`), picked as a reader picks it: a tap on the shown
 * one of the tab rows (the sheet keeps a copy of the row per page). A no-op where there are no tabs.
 */
async function sheetTab(id) {
  const tab = await page.evaluate((t) => {
    for (const el of document.querySelectorAll(`[data-ui="sheet-tabs:${t}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && !el.closest('[hidden]'))
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, on: el.getAttribute('aria-selected') === 'true' };
    }
    return null;
  }, id);
  if (!tab || tab.on) return;
  await p.tap(tab.x, tab.y);
  await advance(page, 0.3);
}
/** On a phone the step's text is a tab of the sheet too: «Текст» before the takeaway or a link is looked at. */
const textTab = () => sheetTab('text');
const takeaway = async () => {
  await textTab();
  return shown(page, '[data-ui="path-takeaway"]');
};
/** The largest step of the camera per frame on the way into a step (world units at 60 fps). */
const CAMERA_STRIDE = 0.35;

const p = await pointer(page, touch);
/** A probe's screen point; throws when it is unknown. */
const scr = async (name) => {
  const v = await page.evaluate((n) => window.__app.locate(n), name);
  if (!v) throw new Error(`probe '${name}' is unknown`);
  return { x: v.x, y: v.y, visible: v.visible };
};
/** A control's rectangle (`ctl-<id>`), null when it is not on screen. */
const control = (id) => page.evaluate((n) => window.__ui.locate(n), `ctl-${id}`);
/** On a phone the dock is a tab of the sheet: «Керування» before a control is touched. */
const controls = () => sheetTab('controls');
/** A tap on a control (`ctl-<id>`, a segmented item `ctl-<id>:<item>`) with the pointer. */
async function tapControl(id) {
  await controls();
  const r = await control(id);
  if (!check(`the control ${id} is on screen`, !!r, JSON.stringify(r && { w: Math.round(r.w), h: Math.round(r.h) })))
    return false;
  await p.tap(r.x, r.y);
  await advance(page, 0.3);
  return true;
}

/**
 * Press `grab` and drag so that `thing` (a point on the board's face: a tip, a probe's end) comes to `target` (a socket
 * probe or a screen point), correcting by what is left (the hand keeps its grip and the thing follows it with a little
 * lag; a finger carries the thing above it), then let go and let it arrive. With a socket as the target the drag ends
 * once the hand would put the thing there: a part's preview starts with that socket (leg 0), an end's `near` is it.
 * `thing` may be a function of what the hand holds after the press (a new part from the tray gets its id then).
 */
async function bring(grab, thing, target, { settleTime = 0.45 } = {}) {
  const g = await scr(grab);
  const socket = typeof target === 'string' && target.startsWith('socket:') ? target.slice('socket:'.length) : null;
  const goal = typeof target === 'string' ? () => scr(target) : async () => target;
  await p.down(g.x, g.y);
  let at = { x: g.x, y: g.y };
  // a small first move lifts the thing (a part from the tray gets its id and takes the board's tilt on its way)
  at = { x: at.x, y: at.y - height * 0.02 };
  await p.move(at.x, at.y);
  await page.evaluate(() => window.__app.step(1 / 60, 24));
  const grabbed = await held();
  if (!grabbed && !grab.startsWith('part:')) check(`the hand takes ${grab}`, false, JSON.stringify(g));
  const thingName = typeof thing === 'function' ? await thing() : thing;
  const t0 = await goal();
  const e0 = await scr(thingName);
  const d = { x: t0.x - e0.x, y: t0.y - e0.y };
  const from = { ...at };
  for (let k = 1; k <= 14; k++) {
    const f = k / 14;
    at = { x: from.x + d.x * f, y: from.y + d.y * f - Math.sin(Math.PI * f) * height * 0.04 };
    await p.move(at.x, at.y);
  }
  const there = async () => socket !== null && (await read(page, 'electronics-hand')).preview?.[0] === socket;
  for (let k = 0; k < 14; k++) {
    // the thing catches up with the hand before it is measured
    await page.evaluate(() => window.__app.step(1 / 60, 8));
    // a part: its preview stands where it should; an end clicks in only within SNAP when let go — close enough
    const e = await scr(thingName);
    const t = await goal();
    const left = { x: t.x - e.x, y: t.y - e.y };
    if (thingName.startsWith('tip:') ? await there() : Math.hypot(left.x, left.y) < 1.5) break;
    at = { x: at.x + left.x * 0.8, y: at.y + left.y * 0.8 };
    await p.move(at.x, at.y);
  }
  await p.up();
  await advance(page, settleTime);
  return thingName;
}
/** What the hand holds now (`part:LED1`), null when nothing. */
const held = async () => (await read(page, 'electronics-hand'))?.held ?? null;
/** A new part of `spec` from the tray (a phone: the dock's button, then the part waiting over the board) with its leg 0
 * into `socket`; returns its id. */
async function fromTray(spec, socket) {
  if (touch) {
    await tapControl(`tray-${spec}`);
    const b = await read(page, 'electronics-board');
    const id = Object.entries(b.parts).find(([, v]) => v.spec === spec && v.legs.every((s) => s === null))?.[0];
    if (!check(`a ${spec} waits over the board`, !!id, JSON.stringify(b.parts))) return null;
    await bring(`part:${id}`, `tip:${id}:0`, `socket:${socket}`);
    return id;
  }
  let id = null;
  await bring(`tray:${spec}`, async () => {
    id = (await held())?.split(':')[1] ?? null;
    return `tip:${id}:0`;
  }, `socket:${socket}`);
  return id;
}
/** A screen point off the board, beyond the − rail (a part let go there goes to the tray). */
async function offBoard() {
  const rail = await scr('socket:-9');
  const line = await scr('socket:j9');
  return { x: rail.x + (rail.x - line.x) * 2.5, y: rail.y + (rail.y - line.y) * 2.5 };
}
/** The battery's switch: a tap on its slider (a phone: the dock's toggle, the shot leaves the switch out). */
async function flipSwitch() {
  if (touch) return tapControl('battery-switch');
  const s = await scr('switch');
  await p.tap(s.x, s.y);
  await advance(page, 0.3);
  return true;
}
/** «Далі»: the next step, as a reader goes on; then the camera is sampled for jumps on the way in. */
async function next(id) {
  step = id;
  await press(page, '[data-ui="nav-next"]');
  const s = await strides(page, 'motion', 2.2);
  check('on the way in the camera does not jump', s.camera <= CAMERA_STRIDE, `largest step ${s.camera?.toFixed(3)}`);
  const pos = await page.evaluate(() => window.__app.position());
  check('the step is on screen', pos.chapterId === 'resistor' && pos.stepId === id, `${pos.chapterId}/${pos.stepId}`);
  check('no takeaway before the goal', !(await takeaway()));
}
/** «Докладніше» opens. */
async function more() {
  await textTab();
  await press(page, '[data-ui="path-more"]');
  check(
    '«Докладніше» opens',
    await page.evaluate(() => document.querySelector('[data-ui="path-more"]')?.getAttribute('aria-expanded') === 'true'),
  );
}
/** The goal reached: the takeaway shown, a snapshot. */
async function goal(what) {
  check(`takeaway after the goal (${what})`, await takeaway());
  await snap(`${step}-goal`);
}
/** The meter's display and the panel's readout, as the reader sees them. */
async function meterNow() {
  const m = await read(page, 'electronics-meter');
  await controls();
  const panel = await page.evaluate(() => document.querySelector('[data-ui="ctl-meter"] output')?.textContent ?? null);
  return { ...m, text: plain(m.text), panel: plain(panel) };
}
/** Both probes into sockets (the red first unless the black is in the red's target). */
async function probes(red, black) {
  const m = await read(page, 'electronics-meter');
  // a probe never goes into the other one's socket: the one standing where the other must go moves first
  const order = m.black === red ? ['black', 'red'] : ['red', 'black'];
  for (const name of order) {
    const to = name === 'red' ? red : black;
    if ((await read(page, 'electronics-meter'))[name] === to) continue;
    await bring(`probe:${name}`, `end:${name}`, `socket:${to}`);
  }
  const n = await read(page, 'electronics-meter');
  return check(`the probes in ${red} and ${black}`, n.red === red && n.black === black, `red ${n.red}, black ${n.black}`);
}
/** A free socket of a row (no leg, plug or probe in it): the near half from the line j, the far half from a. */
async function freeIn(row) {
  const b = await read(page, 'electronics-board');
  const m = await read(page, 'electronics-meter');
  const taken = new Set(
    [...Object.values(b.parts).flatMap((x) => x.legs), ...Object.values(b.leads), m.red, m.black].filter(Boolean),
  );
  const col = Number.parseInt(row, 10);
  const lines = row.endsWith('ae') ? ['a', 'e', 'd', 'c', 'b'] : ['j', 'f', 'i', 'h', 'g'];
  return lines.map((l) => `${l}${col}`).find((s) => !taken.has(s)) ?? null;
}
/** The row of a socket (`a5` → `5ae`). */
const rowOf = (socket) => `${Number.parseInt(socket.slice(1), 10)}${'abcde'.includes(socket[0]) ? 'ae' : 'fj'}`;
/** Follow the recall link to the step `id` of the chapter (by its title) and back with «назад». */
async function recall(id) {
  const target = TITLES[id];
  await textTab();
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('[data-ui="path-recall"]')].filter((b) => !b.closest('[hidden]')).map((b) => b.textContent),
  );
  check('«Згадайте» links shown', links.length > 0, links.join(' | '));
  const i = await page.evaluate((t) => {
    const all = [...document.querySelectorAll('[data-ui="path-recall"]')].filter((b) => !b.closest('[hidden]'));
    const k = all.findIndex((b) => b.textContent.includes(t));
    if (k >= 0) all[k].click();
    return k;
  }, target);
  if (!check(`the recall to ${id} is there`, i >= 0)) return;
  await advance(page, 1.5);
  const there = await page.evaluate(() => window.__app.position());
  check('it leads to the recalled step', there.chapterId === 'resistor' && there.stepId === id, `${there.chapterId}/${there.stepId}`);
  await press(page, '[data-ui="path-back"]');
  await advance(page, 2);
  const back = await page.evaluate(() => window.__app.position());
  check('«назад» returns to the step', back.chapterId === 'resistor' && back.stepId === step, `${back.chapterId}/${back.stepId}`);
}

const steps = {
  async flash() {
    await textTab();
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] button');
    check('no takeaway before the goal', !(await takeaway()));
    const s0 = await read(page, 'flash');
    check('on entry: no LED in place, the switch open', s0.led === null && s0.closed === 0, JSON.stringify(s0));
    await snap('flash-start');
    const id = await fromTray('led-red', 'c9');
    await advance(page, 0.3);
    const s1 = await read(page, 'flash');
    check(
      'the LED stands anode in 9ae, cathode in 10ae; not burnt with the switch open',
      s1.led === id && s1.condition !== 'burnt',
      JSON.stringify(s1),
    );
    await flipSwitch();
    const s2 = await read(page, 'flash');
    check('the switch closed', s2.closed === 1, JSON.stringify(s2));
    // the burn is the model's: 0,93 A burns it within a few frames
    const heat = await read(page, 'electronics-heat');
    check(
      'the LED burnt (the model told it, one wisp)',
      heat.parts[id]?.condition === 'burnt' && heat.burns.some((b) => b.id === id) && heat.smoke.fired >= 1,
      JSON.stringify({ c: heat.parts[id]?.condition, burns: heat.burns, smoke: heat.smoke }),
    );
    check('no takeaway right after the burn', !(await takeaway()));
    await advance(page, 1.2);
    await goal('the LED burnt, 1 s after');
    await more();
  },
  async limit() {
    await next('limit');
    const s0 = await read(page, 'limit');
    check('on entry: a new LED, dark; the switch open; the gap empty', s0.resistor === null && s0.closed === 0 && !(s0.i > 1e-6), JSON.stringify(s0));
    await recall('flash');
    await fromTray('resistor-330', 'd5');
    const s1 = await read(page, 'limit');
    check('the 330 Ω in the gap from 5ae to 9ae', s1.resistor !== null, JSON.stringify((await read(page, 'electronics-board')).parts));
    await flipSwitch();
    await advance(page, 0.5);
    const s2 = await read(page, 'limit');
    check('the LED at 21,0 … 21,5 mA, whole', s2.i >= 0.021 && s2.i <= 0.0215 && s2.condition !== 'burnt', JSON.stringify(s2));
    check('no takeaway before 2 s', !(await takeaway()));
    await advance(page, 2);
    await goal('the LED lit 2 s');
  },
  async ohm() {
    await next('ohm');
    const m0 = await meterNow();
    check('the meter on its place, «вимкнено», «—»', m0.shown >= 0.999 && m0.mode === 'off' && m0.text === '—', JSON.stringify(m0));
    await tapControl('meter-mode:ohm');
    // the live rule (plan E3 decision 5): on R1 in the loop with the switch closed — «—»
    await probes('d5', 'd9');
    await advance(page, 1.2);
    const live = await meterNow();
    check('on the live loop the Ω mode shows «—»', live.mode === 'ohm' && live.text === '—' && live.value === null && live.panel === '—', JSON.stringify(live));
    // R1 whole out of the loop, onto the near half's free sockets (not in another resistor's rows)
    await bring('part:R1', 'tip:R1:0', 'socket:i1');
    const b = await read(page, 'electronics-board');
    const legs = b.parts.R1?.legs ?? [];
    const rows = legs.map((x) => (x ? rowOf(x) : null));
    check(
      'R1 out of the loop on the near half, in rows of its own; the LED dark',
      rows.every((r) => r && r.endsWith('fj')) && !rows.some((r) => ['2fj', '6fj', '12fj', '16fj'].includes(r)) &&
        !((await read(page, 'electronics-heat')).parts.LED1?.i > 1e-6),
      JSON.stringify(b.parts.R1),
    );
    const want = { '330,0 Ω': [await freeIn(rows[0]), await freeIn(rows[1])], '1,000 kΩ': ['f2', 'f6'], '4,700 kΩ': ['f12', 'f16'] };
    for (const [text, [red, black]] of Object.entries(want)) {
      await probes(red, black);
      await advance(page, 1.3);
      const m = await meterNow();
      check(`«${text}» on the display and in the panel`, m.text === text && m.panel === text, JSON.stringify({ text: m.text, panel: m.panel }));
    }
    const s = await read(page, 'ohm');
    check('three readings counted', s.counted.length === 3, JSON.stringify(s.counted));
    await goal('three resistors read');
  },
  async inside() {
    await next('inside');
    const s0 = await read(page, 'inside');
    check('on the board’s shot, no floor', s0.floor === null && s0.value === 'resistor-330', JSON.stringify(s0));
    await recall('ohm');
    // the slider dragged to its end by the pointer: the lens onto the resistor, then the camera through the ring
    await controls();
    const r = await control('depth');
    if (check('the slider «Глибина» is on screen', !!r)) {
      const y = r.y + r.h * 0.18;
      const x0 = r.x - r.w / 2 + r.w * 0.04;
      const x1 = r.x + r.w / 2 - r.w * 0.04;
      // a little past the track's end: the slider holds its maximum
      const end = x1 + r.w * 0.08;
      const pts = Array.from({ length: 31 }, (_, k) => ({ x: x0 + ((end - x0) * k) / 30, y }));
      await p.path(pts, 3);
      await advance(page, 2.5);
    }
    const s1 = await read(page, 'inside');
    const dive = await read(page, 'electronics-dive');
    check('down inside: the floor `inside`, the film open', s1.down && s1.floor === 'inside' && dive.inside?.open, JSON.stringify({ s1, cut: dive.cut }));
    // the ladder «де ми» marks the floor (a desk: lower left; a phone: the header's chip, not checked here)
    const ladder = await page.evaluate(
      () => document.querySelector('[data-ui="floor-ladder"] [aria-current="location"]')?.textContent ?? null,
    );
    if (!touch) check('the ladder «де ми» marks the floor inside the part', ladder === INSIDE, String(ladder));
    await advance(page, 1.2);
    await snap('inside-330');
    const turns330 = s1.turns;
    await tapControl('film-value:resistor-10k');
    await advance(page, 1.3);
    const s2 = await read(page, 'inside');
    check(
      '10 kΩ: more turns, the current 29 times less, still inside',
      s2.value === 'resistor-10k' && s2.turns > turns330 && Math.abs(s1.amps / s2.amps - 28.95) < 0.1 && s2.down,
      JSON.stringify({ turns: [turns330, s2.turns], amps: [s1.amps, s2.amps] }),
    );
    await goal('both values inside');
    await more();
  },
  async law() {
    await next('law');
    await advance(page, 0.5);
    const m0 = await meterNow();
    check('the meter on «A», the probes put in e9 and −9, «0,000 A»', m0.mode === 'A' && m0.red === 'e9' && m0.black === '-9' && m0.text === '0,000 A', JSON.stringify(m0));
    const want = { 'resistor-1k': '8,986 mA', 'resistor-2k': '4,497 mA', 'resistor-3k': '2,998 mA' };
    for (const [spec, text] of Object.entries(want)) {
      const id = await fromTray(spec, 'c5');
      await advance(page, 1.3);
      const m = await meterNow();
      check(`${spec} alone in the gap: «${text}»`, m.text === text && m.panel === text, JSON.stringify({ id, text: m.text, panel: m.panel }));
      // back to the tray (off the board)
      if (id) await bring(`part:${id}`, `tip:${id}:0`, await offBoard());
      await advance(page, 0.6);
      const b = await read(page, 'electronics-board');
      check(`${spec} gone from the board`, !(id in b.parts), Object.keys(b.parts).join(' '));
    }
    await goal('three currents');
    await controls();
    check('the formula card comes with the takeaway', await shown(page, '[data-ui="ctl-ohm-law"]'));
    const rich = await page.evaluate(() => document.querySelector('[data-ui="ctl-ohm-law"]')?.textContent ?? '');
    check('the card reads «I = U / R»', plain(rich).includes('I = U / R'), plain(rich));
  },
  async share() {
    await next('share');
    await recall('law');
    await tapControl('meter-mode:V');
    const want = [
      ['d9', 'd10', '1,960 V'],
      ['d5', 'd9', '7,008 V'],
      ['+3', '-3', '8,968 V'],
    ];
    for (const [red, black, text] of want) {
      await probes(red, black);
      await advance(page, 1.3);
      const m = await meterNow();
      check(`«${text}» between ${red} and ${black}`, m.text === text && m.panel === text, JSON.stringify({ text: m.text, panel: m.panel }));
    }
    await goal('three voltages');
  },
  async amp() {
    await next('amp');
    const entry = await read(page, 'amp');
    check('on entry: «V», the gap closed, the LED «on» lit', entry.mode === 'V' && entry.gapClosed && entry.led > 0.0029, JSON.stringify(entry));
    // the interaction check of the bench (not the goal): «A» across the supply and the − rail burns D1
    await tapControl('meter-mode:A');
    await probes('d5', '-8');
    await advance(page, 1.5);
    const heat = await read(page, 'electronics-heat');
    check('«A» across the supply and the − rail: D1 burnt within 1,5 s', heat.parts.D1?.condition === 'burnt', JSON.stringify(heat.parts.D1));
    await controls();
    check('the dock shows «Нові деталі»', await shown(page, '[data-ui="ctl-fresh"]'));
    await tapControl('fresh');
    await advance(page, 0.5);
    const fresh = await read(page, 'amp');
    const m = await read(page, 'electronics-meter');
    const heat2 = await read(page, 'electronics-heat');
    check(
      'after «Нові деталі»: the entry’s board, nothing burnt, «V», the probes at rest, no button',
      fresh.key === entry.key && !fresh.damaged && m.mode === 'V' && m.red === null && m.black === null &&
        Object.values(heat2.parts).every((x) => x.condition !== 'burnt' && x.condition !== 'bulged') &&
        !(await shown(page, '[data-ui="ctl-fresh"]')),
      JSON.stringify({ key: fresh.key === entry.key, damaged: fresh.damaged, mode: m.mode, red: m.red, black: m.black }),
    );
    // (a) the voltage on R1: on its leg in the supply's row and in the free socket of its other row
    await probes('e5', 'j5');
    await advance(page, 1.3);
    const a = await read(page, 'amp');
    const ma = await meterNow();
    check('(a) «6,587 V» on R1, counted', a.a && ma.text === '6,587 V' && ma.panel === '6,587 V', JSON.stringify({ a: a.a, text: ma.text }));
    // (b) the jumper out (whole, off the board: to the tray), the probes into its rows, then «A»
    await bring('part:J11', 'tip:J11:0', await offBoard());
    await advance(page, 0.6);
    const open = await read(page, 'amp');
    check('the gap open: J11 gone, the LED dark', !open.gapClosed && !(open.led > 1e-6), JSON.stringify(open));
    await probes('i1', 'i5');
    await tapControl('meter-mode:A');
    await advance(page, 1.3);
    const b = await read(page, 'amp');
    const mb = await meterNow();
    check('(b) «2,994 mA» in the gap, the meter’s current the LED’s', b.b && plain(mb.text).replace('−', '') === '2,994 mA' && Math.abs(Math.abs(b.meter) / b.led - 1) < 1e-3, JSON.stringify({ b: b.b, text: mb.text, meter: b.meter, led: b.led }));
    await goal('both halves');
    await more();
    // the closing card: three lines, the bridge; «Далі» enabled only if `resistor-pick` is built
    await advance(page, 1);
    const card = await closingCard(page, (s) => advance(page, s));
    check('closing card after the last step: three lines and the bridge', card.shown && card.lines === 3 && card.bridge.length > 0, `${card.lines} lines; «${card.bridge.slice(-40)}»`);
    await snap('closing');
    const built = await page.evaluate(() => window.__app.listChapters('electronics').some((c) => c.id === 'resistor-pick'));
    const go = await page.evaluate(() => {
      const b = document.querySelector('[data-ui="path-next"]');
      return b ? { disabled: b.disabled, tip: b.dataset.tip ?? '' } : null;
    });
    check(
      built ? '«Далі» on the card leads on (resistor-pick is built)' : '«Далі» on the card is disabled with its tip (resistor-pick is not built yet)',
      !!go && (built ? !go.disabled : go.disabled && go.tip.length > 0),
      JSON.stringify(go),
    );
  },
};

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: `${ID}/flash`, freeze: 0 }));
  await page.evaluate(() => window.__app.pause());
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await advance(page, 1);
  step = 'flash';
  const pos = await page.evaluate(() => window.__app.position());
  check('the chapter opens on its first step', pos.chapterId === 'resistor' && pos.stepId === 'flash', `${pos.chapterId}/${pos.stepId}`);
  for (const id of Object.keys(steps)) {
    step = id;
    try {
      await steps[id]();
    } catch (e) {
      check(`script error: ${e.message}`, false);
      await snap(`${id}-error`);
      break;
    }
  }
  step = 'all';
  const errors = (await appErrors(page)).filter((e) => e.level === 'error');
  check('no console errors', errors.length === 0, errors.map((e) => e.message).join(' | ').slice(0, 300));
} catch (e) {
  check(`script error: ${e.message}`, false);
} finally {
  await browser.close();
}
writeFileSync(join(out, `interactions-${tag}.json`), JSON.stringify({ size, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? `PASS ${ID} — ${results.length} checks (${size})`
    : `FAIL ${ID} — ${failed.length} of ${results.length} checks (${size})`,
);
process.exit(failed.length ? 1 : 0);
