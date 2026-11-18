#!/usr/bin/env node
/* global process, console, window, document */
// Interaction test of chapter `circuit/charge` (lenovo; dev server or production preview up), default interface:
//
//   node app/src/volumes/circuit/chapters/charge/qa/interactions.mjs --port 5312 [--size 1280x720] [--touch | --mouse] [--out <dir>]
//
// The reader arrives from the last frame of `wire` (the stand shot). Every goal of the script is reached by real
// pointer input — mouse, or touch through the DevTools protocol (`--touch`, implied at 390x844): rub the balloon
// on the hair and bring it to the second balloon; carry the lens to the contact and rub; bring the spheres
// together in pairs; carry electrons across the gap; walk the probe around the balloon; bring the balloon to the
// wire and take it away. After each goal the panel must show «Висновок». «Докладніше» opens once. Every step
// change is sampled frame by frame (camera, balloon, lens): no frame may jump (largest step ≤ 6 × the mean step
// of the move, and never a whole move in one frame). Ends on the stand shot, closing card; no console errors.
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
import { advance, at, press, read, shown } from './helpers.mjs';
import { nextChapter } from '../../../../../../../tools/qa/next-chapter.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
// `--mouse`: a narrow desktop window (a mouse at 390×844)
const touch = !args.mouse && (Boolean(args.touch) || width < 600);
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height, touch });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(8)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) => out && screenshot(page, `${out}/${width}x${height}-${name}.jpg`);
const frame = () => page.evaluate(() => window.__app.step(1 / 60, 1));
const project = (p) => page.evaluate(([x, y, z]) => window.__app.project(x, y, z), p);

// ── the pointer: a mouse, or one finger (CDP touch events reach the page as touch Pointer Events) ──
const cdp = touch ? await page.context().newCDPSession(page) : null;
const finger = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0, radiusX: 6, radiusY: 6, force: 1 }],
  });
let last = { x: 0, y: 0 };
const pointer = {
  async down(p) {
    last = p;
    if (touch) await finger('touchStart', p.x, p.y);
    else {
      await page.mouse.move(p.x, p.y);
      await frame();
      await page.mouse.down();
    }
    await frame();
  },
  /** Move in `n` small moves, one engine frame each (the scene sees every position); kept inside the window. */
  async move(q, n = 12) {
    const p = { x: Math.min(Math.max(q.x, 6), width - 6), y: Math.min(Math.max(q.y, 6), height - 6) };
    const a = last;
    for (let i = 1; i <= n; i++) {
      const x = a.x + ((p.x - a.x) * i) / n;
      const y = a.y + ((p.y - a.y) * i) / n;
      if (touch) await finger('touchMove', x, y);
      else await page.mouse.move(x, y);
      await frame();
    }
    last = p;
  },
  async up() {
    if (touch) await finger('touchEnd', last.x, last.y);
    else await page.mouse.up();
    await frame();
  },
};
/** Press on a probe, follow screen points (or world points: arrays), let go. */
async function drag(probe, path, { hold = 0, n = 12 } = {}) {
  const p = await at(page, probe);
  await pointer.down(p);
  for (const q of path) {
    const s = Array.isArray(q) ? await project(q) : q;
    await pointer.move(s, n);
  }
  if (hold) await advance(page, hold);
  await pointer.up();
}

// ── continuity: sample the frames of a move ──
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
async function smooth(what, frames = 200) {
  const s = [];
  for (let i = 0; i < frames; i++) {
    s.push(await read(page, 'charge'));
    await frame();
  }
  for (const key of ['cam', 'balloon', 'lens']) {
    const steps = s.slice(1).map((v, i) => dist(v[key], s[i][key]));
    const moving = steps.filter((d) => d > 1e-5).length;
    if (moving < 3) continue;
    // a jump is a frame that moves far more than both of its neighbours (an eased move never does)
    let worst = 0;
    let at = -1;
    steps.forEach((d, i) => {
      // (ignored below 0.06 world units — half a degree at the table's distance: the engine's idle drift
      // switching on at the end of a flight is that size, docs/requests/B-circuit-charge.md)
      const around = Math.max(steps[i - 1] ?? 0, steps[i + 1] ?? 0, 0.004);
      if (d > 0.06 && d / around > worst) [worst, at] = [d / around, i];
    });
    check(`${what}: ${key} moves without a jump`, worst <= 3, `worst frame ${at}: ${worst.toFixed(2)}× its neighbours (${(steps[at] ?? 0).toFixed(3)}), ${moving} moving frames`);
  }
}
const enter = async (id, frames = 200) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('charge', s), id);
  await smooth(`into ${id}`, frames);
  check('no takeaway before the goal', !(await takeaway()));
};

