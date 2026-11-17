#!/usr/bin/env node
/* global process, console, window, document */
// Interaction test of chapter `circuit/flow` (lenovo; dev server or production preview up), DOM interface:
//
//   node app/src/volumes/circuit/chapters/flow/qa/interactions.mjs --port 5314 [--size 1280x720] [--touch] [--out <dir>]
//
// Every goal of the script is reached by real pointer input (mouse, or touch with --touch): the wire's end into
// its clamp, the frame onto the wire and along it, the switch to the second seat and clicked, the tap, the two
// «Час» sliders, the switch; after each the panel must show «Висновок». Each step is arrived at the way a reader
// arrives (the previous step on screen), and every travelling number (camera, props) is sampled frame by frame
// on the way in: its largest per-frame change is bounded. «Докладніше» is opened once, «Згадайте» is checked, the
// closing card is reached; no console errors. Frozen engine clock: deterministic. Exit code 1 on any failure.
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
import { nextChapter } from '../../../../../../../tools/qa/next-chapter.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const isTouch = Boolean(args.touch);
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height, touch: isTouch });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(9)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) =>
  out && screenshot(page, `${out}/${width}x${height}${isTouch ? 't' : ''}-${name}.jpg`);
/** Per-frame bounds of the travelling numbers (camera in world units, the rest 0…1 per frame at 60 fps). */
const BOUND = {
  camera: 0.35,
  end: 0.06,
  counter: 0.06,
  seat: 0.08,
  jumper: 0.12,
  lenses: 0.05,
  water: 0.04,
  crawl: 0.05,
  lensUse: 0.05,
  window: 0.05,
};
const smooth = async (seconds) => {
  const s = await strides(page, 'motion', seconds);
  const bad = Object.entries(s).filter(([k, v]) => v > (BOUND[k] ?? 0.1));
  check(
    'on the way in nothing jumps (largest per-frame steps)',
    bad.length === 0,
    Object.entries(s)
      .filter(([, v]) => v > 1e-4)
      .map(([k, v]) => `${k} ${v.toFixed(3)}`)
      .join(', ') || 'still',
  );
};
/** Arrive at a step the way a reader does: the previous step on screen, then the move. */
const enter = async (id, settle = 2.8) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('flow', s), id);
  await smooth(settle);
  check('no takeaway before the goal', !(await takeaway()));
};
const p = await pointer(page, isTouch);
const via = async (names) => Promise.all(names.map((n) => at(page, n)));
const sliderAt = async (id, fx) => {
  const r = await locate(page, id);
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  return { x: x0 + (x1 - x0) * fx, y: r.y + r.h * 0.18 };
};

const steps = {
  async connect() {
    check('opening card', await shown(page, '[data-ui="path-opening"]'));
    await press(page, '[data-ui="path-opening"] .btn');
    check('«Згадайте» link', await shown(page, '[data-ui="path-recall"]'));
    check('the lamp is dark while the end lies out', (await read(page, 'flow')).glow < 0.05);
    await snap('connect-start');
    await p.path(await via(['loose-end', 'minus-mouth']), 16);
    await advance(page, 0.05);
    const lit = await read(page, 'flow');
    check(
      'the end clicks in and the lamp lights at once',
      (await read(page, 'connect')).inClamp && lit.glow > 0.5,
      lit.glow.toFixed(2),
    );
    check('no takeaway before two seconds of light', !(await takeaway()));
    await advance(page, 2.3);
    check('takeaway after the look into the lens', await takeaway());
    await press(page, '[data-ui="path-more"]');
    check(
      '«Докладніше» opens',
      await page.evaluate(
        () => document.querySelector('[data-ui="path-more"]')?.getAttribute('aria-expanded') === 'true',
      ),
    );
    await snap('connect-goal');
  },
  async count() {
    await p.path(await via(['counter', 'wire-after']), 16);
    await advance(page, 0.6);
    const mid = await read(page, 'same');
    check(
      'on the wire the frame counts its second',
      mid.progress > 0.2 && mid.progress < 1,
      mid.progress.toFixed(2),
    );
    await snap('count-mid');
    await advance(page, 0.9);
    check('takeaway after one full second', await takeaway());
    await snap('count-goal');
  },
  async same() {
    for (const [zone, path] of [
      ['plus', ['counter', 'track-9', 'track-10', 'wire-plus']],
      ['after', ['counter', 'track-9', 'track-8']],
      ['before', ['counter', 'track-7', 'track-6', 'track-5']],
      ['minus', ['counter', 'track-4', 'track-3', 'track-2', 'track-1']],
    ]) {
      await p.path(await via(path), 10);
      await advance(page, 1.4);
      const s = await read(page, 'same');
      check(
        `the bead slid to «${zone}» and counted a second there`,
        s.counted.includes(zone),
        `${s.zone} ${s.counted.join(',')}`,
      );
      if (zone === 'before') await snap('same-before');
    }
    check('takeaway after the four stretches', await takeaway());
  },
  async loop() {
    await snap('loop-start');
    await p.path(await via(['switch', 'seat-second']), 18);
    await advance(page, 1.2);
    let s = await read(page, 'loop');
    check(
      'the switch lies in the second seat, the jumper in the first, lamp lit',
      s.seat > 0.99 && s.jumper > 0.99 && s.whole,
      JSON.stringify(s),
    );
    const sw = await at(page, 'switch');
    await p.tap(sw.x, sw.y);
    check(
      'opened far away: the frame on the near wire shows «0» at once',
      !(await read(page, 'loop')).whole && (await read(page, 'same')).progress === 0,
    );
    await snap('loop-open');
    await p.tap(sw.x, sw.y);
    await advance(page, 1.4);
    check('takeaway after open and close in the second seat', await takeaway());
    await snap('loop-goal');
  },
  async pump() {
    check('the stand has turned into the water picture', (await read(page, 'pump')).morph > 0.999);
    await snap('pump-start');
    const tap = await at(page, 'tap');
    await p.tap(tap.x, tap.y);
    check('the tap shut: the water stops in the same frame', !(await read(page, 'pump')).flowing);
    await snap('pump-shut');
    await p.tap(tap.x, tap.y);
    check('…and runs again', (await read(page, 'pump')).flowing);
    check('takeaway', await takeaway());
  },
};

