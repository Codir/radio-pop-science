#!/usr/bin/env node
/* global process, console, window, document, getComputedStyle */
// Interaction test of `circuit/prologue` (run on lenovo; dev server or preview up), under the 2D interface:
//
//   node app/src/volumes/circuit/chapters/prologue/qa/interactions.mjs --port 5285 [--size 1920x1080]
//
// Every goal of every step is reached with real pointer input (scene probes `__app.locate`, HUD controls
// `__ui.locate`), every takeaway must appear only after its goal, «Докладніше» is opened once, and the console
// must stay clean. Frozen engine clock (`?freeze`): deterministic. Exit code 1 on any failure.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseArgs,
  parseSize,
} from '../../../../../../../tools/qa/lib.mjs';
import { advance, at, read } from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(7)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const shown = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, sel);
const takeaway = () => shown('[data-ui="path-takeaway"]');
const state = () => read(page, 'prologue');
const tap = async (probe) => {
  const p = await at(page, probe);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
  await advance(page, 0.1);
};
const enter = async (id) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('circuit/prologue/' + s, undefined, { instant: true }), id);
  await advance(page, 1.5);
  // the opening card of the chapter stands before step 1: go on to the step itself
  if (await shown('[data-ui="path-opening"] button')) {
    await page.click('[data-ui="path-opening"] button');
    await advance(page, 0.6);
  }
  check('no takeaway before the goal', !(await takeaway()));
};

