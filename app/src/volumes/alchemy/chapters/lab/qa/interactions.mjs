#!/usr/bin/env node
/* global process, console, window, document, location */
// Interaction test of `alchemy/lab` (production preview or dev server up):
//
//   node app/src/volumes/alchemy/chapters/lab/qa/interactions.mjs --port 5351 --size 1280x720 --hud dom|gl
//        [--out <dir>]   (saves the dock of every step and the fission choice as JPEG there)
//
// Every tool of the dock is used with real pointer input (`__ui.locate('ctl-<id>')`), and the game state is read
// only from `__app.read('lab')`. The checks are numbered as in the plan (task 12); «chart» checks (task 13) run
// first, while the collection is still empty; «walk» checks then win every quest from the dock. Frozen engine
// clock (`?freeze`); a fresh browser context has empty storage, so the dice fall the same way on every run.
// Exit code 1 if any check fails or the console reports an error or warning.
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

/**
 * The dock's body fits its column: nothing scrolls. Both interfaces: every body row on screen lies inside the
 * scroll box; DOM: the scroll box has nothing more to scroll.
 */
async function dockFits() {
  const scroll = await box(page, 'dock-scroll');
  const rows = (await Promise.all(['card', 'projectile', 'electrons'].map((id) => box(page, `ctl-${id}`)))).filter(Boolean);
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

async function offscreen() {
  return page.evaluate(() => window.__ui.offscreen().map((o) => `${o.name} (${o.reason})`));
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
  await click(page, 'fire');
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
  s = await read(page);
  const offChip = await offscreen();
  const fitChip = await dockFits();
  check('⁴H: the chip is on screen, the dock fits, nothing off screen', s.z === 1 && s.n === 3 && (await textShown(page, SLOWED)) && offChip.length === 0 && fitChip.ok, `${at(s)}; ${fitChip.detail} ${offChip.join(', ')}`);
  await advance(page, 2.2);
  s = await read(page);
  check('…it stays after ⁴H fell apart by itself', !(s.z === 1 && s.n === 3) && (await textShown(page, SLOWED)), at(s));
  await click(page, 'restart');
  check('…and goes with «Почати знову»', !(await textShown(page, SLOWED)));

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

  label = 'console';
  await advance(page, 1);
  const errors = await appErrors(page);
  check('no console errors or warnings', errors.length === 0, errorsText(errors));
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
