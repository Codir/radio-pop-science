#!/usr/bin/env node
/* global process, console, window, document, location */
// Interaction test of `alchemy/lab` (production preview or dev server up):
//
//   node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --port 5351 --size 1280x720 --hud dom|gl
//        [--out <dir>]   (saves the dock of every step, the fission choice and pictures in mid-action as JPEG there)
//
// Every tool of the dock is used with real pointer input (`__ui.locate('ctl-<id>')`), and the game state is read
// only from `__app.read('lab')`. The checks are numbered as in the plan (task 12); «chart» checks (task 13) run
// first, while the collection is still empty; «fx» checks (task 14) follow the animations of the events (a
// fragment is picked in the scene through the `lab.fragment.*` probes); «walk» checks then win every quest from
// the dock; «free» checks (task 15) take a new start in the dock and on the chart, reload the page (the same
// browser context keeps its storage) and finally open the chapter in a second context whose `localStorage`
// throws. The model changes at the click; the status line, the toasts and the chips speak when the scene shows
// the change (a shot reaches the nucleus ≈ 0.45 s later), so checks of those give the clock time to get there.
// Frozen engine clock (`?freeze`); a fresh browser context has empty storage, so the dice fall the same way on
// every run.
// Exit code 1 if any check fails or the console reports an error or warning.
import { join } from 'node:path';
import {
  appErrors,
  appUrl,
  baseUrl,
  ensureDir,
  hudMode,
  launch,
  openApp,
  parseArgs,
  parseSize,
  screenshot,
} from '../../../../../../../tools/qa/lib.mjs';
import { advance, box, cellPoint, click, clickCell, controlText, enter, pick, read, shown, textShown } from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const out = typeof args.out === 'string' ? ensureDir(args.out) : null;
const { browser, page } = await launch({ width, height });
const results = [];
let label = '';

