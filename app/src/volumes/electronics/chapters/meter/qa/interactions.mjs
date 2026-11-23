#!/usr/bin/env node
/* global process, console, window, document, URL */
// Interaction test of chapter `electronics/meter` (a dev server, a preview or the site profile up), DOM interface:
//
//   node app/src/volumes/electronics/chapters/meter/qa/interactions.mjs --base <url> [--port <p>] --out <dir>
//        [--size 1280x720] [--touch]
//
// The reader's way through the six steps on a frozen engine clock, every goal by real pointer input (a mouse, or a
// finger with --touch: real touch events, the dragged thing riding above it): the multimeter on «V» between the rails,
// «8,980 V», and the other way round, «−8,980 V»; on «A» across the supply after the protection diode the diode burns
// and «Нові деталі» puts the board back, then the supply jumper carried off the board and the meter on «A» in its gap,
// «13,31 mA», the battery's current; the switch closed before the scope's probe is in the rail (its name stands over it),
// opened and closed again with the probe in — the rail's trace flat at 8,98 V, and back at the diode's leak when the
// switch opens; the player started with a tap on its box (a phone: the dock's toggle) and the probe on its row — a
// wave within ±0,35 V while the meter there reads under 1 mV; 20 ms and 1 ms a division; both probes on the
// amplifier's input and its speaker, the knob low, high and in the middle with channel 1 at 0,02 V a division. After
// each goal the panel shows the takeaway and the reader numbers are the model's; «Докладніше» opens; every recall link
// is followed (into a chapter not built yet it leaves the reader where they are, with no console error); every step is
// arrived at with «Далі» and its camera sampled frame by frame for jumps; the closing card has three lines and the
// bridge, and «Далі» on it is enabled only if `resistor` is built. Goal snapshots `<step>-goal-<size>.jpg` in --out;
// the console must stay free of errors. Last line: `PASS electronics/meter — <n> checks (<size>)` or
// `FAIL electronics/meter — <k> of <n> checks (<size>)` (exit 1).
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

const ID = 'electronics/meter';
/** Every step's recall links as the reader sees them (`electronics/<chapter>/<step>` and its title): the generated
 * content of the chapter. */
const RECALLS = Object.fromEntries(
  JSON.parse(readFileSync(new URL('../../../content/generated/meter.json', import.meta.url), 'utf8')).steps.map(
    (s) => [s.id, s.path?.recall ?? []],
  ),
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
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(6)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
  return Boolean(ok);
};
const plain = (s) => (typeof s === 'string' ? s.replace(/\u00a0/g, ' ') : s);
const snap = (name) => screenshot(page, join(out, `${name}-${tag}.jpg`));
/**
 * A tab of the step's sheet in a narrow layout (`text`, `controls` or `board`), picked as a reader picks it: a tap on
 * the shown one of the tab rows (the sheet keeps a copy of the row per page). A no-op where there are no tabs.
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
/** A tap on a slider's track at the fraction `fx` of its range (the slider eases there; the scene takes the value). */
async function slideTo(id, fx) {
  await controls();
  const r = await control(id);
  if (!check(`the slider ${id} is on screen`, !!r)) return;
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await p.tap(x0 + (x1 - x0) * fx, r.y + r.h * 0.18);
  await advance(page, 0.4);
}
/**
 * The crests of `twice` as the panel shows them (`ctl-crests`, a block of two numbers), and whether both numbers stand
 * on screen above the bottom navigation (a phone: the sheet as it opens on the step; review of E3-8).
 */
async function crests() {
  await controls();
  return page.evaluate(() => {
    const shown = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.closest('[hidden]');
    };
    const block = [...document.querySelectorAll('[data-ui="ctl-crests"]')].find(shown);
    const cells = block ? [...block.querySelectorAll('.dk-stat-num')] : [];
    const nav = [...document.querySelectorAll('[data-ui="nav-next"]')].find(shown)?.getBoundingClientRect();
    return {
      texts: cells.map((e) => e.textContent.replace(/\u00a0/g, ' ')),
      seen:
        cells.length === 2 &&
        cells.every((e) => {
          const r = e.getBoundingClientRect();
          return r.height > 0 && r.top >= 0 && r.bottom <= (nav ? nav.top : window.innerHeight);
        }),
    };
  });
}
/** The text a panel's readout shows (`ctl-<id>`). */
async function panelText(id) {
  await controls();
  return plain(await page.evaluate((n) => document.querySelector(`[data-ui="ctl-${n}"] output`)?.textContent ?? null, id));
}

