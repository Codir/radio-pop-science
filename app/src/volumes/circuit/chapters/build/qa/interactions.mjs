#!/usr/bin/env node
/* global process, console, window, document, getComputedStyle */
// Interaction test of chapter `circuit/build` (lenovo; dev server or production preview up), DOM interface:
//
//   node app/src/volumes/circuit/chapters/build/qa/interactions.mjs --port 5318 [--size 1280x720] [--touch] [--out <dir>]
//
// Every goal of the script is reached by real pointer input (mouse, or touch with --touch): six wire ends dragged
// into six clamps and the switch tapped (`first-light`); a touch on the «−» clamp, the lens carried along the loop
// and tapped over the lamp's clamp and over the far wire (`find-fault`); the lamp wire's end moved onto «−»
// (`short`); the slider «Скласти» dragged to its end (`flashlight`). After each the panel must show «Висновок».
// Each step is arrived at the way a reader arrives (the previous step on screen) and every travelling number
// (camera, the six ends, lens, frame, heat view, unfold) is sampled frame by frame on the way in; the slider's
// drag is sampled too. «Докладніше» opened once, «Згадайте» present, the closing card over the last frame; no
// console errors. Frozen engine clock: deterministic. Exit code 1 on any failure.
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
import { advance, at, locate, pointer, press, read, shown, strides } from './helpers.mjs';
import { sheetTab } from '../../../../../../../tools/qa/sheet-tab.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const isTouch = Boolean(args.touch);
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height, touch: isTouch });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(11)} ${what}${detail === '' ? '' : `  [${detail}]`}`,
  );
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) =>
  out && screenshot(page, `${out}/${width}x${height}${isTouch ? 't' : ''}-${name}.jpg`);
/** Per-frame bounds of the travelling numbers (world units per frame at 60 fps; shares 0…1 per frame). */
const BOUND = { camera: 0.35, a0: 0.2, a1: 0.2, b0: 0.2, b1: 0.2, c0: 0.2, c1: 0.2, lens: 0.25 };
const smooth = async (seconds, what = 'on the way in nothing jumps (largest per-frame steps)') => {
  const s = await strides(page, 'motion', seconds);
  const bad = Object.entries(s).filter(([k, v]) => v > (BOUND[k] ?? 0.06));
  check(
    what,
    bad.length === 0,
    Object.entries(s)
      .filter(([, v]) => v > 1e-4)
      .map(([k, v]) => `${k} ${v.toFixed(3)}`)
      .join(', ') || 'still',
  );
};
const enter = async (id, settle = 3) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('build', s), id);
  await smooth(settle);
  check('no takeaway before the goal', !(await takeaway()));
};
const p = await pointer(page, isTouch);
const via = async (names) => Promise.all(names.map((n) => at(page, n)));
/** Drag a probe to another along a low arc (so the hand passes no other clamp on the way). */
const carry = async (from, to, lift = 0.06) => {
  const [a, b] = await via([from, to]);
  const mid = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + lift * height };
  await p.path([a, mid, b], 10);
  await advance(page, 0.35);
};

const steps = {
  async 'first-light'() {
    check('the chapter opens on the lit stand', (await read(page, 'build')).glow > 0.5);
    await snap('first-light-open');
    await smooth(3.2, 'the ends come out and lie down (largest per-frame steps)');
    check('then the lamp is dark, every end out', (await read(page, 'build')).glow < 0.05);
    check('«Згадайте» link', await shown(page, '[data-ui="path-recall"]'));
    await snap('first-light-start');
    await carry('end-c0', 'clamp-minus');
    await carry('end-a0', 'clamp-plus');
    await carry('end-a1', 'clamp-swIn');
    await snap('first-light-mid');
    await carry('end-b0', 'clamp-swOut');
    await carry('end-c1', 'clamp-lampA');
    check('still dark with one end out', (await read(page, 'build')).glow < 0.05);
    await carry('end-b1', 'clamp-lampB');
    await advance(page, 0.4);
    const fl = await read(page, 'first-light');
    check('six ends in six clamps: the lamp lights', (await read(page, 'build')).glow > 0.5, fl.verdict);
    check('no takeaway before the switch puts it out', !(await takeaway()));
    const sw = await at(page, 'switch');
    await p.tap(sw.x, sw.y);
    await advance(page, 0.5);
    check('the switch puts it out', (await read(page, 'build')).glow < 0.1);
    check('takeaway', await takeaway());
    await p.tap(sw.x, sw.y);
    await advance(page, 0.5);
    await press(page, '[data-ui="path-more"]');
    check(
      '«Докладніше» opens',
      await page.evaluate(
        () => document.querySelector('[data-ui="path-more"]')?.getAttribute('aria-expanded') === 'true',
      ),
    );
    await snap('first-light-goal');
  },
  async 'find-fault'() {
    await advance(page, 1.5);
    const f = await read(page, 'find-fault');
    check('fault 1 is on the stand, the lamp dark', f.fault === 1 && f.phase === 'fault', f.phase);
    await snap('find-fault-1');
    const f1 = await at(page, 'fault-1');
    await p.tap(f1.x, f1.y);
    await advance(page, 0.8);
    check('a touch on the «−» clamp mends it: the lamp lights', (await read(page, 'build')).glow > 0.5);
    await smooth(2.6, 'the stand resets into fault 2 (largest per-frame steps)');
    const lens = await at(page, 'lens');
    await p.tap(lens.x, lens.y);
    await advance(page, 1);
    await carry('lens', 'fault-2', 0);
    await advance(page, 1);
    check('the lens is over the lamp’s clamp', (await read(page, 'find-fault')).over2);
    await snap('find-fault-2');
    const l2 = await at(page, 'lens');
    await p.tap(l2.x, l2.y);
    await advance(page, 1.6);
    check('a touch there mends fault 2', (await read(page, 'find-fault')).fixed === 2);
    await advance(page, 2.6);
    await carry('lens', 'fault-3', 0);
    await advance(page, 1);
    check('the lens is over the break in the far wire', (await read(page, 'find-fault')).over3);
    await snap('find-fault-3');
    const l3 = await at(page, 'lens');
    await p.tap(l3.x, l3.y);
    await advance(page, 0.9);
    await snap('find-fault-swap');
    await advance(page, 2.2);
    check(
      'all three mended, the lamp lights',
      (await read(page, 'find-fault')).fixed === 3 && (await read(page, 'build')).glow > 0.5,
    );
    check('takeaway', await takeaway());
    await snap('find-fault-goal');
  },
  async short() {
    const s0 = await read(page, 'short');
    check('lit, the frame reads 0,3 A', s0.verdict === 'lit' && Math.abs(s0.amps - 0.3) < 0.01, s0.amps);
    await snap('short-start');
    await carry('end-b1', 'clamp-minus', -0.02);
    await advance(page, 0.6);
    const s1 = await read(page, 'short');
    check(
      'the end in «−»: a short, the lamp dark, ≈ 6 A at once',
      s1.shorted && s1.amps > 5 && (await read(page, 'build')).glow < 0.1,
      s1.amps.toFixed(2),
    );
    check('no takeaway before 2 s', !(await takeaway()));
    await advance(page, 2.3);
    const s2 = await read(page, 'short');
    check('the battery is hot in the lens', s2.heat > 0.75, s2.heat.toFixed(2));
    check('takeaway', await takeaway());
    await snap('short-goal');
  },
  async flashlight() {
    // a narrow desktop window: «Опис» and «Керування» share the sheet (tools/qa/sheet-tab.mjs)
    await sheetTab(page, 'controls', (pg) => advance(pg, 0.5));
    const r = await locate(page, 'fold');
    const y = r.y + r.h * 0.18;
    const x0 = r.x - r.w / 2 + r.w * 0.04;
    const x1 = r.x + r.w / 2 + 20;
    await snap('flashlight-start');
    await p.down(x0, y);
    let worst = 0;
    let prev = (await read(page, 'motion')).camera;
    for (let i = 1; i <= 60; i++) {
      await p.move(x0 + ((x1 - x0) * i) / 60, y);
      const cam = (await read(page, 'motion')).camera;
      worst = Math.max(worst, Math.hypot(...cam.map((v, k) => v - prev[k])));
      prev = cam;
      if (i === 30) await snap('flashlight-mid');
    }
    await p.up();
    check('the camera rides the slider without a jump', worst < 0.35, worst.toFixed(3));
    await advance(page, 1.2);
    const f = await read(page, 'flashlight');
    check('folded: the flashlight, the lamp lit all the way', f.unfold < 0.001 && f.glow > 0.9, f.unfold);
    check('takeaway', await takeaway());
    await snap('flashlight-goal');
    await advance(page, 2.6);
    // the volume's ending: the format's closing card takes the panel, the slider's dock fades away
    check('the closing card takes the panel', await shown(page, '[data-ui="path-closing"]'));
    check(
      '…with the four lines of the script',
      await page.evaluate(
        () => document.querySelectorAll('[data-ui="path-closing"] .path-now li').length === 4,
      ),
    );
    check('…and the journey map', await shown(page, '[data-ui="path-map"]'));
    check('…and «Почати з початку»', await shown(page, '[data-ui="path-restart"]'));
    check(
      'the slider has gone with its dock',
      !(await shown(page, '[data-ui="ctl-fold"]')) ||
        !(await page.evaluate(() => {
          const r = document.querySelector('[data-ui="dock"]')?.getBoundingClientRect();
          return (
            r && r.height > 4 && getComputedStyle(document.querySelector('[data-ui="dock"]')).opacity > 0.1
          );
        })),
    );
    await snap('flashlight-card');
    await press(page, '[data-ui="path-map"]');
    check(
      'the map action opens the journey map',
      await page.evaluate(() => !!document.querySelector('[data-ui="map-chrome"]:not([hidden])')),
    );
    await page.keyboard.press('Escape');
    await advance(page, 0.8);
    await press(page, '[data-ui="nav-prev"]');
    await advance(page, 1.2);
    check(
      '«back» returns to the step and its slider',
      (await shown(page, '[data-ui="path-step"]')) &&
        !(await shown(page, '[data-ui="path-closing"]')) &&
        (await read(page, 'build')).step === 'flashlight',
    );
    await snap('flashlight-back');
  },
};

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: 'circuit/build/first-light', freeze: 0, extra: {} }));
  await page.evaluate(() => window.__app.pause());
  await advance(page, 0.1);
  for (const id of ['first-light', 'find-fault', 'short', 'flashlight']) {
    if (id === 'first-light') step = id;
    else await enter(id);
    await steps[id]();
  }
  // every «Згадайте» link of the chapter leads to a built step (resistance, drain included)
  step = 'recall';
  for (const id of ['first-light', 'find-fault', 'short', 'flashlight']) {
    await page.evaluate((s) => window.__app.goto('build', s, { instant: true }), id);
    await advance(page, 0.5);
    const n = await page.evaluate(() => document.querySelectorAll('[data-ui="path-recall"]').length);
    for (let i = 0; i < n; i++) {
      await page.evaluate((k) => document.querySelectorAll('[data-ui="path-recall"]')[k]?.click(), i);
      await advance(page, 1.5);
      const pos = await page.evaluate(() => window.__app.position());
      check(
        `${id}: «Згадайте» ${i + 1} opens a step`,
        pos && pos.chapterId !== 'build',
        pos ? `${pos.chapterId}/${pos.stepId}` : 'none',
      );
      await press(page, '[data-ui="path-back"]');
      await advance(page, 1.5);
    }
  }
  step = 'all';
  const errors = (await appErrors(page)).filter((e) => e.level === 'error');
  check(
    'no console errors',
    errors.length === 0,
    errors
      .map((e) => e.text)
      .join(' | ')
      .slice(0, 300),
  );
} catch (e) {
  check(`script error: ${e.message}`, false);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed (${width}x${height}${isTouch ? ', touch' : ''})`,
);
process.exit(failed.length ? 1 : 0);