const check = (what, ok, detail = '') => {
  results.push({ label, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label.padEnd(20)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const at = (s) => `${s.z}-${s.n}, moves ${s.moves}, e ${s.electrons}${s.done ? ', done' : ''}${s.pending ? ', pending' : ''}`;
const errorsText = (errors) => errors.slice(0, 2).map((e) => e.message.slice(0, 160)).join(' | ');

const PROJECTILES = ['n', 'p', 'd', 'he3', 'alpha', 'c12', 'o16', 'ca48'];
/** What each step offers (sim/lab/quests.ts) and where it starts: the dock must show exactly that. */
const STEPS = {
  'heavy-hydrogen': { tools: ['n', 'wait'], start: [1, 0] },
  radiocarbon: { tools: ['n', 'wait'], start: [6, 6] },
  sun: { tools: ['p', 'he3', 'wait'], start: [1, 0] },
  'star-forge': { tools: ['alpha', 'wait'], start: [2, 2] },
  'mercury-gold': { tools: ['n', 'wait'], start: [80, 116] },
  technetium: { tools: ['n', 'd', 'wait'], start: [42, 56] },
  plutonium: { tools: ['n', 'wait'], start: [92, 146] },
  fission: { tools: ['n', 'wait'], start: [92, 143] },
  'uranium-chain': { tools: ['wait'], start: [92, 146] },
  'lead-gold': { tools: ['gamma-n', 'gamma-p', 'wait'], start: [82, 126] },
  superheavy: { tools: [...PROJECTILES, 'wait'], start: [98, 151] },
  free: { tools: [...PROJECTILES, 'gamma-n', 'gamma-p', 'wait'], start: [1, 0] },
};
/** The 84 elements with a nuclide in nature (parts/start-picker.ts): the element slider's values index this. */
const NATURAL_Z = [...Array.from({ length: 83 }, (_, i) => i + 1).filter((z) => z !== 43 && z !== 61), 90, 91, 92];
/** The controls of the free lab's start choice, and everything else of the dock that it replaces. */
const CHOICE = ['pick-element', 'pick-isotope', 'take-start', 'cancel-start'];
const REPLACED = [
  'fire', 'projectile', 'gamma-n', 'gamma-p', 'wait', 'electrons', 'neutral', 'restart', 'new-start', 'pick-heavy', 'pick-light',
];

/**
 * The dock's body fits its column: nothing scrolls. Both interfaces: every body row on screen lies inside the
 * scroll box; DOM: the scroll box has nothing more to scroll.
 */
async function dockFits() {
  const scroll = await box(page, 'dock-scroll');
  const ids = ['pick-element', 'pick-isotope', 'card', 'projectile', 'electrons'];
  const rows = (await Promise.all(ids.map((id) => box(page, `ctl-${id}`)))).filter(Boolean);
  if (!scroll || rows.length === 0) return { ok: false, detail: 'dock rows not on screen' };
  const top = scroll.y - scroll.h / 2;
  const bottom = scroll.y + scroll.h / 2;
  const highest = Math.min(...rows.map((r) => r.y - r.h / 2));
  const lowest = Math.max(...rows.map((r) => r.y + r.h / 2));
  let ok = highest >= top - 1 && lowest <= bottom + 1;
  let detail = `rows ${highest.toFixed(0)}…${lowest.toFixed(0)} in ${top.toFixed(0)}…${bottom.toFixed(0)}`;
  const dom = await page.evaluate(() => {
    const el = document.querySelector('[data-ui="dock-scroll"]');
    return el ? { sh: el.scrollHeight, ch: el.clientHeight } : null;
  });
  if (dom) {
    ok &&= dom.sh <= dom.ch + 1;
    detail += `; scrollHeight ${dom.sh} / clientHeight ${dom.ch}`;
  }
  return { ok, detail };
}

/** The nuclide chart's window of a centre (chart-model.ts `windowOrigin`): it never leaves the table. */
const windowOf = (z, n) => ({
  n0: Math.min(Math.max(n - 7, 0), 178 - 14),
  z0: Math.min(Math.max(z - 5, 1), 118 - 10),
});

/**
 * The board shows the chart, the status line (when there is one) and the energy readout without being scrolled:
 * each lies inside the board's box. Also the atom stays free: its nucleus and its name plate are right of it.
 */
async function boardFits() {
  const board = await box(page, 'board');
  if (!board) return { ok: false, detail: 'no board' };
  const top = board.y - board.h / 2;
  const bottom = board.y + board.h / 2;
  const right = board.x + board.w / 2;
  const parts = [];
  let ok = true;
  for (const id of ['chart', 'status', 'energy']) {
    const r = await box(page, `ctl-${id}`);
    if (!r) {
      if (id !== 'status') ok = false;
      parts.push(`${id} off`);
      continue;
    }
    const inside = r.y - r.h / 2 >= top - 1 && r.y + r.h / 2 <= bottom + 1;
    ok &&= inside;
    parts.push(`${id} ${(r.y - r.h / 2).toFixed(0)}…${(r.y + r.h / 2).toFixed(0)}`);
  }
  const probes = await page.evaluate(() => ['lab.nucleus', 'lab.plate'].map((n) => window.__app.locate(n)));
  for (const [name, p] of [['nucleus', probes[0]], ['plate', probes[1]]]) {
    ok &&= p !== null && p.x > right;
    parts.push(`${name} x ${p ? p.x.toFixed(0) : '—'}`);
  }
  return { ok, detail: `board ${top.toFixed(0)}…${bottom.toFixed(0)}, right ${right.toFixed(0)}; ${parts.join(', ')}` };
}

/**
 * Nothing of the board's body hides under its button row (buttons stay put under the scrolling body): every row
 * `ids` names is on screen and ends above the top of the board's button `button`, so none needs scrolling to.
 */
async function bodyAbove(button, ids) {
  const b = await box(page, `ctl-${button}`);
  if (!b) return { ok: false, detail: `${button} not on screen` };
  const top = b.y - b.h / 2;
  const parts = [];
  let ok = true;
  for (const id of ids) {
    const r = await box(page, `ctl-${id}`);
    if (!r) {
      ok = false;
      parts.push(`${id} off`);
      continue;
    }
    const bottom = r.y + r.h / 2;
    ok &&= bottom <= top + 1;
    parts.push(`${id} …${bottom.toFixed(0)}`);
  }
  return { ok, detail: `${button} from ${top.toFixed(0)}: ${parts.join(', ')}` };
}

async function offscreen() {
  return page.evaluate(() => window.__ui.offscreen().map((o) => `${o.name} (${o.reason})`));
}

/** What `read('lab')` says about the game itself (not the animations): it must not move while a shot is shown. */
const MODEL_KEYS = ['step', 'z', 'n', 'electrons', 'moves', 'elapsed', 'done', 'best', 'pending', 'countdown', 'discovered', 'symbol', 'chart'];

/** Right edge of the board (CSS px). */
async function boardEdge() {
  const board = await box(page, 'board');
  return board ? board.x + board.w / 2 : 0;
}

/** The two fission fragments in the scene (QA probes; `shown` is false while there is nothing to pick). */
async function fragments() {
  const [heavy, light] = await page.evaluate(() => ['lab.fragment.heavy', 'lab.fragment.light'].map((n) => window.__app.locate(n)));
  return { heavy, light };
}
const fragOnScreen = (p, boardRight) => p !== null && p.shown && p.visible && p.x > boardRight;
const fragText = ({ heavy, light }) =>
  ['heavy', 'light'].map((k, i) => {
    const p = i === 0 ? heavy : light;
    return `${k} ${p ? `${p.x.toFixed(0)},${p.y.toFixed(0)}${p.shown ? '' : ' hidden'}` : '—'}`;
  }).join(', ');

/** Controls of `ids` that are on screen (`on`) or not. */
async function filterShown(p, ids, on) {
  const out = [];
  for (const id of ids) if ((await shown(p, id)) === on) out.push(id);
  return out;
}

/** The dock offers the start choice and nothing it replaces; the wrong ones, for the check's detail. */
async function choiceOnly(p) {
  const missing = await filterShown(p, CHOICE, false);
  const extra = await filterShown(p, REPLACED, true);
  return [...missing.map((id) => `${id} missing`), ...extra.map((id) => `${id} shown`)];
}

/** Move the element slider as a gesture would (`notify`: its `onChange` runs), then let 0.4 s of clock pass. */
async function chooseElement(p, z) {
  await p.evaluate((i) => window.__ui.set('pick-element', i, true), NATURAL_Z.indexOf(z));
  await advance(p, 0.4);
}

/** Reload the page (same URL, same storage) and wait as `openApp` does; then the start settles (0.5 s). */
async function reload(p) {
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => typeof window.__app === 'object');
  await p.evaluate(() => window.__app.ready);
  if ((await hudMode(p)) === 'dom') await p.evaluate(() => document.fonts.ready.then(() => undefined));
  await p.evaluate(() => window.__app.settled());
  await advance(p, 0.5);
}

let failed = true;
try {
  await openApp(page, appUrl(baseUrl(args), { route: 'alchemy/lab/heavy-hydrogen', freeze: 1 }));

  // chart — the board's nuclide chart (task 13), while only ¹H is discovered: a click picks a cell and changes
  // nothing in the game; the window keeps its place at the corner of the table; «Уся карта» shows all of it
  label = 'chart heavy-hydrogen';
  await enter(page, 'heavy-hydrogen');
  let s = await read(page);
  check('the board is on screen', (await box(page, 'board')) !== null);
  check('the window is the corner of the table, only ¹H discovered, nothing picked',
    s.chart.n0 === 0 && s.chart.z0 === 1 && s.chart.cols === 15 && s.chart.rows === 11 && s.discovered === 1 && s.picked === null && !(await shown(page, 'picked')),
    `${JSON.stringify(s.chart)}, discovered ${s.discovered}, picked ${s.picked}`);
  await clickCell(page, 1, 1);
  s = await read(page);
  check('a click on the ²H cell picks it', s.picked === '1-1', `picked ${s.picked}`);
  let line = await controlText(page, 'picked');
  // (the DOM interface writes the mass number as a <sup>: «2H» in its text)
  check('…its line says it is not discovered yet', (await shown(page, 'picked')) && /[²2]H · ще не відкрито/.test(line), line);
  check('…and the game is untouched', s.z === 1 && s.n === 0 && s.moves === 0 && s.discovered === 1, at(s));
  const before = s;
  // (the status line speaks when the shot reaches the nucleus: 1 s of clock)
  await click(page, 'fire', 1);
  s = await read(page);
  check('after «Вистрілити»: the same window, one more nuclide discovered',
    s.z === 1 && s.n === 1 && s.chart.n0 === before.chart.n0 && s.chart.z0 === before.chart.z0 && s.discovered === before.discovered + 1,
    `${at(s)}, window ${s.chart.n0}-${s.chart.z0}, discovered ${s.discovered}`);
  line = await controlText(page, 'picked');
  check('…and the picked line now names ²H', s.picked === '1-1' && line.includes('Гідроген'), line);
  const fitPicked = await boardFits();
  check('with the picked line and the status: chart, status, energy unscrolled; the atom free', (await shown(page, 'status')) && fitPicked.ok, fitPicked.detail);
  if (out) await screenshot(page, join(out, 'chart-heavy-hydrogen-picked.jpg'));
  await click(page, 'full');
  s = await read(page);
  check('«Уся карта» shows the whole table', s.chart.n0 === 0 && s.chart.z0 === 1 && s.chart.cols === 179 && s.chart.rows === 118, JSON.stringify(s.chart));
  if (out) await screenshot(page, join(out, 'chart-full.jpg'));
  const u238 = await cellPoint(page, 92, 146);
  if (u238) await page.mouse.click(u238.x, u238.y);
  await advance(page, 0.4);
  s = await read(page);
  const [pz, pn] = (s.picked ?? '0-0').split('-').map(Number);
  check('a click on the whole table picks the nuclide there (²³⁸U ± one pixel)', u238 !== null && Math.abs(pz - 92) <= 1 && Math.abs(pn - 146) <= 1 && s.moves === 1, `picked ${s.picked}`);
  await click(page, 'full');
  s = await read(page);
  check('…and back to the window', s.chart.cols === 15 && s.chart.n0 === 0 && s.chart.z0 === 1, JSON.stringify(s.chart));
  await click(page, 'restart');
  s = await read(page);
  check('«Почати знову» forgets the pick', s.picked === null && !(await shown(page, 'picked')), `picked ${s.picked}`);
  const chartErrors = await appErrors(page);
  check('console clean', chartErrors.length === 0, errorsText(chartErrors));

  // 1 — the first quest from the dock: ¹H → ²H → ³H → ³He
  label = '1 heavy-hydrogen';
  await enter(page, 'heavy-hydrogen');
  await click(page, 'fire');
  await click(page, 'fire');
  await click(page, 'wait');
  s = await read(page);
  check('fire, fire, wait → ³He in 3 moves, best 3', s.z === 2 && s.n === 1 && s.moves === 3 && s.done && s.best === 3, at(s));

  // 2 — mercury into gold: ¹⁹⁶Hg + n → ¹⁹⁷Hg, electron capture → ¹⁹⁷Au, a neutral atom
  label = '2 mercury-gold';
  await enter(page, 'mercury-gold');
  await click(page, 'fire');
  await click(page, 'wait');
  s = await read(page);
  check('fire, wait → ¹⁹⁷Au with 79 electrons', s.z === 79 && s.n === 118 && s.electrons === 79 && s.done, at(s));

  // 3 — electrons are not moves; «Нейтралізувати» appears with a charge
  label = '3 electrons';
  check('no «Нейтралізувати» on a neutral atom', !(await shown(page, 'neutral')));
  await pick(page, 'electrons', 'minus');
  s = await read(page);
  check('«−» takes one electron, no move', s.electrons === 78 && s.moves === 2, at(s));
  check('«Нейтралізувати» appears', await shown(page, 'neutral'));
  await click(page, 'neutral');
  s = await read(page);
  check('«Нейтралізувати» gives 79 back, no move', s.electrons === 79 && s.moves === 2, at(s));
  check('…and hides again', !(await shown(page, 'neutral')));

  // 4 — restart keeps the best
  label = '4 restart';
  await click(page, 'restart');
  s = await read(page);
  check('back to ¹⁹⁶Hg, 0 moves, best kept', s.z === 80 && s.n === 116 && s.moves === 0 && !s.done && s.best === 2, `${at(s)}, best ${s.best}`);

  // 5 — a fleeting nucleus falls apart by itself after 2 s of game time, and that is not a move
  label = '5 star-forge';
  await enter(page, 'star-forge');
  await click(page, 'fire');
  s = await read(page);
  check('⁸Be with a running countdown', s.z === 4 && s.n === 4 && s.countdown !== null, `${at(s)}, countdown ${s.countdown}`);
  await advance(page, 2.2);
  s = await read(page);
  check('…falls back to ⁴He, still 1 move', s.z === 2 && s.n === 2 && s.moves === 1, at(s));

  // 5b — the boundary: a shot 1.9 s after ⁸Be appeared still finds it (the countdown has 0.1 s left), and wins
  label = '5b star-forge 1.9 s';
  await click(page, 'restart');
  await click(page, 'fire', 0);
  await advance(page, 1.9);
  s = await read(page);
  check('after 1.9 s still ⁸Be, 0.1 s left', s.z === 4 && s.n === 4 && s.countdown !== null && Math.abs(s.countdown - 0.1) < 1e-6, `${at(s)}, countdown ${s.countdown}`);
  await click(page, 'fire', 0);
  s = await read(page);
  check('the second α makes ¹²C in 2 moves before the countdown runs out', s.z === 6 && s.n === 6 && s.moves === 2 && s.done, at(s));
  await advance(page, 0.4);

  // 6 — leaving a step mid-countdown: the new step starts clean and the old timer never fires (Review Focus 3)
  label = '6 jump mid-countdown';
  await click(page, 'restart');
  await click(page, 'fire');
  await page.evaluate(() => {
    location.hash = '#/alchemy/lab/uranium-chain';
  });
  await page.waitForFunction(() => window.__app.position().stepId === 'uranium-chain');
  await page.evaluate(() => window.__app.settled());
  await advance(page, 3);
  s = await read(page);
  check('uranium-chain starts on ²³⁸U, 0 moves', s.step === 'uranium-chain' && s.z === 92 && s.n === 146 && s.moves === 0 && s.countdown === null, at(s));

  // 7 — fission: only the fragment choice (and restart) while it is pending
  label = '7 fission';
  await enter(page, 'fission');
  await click(page, 'fire');
  s = await read(page);
  check('the neutron splits ²³⁵U: a choice is pending', s.pending && s.moves === 1, at(s));
  check('both fragment buttons are shown', (await shown(page, 'pick-heavy')) && (await shown(page, 'pick-light')));
  const hiddenWhilePending = [];
  for (const id of ['fire', 'wait', 'electrons', 'neutral']) if (await shown(page, id)) hiddenWhilePending.push(id);
  check('no tool while the choice is pending', hiddenWhilePending.length === 0, hiddenWhilePending.join(', '));
  check('«Почати знову» stays', await shown(page, 'restart'));
  if (out) await screenshot(page, join(out, 'dock-fission-pending.jpg'));
  const pendingOff = await offscreen();
  const pendingFit = await dockFits();
  check('the dock fits during the choice', pendingOff.length === 0 && pendingFit.ok, `${pendingFit.detail} ${pendingOff.join(', ')}`);
  await click(page, 'pick-heavy');
  s = await read(page);
  check('the heavy fragment ¹⁴¹Ba, no extra move', s.z === 56 && s.n === 85 && !s.pending && s.moves === 1, at(s));
  check('the tools are back', (await shown(page, 'fire')) && (await shown(page, 'wait')) && !(await shown(page, 'pick-heavy')));

  // 8 — five «wait» presses in one frame: five decays, each counted once (Review Focus 2)
  label = '8 wait ×5';
  await enter(page, 'uranium-chain');
  for (let i = 0; i < 5; i++) await click(page, 'wait', 0);
  s = await read(page);
  check('five decays: ²²⁶Ra in 5 moves', s.z === 88 && s.n === 138 && s.moves === 5, at(s));
  await advance(page, 0.5);
  const quick = await appErrors(page);
  check('console clean', quick.length === 0, errorsText(quick));

  // 9 — every step: the dock shows the step's tools, nothing else, and fits 1280×720 without scrolling
  let cardHeight = null;
  for (const [id, step] of Object.entries(STEPS)) {
    label = `9 ${id}`;
    await enter(page, id);
    s = await read(page);
    check(`starts on ${step.start.join('-')}, 0 moves`, s.z === step.start[0] && s.n === step.start[1] && s.moves === 0, at(s));
    const projectiles = step.tools.filter((t) => PROJECTILES.includes(t));
    const expect = {
      card: true, electrons: true, moves: true, elapsed: true, energy: true, restart: true,
      chart: true, full: true, collection: true, picked: false,
      status: false, neutral: false, 'pick-heavy': false, 'pick-light': false,
      fire: projectiles.length > 0, projectile: projectiles.length > 1,
      'gamma-n': step.tools.includes('gamma-n'), 'gamma-p': step.tools.includes('gamma-p'), wait: step.tools.includes('wait'),
      'new-start': id === 'free', 'start-here': false, ...Object.fromEntries(CHOICE.map((c) => [c, false])),
    };
    const wrong = [];
    for (const [ctl, want] of Object.entries(expect)) if ((await shown(page, ctl)) !== want) wrong.push(`${ctl} ${want ? 'missing' : 'shown'}`);
    if (projectiles.length > 1) {
      for (const p of PROJECTILES) {
        const on = (await box(page, `ctl-projectile:${p}`)) !== null;
        if (on !== projectiles.includes(p)) wrong.push(`projectile:${p} ${on ? 'shown' : 'missing'}`);
      }
    }
    check('the dock offers exactly the step’s tools', wrong.length === 0, wrong.join(', '));
    const off = await offscreen();
    check('__ui.offscreen() empty', off.length === 0, off.join(', '));
    const fit = await dockFits();
    check('the dock fits without scrolling', fit.ok, fit.detail);
    const win = windowOf(...step.start);
    check(`the chart's window ${win.n0}-${win.z0} stays on the table`, s.chart.n0 === win.n0 && s.chart.z0 === win.z0 && s.chart.cols === 15, JSON.stringify(s.chart));
    // the card's rows are one line each, also «Ядро» of a heavy nucleus (it used to wrap at «α-» / «розпад»)
    const card = await box(page, 'ctl-card');
    cardHeight ??= card?.h ?? null;
    check('the card is as tall as the first step’s: one line per row', card !== null && Math.abs(card.h - cardHeight) <= 1,
      `card ${card ? card.h.toFixed(1) : '—'}, first ${cardHeight === null ? '—' : cardHeight.toFixed(1)}`);
    if (out) await screenshot(page, join(out, `dock-${id}.jpg`));
    // …and still fits once the status line has something to say (a decay or a refusal)
    await click(page, 'wait');
    const told = await dockFits();
    const offTold = await offscreen();
    check('with the status line: fits, nothing off screen', (await shown(page, 'status')) && told.ok && offTold.length === 0, `${told.detail} ${offTold.join(', ')}`);
    const boardTold = await boardFits();
    check('…and the board shows it unscrolled, the atom free', boardTold.ok, boardTold.detail);
    if (out) await screenshot(page, join(out, `dock-${id}-status.jpg`));
  }

  // 10 — gamma knock-outs; the energy readout says how much is needed
  label = '10 lead-gold';
  await enter(page, 'lead-gold');
  await click(page, 'gamma-p');
  s = await read(page);
  check('γ knocks out a proton: ²⁰⁷Tl', s.z === 81 && s.n === 126 && s.moves === 1, at(s));
  await click(page, 'gamma-n');
  s = await read(page);
  check('γ knocks out a neutron: ²⁰⁶Tl', s.z === 81 && s.n === 125 && s.moves === 2, at(s));
  const energy = await controlText(page, 'energy');
  check('the energy readout says «потрібно»', energy.includes('потрібно'), energy);

  // 11 — two projectiles: the choice in the dock; ⁵Li falls apart into ⁴He by itself
  label = '11 sun';
  await enter(page, 'sun');
  await click(page, 'fire');
  s = await read(page);
  check('p + p → ²H', s.z === 1 && s.n === 1 && s.moves === 1, at(s));
  await pick(page, 'projectile', 'he3');
  await click(page, 'fire');
  await advance(page, 2.2);
  s = await read(page);
  check('²H + ³He → ⁵Li → ⁴He: done in 2 moves', s.z === 2 && s.n === 2 && s.moves === 2 && s.done, at(s));

  // 12 — waiting on a stable nucleus is refused with a reason, and nothing changes
  label = '12 refusal';
  await enter(page, 'heavy-hydrogen');
  check('no status before anything happened', !(await shown(page, 'status')));
  await click(page, 'wait');
  s = await read(page);
  check('¹H stays, 0 moves', s.z === 1 && s.n === 0 && s.moves === 0, at(s));
  const status = await controlText(page, 'status');
  check('the status line gives the reason', (await shown(page, 'status')) && status.includes('Стабільне ядро не розпад'), status);

  // a fleeting nucleus the step's own tools reach (⁴H after three shots) brings the «сповільнено» chip with it
  label = 'chips heavy-hydrogen';
  const SLOWED = 'нетривке ядро сповільн';
  check('no «сповільнено» chip at the start', !(await textShown(page, SLOWED)));
  for (let i = 0; i < 3; i++) await click(page, 'fire');
  // the chip comes with ⁴H on stage: the third shot lands after the first two (≈ 1 s more of clock)
  await advance(page, 1);
  s = await read(page);
  const offChip = await offscreen();
  const fitChip = await dockFits();
  check('⁴H: the chip is on screen, the dock fits, nothing off screen', s.z === 1 && s.n === 3 && (await textShown(page, SLOWED)) && offChip.length === 0 && fitChip.ok, `${at(s)}; ${fitChip.detail} ${offChip.join(', ')}`);
  await advance(page, 2.2);
  s = await read(page);
  check('…it stays after ⁴H fell apart by itself', !(s.z === 1 && s.n === 3) && (await textShown(page, SLOWED)), at(s));
  await click(page, 'restart');
  check('…and goes with «Почати знову»', !(await textShown(page, SLOWED)));

  // fx — every transformation is shown (task 14): the model changes at the click, the scene catches up and
  // changes nothing; a fission's fragments hang in the scene and are picked there (twin of the dock buttons)
  label = 'fx heavy-hydrogen';
  await enter(page, 'heavy-hydrogen');
  await click(page, 'fire', 0);
  const atClick = await read(page);
  check('the model changes at the click while the shot is still shown', atClick.z === 1 && atClick.n === 1 && atClick.moves === 1 && atClick.busy === true,
    `${at(atClick)}, busy ${atClick.busy}`);
  await advance(page, 3);
  s = await read(page);
  const changed = MODEL_KEYS.filter((k) => JSON.stringify(s[k]) !== JSON.stringify(atClick[k]));
  check('3 s later: the same state as right after the click, nothing playing', changed.length === 0 && s.busy === false,
    `${changed.join(', ')}${changed.length ? ' changed' : ''}; busy ${s.busy}`);

  label = 'fx fission (scene)';
  await enter(page, 'fission');
  await click(page, 'fire', 0);
  let frags = await fragments();
  check('no fragment in the scene before the split', !frags.heavy?.shown && !frags.light?.shown, fragText(frags));
  await advance(page, 2.5);
  frags = await fragments();
  const boardRight = await boardEdge();
  s = await read(page);
  check('the two fragments hang in the free area, nothing playing', fragOnScreen(frags.heavy, boardRight) && fragOnScreen(frags.light, boardRight) && s.pending && s.busy === false,
    `${fragText(frags)}, board right ${boardRight.toFixed(0)}, busy ${s.busy}`);
  if (out) await screenshot(page, join(out, 'fx-fission-choice.jpg'));
  if (frags.heavy) await page.mouse.click(frags.heavy.x, frags.heavy.y);
  await advance(page, 0.4);
  s = await read(page);
  check('a click on the heavy fragment in the scene: ¹⁴¹Ba, no extra move', s.z === 56 && s.n === 85 && !s.pending && s.moves === 1, at(s));
  check('…the dock’s fragment buttons are gone, the tools are back',
    !(await shown(page, 'pick-heavy')) && !(await shown(page, 'pick-light')) && (await shown(page, 'fire')));
  await advance(page, 1.5);
  frags = await fragments();
  s = await read(page);
  check('…and the fragments have left the scene', !frags.heavy?.shown && !frags.light?.shown && s.busy === false, `${fragText(frags)}, busy ${s.busy}`);

  label = 'fx fission (dock)';
  await click(page, 'restart', 0.5); // (still in `fission`: an entry of the same step changes nothing)
  await click(page, 'fire', 2.5);
  await click(page, 'pick-light', 1.5);
  s = await read(page);
  frags = await fragments();
  check('the dock’s «легкий уламок» → ⁹²Kr, and the scene’s fragments go with it',
    s.z === 36 && s.n === 56 && !s.pending && !frags.heavy?.shown && !frags.light?.shown && s.busy === false, `${at(s)}; ${fragText(frags)}`);

  // leaving a step while its fission tears: nothing of it survives into the new step (Review Focus 3)
  label = 'fx jump mid-fission';
  await click(page, 'restart', 0.5);
  await click(page, 'fire', 1.1);
  await page.evaluate(() => {
    location.hash = '#/alchemy/lab/heavy-hydrogen';
  });
  await page.waitForFunction(() => window.__app.position().stepId === 'heavy-hydrogen');
  await page.evaluate(() => window.__app.settled());
  await advance(page, 2.5);
  s = await read(page);
  frags = await fragments();
  check('the new step starts clean: ¹H, nothing playing, no fragment, no late message',
    s.step === 'heavy-hydrogen' && s.z === 1 && s.n === 0 && s.moves === 0 && s.busy === false && !frags.heavy?.shown && !frags.light?.shown && !(await shown(page, 'status')),
    `${at(s)}, busy ${s.busy}; ${fragText(frags)}`);

  // ten quick shots at ¹H in the free lab, no clock between them: the model takes six (⁷H is the end of the
  // line, the rest bounce), the scene skips to the end instead of falling behind (Review Focus 2)
  label = 'fx free ×10';
  await enter(page, 'free');
  await click(page, 'restart', 0.5);
  for (let i = 0; i < 10; i++) await click(page, 'fire', 0);
  s = await read(page);
  const tenErrors = await appErrors(page);
  check('ten «Вистрілити» in one frame → ⁷H in 6 moves, console clean', s.z === 1 && s.n === 6 && s.moves === 6 && tenErrors.length === 0,
    `${at(s)}; ${errorsText(tenErrors)}`);
  await advance(page, 5);
  s = await read(page);
  check('…5 s later nothing plays and ⁷H stays', s.busy === false && s.z === 1 && s.n === 6 && s.moves === 6, `${at(s)}, busy ${s.busy}`);
  await click(page, 'restart', 0.5); // the free lab remembers where it stopped: back to ¹H for «walk free»

  // reduced motion: the final picture at once
  label = 'fx reduced motion';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page, 'heavy-hydrogen');
  await click(page, 'fire', 0);
  s = await read(page);
  check('a shot is shown at once: nothing plays', s.z === 1 && s.n === 1 && s.busy === false, `${at(s)}, busy ${s.busy}`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // the emitter: in every step that shoots, left of the atom and clear of the board (smallest and largest atom)
  for (const step of ['superheavy', 'heavy-hydrogen', 'lead-gold', 'uranium-chain']) {
    label = `fx emitter ${step}`;
    await enter(page, step);
    const [em, nucleus] = await page.evaluate(() => ['lab.emitter', 'lab.nucleus'].map((n) => window.__app.locate(n)));
    const edge = await boardEdge();
    if (step === 'uranium-chain') check('no emitter: the step only waits', em !== null && !em.shown);
    else {
      check('the emitter is on screen, between the board and the atom', em !== null && em.shown && em.visible && em.x > edge && em.x < nucleus.x,
        `emitter ${em ? `${em.x.toFixed(0)},${em.y.toFixed(0)}` : '—'}, board right ${edge.toFixed(0)}, nucleus x ${nucleus.x.toFixed(0)}`);
    }
  }

  // mid-action pictures (0.3 s of clock after the click; the fission when it tears)
  if (out) {
    for (const [step, after, file] of [['star-forge', 0.3, 'fx-star-forge.jpg'], ['mercury-gold', 0.3, 'fx-mercury-gold.jpg'], ['fission', 1.2, 'fx-fission.jpg']]) {
      await enter(page, step);
      await click(page, 'fire', 0);
      await advance(page, after);
      await screenshot(page, join(out, file));
    }
  }

  // every quest can be won from the dock (routes of the solver, sim/lab/solver.ts)
  const walk = async (id, actions, goal) => {
    label = `walk ${id}`;
    await enter(page, id);
    for (const a of actions) {
      if (typeof a === 'number') await advance(page, a);
      else if (a.includes(':')) await pick(page, ...a.split(':'));
      else await click(page, a);
    }
    s = await read(page);
    check(`won: ${goal.text}`, s.done && goal.test(s), at(s));
  };
  await walk('radiocarbon', ['fire', 'fire', 'wait'], { text: '¹⁴N', test: (x) => x.z === 7 && x.n === 7 });
  await walk('star-forge', ['fire', 'fire'], { text: '¹²C in 2 moves', test: (x) => x.z === 6 && x.n === 6 && x.moves === 2 });
  await walk('technetium', ['projectile:d', 'fire'], { text: 'technetium', test: (x) => x.z === 43 });
  await walk('plutonium', ['fire', 'wait', 'wait'], { text: '²³⁹Pu', test: (x) => x.z === 94 && x.n === 145 });
  await walk('fission', ['fire', 'pick-heavy', 'wait', 'wait', 'wait'], { text: 'stable ¹⁴¹Pr', test: (x) => x.z === 59 && x.n === 82 });
  await walk('lead-gold', [...Array(8).fill('gamma-n'), 'gamma-p', 'gamma-p', 'gamma-p'], { text: '¹⁹⁷Au in 11 moves', test: (x) => x.z === 79 && x.n === 118 && x.moves === 11 });
  await walk('superheavy', ['projectile:ca48', 'fire'], { text: 'oganesson', test: (x) => x.z === 118 });
  label = 'walk uranium-chain';
  await enter(page, 'uranium-chain');
  for (let i = 0; i < 24 && !(await read(page)).done; i++) await click(page, 'wait');
  s = await read(page);
  check('won: ²⁰⁶Pb', s.done && s.z === 82 && s.n === 124, at(s));
  label = 'walk free';
  await enter(page, 'free');
  await click(page, 'fire');
  s = await read(page);
  check('the free lab plays: ¹H + n → ²H', s.z === 1 && s.n === 1 && s.moves === 1, at(s));

  // free — a new start (task 15): any natural nuclide, in the dock («Новий старт») or from the chart («Почати
  // звідси»); the free lab and the collection outlive a reload
  label = 'free new start';
  check('«Новий старт» is offered, its choice is not', (await shown(page, 'new-start')) && (await filterShown(page, CHOICE, true)).length === 0);
  await click(page, 'new-start');
  s = await read(page);
  let wrong = await choiceOnly(page);
  check('«Новий старт»: «Вистрілити» and every other tool give way to the two sliders, «Взяти» and «Скасувати»',
    s.picking && wrong.length === 0, wrong.join(', '));
  check('…the choice opens on the current nuclide ²H, the card stays',
    s.choice === '1-1' && (await textShown(page, '²H · 0,0145')) && (await shown(page, 'card')), `choice ${s.choice}`);
  let fit = await dockFits();
  let off = await offscreen();
  check('…the dock fits without scrolling, nothing off screen', fit.ok && off.length === 0, `${fit.detail} ${off.join(', ')}`);
  await chooseElement(page, 50);
  s = await read(page);
  check('tin: the isotope slider goes to the most abundant isotope, ¹²⁰Sn',
    s.choice === '50-70' && (await textShown(page, 'Sn · Станум')) && (await textShown(page, '¹²⁰Sn · 32,58')), `choice ${s.choice}`);
  fit = await dockFits();
  check('…the dock still fits', fit.ok, fit.detail);
  if (out) await screenshot(page, join(out, 'free-choice-tin.jpg'));
  await click(page, 'cancel-start');
  s = await read(page);
  check('«Скасувати»: the tools are back, nothing changed', !s.picking && (await shown(page, 'fire')) && !(await shown(page, 'pick-element')) && s.z === 1 && s.n === 1 && s.moves === 1, at(s));
  await click(page, 'new-start');
  await chooseElement(page, 79);
  s = await read(page);
  // (a disabled slider: the DOM interface dims the whole control, and `__ui` counts it as hidden — read its text)
  const goldCaption = (await controlText(page, 'pick-isotope')).includes('¹⁹⁷Au · 100') || (await textShown(page, '¹⁹⁷Au · 100'));
  // the DOM range input tells whether it is disabled; the WebGL slider has no such hook (null)
  const goldOff = await page.evaluate(() => document.querySelector('[data-ui="ctl-pick-isotope"] input')?.disabled ?? null);
  check('gold: its only natural isotope ¹⁹⁷Au · 100 % (DOM: the isotope slider disabled)', s.choice === '79-118' && goldCaption && goldOff !== false,
    `choice ${s.choice}, disabled ${goldOff}`);
  fit = await dockFits();
  off = await offscreen();
  check('…the dock fits, nothing off screen', fit.ok && off.length === 0, `${fit.detail} ${off.join(', ')}`);
  if (out) await screenshot(page, join(out, 'free-choice-gold.jpg'));
  await click(page, 'take-start');
  s = await read(page);
  check('«Взяти як старт»: ¹⁹⁷Au, a neutral atom, 0 moves, the tools are back',
    s.z === 79 && s.n === 118 && s.electrons === 79 && s.moves === 0 && s.elapsed === 0 && !s.picking && (await shown(page, 'fire')) && !(await shown(page, 'take-start')),
    at(s));
  check('…a new run: no status line, the chart centred on gold',
    !(await shown(page, 'status')) && s.chart.n0 === windowOf(79, 118).n0 && s.chart.z0 === windowOf(79, 118).z0, JSON.stringify(s.chart));
  if (out) await screenshot(page, join(out, 'free-gold.jpg'));
  // a move and a charge, for the reload to keep
  await click(page, 'fire');
  await pick(page, 'electrons', 'minus');
  const kept = await read(page);
  check('¹⁹⁷Au + n → ¹⁹⁸Au, one electron off', kept.z === 79 && kept.n === 119 && kept.moves === 1 && kept.electrons === 78, at(kept));
  // the tallest free dock: an ion (with «Нейтралізувати») of a nucleus whose card line takes two rows
  fit = await dockFits();
  off = await offscreen();
  check('¹⁹⁸Au⁺: «Нейтралізувати» in the place of «Почати знову», «Новий старт» stays; the dock fits',
    (await shown(page, 'neutral')) && !(await shown(page, 'restart')) && (await shown(page, 'new-start')) && fit.ok && off.length === 0,
    `${fit.detail} ${off.join(', ')}`);
  if (out) await screenshot(page, join(out, 'free-ion.jpg'));
  const beforeReload = await appErrors(page);
  check('console clean', beforeReload.length === 0, errorsText(beforeReload));

  label = 'free reload';
  await reload(page);
  s = await read(page);
  check('after a reload: the same nuclide, electrons and moves, the same collection',
    s.step === 'free' && s.z === kept.z && s.n === kept.n && s.electrons === kept.electrons && s.moves === kept.moves && s.discovered === kept.discovered,
    `${at(s)}, discovered ${s.discovered} (was ${kept.discovered})`);

  label = 'free start here';
  await clickCell(page, 79, 119);
  s = await read(page);
  check('a pick of ¹⁹⁸Au (not in nature): no «Почати звідси»', s.picked === '79-119' && !(await shown(page, 'start-here')), `picked ${s.picked}`);
  await clickCell(page, 80, 118);
  s = await read(page);
  check('a pick of ¹⁹⁸Hg (in nature): «Почати звідси» on the board', s.picked === '80-118' && (await shown(page, 'start-here')), `picked ${s.picked}`);
  const fitHere = await boardFits();
  off = await offscreen();
  check('…chart and energy unscrolled, the button on screen, the atom free', fitHere.ok && off.length === 0, `${fitHere.detail} ${off.join(', ')}`);
  if (out) await screenshot(page, join(out, 'free-start-here.jpg'));
  await click(page, 'new-start');
  check('…not while the dock’s choice is open', !(await shown(page, 'start-here')));
  await click(page, 'cancel-start');
  await click(page, 'start-here');
  s = await read(page);
  check('«Почати звідси»: ¹⁹⁸Hg, 0 moves, the pick forgotten',
    s.z === 80 && s.n === 118 && s.electrons === 80 && s.moves === 0 && s.picked === null && !(await shown(page, 'start-here')), `${at(s)}, picked ${s.picked}`);

  // the fullest board: a picked natural nuclide (its two-line note and «Почати звідси») and the longest refusal
  label = 'free board full';
  await click(page, 'restart');
  await clickCell(page, 1, 0);
  await click(page, 'gamma-p', 1);
  s = await read(page);
  const under = await bodyAbove('start-here', ['chart', 'picked', 'full', 'energy', 'collection', 'moves', 'elapsed', 'status']);
  check('¹H picked, γ refused: every row of the board above «Почати звідси», nothing to scroll',
    s.z === 1 && s.n === 0 && s.picked === '1-0' && (await shown(page, 'status')) && under.ok, `${at(s)}; ${under.detail}`);
  if (out) await screenshot(page, join(out, 'free-board-full.jpg'));

  label = 'free elsewhere';
  await enter(page, 'sun');
  check('a quest step has no «Новий старт» and no «Почати звідси»', !(await shown(page, 'new-start')) && !(await shown(page, 'start-here')));

  label = 'console';
  await advance(page, 1);
  const errors = await appErrors(page);
  check('no console errors or warnings', errors.length === 0, errorsText(errors));

  // storage that throws (a private window, blocked site data): the chapter still opens and plays (Review Focus 1)
  label = 'broken storage';
  const denied = await browser.newContext({ viewport: { width, height } });
  await denied.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('denied');
      },
    }),
  );
  const p2 = await denied.newPage();
  const uncaught = [];
  p2.on('pageerror', (e) => uncaught.push({ message: String(e) }));
  await openApp(p2, appUrl(baseUrl(args), { route: 'alchemy/lab/free', freeze: 1 }));
  await p2.evaluate(() => window.__app.settled());
  await advance(p2, 0.5);
  const throws = await p2.evaluate(() => {
    try {
      return window.localStorage === undefined;
    } catch {
      return true;
    }
  });
  s = await read(p2);
  check('localStorage throws, and the free lab opens on ¹H', throws && s.step === 'free' && s.z === 1 && s.n === 0 && s.moves === 0, at(s));
  await click(p2, 'fire');
  s = await read(p2);
  check('«Вистрілити» works: ²H', s.z === 1 && s.n === 1 && s.moves === 1, at(s));
  await click(p2, 'new-start');
  await chooseElement(p2, 79);
  await click(p2, 'take-start');
  s = await read(p2);
  check('a new start works: ¹⁹⁷Au', s.z === 79 && s.n === 118 && s.moves === 0, at(s));
  await advance(p2, 1);
  const deniedErrors = [...(await appErrors(p2)), ...uncaught];
  check('console clean', deniedErrors.length === 0, errorsText(deniedErrors));
  await denied.close();
  failed = results.some((r) => !r.ok);
  console.log(
    `${failed ? 'FAIL' : 'PASS'} alchemy/lab interactions — ${results.filter((r) => r.ok).length}/${results.length} checks at ${width}x${height}`,
  );
} catch (e) {
  console.error(`interaction test crashed: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
