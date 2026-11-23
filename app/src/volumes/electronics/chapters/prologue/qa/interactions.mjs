#!/usr/bin/env node
/* global process, console, window, document, URL, getComputedStyle */
// Interaction test of chapter `electronics/prologue` (a dev server, a preview or the site profile up), DOM interface:
//
//   node app/src/volumes/electronics/chapters/prologue/qa/interactions.mjs --base <url> [--port <p>] --out <dir>
//        [--size 1280x720] [--touch]
//
// The reader's way through the five steps on a frozen engine clock, every goal by real pointer input (a mouse, or a
// finger with --touch: real touch events, the carried part riding above it): a tap on the player's box plays the
// melody straight on the speaker past the amplifier — the bar «Хвиля на динаміку» at 0,05 … 0,06 V for 3 s; the
// switch closed (a phone: the dock's toggle) — the closing's knock on the bar, then the music at the knob's 0,1, the
// knob to 0,85 — the battery's 13,31 mA, the bar over 1,26 V; the LED «on» held out of the board 1,7 s and let go
// over it (its light goes, the music plays on), then the volume knob P1 — the speaker silent — let go off the board
// and put straight back by the step; D2 not taken; the scope's probe 2 s each on the + rail, the player's row and the
// speaker's (a flat line at 8,9 V, ±0,3 V, a wave reaching 0,79 V); three stops of the map. After each goal the panel
// shows the takeaway and the reader numbers are the model's; «Докладніше» opens; every recall link is followed;
// every step is arrived at with «Далі» and its camera sampled frame by frame for jumps; the closing card has the bridge
// and «Далі» on it leads on when `meter` is built. Then a live page (the real clock, no `?freeze`): the model in time
// runs in its background thread (`mode` `worker`, plan decision 12 of batch E3) and every request of the page
// answers below 400; and, without `?noaudio`, a tap on the player is the engine's first gesture — the volume's sound
// runs and the line «Звук вимкнено…» goes. Goal snapshots `<step>-goal-<size>.jpg` in --out; the console must stay
// free of errors. Last line: `PASS electronics/prologue — <n> checks (<size>)` or
// `FAIL electronics/prologue — <k> of <n> checks (<size>)` (exit 1).
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

const ID = 'electronics/prologue';
/** Every step's recall links as the reader sees them (`electronics/<chapter>/<step>` and its title): the generated
 * content of the chapter. */
