#!/usr/bin/env node
/* global process, console, window */
// Interaction test of chapter `circuit/lamp` (lenovo; dev server or production preview up), DOM interface:
//
//   node app/src/volumes/circuit/chapters/lamp/qa/interactions.mjs --port 5316 [--size 1280x720] [--touch] [--out <dir>]
//
// Every goal by real pointer input (mouse, or a finger with --touch), the reader's way from step to step («Далі»);
// after each goal the panel shows «Висновок» (never before); «Докладніше» opened once; per-frame continuity of the
// camera and the magnifier through every step change and every slider sweep (no cut: the largest per-frame step
// stays within a bound and within a multiple of the mean); console clean. Frozen engine clock. Exit 1 on failure.
import { appErrors, appUrl, baseUrl, ensureDir, launch, openApp, parseArgs, parseSize, screenshot } from '../../../../../../../tools/qa/lib.mjs';
import { advance, at, continuity, jumps, pointer, press, rangeOf, read, shown } from './helpers.mjs';
import { nextChapter } from '../../../../../../../tools/qa/next-chapter.mjs';
import { energy, glow, handover, hotSpot, story } from './steps-b.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const touch = Boolean(args.touch);
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height, touch });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(9)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) => out && screenshot(page, `${out}/${width}x${height}-${name}.jpg`);
/** No cut: the largest per-frame move within `bound` (world units), and no spike (a move ≥ 3× both neighbours). */
const smooth = (what, j, bound) =>
  check(
    `${what}: no jump`,
    j.max <= bound && j.spike < 3,
    `max ${j.max.toFixed(3)} · mean ${j.mean.toFixed(3)} · spike ${j.spike.toFixed(2)}`,
  );
/** The reader's «Далі», the transition sampled frame by frame. */
const next = async (id, seconds = 3.2) => {
  const j = await continuity(page, seconds, () => page.evaluate(() => window.__app.next()));
  step = id;
  smooth('camera into the step', j.camera, 0.45);
  smooth('lens into the step', j.lens, 0.3);
  check('no takeaway before the goal', !(await takeaway()));
};
/** Sweep a slider by hand from `a` to `b` (track shares) in `n` moves, camera / lens sampled after each. */
const sweep = async (p, id, a, b, n = 40) => {
  const r = await rangeOf(page, id);
  const x = (f) => r.x - r.w / 2 + r.w * (0.04 + 0.92 * f);
  const y = r.y;
  const hold = await p.down(x(a), y);
  const cam = [];
  const lens = [];
  const rail = [];
  for (let i = 1; i <= n; i++) {
    await hold.move(x(a + ((b - a) * i) / n), y);
    const s = await read(page, 'lamp');
    cam.push(s.cameraRaw);
    lens.push(s.lens);
    rail.push([s.rail]);
  }
  await hold.up();
  if (process.env.LAMP_QA_DEBUG) console.log(JSON.stringify(rail.map((r) => +r[0].toFixed(3))));
  return { camera: jumps(cam), lens: jumps(lens) };
};

async function inside(p) {
  check('opening card', await shown(page, '[data-ui="path-opening"]'));
  await press(page, '[data-ui="path-opening"] .btn');
  check('«Згадайте» link', await shown(page, '[data-ui="path-recall"]'));
  check('no takeaway before the goal', !(await takeaway()));
  let j = await sweep(p, 'depth', 0, 1, 60);
  smooth('depth slider down: camera', j.camera, 0.5);
  smooth('depth slider down: lens', j.lens, 0.8);
  await advance(page, 1.2);
  const s = await read(page, 'lamp');
  check('down at the lamp', s.rail >= 0.98, s.rail.toFixed(3));
  await snap('inside-down');
  // the mark along the way: contact → first support → coil → second support → thread
  const seq = ['path-mark', 'lamp-leadIn', 'lamp-coil', 'lamp-leadOut', 'lamp-thread'];
  const hold = await p.down(...Object.values(await at(page, seq[0])));
  for (const n of seq.slice(1)) {
    const q = await at(page, n);
    await hold.move(q.x, q.y, 24);
  }
  await hold.up();
  await advance(page, 1);
  check('takeaway once the mark reached the thread', await takeaway());
  await page.click('[data-ui="path-more"]');
  check('«Докладніше» opens', (await page.getAttribute('[data-ui="path-more"]', 'aria-expanded')) === 'true');
  await snap('inside-goal');
  j = await sweep(p, 'depth', 1, 0.2, 40);
  smooth('depth slider back up: camera', j.camera, 0.5);
  j = await sweep(p, 'depth', 0.2, 1, 40);
  smooth('…and down again: camera', j.camera, 0.5);
  await advance(page, 1.2);
}

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'circuit/lamp/inside', freeze: 0 }));
  await advance(page, 2);
  step = 'inside';
  const p = await pointer(page, touch);
  const ctx = { page, p, check, takeaway, snap, smooth, sweep, read, at, advance };
  await inside(p);
  await next('hot-spot');
  await hotSpot(ctx);
  await next('glow', 3.4);
  await glow(ctx);
  await next('energy', 3.4);
  await energy(ctx);
  await next('handover', 3.4);
  await handover(ctx);
  await next('story', 3.4);
  await story(ctx);
  step = 'closing';
  // the chapter's end (tools/qa/next-chapter.mjs): «Далі» brings the closing card, «Далі» again the next chapter
  const border = await nextChapter(page, (s) => advance(page, s));
  check(
    'closing card after the last step: its three lines and the bridge',
    border.card.shown && border.card.lines === 3 && border.card.bridge.length > 0,
    `${border.card.lines} lines`,
  );
  check(
    '«Далі» on the card: the next chapter',
    border.landed.chapterId === 'drain',
    `${border.landed.chapterId}/${border.landed.stepId}`,
  );
  step = 'console';
  const errors = await appErrors(page);
  check('no console errors or warnings', errors.length === 0, JSON.stringify(errors).slice(0, 300));
} catch (e) {
  check(`threw: ${e.message}`, false);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `FAIL ${failed} of ${results.length}` : `PASS ${results.length} checks at ${width}x${height}${touch ? ' touch' : ''}`);
process.exit(failed ? 1 : 0);
