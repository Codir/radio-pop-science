#!/usr/bin/env node
/* global process, console, window, document */
// Interaction test of chapter `circuit/battery` (lenovo; dev server or production preview up), plain address:
//
//   node app/src/volumes/circuit/chapters/battery/qa/interactions.mjs --port 5313 [--size 1280x720] [--touch] [--out <dir>]
//
// Every goal of the script is reached by real pointer input (mouse, or a finger with --touch): the lens laid on
// «−» and «+» (a tap on the lens, a drag of it), the «Розріз» slider dragged both ways, the three layers tapped,
// the clump pulled off the minus cap, both probes dragged onto their clamps. After each goal the panel must show
// «Висновок». «Докладніше» opened once, «Згадайте» present, the closing card reached, no console errors. Every step
// change and the cut slider are sampled frame by frame: the largest per-frame change is bounded (no jump).
// Frozen engine clock (`?freeze`): deterministic. Exit code 1 on any failure.
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
import {
  advance,
  at,
  dragTo,
  frame,
  pressUi,
  read,
  scrub,
  sheetTab,
  shown,
  tapProbe,
  thumbAt,
  moveTo,
  useTouch,
} from './helpers.mjs';
import { nextChapter } from '../../../../../../../tools/qa/next-chapter.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const touch = !!args.touch;
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height, touch });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(8)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) =>
  out && screenshot(page, `${out}/${width}x${height}${touch ? 't' : ''}-${name}.jpg`);
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

/**
 * Sample `seconds` frame by frame: the largest per-frame change of the camera (world units), of the cut, of the
 * meter's slide, of the scale's pointer and of the lens on the screen (px).
 */
async function sample(seconds, mid = null) {
  const big = { cam: 0, cut: 0, meter: 0, pointer: 0, lens: 0 };
  let prev = null;
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    await frame(page);
    if (mid && i === Math.round(n * 0.35)) await snap(mid);
    const s = await read(page, 'battery');
    const lens = await at(page, 'lens');
    if (prev) {
      big.cam = Math.max(big.cam, dist(s.camera, prev.s.camera));
      big.cut = Math.max(big.cut, Math.abs(s.cut - prev.s.cut));
      big.meter = Math.max(big.meter, Math.abs(s.meter - prev.s.meter));
      big.pointer = Math.max(big.pointer, Math.abs(s.pointer - prev.s.pointer));
      big.lens = Math.max(big.lens, Math.hypot(lens.x - prev.lens.x, lens.y - prev.lens.y));
    }
    prev = { s, lens };
  }
  return big;
}
const smooth = (what, big) =>
  check(
    `${what}: no jump (largest per-frame change)`,
    big.cam < 0.3 && big.cut < 0.06 && big.meter < 0.06 && big.pointer < 0.08 && big.lens < 0.04 * height,
    `camera ${big.cam.toFixed(3)} · cut ${big.cut.toFixed(3)} · meter ${big.meter.toFixed(3)} · pointer ${big.pointer.toFixed(3)} · lens ${big.lens.toFixed(1)} px`,
  );
/** Arrive at a step the way a reader does: the previous step on screen, then the move, sampled frame by frame. */
async function enter(id, seconds = 2.6) {
  step = id;
  await page.evaluate((s) => window.__app.goto('battery', s), id);
  smooth(`the way into ${id}`, await sample(seconds, `${id}-1mid`));
  await advance(page, 0.3);
  await snap(`${id}-0start`);
  check('no takeaway before the goal', !(await takeaway()));
}

