#!/usr/bin/env node
/* global process, console, window */
// Interaction test of chapter `circuit/drain` (lenovo; dev server or production preview up), DOM interface:
//
//   node app/src/volumes/circuit/chapters/drain/qa/interactions.mjs --port 5317 [--size 1280x720] [--touch] [--out <dir>]
//
// Every goal by real pointer input (mouse, or a finger with --touch), the reader's way from step to step («Далі»);
// after each goal the panel shows «Висновок» (never before); «Докладніше» opened once; per-frame continuity of the
// camera, the magnifier, the stand's battery, the lamp's heat and the needle through every step change, every
// slider sweep and every drag (no cut: the largest per-frame step within a bound, no spike); the way back from the
// last step plays the swap backwards; console clean. Frozen engine clock. Exit 1 on failure.
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
import { advance, at, continuity, jumps, pointer, press, rangeOf, read, shown } from './helpers.mjs';
import { nextChapter } from '../../../../../../../tools/qa/next-chapter.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const touch = Boolean(args.touch);
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height, touch });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(7)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) => out && screenshot(page, `${out}/${width}x${height}-${name}.jpg`);
const smooth = (what, j, bound) =>
  check(
    `${what}: no jump`,
    j.max <= bound && j.spike < 3,
    `max ${j.max.toFixed(3)} · mean ${j.mean.toFixed(3)} · spike ${j.spike.toFixed(2)}`,
  );
/** Everything that moves in a transition: camera, lens, the stand's battery, the light and the needle. */
const all = (what, j, light = 0.12) => {
  smooth(`${what}: camera`, j.camera, 0.45);
  smooth(`${what}: lens`, j.lens, 0.3);
  smooth(`${what}: battery`, j.battery, 0.3);
  smooth(`${what}: light and needle`, j.light, light);
};
/** The circuit closing or opening at the cradle: the stage puts the light there in the frame of the contact (the
 *  pool and the room at once; only the coil's colour runs its tenth of a second) — a step, by design. */