let failed = true;
try {
  await openApp(
    page,
    appUrl(baseUrl(args), { route: 'circuit/prologue/click', freeze: 1, extra: { hud: 'dom' } }),
  );
  await enter('click');
  const navHidden = () => page.evaluate(() => window.__ui.navHidden());
  check('the navigator waits for the first light', (await navHidden()) === true);
  for (let i = 0; i < 3; i++) {
    await tap('switch');
    await advance(page, 0.7);
  }
  const c = await state();
  check(
    'lamp lit twice and on now',
    c.lightings >= 2 && c.glow > 0.5,
    `lightings ${c.lightings}, glow ${c.glow.toFixed(2)}`,
  );
  check('takeaway shown', await takeaway());
  check('…and is there once the lamp has lit', (await navHidden()) === false);

  // «Далі» from `click`: the flashlight unfolds into the stand by itself — no slider, the lamp never goes out
  await page.evaluate(() => window.__app.next());
  step = 'dive';
  await advance(page, 0.2);
  const u0 = await state();
  check(
    '«Далі» starts the unfolding by itself',
    u0.unfold.playing && u0.unfold.value < 0.35,
    u0.unfold.value.toFixed(2),
  );
  // …and nothing to use either: the depth slider waits with the text (the phone sheet showed it greyed early)
  const sliderShown = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-ui="ctl-depth"]');
      if (!el || el.closest('[hidden]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && Number(getComputedStyle(el).opacity) > 0.05;
    });
  check('no slider while it unfolds', !(await sliderShown()));
  // the script: no text to read mid-motion (stepUi `panel.hiddenUntil`): an empty plate until the last beat
  const panelHeld = () =>
    page.evaluate(() => {
      const p = document.querySelector('[data-ui="step-panel"]');
      return (
        p.classList.contains('held') &&
        getComputedStyle(p.querySelector('.sp-scroll')).visibility === 'hidden'
      );
    });
  check('the panel holds its text while the flashlight unfolds', await panelHeld());
  let dark = 0;
  for (let k = 0; k < 14; k++) {
    await page.evaluate(() => window.__app.step(1 / 60, 30));
    if ((await state()).glow < 0.5) dark++;
  }
  const u1 = await state();
  check(
    'it ends on the stand in ≈ 7 s, the lamp lit all the way',
    !u1.unfold.playing && u1.unfold.value > 0.999 && dark === 0,
    `dark frames ${dark}`,
  );
  await advance(page, 0.2);
  check('…and shows it with the last beat', !(await panelHeld()) && (await shown('[data-ui="path-step"]')));
  check('…the slider with it', await sliderShown());
  const named = u1.names;
  check('the parts are named as they land', named.length === 4, named.join(', '));
  await page.click('[data-ui="path-more"]');
  await advance(page, 0.4);
  check('«Докладніше» opens', (await page.getAttribute('[data-ui="path-more"]', 'aria-expanded')) === 'true');
  check('no takeaway before the goal', !(await takeaway()));

  await tap('lens');
  await advance(page, 2);
  check('the lens lies on the wire', (await state()).dive.lens > 0.99);
  // the slider is the dive: a drag scrubs it frame by frame, both ways, and it stays where it is let go
  const track = await page.evaluate(() => {
    const r = document.querySelector('[data-ui="ctl-depth"] input.dk-range')?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y + r.height / 2, w: r.width } : null;
  });
  const xAt = (f) => track.x + 8 + (track.w - 16) * f;
  await page.mouse.move(xAt(0), track.y);
  await page.mouse.down();
  let lag = 0;
  for (let k = 1; k <= 12; k++) {
    await page.mouse.move(xAt(k * 0.03), track.y);
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    const s = await state();
    lag = Math.max(lag, Math.abs(s.dive.position - s.dive.slider));
  }
  const fwd = await state();
  for (let k = 11; k >= 4; k--) {
    await page.mouse.move(xAt(k * 0.03), track.y);
    await page.evaluate(() => window.__app.step(1 / 60, 1));
  }
  await page.mouse.up();
  await advance(page, 0.5);
  const bwd = await state();
  check(
    'a drag scrubs the dive with the hand',
    lag < 0.05 && fwd.dive.position > 0.6,
    `lag ${lag.toFixed(3)}, at ${fwd.dive.position.toFixed(2)}`,
  );
  check(
    'back again, and it stays where let go',
    bwd.dive.position < fwd.dive.position - 0.3 && !bwd.dive.moving,
    bwd.dive.position.toFixed(2),
  );
  // a click on the track glides there, speed-limited
  await page.mouse.click(track.x + track.w - 1, track.y);
  await page.evaluate(() => window.__app.step(1 / 60, 30));
  const t1 = await state();
  check(
    'a click on the track travels (does not jump)',
    t1.dive.moving && t1.dive.position < 1.2,
    t1.dive.position.toFixed(2),
  );
  await advance(page, 5);
  const t2 = await state();
  check('…and arrives at the rows', t2.dive.position > 1.99 && !t2.dive.moving, t2.dive.position.toFixed(2));
  await advance(page, 2.2);
  // «де ми»: the platform's floor ladder lights the floor on screen, by its plain name in the prologue
  check(
    'floor ladder: «ряди кульок» lit',
    (await page.evaluate(
      () => document.querySelector('[data-ui="floor-ladder"] .fl-row.on')?.textContent,
    )) === 'ряди кульок',
  );
  const d2 = await state();
  check('2 s on the rows', d2.deep > 1.99 && d2.dive.dwell >= 2, `deep ${d2.deep.toFixed(2)}`);
  check('takeaway shown', await takeaway());

  // `riddle` on the crawl: one slider of true time is the moment of the scene (DECISIONS §60 t)
  await enter('riddle');
  const r0 = await state();
  check(
    'entry: time 0, lamp dark, the scene in place',
    r0.riddle.seconds === 0 && !r0.riddle.lampOn && r0.riddle.ready,
  );
  check(
    'no button, no clock: one slider',
    await page.evaluate(
      () =>
        !document.querySelector('[data-ui="ctl-go"], [data-ui="ctl-clock"]') &&
        !!document.querySelector('[data-ui="ctl-riddle-time"] input.dk-range'),
    ),
  );
  await advance(page, 16);
  check('a hint after 15 s', await shown('[data-ui="path-hint"]'));
  const rt = await page.evaluate(() => {
    const r = document.querySelector('[data-ui="ctl-riddle-time"] input.dk-range').getBoundingClientRect();
    return { x: r.x, y: r.y + r.height / 2, w: r.width };
  });
  const tAt = (f) => rt.x + 8 + (rt.w - 16) * f;
  // the lamp follows the time in the same frame: on just above 0, off again at 0
  await page.mouse.move(tAt(0), rt.y);
  await page.mouse.down();
  await page.mouse.move(tAt(0.03), rt.y, { steps: 2 });
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  const on = await state();
  check(
    'the time leaves 0: the lamp shines in that frame',
    on.light > 0.5 && on.riddle.seconds > 0,
    `light ${on.light.toFixed(2)}, ${on.riddle.seconds.toFixed(1)} s`,
  );
  await page.mouse.move(tAt(-0.05), rt.y, { steps: 2 });
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  const off = await state();
  check(
    'back to 0: dark again',
    off.riddle.seconds === 0 && off.light < 0.5,
    `light ${off.light.toFixed(2)}`,
  );
  // a drag scrubs the scene with the hand
  let timeLag = 0;
  for (let k = 1; k <= 10; k++) {
    await page.mouse.move(tAt(k * 0.05), rt.y);
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    const s = (await state()).riddle;
    timeLag = Math.max(timeLag, Math.abs(s.seconds - s.target));
  }
  await page.mouse.up();
  check('a drag is the moment of the scene', timeLag < 0.2, `lag ${timeLag.toFixed(2)} s`);
  // a click on the track's end glides there; the takeaway waits for a second at the end
  await page.mouse.click(rt.x + rt.w - 1, rt.y);
  await page.evaluate(() => window.__app.step(1 / 60, 30));
  const mid = (await state()).riddle;
  check(
    'a click on the track travels (the snail crawls, no jump)',
    mid.seconds > 70 && mid.seconds < 136,
    `${mid.seconds.toFixed(1)} s`,
  );
  await advance(page, 3.2);
  const end = (await state()).riddle;
  check(
    'at the end: snail ≈ 13.6 cm, spark ≈ 6.0 mm',
    Math.abs(end.snailCm - 13.6) < 0.1 && Math.abs(end.sparkMm - 6.0) < 0.05,
    `${end.snailCm.toFixed(2)} cm, ${end.sparkMm.toFixed(2)} mm`,
  );
  await advance(page, 1.2);
  check('takeaway after a second at the end', await takeaway());
  await page.click('[data-ui="path-more"]');
  await advance(page, 0.4);
  check('«Докладніше» opens', (await page.getAttribute('[data-ui="path-more"]', 'aria-expanded')) === 'true');
  const sw = await at(page, 'switch');
  await page.mouse.click(sw.x, sw.y);
  await advance(page, 0.3);
  check("the stand's switch is inert here", (await state()).riddle.lampOn);

  await enter('map');
  // the platform's journey map on the step's board (journeyInset): the stops are real buttons
  check('the journey map is on the board', await shown('[data-ui="journey-stop:wire"]'));
  check('takeaway hidden before the stops are opened', !(await takeaway()));
  for (const id of ['wire', 'charge', 'battery', 'flow', 'resistance', 'lamp', 'drain']) {
    await page.click(`[data-ui="journey-stop:${id}"]`);
    await advance(page, 0.5);
  }
  check(
    'the card names the last stop',
    (await page.textContent('[data-ui="journey-card"]'))?.includes('Чому батарейка сідає?'),
  );
  const m = await state();
  check('all seven stops opened', m.map.opened === 7, `${m.map.opened} / ${m.map.of}`);
  check('takeaway shown', await takeaway());

  step = 'console';
  const errors = await appErrors(page);
  check(
    'no console errors or warnings',
    errors.length === 0,
    errors
      .slice(0, 2)
      .map((e) => e.message.slice(0, 160))
      .join(' | '),
  );
  // regression (B-circuit-prologue §6.4): a frozen deep link straight into `map` laid the journey map out in a
  // loop of resize notifications («ResizeObserver loop completed …») — four fresh loads, no console error
  step = 'deep map';
  for (let n = 0; n < 4; n++) {
    await openApp(
      page,
      appUrl(baseUrl(args), {
        route: 'circuit/prologue/map',
        freeze: 3,
        extra: { hud: 'dom', n: String(n) },
      }),
    );
    await advance(page, 1);
    const deep = await appErrors(page);
    check(
      `deep link #${n + 1}: no console error`,
      deep.length === 0,
      deep.map((e) => e.message.slice(0, 120)).join(' | '),
    );
  }
  failed = results.some((x) => !x.ok);
  console.log(
    `${failed ? 'FAIL' : 'PASS'} prologue interactions — ${results.filter((x) => x.ok).length}/${results.length} checks at ${width}x${height}`,
  );
} catch (e) {
  console.error(`interaction test crashed: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
