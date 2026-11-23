#!/usr/bin/env node
/* global process, console, window, document, URL */
// Interaction test of chapter `electronics/resistor-pick` (a dev server, a preview or the site profile up), DOM
// interface:
//
//   node app/src/volumes/electronics/chapters/resistor-pick/qa/interactions.mjs --base <url> [--port <p>] --out <dir>
//        [--size 1280x720] [--touch]
//
// The reader's way through the six steps on a frozen engine clock, every goal by real pointer input (a mouse, or a
// finger with --touch: real touch events, the dragged thing riding above it): the slider «Глибина» dragged down to the
// resistor's floor `part`, two of its bands picked by a touch on the body and two by the dock's buttons — the table
// fills in and the mark goes to the band picked last; the slider «Номінал» dragged to both ends and held on 360 and
// 330 Ω, the span of the tolerance in the panel; the two nearest values from the tray (a phone: the dock's buttons)
// one at a time in the LED's gap on the ammeter; the 330 Ω beside the LED and then a 1 kΩ, with the panel's voltage,
// power and state; a 100 Ω between the jumpers' ends with the switch closed (a phone: the dock's toggle) — it burns;
// the multimeter on «V» on the amplifier's LED «on» and on its 2,2 kΩ, whose callouts' points sit each on its own part
// and whose LED's tag leaves R1's body free (snapshot `on-entry-<size>.jpg`). After each goal the panel shows the takeaway
// and the reader numbers are the model's; «Докладніше» opens; every recall link of every step is followed (each
// leads into this chapter or into `resistor`, built, and «назад» returns); every step is arrived at with «Далі» and its
// camera sampled frame by frame for jumps; the closing card has three lines and the bridge, and «Далі» on it is
// enabled only if `divider` is built. Goal snapshots `<step>-goal-<size>.jpg` in --out; the console must stay free of
// errors. Last line: `PASS electronics/resistor-pick — <n> checks (<size>)` or `FAIL electronics/resistor-pick — <k>
// of <n> checks (<size>)` (exit 1).
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

const ID = 'electronics/resistor-pick';
const CHAPTER = 'resistor-pick';
/** The volume's floor `part` as the ladder «де ми» names it (`volume.json`). */
const PART = JSON.parse(readFileSync(new URL('../../../volume.json', import.meta.url), 'utf8')).axis.floors.find(
  (f) => f.id === 'part',
).label;
/** The generated content of the chapter: every step's recall links and captions, as the reader sees them. */
const CONTENT = JSON.parse(readFileSync(new URL('../../../content/generated/resistor-pick.json', import.meta.url), 'utf8'));
const RECALLS = Object.fromEntries(CONTENT.steps.map((s) => [s.id, s.path?.recall ?? []]));
const LABELS = Object.fromEntries(CONTENT.steps.map((s) => [s.id, (s.labels ?? []).map((t) => t.replace(/\u00a0/g, ' '))]));
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
  // a control below the fold of a phone's sheet (the dock's row of buttons ends its scroll): the reader scrolls the
  // panel until it shows — here the control scrolled into view, then touched where it is
  const hidden = await page.evaluate((n) => {
    const el = document.querySelector(`[data-ui="ctl-${n}"]`);
    if (!el) return false;
    const b = el.getBoundingClientRect();
    const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    if (top && el.contains(top)) return false;
    el.scrollIntoView({ block: 'center' });
    return true;
  }, id);
  if (hidden) await advance(page, 0.3);
  const r = await control(id);
  if (!check(`the control ${id} is on screen`, !!r, JSON.stringify(r && { w: Math.round(r.w), h: Math.round(r.h) })))
    return false;
  await p.tap(r.x, r.y);
  await advance(page, 0.3);
  return true;
}
/** A dock button (`ctl-<id>`) is greyed out. */
const disabled = (id) =>
  page.evaluate((n) => document.querySelector(`[data-ui="ctl-${n}"]`)?.disabled ?? null, id);
/** The text a panel readout shows (`ctl-<id>`), as the reader sees it. */
async function panel(id) {
  await controls();
  return plain(await page.evaluate((n) => document.querySelector(`[data-ui="ctl-${n}"] output`)?.textContent ?? null, id));
}