const RECALLS = Object.fromEntries(
  JSON.parse(readFileSync(new URL('../../../content/generated/prologue.json', import.meta.url), 'utf8')).steps.map(
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
const { browser, context, page } = await launch({ width, height, dpr: touch ? 3 : 1, touch });
const results = [];
let step = 'boot';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(6)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
  return Boolean(ok);
};
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
/** The bar «Хвиля на динаміку» as the panel shows it: its number and whether the line «Звук вимкнено…» shows. */
async function wave() {
  await controls();
  return page.evaluate(() => {
    const on = (e) => !!e && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0;
    const bar = [...document.querySelectorAll('[data-ui="ctl-wave"]')].find(on);
    const note = [...document.querySelectorAll('[data-ui="ctl-sound-off"]')].find(on);
    return {
      text: bar?.querySelector('output')?.textContent?.replace(/\u00a0/g, ' ') ?? null,
      t: bar ? Number(getComputedStyle(bar.querySelector('.dk-lbar')).getPropertyValue('--t')) : null,
      note: !!note,
    };
  });
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
/** What the hand holds now (`part:LED1`), null when nothing. */
const held = async () => (await read(page, 'electronics-hand'))?.held ?? null;
/** A screen point off the board, beyond the − rail (a part let go there leaves the board). */
async function offBoard() {
  const rail = await scr('socket:-9');
  const line = await scr('socket:j9');
  return { x: rail.x + (rail.x - line.x) * 2.5, y: rail.y + (rail.y - line.y) * 2.5 };
}
/**
 * Take a part of the board whole and hold it up for `seconds` (out of the circuit), reading the step's numbers while
 * it is held; then let it go where `drop` says — `back` over the board where it was (the hand takes it back to its
 * sockets) or `off` the board (the bench takes it off, the step puts it straight back).
 */
async function holdOut(id, seconds, drop) {
  const g = await scr(`part:${id}`);
  await p.down(g.x, g.y);
  const up = { x: g.x, y: g.y - height * 0.08 };
  for (let k = 1; k <= 8; k++) await p.move(g.x, g.y + (up.y - g.y) * (k / 8));
  const taken = await held();
  await advance(page, seconds);
  const during = { stand: await read(page, 'stand'), heat: (await read(page, 'electronics-heat')).parts[id] ?? null, taken };
  const to = drop === 'off' ? await offBoard() : g;
  for (let k = 1; k <= 10; k++) await p.move(up.x + (to.x - up.x) * (k / 10), up.y + (to.y - up.y) * (k / 10));
  await p.up();
  await advance(page, 0.6);
  return during;
}
/** The player: a tap on its box in the scene (every device: the step's one gesture). */
async function tapPlayer() {
  const s = await scr('player');
  check('the player’s box is on screen', s.visible, JSON.stringify(s));
  await p.tap(s.x, s.y);
  await advance(page, 0.3);
}
/** «Далі»: the next step, as a reader goes on; then the camera is sampled for jumps on the way in. */
async function next(id) {
  step = id;
  await press(page, '[data-ui="nav-next"]');
  const s = await strides(page, 'motion', 2.2);
  check('on the way in the camera does not jump', s.camera <= CAMERA_STRIDE, `largest step ${s.camera?.toFixed(3)}`);
  const pos = await page.evaluate(() => window.__app.position());
  check('the step is on screen', pos.chapterId === 'prologue' && pos.stepId === id, `${pos.chapterId}/${pos.stepId}`);
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
/** One of the scope's probes into a socket. */
async function scopeProbe(name, to) {
  await bring(`probe:${name}`, `end:${name}`, `socket:${to}`);
  const s = await read(page, 'electronics-scope');
  return check(`the scope's ${name} in ${to}`, s[name] === to, `${name} ${s[name]}`);
}
/**
 * Follow every recall link of the step on screen (the script's «Згадати», in its order): a link into this chapter leads
 * to that step, and «назад» returns.
 */
async function recalls() {
  const list = RECALLS[step] ?? [];
  await textTab();
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('[data-ui="path-recall"]')].filter((b) => !b.closest('[hidden]')).map((b) => b.textContent),
  );
  check('every «Згадайте» link of the step is shown', links.length === list.length, links.join(' | '));
  for (const { target, title } of list) {
    await textTab();
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
    check(`the recall leads to ${target}`, there.chapterId === chapter && there.stepId === stepId, `${there.chapterId}/${there.stepId}`);
    await press(page, '[data-ui="path-back"]');
    await advance(page, 2);
    // back on a chapter's first step whose goal is not reached yet, the panel opens on the chapter's opening card
    // again (the platform's `step-panel.ts`): the reader goes on to the step as at the start
    await textTab();
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] button');
    const back = await page.evaluate(() => window.__app.position());
    check('«назад» returns to the step', back.chapterId === 'prologue' && back.stepId === step, `${back.chapterId}/${back.stepId}`);
  }
}