/** Drag a slider's thumb from `from` to `to` in small even steps, sampling `reader` each step; returns the samples. */
const scrubSlider = async (id, from, to, reader, n = 40) => {
  const a = await sliderAt(id, from);
  await p.down(a.x, a.y);
  const samples = [];
  for (let k = 1; k <= n; k++) {
    const b = await sliderAt(id, from + ((to - from) * k) / n);
    await p.move(b.x, b.y);
    samples.push(await read(page, reader));
  }
  return { samples, release: () => p.up() };
};

Object.assign(steps, {
  async snail() {
    await advance(page, 1);
    check(
      'the crawl scene is in place, the lamp dark at time 0',
      (await read(page, 'snail')).ready && (await read(page, 'flow')).glow < 0.05,
    );
    await snap('snail-start');
    const { samples, release } = await scrubSlider('snail-time', 0, 1.02, 'snail');
    await release();
    const jumpCm = Math.max(...samples.slice(1).map((s, i) => Math.abs(s.snailCm - samples[i].snailCm)));
    check(
      'a drag scrubs the time: the snail creeps in small steps',
      jumpCm < 1.2,
      `largest step ${jumpCm.toFixed(2)} cm`,
    );
    check('the lamp lit once the time left 0', (await read(page, 'flow')).glow > 0.5);
    await advance(page, 1.4);
    const s = await read(page, 'snail');
    check(
      'at the end: snail 13.6 cm, the marked electron on 6 mm',
      s.snailCm > 13.5 && Math.abs(s.sparkMm - 6) < 0.05,
      `${s.snailCm.toFixed(2)} cm, ${s.sparkMm.toFixed(2)} mm`,
    );
    check('takeaway', await takeaway());
    await snap('snail-goal');
  },
  async together() {
    check(
      'three lenses lie on the loop, the switch open, the lamp dark',
      (await read(page, 'together')).landed && (await read(page, 'flow')).glow < 0.05,
    );
    await snap('together-start');
    const sw = await at(page, 'switch');
    await p.down(sw.x, sw.y);
    await p.up();
    const t = await read(page, 'together');
    const f = await read(page, 'flow');
    check(
      'one click: the shift starts in all three lenses in the frame the circuit closes',
      t.drifting.every(Boolean) && f.whole,
      `${t.drifting} glow ${f.glow.toFixed(2)}`,
    );
    await advance(page, 2.2);
    check('takeaway after two seconds closed', await takeaway());
    await snap('together-goal');
  },
  async push() {
    check('lamp dark at time 0', (await read(page, 'flow')).glow < 0.05);
    await snap('push-start');
    const { samples, release } = await scrubSlider('push-time', 0, 0.62, 'push', 50);
    const jump = Math.max(...samples.slice(1).map((s, i) => Math.abs(s.front - samples[i].front)));
    check(
      'the wave scrubs with the thumb, in small steps',
      jump < 0.06,
      `largest front step ${jump.toFixed(3)}`,
    );
    const order = samples.map((s) => s.drifting.filter(Boolean).length);
    check(
      'the lenses start one by one as the wave passes them',
      order.includes(1) && order.at(-1) >= 2,
      order.join(''),
    );
    await snap('push-mid');
    const back = await sliderAt('push-time', 0.1);
    await p.move(back.x, back.y);
    check(
      '…and back: scrubbed back, the shift stops again',
      (await read(page, 'push')).drifting.filter(Boolean).length <= 1,
    );
    await release();
    const end = await sliderAt('push-time', 1.0);
    await p.tap(end.x, end.y);
    await advance(page, 4.5);
    const s = await read(page, 'push');
    check(
      'at the end the two fronts have met, all three lenses drift',
      s.front > 0.999 && s.drifting.every(Boolean),
      JSON.stringify(s),
    );
    check('the lamp stays dark within the nanosecond', (await read(page, 'flow')).glow < 0.05);
    check('takeaway', await takeaway(), JSON.stringify(await read(page, 'push')));
    await snap('push-goal');
    await advance(page, 5.5);
    check(
      'then back to ordinary time: lenses gone, lamp lit',
      (await read(page, 'push')).returned && (await read(page, 'flow')).glow > 0.5,
    );
    await snap('push-end');
    // the chapter's end (tools/qa/next-chapter.mjs): «Далі» brings the closing card, «Далі» again the next chapter
    const border = await nextChapter(page, (s) => advance(page, s));
    check(
      'closing card after the last step: its three lines and the bridge',
      border.card.shown && border.card.lines === 3 && border.card.bridge.length > 0,
      `${border.card.lines} lines`,
    );
    check(
      '«Далі» on the card: the next chapter',
      border.landed.chapterId === 'resistance',
      `${border.landed.chapterId}/${border.landed.stepId}`,
    );
  },
});

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: 'circuit/flow/connect', freeze: 0, extra: { hud: 'dom' } }));
  await page.evaluate(() => window.__app.pause());
  await advance(page, 2);
  for (const id of ['connect', 'count', 'same', 'loop', 'pump', 'snail', 'together', 'push']) {
    if (id === 'connect') step = id;
    else await enter(id);
    await steps[id]();
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