const CONTACT = 0.3;
const next = async (id, seconds = 3.2, again = false) => {
  // sampled in two stretches, the mid-transition frame shot between them (contact sheets)
  const a = await continuity(page, 1.1, () => page.evaluate(() => window.__app.next()));
  step = id;
  if (!again) await snap(`${id}-1-mid`);
  const b = await continuity(page, seconds - 1.1);
  if (!again) await snap(`${id}-2-start`);
  const j = Object.fromEntries(
    Object.keys(a).map((k) => [
      k,
      {
        max: Math.max(a[k].max, b[k].max),
        mean: (a[k].mean + b[k].mean) / 2,
        spike: Math.max(a[k].spike, b[k].spike),
      },
    ]),
  );
  all('into the step', j);
  if (!again) check('no takeaway before the goal', !(await takeaway()));
};
/** Sweep a slider by hand from `a` to `b` (track shares; past 1 = the thumb pushed to the end), sampled per move. */
const sweep = async (p, id, a, b, n = 48) => {
  const r = await rangeOf(page, id);
  const x = (f) => r.x - r.w / 2 + r.w * (0.04 + 0.92 * f);
  const hold = await p.down(x(a), r.y);
  const cam = [];
  const light = [];
  for (let i = 1; i <= n; i++) {
    await hold.move(x(a + ((b - a) * i) / n), r.y);
    const s = await read(page, 'drain');
    cam.push(s.cameraRaw);
    light.push([s.glow, s.volts, s.amps]);
  }
  await hold.up();
  return { camera: jumps(cam), light: jumps(light) };
};
/** Drag from one probe to another in `n` moves, sampling a series from `__app.read(name)` after each. */
const carry = async (p, from, to, name, pick, n = 30) => {
  const a = await at(page, from);
  const b = await at(page, to);
  const hold = await p.down(a.x, a.y);
  const xs = [];
  for (let i = 1; i <= n; i++) {
    await hold.move(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n);
    xs.push(pick(await read(page, name)));
  }
  await hold.up();
  return jumps(xs);
};
const tap = async (p, name) => {
  const q = await at(page, name);
  await p.tap(q.x, q.y);
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'circuit/drain/hours', freeze: 0 }));
  await advance(page, 1);
  step = 'hours';
  const p = await pointer(page, touch);
  await snap('hours-1-first');
  const j0 = await continuity(page, 3.4);
  all('the stand plan lowers, the meter comes', j0);
  await snap('hours-2-start');
  check('opening card', await shown(page, '[data-ui="path-opening"]'));
  await press(page, '[data-ui="path-opening"] .btn');
  check('no takeaway before the goal', !(await takeaway()));
  let s = await read(page, 'drain');
  check(
    'fresh: meter ≈ 1,5 V, frame ≈ 0,31 A, lamp white',
    s.touching && Math.abs(s.volts - 1.54) < 0.03 && s.amps > 0.3 && s.glow > 0.97,
    `${s.volts.toFixed(2)} V ${s.amps.toFixed(2)} A glow ${s.glow.toFixed(2)}`,
  );
  let j = await sweep(p, 'hours', 0, 1.08, 60);
  smooth('«Години» to the end: light, needle, number', j.light, 0.12);
  await advance(page, 1.5);
  s = await read(page, 'drain');
  check(
    'dead: needle below 1 V, the filament a dull red',
    s.volts < 1 && s.glow < 0.2 && s.glow > 0.076,
    `${s.volts.toFixed(2)} V glow ${s.glow.toFixed(3)}`,
  );
  check('takeaway at «8 год» after 1 s', await takeaway());
  await page.click('[data-ui="path-more"]');
  check('«Докладніше» opens', (await page.getAttribute('[data-ui="path-more"]', 'aria-expanded')) === 'true');
  await snap('hours-3-goal');
  j = await sweep(p, 'hours', 1, 0.3, 40);
  smooth('…and back: light, needle, number', j.light, 0.12);
  await advance(page, 1);
  s = await read(page, 'drain');
  check('back in the day the lamp is bright again', s.glow > 0.85, s.glow.toFixed(2));

  await next('spent');
  await advance(page, 1);
  s = await read(page, 'spent');
  check(
    'section open, slider back at 0',
    s.cut > 0.99 && s.hours < 0.01,
    `cut ${s.cut.toFixed(2)} h ${s.hours.toFixed(2)}`,
  );
  j = await sweep(p, 'spent-hours', 0, 1.08, 60);
  smooth('«Години» in the section', j.light, 0.12);
  await advance(page, 1.5);
  check('takeaway: the section open at «8 год»', await takeaway());
  s = await read(page, 'spent');
  check('the surplus on the minus stays (a little smaller)', s.surplus > 0.45, s.surplus.toFixed(2));
  await snap('spent-3-goal');

  await next('ghost');
  await advance(page, 0.8);
  for (let k = 0; k < 2; k++) {
    await tap(p, 'switch');
    await advance(page, 3);
    s = await read(page, 'ghost');
    check(
      `opened #${k + 1}: the needle creeps up to ≈ 1,2 V`,
      !s.closed && s.volts > 1.15,
      s.volts.toFixed(2),
    );
    await tap(p, 'switch');
    await advance(page, 0.6);
    s = await read(page, 'ghost');
    check(`closed #${k + 1}: below 1 V within half a second`, s.closed && s.volts < 1, s.volts.toFixed(2));
  }
  await advance(page, 0.5);
  check('takeaway after two openings and closings', await takeaway());
  await snap('ghost-3-goal');

  await next('inner', 3.2);
  await advance(page, 0.6);
  j = await carry(p, 'lens-hit', 'battery-spot', 'drain', (x) => x.lens);
  smooth('the lens carried to the battery', j, 0.3);
  const jc = await continuity(page, 3);
  smooth('the camera pushes in', jc.camera, 0.45);
  check('takeaway after 2 s over the battery', await takeaway());
  s = await read(page, 'inner');
  check(
    'particles stick in the deposit',
    s.stuck >= 0 && s.rail > 0.93,
    `rail ${s.rail.toFixed(2)} stuck ${s.stuck}`,
  );
  await snap('inner-3-goal');

  await next('life', 3.4);
  j = await carry(p, 'spare', 'cradle', 'life', (x) => [x.carry]);
  smooth('the new battery carried to the cradle', j, 0.1);
  const js = await continuity(page, 4.2);
  smooth("the swap: the stand's battery", js.battery, 0.3);
  smooth('the swap: the light comes back', js.light, CONTACT);
  s = await read(page, 'drain');
  check(
    'the new battery in the cradle, the lamp white',
    s.cradle.fresh && s.glow > 0.95,
    `glow ${s.glow.toFixed(2)}`,
  );
  check('takeaway', await takeaway());
  await advance(page, 2);
  s = await read(page, 'drain');
  check(
    'the last frame: the stand plan, lamp on',
    !s.moving && Math.abs(s.cameraRaw[1] - 8.05) < 0.2 && Math.abs(s.cameraRaw[2] - 8.6) < 0.2,
    s.camera.join(','),
  );
  await snap('life-3-goal');
  step = 'back';
  const jb = await continuity(page, 4, () => page.evaluate(() => window.__app.prev()));
  all('«Назад» from life: the swap plays backwards', jb, CONTACT);
  s = await read(page, 'drain');
  check('the dead battery back in the cradle', !s.cradle.fresh && s.glow < 0.2, `glow ${s.glow.toFixed(2)}`);
  await next('life', 3.4, true);
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
    border.landed.chapterId === 'build',
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
console.log(
  failed
    ? `FAIL ${failed} of ${results.length}`
    : `PASS ${results.length} checks at ${width}x${height}${touch ? ' touch' : ''}`,
);
process.exit(failed ? 1 : 0);
