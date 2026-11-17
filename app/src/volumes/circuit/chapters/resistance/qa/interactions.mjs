#!/usr/bin/env node
/* global process, console, window, document */
// Interaction test of chapter `circuit/resistance` (lenovo; dev server or production preview up), DOM interface:
//
//   node app/src/volumes/circuit/chapters/resistance/qa/interactions.mjs --port 5315 [--size 1280x720] [--touch] [--out <dir>]
//
// The chapter is entered from its neighbour (`flow/push` on screen): its first frame is the stand shot with the lamp
// on, then the dive. Every goal is reached by real pointer input (mouse, or touch with --touch): an electron
// tapped and five hits after it, the switch opened and closed, the snake's handle pulled to its end (and back on
// the way: it scrubs), the lens carried round the loop. After each the panel must show «Висновок». Each step is
// arrived at the way a reader arrives, and every travelling number is sampled frame by frame on the way in: its
// largest per-frame change is bounded. «Докладніше» is opened once, «Згадайте» is checked, the chapter's last
// frame is the stand shot with the lamp on, the closing card is reached; no console errors. Frozen engine clock.
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
import { advance, at, pointer, press, read, shown, strides } from './helpers.mjs';
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
/** The main shot's camera (STAGE_SHOTS.stand). */
const STAND = [0, 8.05, 8.6];
const atStand = (c) => Math.hypot(c[0] - STAND[0], c[1] - STAND[1], c[2] - STAND[2]) < 0.6;
/** Per-frame bounds of the travelling numbers (camera in world units, the rest per frame at 60 fps). */
const BOUND = {
  camera: 0.35,
  lensUse: 0.05,
  window: 0.05,
  deep: 0.08,
  stretch: 0.06,
  thermo: 0.06,
  frame: 0.06,
  heat: 0.06,
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
const enter = async (id, settle = 4.5) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('resistance', s), id);
  await smooth(settle);
  check('no takeaway before the goal', !(await takeaway()));
};
const p = await pointer(page, isTouch);