const steps = {
  async quiet() {
    await textTab();
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] button');
    check('no takeaway before the goal', !(await takeaway()));
    await recalls();
    const s0 = await read(page, 'quiet');
    const w0 = await wave();
    check(
      'on entry: the player stands, its plugs past the amplifier, the switch open; the player called; «0,00 V»',
      !s0.playing && s0.past && s0.closed === 0 && s0.call === 'player' && w0.text === '0,00 V',
      JSON.stringify({ s0, w0 }),
    );
    check('the sound is off (no audio on a check’s page): the line says so', s0.soundOff && w0.note, JSON.stringify(w0));
    const led = (await read(page, 'electronics-model')).parts.LED1;
    check('the amplifier dark: its LED «on» takes no current', led && Math.abs(led.i) < 1e-9, JSON.stringify(led));
    await snap('quiet-start');
    await tapPlayer();
    const s1 = await read(page, 'quiet');
    check('a tap starts the player; the call is over', s1.playing && s1.taps === 1 && s1.call === null, JSON.stringify(s1));
    await advance(page, 1.6);
    check('no takeaway before 3 s', !(await takeaway()));
    await advance(page, 2);
    const s2 = await read(page, 'quiet');
    const w2 = await wave();
    check(
      'the player straight on the speaker 3 s: its crest 0,05 … 0,06 V, the bar the same, barely moved',
      s2.reached && s2.runCrest >= 0.05 && s2.runCrest <= 0.06 && /^0,0[3-6] V$/.test(w2.text) && w2.t < 0.02,
      JSON.stringify({ runCrest: s2.runCrest, crest: s2.crest, w2 }),
    );
    await goal('the whisper');
    await more();
  },
  async loud() {
    await next('loud');
    await recalls();
    const s0 = await read(page, 'loud');
    check(
      'on entry: the plugs on the amplifier, the player plays, the switch open, the knob at 0,1 — silence',
      s0.playing && s0.closed === 0 && Math.abs(s0.knob - 0.1) < 1e-9 && s0.battery < 1e-9 && s0.crest < 1e-4,
      JSON.stringify(s0),
    );
    const board = await read(page, 'electronics-board');
    check('pl+ on c13 (the knob’s top), spk+ on c10 (after the output capacitor)', board.leads['pl+'] === 'c13' && board.leads['spk+'] === 'c10', JSON.stringify(board.leads));
    // the switch: a bare tap (no settling), then the bar frame by frame — the closing's knock lasts a moment
    await controls();
    const toggle = touch ? await control('battery-switch') : null;
    const sw = toggle ?? (await scr('switch'));
    await p.down(sw.x, sw.y);
    await p.up();
    let knock = 0;
    for (let k = 0; k < 40; k++) {
      await page.evaluate(() => window.__app.step(1 / 60, 1));
      knock = Math.max(knock, (await read(page, 'loud')).crest);
    }
    const closed = (await read(page, 'loud')).closed;
    check('the switch closed: the closing’s knock on the bar (≈ 3,5 V)', closed === 1 && knock > 3 && knock < 4, JSON.stringify({ closed, knock }));
    await advance(page, 1.2);
    const low = await read(page, 'loud');
    check(
      'a second on: the battery 13,31 mA, the LED «on» 2,99 mA; the music at 0,1 up to 0,30 V',
      Math.abs(low.battery - 0.01331) < 2e-4 && Math.abs(low.led - 0.00299) < 1e-4 && low.crest > 0.15 && low.crest <= 0.31,
      JSON.stringify(low),
    );
    check('no takeaway with the knob low', !(await takeaway()));
    await slideTo('volume', 0.85);
    await advance(page, 1.4);
    const high = await read(page, 'loud');
    const w = await wave();
    check(
      'the knob at 0,85 a second: the goal; the bar between 1,26 and 2,3 V',
      high.reached && high.knob >= 0.8 && high.crest > 1.26 && high.crest < 2.3 && /^[12],\d\d V$/.test(w.text),
      JSON.stringify({ knob: high.knob, crest: high.crest, w }),
    );
    await goal('loud music');
    await more();
  },
  async stand() {
    await next('stand');
    await recalls();
    await advance(page, 1);
    const s0 = await read(page, 'stand');
    const h0 = await read(page, 'electronics-heat');
    const potLegs = (await read(page, 'electronics-board')).parts.P1?.legs.join();
    check(
      'on entry: the amplifier plays (0,6 … 1 V on the bar), the LED «on» lit, no call',
      s0.crest > 0.6 && s0.crest < 1 && h0.parts.LED1?.light > 0.1 && s0.call === null && s0.whole,
      JSON.stringify({ crest: s0.crest, light: h0.parts.LED1?.light, call: s0.call, whole: s0.whole }),
    );
    // the bias diodes are not the hand's
    const d2 = await scr('part:D2');
    await p.down(d2.x, d2.y);
    await p.move(d2.x, d2.y - height * 0.05);
    const tookD2 = await held();
    await p.move(d2.x, d2.y);
    await p.up();
    await advance(page, 1.4);
    // a finger on D2 may find a part beside it, which then goes back where it was
    const d2Legs = (await read(page, 'electronics-board')).parts.D2?.legs ?? [];
    check('D2 is not taken', tookD2 !== 'part:D2' && d2Legs.length === 2 && d2Legs.every((l) => l !== null), String(tookD2));
    check('whatever was pressed is back: the board the entry’s', (await read(page, 'stand')).whole, String(tookD2));
    // the LED «on» out 1,7 s, let go over the board where it was
    const led = await holdOut('LED1', 1.7, 'back');
    check(
      'the LED «on» in the hand: out of the circuit, dark; the music plays on',
      led.taken === 'part:LED1' && led.stand.out === 'LED1' && !(led.heat?.light > 0.01) && led.stand.crest > 0.5,
      JSON.stringify({ taken: led.taken, out: led.stand.out, light: led.heat?.light, crest: led.stand.crest }),
    );
    await advance(page, 1.2);
    const s1 = await read(page, 'stand');
    check(
      'back on its sockets, the board the entry’s for 1 s: the LED counted; the step calls the volume knob',
      s1.led && !s1.mute && s1.whole && s1.call === 'P1' && (await read(page, 'electronics-heat')).parts.LED1?.light > 0.1,
      JSON.stringify({ led: s1.led, mute: s1.mute, whole: s1.whole, call: s1.call }),
    );
    check('no takeaway after one half', !(await takeaway()));
    // the volume knob out 2 s — the speaker silent —, let go off the board: the step puts it back
    const pot = await holdOut('P1', 2.2, 'off');
    check(
      'the knob in the hand: the speaker silent (the bar under 5 mV), the visit silenced',
      pot.taken === 'part:P1' && pot.stand.out === 'P1' && pot.stand.crest < 0.005 && pot.stand.open?.silenced,
      JSON.stringify({ taken: pot.taken, crest: pot.stand.crest, open: pot.stand.open }),
    );
    const b = await read(page, 'electronics-board');
    const s2 = await read(page, 'stand');
    check(
      'let go off the board: the knob straight back on its own sockets, at 0,5',
      s2.backs === 1 && b.parts.P1?.legs.join() === potLegs && b.settings.P1 === 0.5 && !b.pending.includes('P1'),
      JSON.stringify({ backs: s2.backs, legs: b.parts.P1?.legs, setting: b.settings.P1 }),
    );
    await advance(page, 1.3);
    const s3 = await read(page, 'stand');
    const heat = await read(page, 'electronics-heat');
    check(
      'the music back, the goal: the LED and the knob; nothing burnt',
      s3.reached && s3.mute && s3.crest > 0.3 && Object.values(heat.parts).every((x) => x.condition !== 'burnt'),
      JSON.stringify({ reached: s3.reached, counted: s3.counted, crest: s3.crest }),
    );
    await goal('two parts out and back');
    await more();
  },
  async riddle() {
    await next('riddle');
    await recalls();
    const s0 = await read(page, 'riddle');
    const sc0 = await read(page, 'electronics-scope');
    check(
      'on entry: the scope on its place, 2,5 V and 5 ms a division, its probe at rest; the three words up',
      sc0.shown >= 0.999 && sc0.voltsPerDiv === 2.5 && sc0.timePerDiv === 0.005 && s0.ch1 === null &&
        s0.marks.battery && s0.marks.player && s0.marks.speaker && s0.playing,
      JSON.stringify({ shown: sc0.shown, v: sc0.voltsPerDiv, t: sc0.timePerDiv, s0 }),
    );
    const rows = [
      ['battery', '+6', (sc) => sc.min[0] > 8.85 && sc.max[0] < 8.99],
      ['player', 'a13', (sc, r) => Math.max(Math.abs(sc.min[0]), Math.abs(sc.max[0])) <= 0.3 && r.crest > 0.2],
      ['speaker', 'd10', (sc, r) => Math.max(Math.abs(sc.min[0]), Math.abs(sc.max[0])) <= 1 && r.crest > 0.79],
    ];
    for (const [k, socket, seen] of rows) {
      await scopeProbe('ch1', socket);
      await advance(page, 2.3);
      const r = await read(page, 'riddle');
      const sc = await read(page, 'electronics-scope');
      check(
        `the probe 2 s on «${k}» (${socket}): counted, its word gone; the screen shows the model`,
        r.counted.includes(k) && !r.marks[k] && seen(sc, r),
        JSON.stringify({ counted: r.counted, min: sc.min[0], max: sc.max[0], crest: r.crest }),
      );
      if (k !== 'speaker') check('no takeaway yet', !(await takeaway()));
    }
    await sheetTab('board');
    await goal('three rows');
    await more();
  },
  async map() {
    await next('map');
    await sheetTab('board');
    check('the journey map is on the board', await shown(page, '[data-ui="journey-stop:meter"]'));
    for (const id of ['meter', 'resistor', 'amplifier']) {
      await sheetTab('board');
      const r = await page.evaluate((n) => {
        const e = [...document.querySelectorAll(`[data-ui="journey-stop:${n}"]`)].find((x) => !x.closest('[hidden]'));
        e?.scrollIntoView({ block: 'center' });
        const b = e?.getBoundingClientRect();
        return b && b.width > 0 ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
      }, id);
      if (!check(`the stop ${id} is on screen`, !!r)) continue;
      await p.tap(r.x, r.y);
      await advance(page, 0.5);
      if (id !== 'amplifier') check(`no takeaway after ${id}`, !(await takeaway()));
    }
    const m = await read(page, 'map');
    check('three stops opened', m.opened.length === 3 && m.reached, JSON.stringify(m));
    await goal('three stops');
    await more();
    // the closing card: the bridge to `meter`; «Далі» on it leads on when `meter` is built
    await advance(page, 1);
    const card = await closingCard(page, (s) => advance(page, s));
    check('closing card after the last step: the bridge', card.shown && card.bridge.length > 0, `«${card.bridge.slice(-60)}»`);
    await snap('closing');
    const built = await page.evaluate(() => window.__app.listChapters('electronics').some((c) => c.id === 'meter'));
    const go = await page.evaluate(() => {
      const b = document.querySelector('[data-ui="path-next"]');
      return b ? { disabled: b.disabled, tip: b.dataset.tip ?? '', text: b.textContent } : null;
    });
    check(
      built ? '«Далі» on the card leads on (meter is built)' : '«Далі» on the card is disabled with its tip (meter is not built)',
      !!go && (built ? !go.disabled : go.disabled && go.tip.length > 0),
      JSON.stringify(go),
    );
  },
};