/**
 * Press `grab` and drag so that `thing` (a point on the board's face: a tip, a probe's end) comes to `target` (a socket
 * probe or a screen point), correcting by what is left (the hand keeps its grip and the thing follows it with a little
 * lag; a finger carries the thing above it), then let go and let it arrive. With a socket as the target the drag ends
 * once the hand would put the thing there: a part's preview starts with that socket (leg 0), an end's `near` is it.
 * `thing` may be a function of what the hand holds after the press (a new part from the tray gets its id then).
 */
async function bring(grab, thing, target, { settleTime = 0.45 } = {}) {
  const g = typeof grab === 'string' ? await scr(grab) : grab;
  const socket = typeof target === 'string' && target.startsWith('socket:') ? target.slice('socket:'.length) : null;
  const goal = typeof target === 'string' ? () => scr(target) : async () => target;
  await p.down(g.x, g.y);
  let at = { x: g.x, y: g.y };
  // a small first move lifts the thing (a part from the tray gets its id and takes the board's tilt on its way)
  at = { x: at.x, y: at.y - height * 0.02 };
  await p.move(at.x, at.y);
  await page.evaluate(() => window.__app.step(1 / 60, 24));
  const grabbed = await held();
  if (!grabbed && typeof grab === 'string' && !grab.startsWith('part:'))
    check(`the hand takes ${grab}`, false, JSON.stringify(g));
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
/** A part off the board, to the tray; checks it left. */
async function toTray(id) {
  await bring(`part:${id}`, `tip:${id}:0`, await offBoard());
  await advance(page, 0.6);
  const b = await read(page, 'electronics-board');
  return check(`${id} gone from the board`, !(id in b.parts), Object.keys(b.parts).join(' '));
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
async function next(id, settle = 0) {
  step = id;
  await press(page, '[data-ui="nav-next"]');
  const s = await strides(page, 'motion', 2.2);
  check('on the way in the camera does not jump', s.camera <= CAMERA_STRIDE, `largest step ${s.camera?.toFixed(3)}`);
  if (settle > 0) {
    // the rest of the way in (the magnifier's rail home, then the step's own shot), sampled too
    const r = await strides(page, 'motion', settle);
    check('the rest of the way in does not jump either', r.camera <= CAMERA_STRIDE, `largest step ${r.camera?.toFixed(3)}`);
  }
  const pos = await page.evaluate(() => window.__app.position());
  check('the step is on screen', pos.chapterId === CHAPTER && pos.stepId === id, `${pos.chapterId}/${pos.stepId}`);
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
  return { ...m, text: plain(m.text), panel: await panel('meter') };
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
/**
 * A slider (`ctl-<id>`) dragged by its thumb until `value()` says `want` (the slider's stops make the drag land on a
 * value; a press on the track jumps there first, then the pointer corrects by what is left), then let go. `to` is the
 * first guess as a share of the track (0 … 1; beyond the ends holds the end).
 */
async function slideTo(id, value, want, to) {
  await controls();
  const r = await page.evaluate((n) => {
    const el = document.querySelector(`[data-ui="ctl-${n}"] input[type=range]`);
    const b = el?.getBoundingClientRect();
    return b ? { x: b.x, y: b.y + b.height / 2, w: b.width } : null;
  }, id);
  if (!check(`the slider ${id} is on screen`, !!r)) return false;
  // the thumb's middle runs from about half a thumb inside each end of the input
  const xAt = (t) => r.x + 11 + Math.min(Math.max(t, 0), 1) * (r.w - 22);
  let x = xAt(to);
  await p.down(x, r.y);
  for (let k = 0; k < 24; k++) {
    await advance(page, 0.05);
    const v = await value();
    if (v === want) break;
    // one track share per value step on the log scale is not known here: a fixed nudge toward it
    const dir = Math.log(want / v) > 0 ? 1 : -1;
    x += dir * Math.max(1, r.w / 120);
    await p.move(x, r.y);
  }
  await p.up();
  await advance(page, 0.2);
  const v = await value();
  return check(`the slider ${id} stands on ${want}`, v === want, String(v));
}
/**
 * Follow every recall link of the step on screen (the script's «Згадати», in its order): a link into this chapter or
 * into a built one leads to that step, and «назад» returns; a link into a chapter that is not built yet (the HUD keeps
 * it a button, `nav.open` refuses) leaves the reader on this step, with no new console error.
 */
async function recalls(back = 2) {
  const list = RECALLS[step] ?? [];
  await textTab();
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('[data-ui="path-recall"]')].filter((b) => !b.closest('[hidden]')).map((b) => b.textContent),
  );
  check('every «Згадайте» link of the step is shown', links.length === list.length, links.join(' | '));
  const built = new Set(
    await page.evaluate(() => window.__app.listChapters('electronics').map((c) => `electronics/${c.id}`)),
  );
  for (const { target, title } of list) {
    await textTab();
    const errorsBefore = (await appErrors(page)).filter((e) => e.level === 'error').length;
    const i = await page.evaluate((t) => {
      const all = [...document.querySelectorAll('[data-ui="path-recall"]')].filter((b) => !b.closest('[hidden]'));
      const k = all.findIndex((b) => b.textContent.includes(t));
      if (k >= 0) all[k].click();
      return k;
    }, title);
    if (!check(`the recall to ${target} is there`, i >= 0, title)) continue;
    await advance(page, 1.5);
    const there = await page.evaluate(() => window.__app.position());
    const [, chapter, stepId] = target.split('/');
    if (built.has(`electronics/${chapter}`)) {
      check(`the recall leads to ${target}`, there.chapterId === chapter && there.stepId === stepId, `${there.chapterId}/${there.stepId}`);
      await press(page, '[data-ui="path-back"]');
      await advance(page, back);
      const pos = await page.evaluate(() => window.__app.position());
      check('«назад» returns to the step', pos.chapterId === CHAPTER && pos.stepId === step, `${pos.chapterId}/${pos.stepId}`);
    } else {
      const errors = (await appErrors(page)).filter((e) => e.level === 'error');
      check(
        `the recall to ${target} (not built yet) leaves the reader here, no console error`,
        there.chapterId === CHAPTER && there.stepId === step && errors.length === errorsBefore,
        `${there.chapterId}/${there.stepId}; ${errors.slice(errorsBefore).map((e) => e.message).join(' | ').slice(0, 200)}`,
      );
    }
  }
}
/** The rows of the dock's table as the reader sees them, and the highlighted one. */
async function tableNow() {
  await controls();
  return page.evaluate(() => {
    const t = document.querySelector('[data-ui="ctl-band-table"] tbody');
    if (!t) return null;
    const rows = [...t.children].map((tr) => [...tr.children].map((td) => td.textContent.replace(/\u00a0/g, ' ')));
    const lit = [...t.children].findIndex((tr) => tr.getAttribute('aria-current') === 'true');
    return { rows, lit };
  });
}

const steps = {
  async bands() {
    await textTab();
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] button');
    check('no takeaway before the goal', !(await takeaway()));
    await recalls();
    // back on the chapter's first step from another chapter: its opening card again
    await textTab();
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] button');
    const s0 = await read(page, 'bands');
    const b0 = await read(page, 'electronics-board');
    check(
      'on entry: the board’s shot, the LED’s loop with the 330 Ω, the switch open, nothing picked',
      s0.floor === null && s0.closed === 0 && s0.seen.length === 0 && b0.parts.R1?.spec === 'resistor-330' &&
        JSON.stringify(s0.bands) === JSON.stringify(['orange', 'orange', 'brown', 'gold']),
      JSON.stringify({ s0, R1: b0.parts.R1 }),
    );
    await controls();
    check('off the floor `part` the band buttons are grey', (await disabled('band-0')) === true && (await disabled('band-3')) === true);
    const t0 = await tableNow();
    check('the table: four rows, «—» before a band is picked, none lit', t0?.rows.length === 4 && t0.rows.every((r) => r[1] === '—' && r[2] === '—') && t0.lit === -1, JSON.stringify(t0));
    await snap('bands-start');
    // the slider dragged to its end by the pointer: the lens onto the resistor, the camera down to the floor `part`
    const r = await control('depth');
    if (check('the slider «Глибина» is on screen', !!r)) {
      const y = r.y + r.h * 0.18;
      const x0 = r.x - r.w / 2 + r.w * 0.04;
      const x1 = r.x + r.w / 2 - r.w * 0.04;
      const end = x1 + r.w * 0.08;
      const pts = Array.from({ length: 31 }, (_, k) => ({ x: x0 + ((end - x0) * k) / 30, y }));
      await p.path(pts, 3);
      await advance(page, 2.5);
    }
    const s1 = await read(page, 'bands');
    const dive = await read(page, 'electronics-dive');
    check('down on the floor `part`, the resistor whole (no cut)', s1.floor === 'part' && s1.atPart && dive.cut === 0 && !dive.open, JSON.stringify({ floor: s1.floor, position: s1.position, cut: dive.cut }));
    const a = await scr('dive:end0');
    const b = await scr('dive:end1');
    // VISUAL §7: on the floor `part` the body takes ≥ 35 % of the safe frame's width (3 : 2 within the page)
    check('the resistor large: its body ≥ 35 % of the safe frame’s width', Math.abs(b.x - a.x) >= 0.35 * Math.min(width, height * 1.5), `${Math.round(Math.abs(b.x - a.x))} px`);
    const ladder = await page.evaluate(
      () => document.querySelector('[data-ui="floor-ladder"] [aria-current="location"]')?.textContent ?? null,
    );
    if (!touch) check('the ladder «де ми» marks the floor «деталь»', ladder === PART, String(ladder));
    check('on the floor `part` the band buttons work', (await disabled('band-0')) === false);
    // two bands by a touch on the body: the first and the gold one
    for (const i of [0, 3]) {
      const at = await scr(`band:${i}`);
      await p.tap(at.x, at.y);
      await advance(page, 0.3);
      const s = await read(page, 'bands');
      check(`a touch on band ${i} picks it, the mark on it`, s.seen.includes(i) && s.last === i && s.marked === i, JSON.stringify({ seen: s.seen, last: s.last, marked: s.marked }));
    }
    // the other two by the dock's buttons
    for (const i of [1, 2]) {
      await tapControl(`band-${i}`);
      const s = await read(page, 'bands');
      check(`the button of band ${i} picks it, the mark on it`, s.seen.includes(i) && s.last === i && s.marked === i, JSON.stringify({ seen: s.seen, last: s.last }));
    }
    const words = LABELS.bands;
    const t1 = await tableNow();
    check(
      'the table: 3 · 3 · 1 · 5 % with the colours’ names, the row of the band picked last lit',
      JSON.stringify(t1?.rows) ===
        JSON.stringify([
          [words[6], words[10], '3'],
          [words[7], words[10], '3'],
          [words[8], words[11], '1'],
          [words[9], words[12], '5 %'],
        ]) && t1.lit === 2,
      JSON.stringify(t1),
    );
    await goal('every band picked');
    await more();
  },
  async series() {
    await next('series');
    await advance(page, 0.5);
    const s0 = await read(page, 'series');
    // the span's words «від» and «до» are the step's captions
    const span = (lo, hi) => `${LABELS.series[2]} ${lo} Ω ${LABELS.series[3]} ${hi} Ω`;
    check(
      'on entry: the camera stays on the floor `part`, 330 Ω, the span 313,5 … 346,5 Ω',
      s0.floor === 'part' && s0.value === 330 && plain(s0.tolerance) === span('313,5', '346,5') && (await panel('tolerance')) === span('313,5', '346,5'),
      JSON.stringify(s0),
    );
    await recalls(3);
    await advance(page, 2.5);
    const s1 = await read(page, 'series');
    check('back on the floor `part` after the recall', s1.floor === 'part', JSON.stringify({ floor: s1.floor, position: s1.position }));
    const value = async () => (await read(page, 'series')).value;
    await slideTo('value', value, 100, -0.05);
    let b = await read(page, 'electronics-board');
    check('100 Ω: a 100 Ω in R1’s sockets, the span 95 … 105 Ω', b.parts.R1?.spec === 'resistor-100' && JSON.stringify(b.parts.R1.legs) === JSON.stringify(['b5', 'b9']) && (await panel('tolerance')) === span('95', '105'), JSON.stringify({ R1: b.parts.R1, tol: await panel('tolerance') }));
    await slideTo('value', value, 1000, 1.05);
    b = await read(page, 'electronics-board');
    check('1 kΩ: a 1 kΩ in R1’s sockets', b.parts.R1?.spec === 'resistor-1k', JSON.stringify(b.parts.R1));
    await slideTo('value', value, 360, Math.log10(3.6));
    await advance(page, 1.2);
    check('360 Ω: the span 342 … 378 Ω', (await panel('tolerance')) === span('342', '378'), await panel('tolerance'));
    await slideTo('value', value, 330, Math.log10(3.3));
    await advance(page, 1.2);
    const s2 = await read(page, 'series');
    check('both ends seen and both values held, on the floor `part`', s2.ends.length === 2 && s2.counted.length === 2 && s2.floor === 'part', JSON.stringify(s2));
    await goal('the series run through');
  },
  async calc() {
    await next('calc', 2.5);
    await recalls();
    await advance(page, 0.5);
    const m0 = await meterNow();
    check('the meter on «A», the probes put in e10 and −10, «0,000 A»', m0.mode === 'A' && m0.red === 'e10' && m0.black === '-10' && m0.text === '0,000 A' && m0.panel === '0,000 A', JSON.stringify(m0));
    const want = { 'resistor-330': '21,24 mA', 'resistor-360': '19,51 mA' };
    for (const [spec, text] of Object.entries(want)) {
      const id = await fromTray(spec, 'd5');
      await advance(page, 1.3);
      const m = await meterNow();
      const c = await read(page, 'calc');
      check(`${spec} alone in the gap, the LED whole: «${text}»`, m.text === text && m.panel === text && c.led !== null, JSON.stringify({ id, text: m.text, panel: m.panel, led: c.led }));
      if (id) await toTray(id);
    }
    await goal('both nearest values');
    await controls();
    check('the formula card comes with the takeaway', await shown(page, '[data-ui="ctl-led-formula"]'));
    const rich = plain(await page.evaluate(() => document.querySelector('[data-ui="ctl-led-formula"]')?.textContent ?? ''));
    check('the card reads «R = (U − U_LED) / I»', rich.includes('R = (U − ULED) / I'), rich);
  },
  async power() {
    await next('power');
    await recalls();
    await advance(page, 1);
    const w = LABELS.power;
    const at330 = { meter: await meterNow(), volts: await panel('r-volts'), watts: await panel('r-power'), state: await panel('r-state') };
    check(
      'the 330 Ω: «21,24 mA», «7,008 V», «0,149 W», warm',
      at330.meter.text === '21,24 mA' && at330.volts === '7,008 V' && at330.watts === '0,149 W' && at330.state === w[5],
      JSON.stringify({ ...at330, meter: at330.meter.text }),
    );
    await advance(page, 2);
    check('2 s with the 330 Ω counted', (await read(page, 'power')).counted.includes('resistor-330'));
    await toTray('R1');
    check('no resistor in the gap: the readouts «—»', (await panel('r-volts')) === '—' && (await panel('r-power')) === '—' && (await panel('r-state')) === '—');
    await fromTray('resistor-1k', 'd5');
    await advance(page, 2.3);
    const at1k = { meter: await meterNow(), volts: await panel('r-volts'), watts: await panel('r-power'), state: await panel('r-state') };
    check(
      'the 1 kΩ: «7,169 mA», «7,169 V», «0,051 W», cold',
      at1k.meter.text === '7,169 mA' && at1k.volts === '7,169 V' && at1k.watts === '0,051 W' && at1k.state === w[4],
      JSON.stringify({ ...at1k, meter: at1k.meter.text }),
    );
    await goal('the warm 330 Ω and the cold 1 kΩ');
    await controls();
    check('the formula card comes with the takeaway', await shown(page, '[data-ui="ctl-power-formula"]'));
    const rich = plain(await page.evaluate(() => document.querySelector('[data-ui="ctl-power-formula"]')?.textContent ?? ''));
    check('the card reads «P = U × I»', rich.includes('P = U × I'), rich);
    await more();
  },
  async burn() {
    await next('burn');
    await recalls();
    const w = LABELS.burn;
    const s0 = await read(page, 'burn');
    check('on entry: no resistor between the jumpers, the switch open, «—»', s0.id === null && s0.closed === 0 && (await panel('r-power')) === '—', JSON.stringify(s0));
    const id = await fromTray('resistor-100', 'c9');
    const s1 = await read(page, 'burn');
    check('the 100 Ω in 9ae/13ae; the switch open: «0,000 W», cold', s1.id === id && (await panel('r-power')) === '0,000 W' && (await panel('r-state')) === w[2], JSON.stringify(s1));
    await flipSwitch();
    const s2 = await read(page, 'burn');
    check('the switch closed: «0,786 W», hot at once', s2.closed === 1 && (await panel('r-power')) === '0,786 W' && (await panel('r-state')) === w[4], JSON.stringify(s2));
    check('no takeaway before the burn', !(await takeaway()));
    await advance(page, 4.2);
    const heat = await read(page, 'electronics-heat');
    check(
      'it burnt at ≈ 3,8 s (the model told it, one wisp); «0,000 W», the state’s word for burnt',
      heat.parts[id]?.condition === 'burnt' && heat.burns.some((b) => b.id === id) && heat.smoke.fired >= 1 &&
        (await panel('r-power')) === '0,000 W' && (await panel('r-state')) === w[5],
      JSON.stringify({ c: heat.parts[id]?.condition, burns: heat.burns, smoke: heat.smoke }),
    );
    await advance(page, 1.2);
    await goal('the 100 Ω burnt, 1 s after');
    await more();
  },
  async on() {
    await next('on');
    await recalls();
    const s0 = await read(page, 'on');
    const m0 = await meterNow();
    check('on entry: the meter off, «—», the LED «on» lit at ≈ 3 mA', m0.mode === 'off' && m0.text === '—' && s0.led > 0.0029 && s0.led < 0.0031, JSON.stringify({ mode: m0.mode, text: m0.text, led: s0.led }));
    // the two callouts: each point on its own part (the first body a ray from the eye through it meets), the LED's tag
    // over none of R1's body (its axis, end to end) and R1's tag off the LED's point
    await textTab();
    check('on entry: each callout’s point on its own part', s0.dots?.led === 'LED1' && s0.dots?.res === 'R1', JSON.stringify(s0.dots));
    const tags = await page.evaluate(() => [0, 1].map((i) => window.__ui.locate(`callout-${i}`)));
    const r1 = [await scr('on:r1-0'), await scr('on:r1-1')];
    const ledDot = await scr('on:led');
    const inTag = (r, q) => q.x > r.x - r.w / 2 && q.x < r.x + r.w / 2 && q.y > r.y - r.h / 2 && q.y < r.y + r.h / 2;
    const body = Array.from({ length: 11 }, (_, i) => ({ x: r1[0].x + ((r1[1].x - r1[0].x) * i) / 10, y: r1[0].y + ((r1[1].y - r1[0].y) * i) / 10 }));
    const round = (r) => r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
    check(
      'on entry: the LED’s tag leaves R1’s body free, R1’s tag the LED’s point',
      !!tags[0] && !!tags[1] && !body.some((q) => inTag(tags[0], q)) && !inTag(tags[1], ledDot),
      JSON.stringify({ tags: tags.map(round), r1: r1.map((q) => [Math.round(q.x), Math.round(q.y)]), led: [Math.round(ledDot.x), Math.round(ledDot.y)] }),
    );
    await snap('on-entry');
    await controls();
    check('the dial has no «A»', !(await shown(page, '[data-ui="ctl-meter-mode:A"]')) && (await shown(page, '[data-ui="ctl-meter-mode:V"]')));
    await tapControl('meter-mode:V');
    const want = [
      ['g5', '-4', '1,750 V', 'led'],
      ['e5', 'g5', '6,587 V', 'res'],
    ];
    for (const [red, black, text, key] of want) {
      await probes(red, black);
      await advance(page, 1.3);
      const m = await meterNow();
      const s = await read(page, 'on');
      check(`«${text}» between ${red} and ${black}, counted`, m.text === text && m.panel === text && s.counted.includes(key), JSON.stringify({ text: m.text, panel: m.panel, counted: s.counted }));
    }
    await goal('both voltages');
    await more();
    // the closing card: three lines, the bridge; «Далі» enabled only if `divider` is built
    await advance(page, 1);
    const card = await closingCard(page, (s) => advance(page, s));
    check('closing card after the last step: three lines and the bridge', card.shown && card.lines === 3 && card.bridge.length > 0, `${card.lines} lines; «${card.bridge.slice(-40)}»`);
    await snap('closing');
    const built = await page.evaluate(() => window.__app.listChapters('electronics').some((c) => c.id === 'divider'));
    const go = await page.evaluate(() => {
      const b = document.querySelector('[data-ui="path-next"]');
      return b ? { disabled: b.disabled, tip: b.dataset.tip ?? '' } : null;
    });
    check(
      built ? '«Далі» on the card leads on (divider is built)' : '«Далі» on the card is disabled with its tip (divider is not built yet)',
      !!go && (built ? !go.disabled : go.disabled && go.tip.length > 0),
      JSON.stringify(go),
    );
  },
};

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: `${ID}/bands`, freeze: 0 }));
  await page.evaluate(() => window.__app.pause());
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await advance(page, 1);
  step = 'bands';
  const pos = await page.evaluate(() => window.__app.position());
  check('the chapter opens on its first step', pos.chapterId === CHAPTER && pos.stepId === 'bands', `${pos.chapterId}/${pos.stepId}`);
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