/**
 * Press `grab` and drag so that `thing` (a point on the board's face: a tip, a probe's end) comes to `target` (a socket
 * probe or a screen point), correcting by what is left (the hand keeps its grip and the thing follows it with a little
 * lag; a finger carries the thing above it), then let go and let it arrive. With a socket as the target the drag ends
 * once the hand would put the thing there: a part's preview starts with that socket (leg 0), an end's `near` is it.
 */
async function bring(grab, thing, target, { settleTime = 0.45 } = {}) {
  const g = await scr(grab);
  const socket = typeof target === 'string' && target.startsWith('socket:') ? target.slice('socket:'.length) : null;
  const goal = typeof target === 'string' ? () => scr(target) : async () => target;
  await p.down(g.x, g.y);
  let at = { x: g.x, y: g.y };
  at = { x: at.x, y: at.y - height * 0.02 };
  await p.move(at.x, at.y);
  await page.evaluate(() => window.__app.step(1 / 60, 24));
  const grabbed = await held();
  if (!grabbed) check(`the hand takes ${grab}`, false, JSON.stringify(g));
  const t0 = await goal();
  const e0 = await scr(thing);
  const d = { x: t0.x - e0.x, y: t0.y - e0.y };
  const from = { ...at };
  for (let k = 1; k <= 14; k++) {
    const f = k / 14;
    at = { x: from.x + d.x * f, y: from.y + d.y * f - Math.sin(Math.PI * f) * height * 0.04 };
    await p.move(at.x, at.y);
  }
  // a part: its preview stands where it should; an end clicks in only within SNAP when let go — close enough
  const there = async () => socket !== null && (await read(page, 'electronics-hand')).preview?.[0] === socket;
  for (let k = 0; k < 14; k++) {
    await page.evaluate(() => window.__app.step(1 / 60, 8));
    const e = await scr(thing);
    const t = await goal();
    const left = { x: t.x - e.x, y: t.y - e.y };
    if (thing.startsWith('tip:') ? await there() : Math.hypot(left.x, left.y) < 1.5) break;
    at = { x: at.x + left.x * 0.8, y: at.y + left.y * 0.8 };
    await p.move(at.x, at.y);
  }
  await p.up();
  await advance(page, settleTime);
}
/** What the hand holds now (`probe:red`), null when nothing. */
const held = async () => (await read(page, 'electronics-hand'))?.held ?? null;
/** A screen point off the board, beyond the − rail (a part let go there goes to the tray). */
async function offBoard() {
  const rail = await scr('socket:-9');
  const line = await scr('socket:j9');
  return { x: rail.x + (rail.x - line.x) * 2.5, y: rail.y + (rail.y - line.y) * 2.5 };
}
/** Whether the dock shows a control (a phone's toggles: a tablet's shot has the switch and the player in it). */
async function docked(id) {
  await controls();
  return (await control(id)) !== null;
}
/** The battery's switch: a tap on its slider (a phone: the dock's toggle, the shot leaves the switch out). */
async function flipSwitch() {
  if (touch && (await docked('battery-switch'))) return tapControl('battery-switch');
  const s = await scr('switch');
  await p.tap(s.x, s.y);
  await advance(page, 0.3);
  return true;
}
/** The player: a tap on its box (a phone: the dock's toggle, the shot leaves the player out). */
async function tapPlayer() {
  if (touch && (await docked('player'))) return tapControl('player');
  const s = await scr('player');
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
  check('the step is on screen', pos.chapterId === 'meter' && pos.stepId === id, `${pos.chapterId}/${pos.stepId}`);
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
  return { ...m, text: plain(m.text), panel: await panelText('meter') };
}
/** Both of the meter's probes into sockets (the one standing where the other must go moves first). */
async function probes(red, black) {
  const m = await read(page, 'electronics-meter');
  const order = m.black === red ? ['black', 'red'] : ['red', 'black'];
  for (const name of order) {
    const to = name === 'red' ? red : black;
    if ((await read(page, 'electronics-meter'))[name] === to) continue;
    await bring(`probe:${name}`, `end:${name}`, `socket:${to}`);
  }
  const n = await read(page, 'electronics-meter');
  return check(`the probes in ${red} and ${black}`, n.red === red && n.black === black, `red ${n.red}, black ${n.black}`);
}
/** One of the scope's probes into a socket. */
async function scopeProbe(name, to) {
  await bring(`probe:${name}`, `end:${name}`, `socket:${to}`);
  const s = await read(page, 'electronics-scope');
  return check(`the scope's ${name} in ${to}`, s[name] === to, `${name} ${s[name]}`);
}
/**
 * Follow every recall link of the step on screen (the script's «Згадати», in its order): a link into this chapter or
 * into a built one leads to that step, and «назад» returns; a link into a chapter that is not built yet (the HUD keeps
 * it a button, `nav.open` refuses) leaves the reader on this step, with no new console error.
 */
