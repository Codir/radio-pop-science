/* global console, window */
// Interaction check of the crawl showcase by real pointer input (run on lenovo, dev or preview up):
//
//   node tools/qa/shot.mjs _dev/_sandbox-circuit-crawl/crawl --port 5283 --extra "debug&hud=dom" \
//     --script app/src/volumes/_dev/chapters/_sandbox-circuit-crawl/qa/interactions.mjs --out <file.jpg>
//
// Checks the scrub recipe (UI_API §3.3) and what `stand.crawlScene` promises: in place after a deep link, a drag
// is followed at once, a click on the track glides, the lamp is on the moment the time leaves zero and off again
// at zero, at the slider's end the snail is at the end of its lane while the spark stands on the last tick of
// its scale, and after leaving the scene is gone and the lamp is the next step's.
import { advance, locate, read, slide } from '../../../../circuit/chapters/prologue/qa/helpers.mjs';

export default async function interactions(page) {
  let failed = 0;
  const check = (what, ok, detail = '') => {
    if (!ok) failed++;
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${detail === '' ? '' : `  [${detail}]`}`);
  };
  const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
  await page.evaluate(() => window.__app.goto('_sandbox-circuit-crawl', 'crawl'));
  await advance(page, 1.5);
  let s = await read(page, 'crawl');
  check('starts at 0 with the lamp off', s.seconds === 0 && s.glow === 0 && s.light < 0.01);
  check('the scene is in place', s.ready && s.presence === 1);

  // press the thumb's track and move: the scene is where the hand is, the light is there in that frame
  const r = await locate(page, 'crawl-time');
  const y = r.y + r.h * 0.18;
  const x = (f) => r.x - r.w / 2 + r.w * (0.04 + 0.92 * f);
  await page.mouse.move(x(0), y);
  await page.mouse.down();
  await page.mouse.move(x(0.5), y, { steps: 8 });
  await page.evaluate(() => window.__app.step(1 / 60, 2));
  s = await read(page, 'crawl');
  check('a drag is followed at once', near(s.seconds / s.duration, 0.5, 0.06), s.seconds.toFixed(1));
  check('the light is on at once', s.light > 1, `lamp ${s.light.toFixed(2)}`);
  await page.mouse.move(x(-0.2), y, { steps: 8 }); // pulled past the left end, as a hand does
  await page.mouse.up();
  await advance(page, 1.2);
  s = await read(page, 'crawl');
  check(
    'back at 0 the lamp is off',
    s.seconds === 0 && s.glow < 0.02,
    `${s.seconds.toFixed(2)} s, glow ${s.glow.toFixed(3)}`,
  );

  // a click on the track: the thumb jumps, the scene glides there
  await page.mouse.click(x(0.8), y);
  await page.evaluate(() => window.__app.step(1 / 60, 3));
  s = await read(page, 'crawl');
  check('a click on the track glides', s.seconds > 0 && s.seconds < 0.5 * s.duration, s.seconds.toFixed(1));
  await advance(page, 2.5);
  s = await read(page, 'crawl');
  check('…and arrives', near(s.seconds / s.duration, 0.8, 0.06), s.seconds.toFixed(1));

  // the end of the slider: both journeys finish together
  await slide(page, 'crawl-time', 1.2);
  await advance(page, 2.5);
  s = await read(page, 'crawl');
  check(
    'at the end the snail and the spark have arrived',
    near(s.seconds, s.duration, 0.01) &&
      near(s.snailCm, s.lengthCm, 1e-3) &&
      near(s.sparkMm, s.scaleMm, 1e-3),
    `${s.snailCm.toFixed(2)} cm, ${s.sparkMm.toFixed(2)} mm in ${s.seconds.toFixed(1)} s`,
  );

  // leaving: the scene hands the lamp back to the step and goes away completely
  await page.evaluate(() => window.__app.goto('_sandbox-circuit-crawl', 'stand'));
  await advance(page, 2.5);
  s = await read(page, 'crawl');
  check("stand: the scene is gone and the lamp is the step's", s.presence === 0 && s.glow > 0.98);
  if (failed) throw new Error(`${failed} interaction check(s) failed`);
}