const steps = {
  async bumps() {
    step = 'bumps';
    await page.evaluate(() => window.__app.goto('resistance', 'bumps'));
    await advance(page, 0.02);
    const first = await read(page, 'resistance');
    check(
      'the first frame is the stand shot with the lamp on',
      atStand(first.camera) && first.glow > 0.9,
      `${first.camera} glow ${first.glow.toFixed(2)}`,
    );
    await snap('bumps-first');
    await smooth(3.6);
    const down = await read(page, 'resistance');
    check('the dive ends on the rows in one motion', down.deep > 1.99 && !down.flying, `deep ${down.deep}`);
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] .btn');
    check('«Згадайте» link', await shown(page, '[data-ui="path-recall"]'));
    await snap('bumps-start');
    const e = await at(page, 'free-electron');
    await p.tap(e.x, e.y);
    const marked = await read(page, 'bumps');
    check('a tap marks an electron', marked.marked >= 0, JSON.stringify(marked));
    check('no takeaway right after the marking', !(await takeaway()));
    await advance(page, 1.2);
    await snap('bumps-mid');
    let s = await read(page, 'bumps');
    for (let i = 0; i < 12 && s.hits < 5; i++) {
      await advance(page, 0.5);
      s = await read(page, 'bumps');
    }
    check('five hits after the marking within six seconds', s.hits >= 5, `${s.hits} hits`);
    check('takeaway', await takeaway());
    await press(page, '[data-ui="path-more"]');
    check(
      '«Докладніше» opens',
      await page.evaluate(
        () => document.querySelector('[data-ui="path-more"]')?.getAttribute('aria-expanded') === 'true',
      ),
    );
    await snap('bumps-goal');
  },
  async heat() {
    await advance(page, 0.5);
    const start = await read(page, 'heat');
    check('on the stand, the lens a window, the thermometer out', start.landed, JSON.stringify(start));
    await snap('heat-start');
    let sw = await at(page, 'switch');
    await p.tap(sw.x, sw.y);
    await advance(page, 0.1);
    check('a tap opens the switch: the lamp goes dark', (await read(page, 'resistance')).glow < 0.1);
    await advance(page, 2);
    const open = await read(page, 'heat');
    check(
      'without current the atoms calm down, the column sinks',
      open.heat < 0.06 && open.level < 0.1,
      JSON.stringify(open),
    );
    await snap('heat-open');
    sw = await at(page, 'switch');
    await p.tap(sw.x, sw.y);
    await advance(page, 0.1);
    check('a tap closes it again: the lamp lights', (await read(page, 'resistance')).glow > 0.5);
    check('no takeaway before three seconds', !(await takeaway()));
    await advance(page, 3.1);
    const closed = await read(page, 'heat');
    check(
      'with current they tremble harder, the column above its tick',
      closed.heat > 0.5 && closed.level > 0.95,
      JSON.stringify(closed),
    );
    check('takeaway', await takeaway());
    await snap('heat-goal');
  },
  async shape() {
    await snap('shape-start');
    const g = await at(page, 'grip');
    const end = await at(page, 'grip-end');
    await p.down(g.x, g.y);
    const ks = [];
    const go = async (f0, f1, n) => {
      for (let i = 1; i <= n; i++) {
        const f = f0 + ((f1 - f0) * i) / n;
        await p.move(g.x + (end.x - g.x) * f, g.y + (end.y - g.y) * f);
        ks.push((await read(page, 'shape')).k);
      }
    };
    await go(0, 0.6, 30);
    await advance(page, 0.3);
    const mid = await read(page, 'shape');
    check(
      'pulled half way: longer, thinner, less current, a dimmer lamp',
      mid.k > 5 && mid.amps < 0.29 && mid.glow < 0.95,
      JSON.stringify(mid),
    );
    await snap('shape-mid');
    await go(0.6, 0.25, 15);
    await advance(page, 0.3);
    check('…and back: it scrubs both ways', (await read(page, 'shape')).k < mid.k);
    await go(0.25, 1.08, 30);
    await advance(page, 0.4);
    await p.up();
    await advance(page, 0.3);
    const jump = Math.max(...ks.slice(1).map((k, i) => Math.abs(k - ks[i])));
    check('the snake follows the hand in small steps', jump < 4, `largest step of k ${jump.toFixed(2)}`);
    const s = await read(page, 'shape');
    check(
      'at the end: k = 40, «0,09 A», the lamp barely glows',
      s.k > 39.6 && s.amps <= 0.15 && s.glow < 0.2,
      JSON.stringify(s),
    );
    check('takeaway', await takeaway());
    await snap('shape-goal');
  },
  async balance() {
    await snap('balance-start');
    const l = await at(page, 'lens-hit');
    await p.down(l.x, l.y);
    for (let k = 1; k <= 24; k++) {
      const q = await at(page, `loop-${k}`);
      await p.move(q.x, q.y);
      await advance(page, 0.12);
      const b = await read(page, 'balance');
      if (['switch', 'lamp', 'minus', 'plus'].includes(b.place) && (b.dwell[b.place] ?? 0) < 1.1) {
        await advance(page, 1.2);
        if (b.place === 'lamp') await snap('balance-lamp');
      }
    }
    await p.up();
    await advance(page, 0.3);
    const b = await read(page, 'balance');
    check(
      'the lens went round the loop: minus, plus, switch, lamp',
      ['minus', 'plus', 'switch', 'lamp'].every((k) => b.dwell[k] >= 1),
      JSON.stringify(b.dwell),
    );
    check('takeaway', await takeaway());
    await snap('balance-goal');
    await advance(page, 5.5);
    const end = await read(page, 'resistance');
    const m = await read(page, 'motion');
    check(
      'the last frame is the stand shot, the lamp on, the lens home',
      atStand(end.camera) && end.glow > 0.9 && m.lensUse < 0.01,
      `${end.camera} lens ${m.lensUse.toFixed(2)}`,
    );
    await snap('balance-end');
    // the chapter's end (tools/qa/next-chapter.mjs): «Далі» brings the closing card, «Далі» again the next chapter
    const border = await nextChapter(page, (s) => advance(page, s));
    check(
      'closing card after the last step: its three lines and the bridge',
      border.card.shown && border.card.lines === 3 && border.card.bridge.length > 0,
      `${border.card.lines} lines`,
    );
    check(
      '«Далі» on the card: the next chapter',
      border.landed.chapterId === 'lamp',
      `${border.landed.chapterId}/${border.landed.stepId}`,
    );
  },
};

try {
  const base = baseUrl(args);
  // the reader comes from the neighbour: flow's last step on screen
  await openApp(page, appUrl(base, { route: 'circuit/flow/push', freeze: 0 }));
  await page.evaluate(() => window.__app.pause());
  await advance(page, 1);
  for (const id of ['bumps', 'heat', 'shape', 'balance']) {
    if (id !== 'bumps') await enter(id);
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