async function recalls() {
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
      await advance(page, 2);
      const back = await page.evaluate(() => window.__app.position());
      check('«назад» returns to the step', back.chapterId === 'meter' && back.stepId === step, `${back.chapterId}/${back.stepId}`);
    } else {
      const errors = (await appErrors(page)).filter((e) => e.level === 'error');
      check(
        `the recall to ${target} (not built yet) leaves the reader here, no console error`,
        there.chapterId === 'meter' && there.stepId === step && errors.length === errorsBefore,
        `${there.chapterId}/${there.stepId}; ${errors.slice(errorsBefore).map((e) => e.message).join(' | ').slice(0, 200)}`,
      );
    }
  }
}

const steps = {
  async volts() {
    await textTab();
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] button');
    check('no takeaway before the goal', !(await takeaway()));
    await recalls();
    const m0 = await meterNow();
    const s0 = await read(page, 'volts');
    check(
      'on entry: the meter on its place, «вимкнено», «—»; the switch closed, the player stopped',
      m0.shown >= 0.999 && m0.mode === 'off' && m0.text === '—' && m0.panel === '—' && s0.closed === 1 && !s0.playing,
      JSON.stringify({ shown: m0.shown, mode: m0.mode, text: m0.text, panel: m0.panel, s0 }),
    );
    const led = (await read(page, 'electronics-heat')).parts.LED1;
    check('the amplifier’s LED «on» lit, 2,99 mA', led && led.i > 0.0029 && led.i < 0.0031, JSON.stringify(led?.i));
    await snap('volts-start');
    await tapControl('meter-mode:V');
    await probes('+3', '-3');
    await advance(page, 1.3);
    const a = await meterNow();
    check('«8,980 V» between the rails, on the display and in the panel', a.text === '8,980 V' && a.panel === '8,980 V', JSON.stringify({ text: a.text, panel: a.panel }));
    check('no takeaway with one way only', !(await takeaway()));
    await probes('-6', '+6');
    await advance(page, 1.3);
    const b = await meterNow();
    check('«−8,980 V» the other way round', b.text === '−8,980 V' && b.panel === '−8,980 V', JSON.stringify({ text: b.text, panel: b.panel }));
    const s = await read(page, 'volts');
    check('both ways counted', s.counted.length === 2, JSON.stringify(s.counted));
    await goal('both ways');
    await more();
  },
  async amps() {
    await next('amps');
    await recalls();
    const entry = await read(page, 'amps');
    check('on entry: «V», J10 closes the gap (the callout «Перемичка» over it), the LED «on» lit, the battery 13,31 mA', entry.mode === 'V' && entry.gapClosed && entry.supplyIn && entry.led > 0.0029 && Math.abs(entry.battery) > 0.0132, JSON.stringify(entry));
    // the step's own shot: J10's ends and the gap's sockets on screen (the reservoir's can no longer stands before them)
    const seen = [];
    for (const n of ['part:J10', 'socket:+1', 'socket:a1', 'socket:c1']) seen.push([n, (await scr(n)).visible]);
    check('J10 and the gap’s sockets on screen', seen.every(([, v]) => v), JSON.stringify(seen));
    // the interaction check of the bench (not the goal): «A» from the supply after the diode to the − rail burns it
    await tapControl('meter-mode:A');
    await probes('c5', '-8');
    await advance(page, 2.5);
    const heat = await read(page, 'electronics-heat');
    check('«A» across the supply and the − rail: D1 burnt within 2,5 s, one wisp', heat.parts.D1?.condition === 'burnt' && heat.smoke.fired >= 1, JSON.stringify({ D1: heat.parts.D1?.condition, smoke: heat.smoke }));
    await controls();
    check('the dock shows «Нові деталі»', await shown(page, '[data-ui="ctl-fresh"]'));
    await tapControl('fresh');
    await advance(page, 0.5);
    const fresh = await read(page, 'amps');
    const m = await read(page, 'electronics-meter');
    const heat2 = await read(page, 'electronics-heat');
    check(
      'after «Нові деталі»: the entry’s board, nothing burnt, «V», the probes at rest, no button',
      fresh.key === entry.key && !fresh.damaged && m.mode === 'V' && m.red === null && m.black === null &&
        Object.values(heat2.parts).every((x) => x.condition !== 'burnt' && x.condition !== 'bulged') &&
        !(await shown(page, '[data-ui="ctl-fresh"]')),
      JSON.stringify({ key: fresh.key === entry.key, damaged: fresh.damaged, mode: m.mode, red: m.red, black: m.black }),
    );
    // the supply jumper whole off the board (to the tray): the amplifier goes dark; a press on J10 takes it whole, the
    // step takes no end of it (an end let go off the board lay stretched across the board: review of E3-8)
    await bring('part:J10', 'tip:J10:0', await offBoard());
    await advance(page, 0.6);
    const open = await read(page, 'amps');
    const gone = await read(page, 'electronics-board');
    check('the gap open: J10 gone, the LED dark, the battery at rest', !open.gapClosed && !(open.led > 1e-6) && !(Math.abs(open.battery) > 1e-6), JSON.stringify(open));
    check(
      'J10 went to the tray: on the board neither whole nor with an end in the air; the callout gone',
      !('J10' in gone.parts) && !gone.pending.includes('J10') && !open.supplyIn,
      JSON.stringify({ J10: gone.parts.J10 ?? null, pending: gone.pending }),
    );
    await probes('+2', 'a1');
    await tapControl('meter-mode:A');
    await advance(page, 1.4);
    const a = await read(page, 'amps');
    const ma = await meterNow();
    check(
      '«13,31 mA» in the gap, the meter’s current the battery’s, the LED lit again',
      ma.text === '13,31 mA' && ma.panel === '13,31 mA' && Math.abs(Math.abs(a.meter) / Math.abs(a.battery) - 1) < 1e-3 && a.led > 0.0029,
      JSON.stringify({ text: ma.text, panel: ma.panel, meter: a.meter, battery: a.battery, led: a.led }),
    );
    await goal('the current in the gap');
    await more();
  },
  async flat() {
    await next('flat');
    await recalls();
    const s0 = await read(page, 'flat');
    const sc0 = await read(page, 'electronics-scope');
    check('on entry: the switch open, the scope rolling at 0,5 s and 2,5 V a division, its probe at rest', s0.closed === 0 && sc0.display === 'roll' && sc0.timePerDiv === 0.5 && sc0.voltsPerDiv === 2.5 && sc0.ch1 === null && sc0.shown >= 0.999, JSON.stringify({ s0, display: sc0.display, t: sc0.timePerDiv, v: sc0.voltsPerDiv, shown: sc0.shown }));
    // the switch first: a closing without the probe does not count; with the probe in, the step calls the switch
    await flipSwitch();
    await scopeProbe('ch1', '+4');
    await advance(page, 0.6);
    const s1 = await read(page, 'flat');
    check('closed before the probe: not counted, the switch called', s1.closed === 1 && !s1.armed && s1.call, JSON.stringify(s1));
    await flipSwitch();
    await advance(page, 0.6);
    const s2 = await read(page, 'flat');
    check('opened with the probe in: the rail at the diode’s leak, near 0 V', s2.closed === 0 && s2.newest && Math.abs(s2.newest[1]) < 0.05, JSON.stringify(s2.newest));
    await flipSwitch();
    await advance(page, 0.4);
    check('no takeaway right after the closing', !(await takeaway()));
    await advance(page, 2.4);
    const s3 = await read(page, 'flat');
    const sc = await read(page, 'electronics-scope');
    check(
      'closed with the probe in: the trace flat at 8,975 … 8,985 V for 2 s',
      s3.armed && s3.newest && s3.newest[0] >= 8.975 && s3.newest[1] <= 8.985 && sc.max[0] <= 8.99 && sc.max[0] >= 8.975,
      JSON.stringify({ newest: s3.newest, max: sc.max[0], min: sc.min[0] }),
    );
    await goal('the flat line');
    await more();
  },
  async wave() {
    await next('wave');
    await recalls();
    await advance(page, 0.5);
    const m0 = await meterNow();
    check(
      'the meter back on «V», its probes put on the player’s row and the − rail, «0,002 mV»',
      m0.mode === 'V' && m0.red === 'd13' && m0.black === '-14' && Math.abs(m0.value) < 1e-3 && m0.panel === m0.text,
      JSON.stringify({ mode: m0.mode, red: m0.red, black: m0.black, text: m0.text, panel: m0.panel }),
    );
    const s0 = await read(page, 'wave');
    check('on entry the player stopped', !s0.playing, JSON.stringify(s0));
    await tapPlayer();
    const s1 = await read(page, 'wave');
    check('a tap starts the player', s1.playing, JSON.stringify(s1));
    await scopeProbe('ch1', 'a13');
    await advance(page, 1.5);
    check('no takeaway before 3 s', !(await takeaway()));
    await advance(page, 2.3);
    const s2 = await read(page, 'wave');
    const sc = await read(page, 'electronics-scope');
    const m = await meterNow();
    check(
      'the wave on the screen within ±0,35 V, its crest of 2 s at least 0,2 V; the meter under 1 mV',
      s2.reached && s2.crest >= 0.2 && s2.crest <= 0.35 && Math.max(Math.abs(sc.min[0]), Math.abs(sc.max[0])) <= 0.35 && Math.abs(m.value) < 1e-3,
      JSON.stringify({ crest: s2.crest, min: sc.min[0], max: sc.max[0], meter: m.text }),
    );
    await goal('the wave');
    await more();
  },
  async notes() {
    await next('notes');
    await recalls();
    await advance(page, 0.3);
    const s0 = await read(page, 'notes');
    check('on entry: the player plays, the probe put on its row, 5 ms a division', s0.playing && s0.ch1 === 'd13' && s0.timePerDiv === 0.005, JSON.stringify(s0));
    await tapControl('time-div:0.02');
    await advance(page, 3.2);
    const a = await read(page, 'electronics-scope');
    check('20 ms a division: 0,2 s on the screen', a.timePerDiv === 0.02 && Math.abs(a.span - 0.2) < 1e-9, JSON.stringify({ t: a.timePerDiv, span: a.span }));
    await snap('notes-20ms');
    check('no takeaway after one of the two', !(await takeaway()));
    await tapControl('time-div:0.001');
    await advance(page, 3.2);
    const s1 = await read(page, 'notes');
    check('both times a division counted', s1.counted.length === 2 && s1.timePerDiv === 0.001, JSON.stringify(s1));
    await goal('20 ms and 1 ms');
    await more();
  },
  async twice() {
    await next('twice');
    await recalls();
    const s0 = await read(page, 'twice');
    check('on entry: both probes at rest, the knob at 0,5, one scale', s0.ch1 === null && s0.ch2 === null && Math.abs(s0.knob - 0.5) < 1e-9 && !s0.zoomed, JSON.stringify(s0));
    check('«вхід підсилювача» and «динамік» stand over their rows', s0.marks.input && s0.marks.speaker, JSON.stringify(s0.marks));
    const c0 = await crests();
    check('the crests say «—» with the probes out', c0.texts.length === 2 && c0.texts.every((t) => t === '—'), JSON.stringify(c0.texts));
    if (touch) check('on a phone the crests’ numbers show above the bottom navigation, the sheet as it opens', c0.seen, JSON.stringify(c0));
    await scopeProbe('ch1', 'a15');
    await scopeProbe('ch2', 'b10');
    const s1 = await read(page, 'twice');
    check('each name gone with a probe in its row', !s1.marks.input && !s1.marks.speaker, JSON.stringify(s1.marks));
    await slideTo('volume', 0.2);
    await advance(page, 1.3);
    const low = await read(page, 'twice');
    check('the knob low (≤ 0,25) a second: counted', low.knob <= 0.25 && low.low, JSON.stringify(low));
    await slideTo('volume', 0.6);
    await advance(page, 1.3);
    const high = await read(page, 'twice');
    check('the knob high (≥ 0,5) a second: counted', high.knob >= 0.5 && high.high, JSON.stringify(high));
    await slideTo('volume', 0.4);
    const [crestIn = '', crestOut = ''] = (await crests()).texts;
    const cr = (await read(page, 'twice')).crests;
    check(
      'the crests in the panel: the input’s sixteen times or so smaller than the speaker’s',
      /^0,0\d\d V$/.test(crestIn) && /^0,\d\d\d V$/.test(crestOut) && cr[1] / cr[0] > 11 && cr[1] / cr[0] < 20,
      `${crestIn} / ${crestOut}; ratio ${(cr[1] / cr[0]).toFixed(1)}`,
    );
    await tapControl('ch1-scale:0.02');
    await advance(page, 1.3);
    const z = await read(page, 'twice');
    const sc = await read(page, 'electronics-scope');
    check(
      'channel 1 at 0,02 V a division with the knob at 0,4: both lines on the screen; the goal',
      z.zoomed && z.reached && sc.volts[0] === 0.02 && sc.volts[1] === 0.25 && sc.screen[0] && sc.screen[0].max < 1 && sc.screen[1] && sc.screen[1].max < 1,
      JSON.stringify({ z, volts: sc.volts, screen: sc.screen }),
    );
    await sheetTab('board');
    await goal('both probes, the knob and the scale');
    await more();
    // the closing card: three lines, the bridge; «Далі» enabled only if `resistor` is built
    await advance(page, 1);
    const card = await closingCard(page, (s) => advance(page, s));
    check('closing card after the last step: three lines and the bridge', card.shown && card.lines === 3 && card.bridge.length > 0, `${card.lines} lines; «${card.bridge.slice(-50)}»`);
    await snap('closing');
    const built = await page.evaluate(() => window.__app.listChapters('electronics').some((c) => c.id === 'resistor'));
    const go = await page.evaluate(() => {
      const b = document.querySelector('[data-ui="path-next"]');
      return b ? { disabled: b.disabled, tip: b.dataset.tip ?? '' } : null;
    });
    check(
      built ? '«Далі» on the card leads on (resistor is built)' : '«Далі» on the card is disabled with its tip (resistor is not built yet)',
      !!go && (built ? !go.disabled : go.disabled && go.tip.length > 0),
      JSON.stringify(go),
    );
  },
};

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: `${ID}/volts`, freeze: 0 }));
  await page.evaluate(() => window.__app.pause());
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await advance(page, 1);
  step = 'volts';
  const pos = await page.evaluate(() => window.__app.position());
  check('the chapter opens on its first step', pos.chapterId === 'meter' && pos.stepId === 'volts', `${pos.chapterId}/${pos.stepId}`);
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