/** The live page: the real clock, the model in its thread, every request below 400; the sound by a tap (no noaudio). */
async function live(base) {
  step = 'live';
  const page2 = await context.newPage();
  const bad = [];
  const fetched = [];
  page2.on('response', (r) => {
    fetched.push(r.url());
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  // without ?noaudio and ?freeze: as a reader opens it
  const url = appUrl(base, { route: `${ID}/quiet` }).replace(/([?&])noaudio(&|$)/, '$1').replace(/[?&]$/, '');
  await openApp(page2, url);
  await page2.waitForTimeout(3000);
  const a = await page2.evaluate(() => window.__app.read('electronics-sound'));
  check('the model in time runs in its background thread', a.mode === 'worker' && a.blocks > 10, JSON.stringify({ mode: a.mode, blocks: a.blocks, state: a.state }));
  check('before the first gesture the output waits; the line «Звук вимкнено…» shows', a.state === 'waiting' && (await page2.evaluate(() => window.__app.read('prologue').soundOff)), a.state);
  const pl = await page2.evaluate(() => window.__app.locate('player'));
  if (touch) await page2.touchscreen.tap(pl.x, pl.y);
  else await page2.mouse.click(pl.x, pl.y);
  await page2.waitForTimeout(2500);
  const b = await page2.evaluate(() => [window.__app.read('electronics-sound'), window.__app.read('quiet')]);
  check(
    'a tap on the player: the engine’s first gesture — the sound runs on the audio clock, the player plays, the line goes',
    b[0].state === 'running' && b[0].clock === 'audio' && b[0].played > 5 && b[1].playing && !b[1].soundOff && b[1].crest > 0.03,
    JSON.stringify({ state: b[0].state, clock: b[0].clock, played: b[0].played, underruns: b[0].underruns, playing: b[1].playing, soundOff: b[1].soundOff, crest: b[1].crest }),
  );
  check('the worker’s script came from under the base', fetched.some((u) => /worker/i.test(u) && u.startsWith(new URL(base).origin + new URL(base).pathname)), fetched.filter((u) => /worker/i.test(u)).join(' | '));
  check('every request of the live page answered below 400', bad.length === 0, bad.join(' | ').slice(0, 300));
  const errors = (await appErrors(page2)).filter((e) => e.level === 'error');
  check('no console errors on the live page', errors.length === 0, errors.map((e) => e.message).join(' | ').slice(0, 300));
  await page2.close();
}

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: `${ID}/quiet`, freeze: 0 }));
  await page.evaluate(() => window.__app.pause());
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await advance(page, 1);
  step = 'quiet';
  const pos = await page.evaluate(() => window.__app.position());
  check('the chapter opens on its first step', pos.chapterId === 'prologue' && pos.stepId === 'quiet', `${pos.chapterId}/${pos.stepId}`);
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
  await live(base);
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