const steps = {
  async poles() {
    check('opening card', await shown(page, '[data-ui="path-opening"]'));
    await pressUi(page, '[data-ui="path-opening"] .btn');
    await snap('poles-0start');
    check('«Згадайте» link to charge/neutral', await shown(page, '[data-ui="path-recall"]'));
    check('no takeaway before the goal', !(await takeaway()));
    // a tap on the lens in its holder: it rises and lies on «−», the camera comes closer — one motion
    await tapProbe(page, 'lens');
    smooth('the lens to «−» and the camera in', await sample(2.2, 'poles-1mid'));
    await advance(page, 1);
    let s = await read(page, 'poles');
    check(
      'the lens lies on «−», the window open',
      s.landed === 'minus' && s.window > 0.95,
      `${s.landed} ${s.window}`,
    );
    check('the scale points at «забагато»', s.pointer > 0.7, s.pointer.toFixed(2));
    await advance(page, 1.2);
    check('no takeaway after «−» alone', !(await takeaway()));
    await snap('poles-1minus');
    // a drag carries the lens to «+»
    const release = await dragTo(page, await at(page, 'lens'), await at(page, 'end-plus'), { steps: 18 });
    await release(0.2);
    smooth('the lens carried to «+»', await sample(1.4));
    await advance(page, 1.5);
    s = await read(page, 'poles');
    check('the lens lies on «+»', s.landed === 'plus', s.landed);
    check('the scale points at «бракує»', s.pointer < -0.7, s.pointer.toFixed(2));
    await advance(page, 1);
    check('takeaway after both ends', await takeaway());
    await pressUi(page, '[data-ui="path-more"]');
    check(
      '«Докладніше» opens',
      await page.evaluate(
        () => document.querySelector('[data-ui="path-more"]')?.getAttribute('aria-expanded') === 'true',
      ),
    );
    await snap('poles-2goal');
  },
  async inside() {
    await sheetTab(page, 'controls');
    let release = await scrub(page, 'cut', 0, 0.5);
    await advance(page, 0.05);
    let c = (await read(page, 'battery')).cut;
    check('a drag scrubs «Розріз» (the cut is where the thumb is)', Math.abs(c - 0.5) < 0.06, c.toFixed(2));
    await moveTo(page, await thumbAt(page, 'cut', 0.5), await thumbAt(page, 'cut', 0.2), 10);
    c = (await read(page, 'battery')).cut;
    check('…and back without letting go', Math.abs(c - 0.2) < 0.06, c.toFixed(2));
    await moveTo(page, await thumbAt(page, 'cut', 0.2), await thumbAt(page, 'cut', 1.02), 30);
    await release();
    await advance(page, 0.8);
    c = (await read(page, 'battery')).cut;
    check('the cut open', c > 0.97, c.toFixed(2));
    await sheetTab(page, 'text');
    for (const id of ['zinc', 'separator', 'cathode']) await tapProbe(page, `layer-${id}`);
    const s = await read(page, 'inside');
    check('three layers touched', s.touched.length === 3, s.touched.join(','));
    await advance(page, 2.4);
    check(
      'the first moment: the scale falls to «порівну»',
      Math.abs((await read(page, 'battery')).pointer) < 0.15,
    );
    await advance(page, 5);
    check('…and climbs back to the mark', (await read(page, 'battery')).pointer > 0.7);
    check('takeaway', await takeaway());
    await snap('inside-2goal');
  },
  async balance() {
    const c = await at(page, 'clump');
    const release = await dragTo(page, c, { x: c.x + 0.12 * height, y: c.y - 0.3 * height }, { steps: 16 });
    const held = await read(page, 'balance');
    check('the clump is in the hand, the scale fell ≥ ⅓', held.held && held.fell, JSON.stringify(held));
    await release(0.3);
    check('let go far: it melts', (await read(page, 'balance')).melted);
    await advance(page, 4);
    check('the reaction refills the minus to the mark', (await read(page, 'battery')).pointer > 0.7);
    check('takeaway', await takeaway());
    await snap('balance-2goal');
  },
  async voltage() {
    await advance(page, 1.2);
    check('the meter is on the table', (await read(page, 'battery')).meter > 0.99);
    for (const id of ['minus', 'plus']) {
      const release = await dragTo(page, await at(page, `probe-${id}`), await at(page, `clamp-${id}`), {
        steps: 16,
      });
      await release(1);
    }
    check('both probes on their clamps', (await read(page, 'voltage')).touching);
    await advance(page, 3);
    const v = await read(page, 'voltage');
    check('the needle stands on 1,6', Math.abs(v.needle - 1.6) < 0.03, v.needle.toFixed(3));
    check('takeaway', await takeaway());
    await snap('voltage-2goal');
    const big = await sample(10);
    smooth('the meter put away, the camera back on the stand', big);
    const b = await read(page, 'battery');
    check(
      'the last frame is the stand plan without the meter',
      b.meter < 0.01 && !b.moving,
      JSON.stringify(b.camera),
    );
    await snap('voltage-3end');
    // the chapter's end (tools/qa/next-chapter.mjs): «Далі» brings the closing card, «Далі» again the next chapter
    const border = await nextChapter(page, (s) => advance(page, s));
    check(
      'closing card after the last step: its three lines and the bridge',
      border.card.shown && border.card.lines === 3 && border.card.bridge.length > 0,
      `${border.card.lines} lines`,
    );
    check(
      '«Далі» on the card: the next chapter',
      border.landed.chapterId === 'flow',
      `${border.landed.chapterId}/${border.landed.stepId}`,
    );
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'circuit/battery/poles', freeze: 1 }));
  if (touch) await useTouch(page);
  await advance(page, 2);
  step = 'poles';
  await steps.poles();
  for (const id of ['inside', 'balance', 'voltage']) {
    await enter(id);
    await steps[id]();
  }
  const errors = await appErrors(page);
  step = 'console';
  check('no console errors or warnings', errors.length === 0, JSON.stringify(errors).slice(0, 300));
} catch (e) {
  check(`threw: ${e.message}`, false);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed
    ? `FAIL ${failed} of ${results.length}`
    : `PASS ${results.length} checks at ${width}x${height}${touch ? ' (touch)' : ''}`,
);
process.exit(failed ? 1 : 0);