// world points of the layout (chapter `layout.ts`, `parts/*`): targets for drags, projected each time
const SPHERES = [-4.1, 0.46, 6.9];
const sphere = (dx, dz) => [SPHERES[0] + dx, SPHERES[1], SPHERES[2] + dz];
const STAND_CAM = [0, 8.05, 8.6];
let firstCam = STAND_CAM;

const steps = {
  async rub() {
    const first = await read(page, 'charge');
    firstCam = first.cam;
    check('the first frame is the stand shot (where chapter 1 ended)', dist(first.cam, STAND_CAM) < 0.2, first.cam.map((v) => v.toFixed(2)).join(','));
    await smooth('from the stand to the table', 190);
    if (await shown(page, '[data-ui="path-opening"]')) await press(page, '[data-ui="path-opening"] .btn');
    check('no takeaway before the goal', !(await takeaway()));
    const h = await at(page, 'hair');
    const b = await at(page, 'balloon');
    await pointer.down(b);
    await pointer.move({ x: h.x + 25, y: h.y + 12 }, 16);
    for (let i = 0; i < 4; i++) {
      await pointer.move({ x: h.x - 45, y: h.y + 12 }, 8);
      await pointer.move({ x: h.x + 45, y: h.y + 12 }, 8);
    }
    let r = await read(page, 'rub');
    check('three rubs and more, the balloon is charged', r.rubs >= 3 && r.charge >= 1, `${r.rubs} rubs`);
    check('no takeaway before the second balloon', !(await takeaway()));
    // slowly away: the hair reaches after it
    // the way away measured in the window's short side (a narrow window is taller than it is wide)
    const unit = Math.min(width, height);
    await pointer.move({ x: h.x + 0.24 * unit, y: h.y - 0.1 * unit }, 30);
    await advance(page, 0.8);
    r = await read(page, 'rub');
    check('the hair rose after the balloon', r.hairRose);
    const s = await at(page, 'second-balloon');
    await pointer.move({ x: s.x + 0.12 * unit, y: s.y }, 30);
    await advance(page, 1.5);
    r = await read(page, 'rub');
    check('the second balloon leans away', r.leaned, `lean ${r.lean.toFixed(2)} rad`);
    await pointer.up();
    await advance(page, 0.6);
    check('takeaway', await takeaway());
    await press(page, '[data-ui="path-more"]');
    check('«Докладніше» opens', await page.evaluate(() => document.querySelector('[data-ui="path-more"]')?.getAttribute('aria-expanded') === 'true'));
    await snap('rub');
  },
  async charge() {
    await advance(page, 0.5);
    const c = await at(page, 'contact');
    await drag('lens', [{ x: c.x - 0.1 * height, y: c.y - 0.12 * height }, c], { n: 14 });
    await advance(page, 1.4);
    let s = await read(page, 'charge-step');
    check('the lens lies on the place of contact', s.placed);
    const g = await at(page, 'lens');
    await pointer.down(g);
    for (let i = 0; i < 4; i++) {
      await pointer.move({ x: g.x - 0.07 * height, y: g.y }, 8);
      await advance(page, 0.15);
      await pointer.move({ x: g.x + 0.07 * height, y: g.y }, 8);
      await advance(page, 0.15);
    }
    await pointer.up();
    await advance(page, 1.5);
    s = await read(page, 'charge-step');
    check('≥ 5 electrons hopped under the lens', s.hops >= 5, `${s.hops}`);
    check('the counter is at its end (600 мільярдів)', s.shown >= 6e11, `${s.shown}`);
    check('takeaway', await takeaway());
    await snap('charge');
  },
  async signs() {
    await advance(page, 0.5);
    // routes on the table around the other spheres (sphere i starts at the corners of a 3.5 × 3 rectangle)
    await drag('sphere-1', [sphere(-0.3, -1.5)], { n: 16 });
    await drag('sphere-3', [sphere(-0.3, 0)], { n: 16 });
    await drag('sphere-2', [sphere(-0.3, 1.95), sphere(-1.75, 0.15)], { n: 16 });
    await advance(page, 0.5);
    const s = await read(page, 'signs');
    check('all three kinds of pair met', s.met.length === 3, s.met.join(','));
    check('takeaway', await takeaway());
    await snap('signs');
  },
};
Object.assign(steps, {
  async neutral() {
    let n = await read(page, 'neutral');
    for (let i = 0; i < 40 && n.phase !== 'pieces'; i++) {
      if (n.phase === 'atom' && i % 4 === 0) await snap('neutral-atom');
      await advance(page, 0.5);
      n = await read(page, 'neutral');
    }
    check('the atom, then the two pieces', n.phase === 'pieces', n.phase);
    await advance(page, 1.6);
    let total = 0;
    for (let k = 0; k < 3; k++) {
      const left = await at(page, 'crumb-left');
      const right = await at(page, 'crumb-right');
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < 18; i++) {
        const p = await at(page, `crumb-electron-${i}`);
        const d = Math.hypot(p.x - left.x, p.y - left.y);
        if (p.x < (left.x + right.x) / 2 && d < bd) [best, bd] = [i, d];
      }
      await frame();
      await drag(`crumb-electron-${best}`, [right], { n: 16 });
      await advance(page, 0.4);
      n = await read(page, 'neutral');
      total = Math.max(total, Math.abs(n.left + n.right));
    }
    check('three electrons carried across the gap', n.moved >= 3, `${n.moved}`);
    check('the pieces are charged now', n.wasNonZero, `${n.left} / ${n.right}`);
    check('«разом» stayed 0', total === 0);
    check('takeaway', await takeaway());
    await snap('neutral');
  },
  async field() {
    // from «ряди» the flight up to the table takes a few seconds; the probe comes once it has landed
    for (let i = 0; i < 30 && !(await read(page, 'field')).ready; i++) await advance(page, 0.5);
    check('the probe is there once the camera is on the table', (await read(page, 'field')).ready);
    const [cx, cy, cz] = (await read(page, 'field')).centre;
    // two walks around the balloon in its drag plane: close (0.8) and far (2.3 world units)
    const ring = (r, from, to) =>
      Array.from({ length: 10 }, (_, i) => {
        const a = from + ((to - from) * i) / 9;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz];
      });
    await drag('probe', [...ring(0.8, 0.1, 2.4), ...ring(2.3, 2.4, 0.2)], { n: 5 });
    await advance(page, 0.5);
    const f = await read(page, 'field');
    check('≥ 8 pale arrows', f.places >= 8, `${f.places}`);
    check('two distances at least threefold apart', f.far >= 3 * f.near, `${f.near.toFixed(2)} … ${f.far.toFixed(2)}`);
    check('takeaway', await takeaway());
    await snap('field');
  },
  async shift() {
    await advance(page, 1.5);
    await drag('balloon', [await at(page, 'spare-left')], { hold: 2.8, n: 18 });
    let s = await read(page, 'shift');
    check('the crowd leaned and stood (held ≥ 2 s)', s.gathered, `lean ${s.lean.toFixed(2)}`);
    const back = await project([-2.6, 0.6, 4.0]);
    await drag('balloon', [back], { n: 18 });
    await advance(page, 1.6);
    s = await read(page, 'shift');
    check('balloon away, the electrons even again', Math.abs(s.lean) < 0.03, s.lean.toFixed(3));
    check('takeaway', await takeaway());
    await snap('shift');
    await smooth('back to the stand', 330);
    const end = await read(page, 'charge');
    check('the last frame is the first frame again (the stand shot, within its breathing)', dist(end.cam, firstCam) < 0.2 && dist(end.cam, STAND_CAM) < 0.2, end.cam.map((v) => v.toFixed(2)).join(','));
    check('the lens is back in its holder', !end.keeper);
    await snap('end');
  },
});

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: 'circuit/wire/plastic', freeze: 0 }));
  await advance(page, 1);
  step = 'rub';
  await page.evaluate(() => window.__app.goto('charge', 'rub'));
  for (let i = 0; i < 600 && !(await read(page, 'charge').catch(() => null)); i++) await page.waitForTimeout(20);
  await steps.rub();
  for (const id of ['charge', 'signs', 'neutral', 'field', 'shift']) {
    await enter(id, id === 'neutral' ? 420 : 200);
    await steps[id]();
  }
  // the chapter's end (tools/qa/next-chapter.mjs): «Далі» brings the closing card, «Далі» again the next chapter
  const border = await nextChapter(page, (s) => advance(page, s));
  check(
    'closing card after the last step: its three lines and the bridge',
    border.card.shown && border.card.lines === 3 && border.card.bridge.length > 0,
    `${border.card.lines} lines`,
  );
  check(
    '«Далі» on the card: the next chapter',
    border.landed.chapterId === 'battery',
    `${border.landed.chapterId}/${border.landed.stepId}`,
  );
  const errors = await appErrors(page);
  step = 'console';
  check('no console errors or warnings', errors.length === 0, JSON.stringify(errors).slice(0, 300));
} catch (e) {
  check(`threw: ${e.message}`, false);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `FAIL ${failed} of ${results.length}` : `PASS ${results.length} checks at ${width}x${height}${touch ? ' (touch)' : ''}`);
process.exit(failed ? 1 : 0);
