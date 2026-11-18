/* global window, document */
// Playwright helpers of the chapter's QA scripts (production hooks only; positions in CSS px from
// `__ui.locate` / `__app.locate`, so one script serves every size). Runs on the frozen engine clock (`?freeze`).

import { sheetTab as openSheetTab } from '../../../../../../../tools/qa/sheet-tab.mjs';
/** Advance the frozen engine clock by `seconds`, then a few single frames so HUD fades settle. */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  for (let i = 0; i < 10; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/**
 * Rectangle { x, y, w, h } (centre + size) of the control `ctl-<id>`; throws when it is not on screen. In a narrow
 * window the controls sit on the sheet's «Керування» tab: it is opened first, as a reader would (as `wire`'s).
 */
export async function locate(page, id) {
  // the tab first: a control on the hidden tab still reports its last box (the reader would not see it)
  await openSheetTab(page, 'controls', (p) => advance(p, 0.2));
  const rect = await page.evaluate((n) => window.__ui.locate(n), `ctl-${id}`);
  if (!rect) throw new Error(`control '${id}' is not on screen`);
  return rect;
}

export const read = (page, name) => page.evaluate((n) => window.__app.read(n), name);

/** Screen position { x, y } of a probe (`ctx.qa.probe`). */
export async function at(page, name) {
  const p = await page.evaluate((n) => window.__app.locate(n), name);
  if (!p) throw new Error(`probe '${name}' is unknown`);
  return p;
}

/** Click a dock button by id. */
export async function click(page, id) {
  const r = await locate(page, id);
  await page.mouse.click(r.x, r.y);
  await advance(page, 0.2);
}

/** Drag a slider's knob from where it is (`from`, fraction of the track) to the fraction `fx`. */
export async function slide(page, id, fx, from = 0) {
  const r = await locate(page, id);
  const y = r.y + r.h * 0.18;
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await page.mouse.move(x0 + (x1 - x0) * from, y);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) * fx, y, { steps: 10 });
  await page.mouse.up();
  await advance(page, 0.2);
}

/** Press a slider's thumb at `from` and drag to `to` (track fractions), keeping the button down; returns the release. */
export async function scrub(page, id, from, to) {
  const r = await locate(page, id);
  const y = r.y + r.h * 0.18;
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await page.mouse.move(x0 + (x1 - x0) * from, y);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) * to, y, { steps: 12 });
  await advance(page, 0.1);
  return async () => {
    await page.mouse.up();
    await advance(page, 0.1);
  };
}

/** Screen point [x, y] of a slider's track at the fraction `fx` (to move a held pointer there). */
export async function thumbAt(page, id, fx) {
  const r = await locate(page, id);
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  return [x0 + (x1 - x0) * fx, r.y + r.h * 0.18];
}

/** One click on a slider's track at the fraction `fx` (the scene travels there, eased). */
export async function clickTrack(page, id, fx) {
  const r = await locate(page, id);
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await page.mouse.click(x0 + (x1 - x0) * fx, r.y + r.h * 0.18);
  await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/** Click a scene object by its probe (one frame first, so the engine picks what is under the pointer now). */
export async function clickProbe(page, name) {
  const p = await at(page, name);
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  const q = await at(page, name);
  await page.mouse.click(q.x, q.y);
  await advance(page, 0.2);
}

/**
 * Press on a point { x, y } (CSS px) and drag by (fx, fy) viewport heights, keeping the button down; returns the
 * release function.
 */
export async function dragFrom(page, p, fx, fy, { settle = 0.5 } = {}) {
  const h = page.viewportSize().height;
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  await page.mouse.down();
  await page.mouse.move(p.x + fx * h, p.y + fy * h, { steps: 14 });
  await advance(page, settle);
  return async (after = 0.2) => {
    await page.mouse.up();
    await advance(page, after);
  };
}

/** Is a panel element (CSS selector) on screen (present and not inside a hidden subtree)? */
export const shown = async (page, sel) => {
  // a narrow window: the step's text (takeaway, «Докладніше») is on the sheet's «Опис» tab — the reader turns to it
  if (sel.includes('path-')) await openSheetTab(page, 'text', (p) => advance(p, 0.2));
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.closest('[hidden]');
  }, sel);
};

/** The sheet's «Опис» tab in a narrow window (no-op elsewhere): before reading or pressing the step's text. */
export const textTab = (page) => openSheetTab(page, 'text', (p) => advance(p, 0.2));

/** Click a panel element by CSS selector. */
export async function press(page, sel) {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await advance(page, 0.3);
}

/**
 * One pointer for the whole script: the mouse, or a finger (`touch`: real touch input through the DevTools
 * protocol, received as Pointer Events with `pointerType: 'touch'`). Every move is followed by one engine frame.
 *   const p = await pointer(page, touch);  await p.tap(x, y);  await p.path([[x0, y0], [x1, y1], …], { steps });
 *   const hold = await p.down(x, y); await hold.move(x, y); await hold.up();
 */
export async function pointer(page, touch = false) {
  const frame = () => page.evaluate(() => window.__app.step(1 / 60, 1));
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const send = (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map(([x, y]) => ({ x, y, id: 0, radiusX: 6, radiusY: 6, force: 1 })),
    });
  const down = async (x, y) => {
    if (touch) await send('touchStart', [[x, y]]);
    else {
      await page.mouse.move(x, y);
      await frame();
      await page.mouse.down();
    }
    await frame();
    let last = [x, y];
    return {
      async move(nx, ny, steps = 1) {
        for (let i = 1; i <= steps; i++) {
          const k = i / steps;
          const px = last[0] + (nx - last[0]) * k;
          const py = last[1] + (ny - last[1]) * k;
          if (touch) await send('touchMove', [[px, py]]);
          else await page.mouse.move(px, py);
          await frame();
        }
        last = [nx, ny];
      },
      async up() {
        if (touch) await send('touchEnd', []);
        else await page.mouse.up();
        await frame();
      },
    };
  };
  return {
    down,
    async tap(x, y) {
      const h = await down(x, y);
      await h.up();
      await advance(page, 0.2);
    },
    async path(points, { steps = 8 } = {}) {
      const h = await down(...points[0]);
      for (const p of points.slice(1)) await h.move(p[0], p[1], steps);
      await h.up();
    },
  };
}

/**
 * Sample the camera and the lens every frame for `seconds` (the chapter's `__app.read('drain')`: camera, lens, the stand's battery, glow and needle), and report the
 * largest per-frame jump of each against the mean step: a cut shows as one step far above the rest.
 */
export async function continuity(page, seconds, during = async () => {}) {
  const cam = [];
  const lens = [];
  const battery = [];
  const light = [];
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    if (i === 0) await during();
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    const s = await page.evaluate(() => window.__app.read('drain'));
    cam.push(s.cameraRaw);
    lens.push(s.lens);
    battery.push(s.battery);
    light.push([s.glow, s.volts]);
  }
  return { camera: jumps(cam), lens: jumps(lens), battery: jumps(battery), light: jumps(light) };
}

/**
 * Per-frame moves of a sampled series: the largest, the mean, and the largest SPIKE — a move several times both
 * its neighbours (a cut or a pop; an eased motion never does that). Moves under 0.03 units do not count as spikes.
 */
export function jumps(xs) {
  const d = [];
  for (let i = 1; i < xs.length; i++) d.push(Math.hypot(...xs[i].map((v, k) => v - xs[i - 1][k])));
  let spike = 0;
  for (let i = 0; i < d.length; i++) {
    if (d[i] < 0.03) continue;
    const around = Math.max(d[i - 1] ?? 0, d[i + 1] ?? 0, 0.01);
    spike = Math.max(spike, d[i] / around);
  }
  const mean = d.reduce((a, b) => a + b, 0) / Math.max(d.length, 1);
  return { max: Math.max(0, ...d), mean, spike };
}

/** The slider's range input of a control (centre, width; CSS px) — its track, whatever the marks' rows below. */
export async function rangeOf(page, id) {
  // a narrow window: the slider sits on the sheet's «Керування» tab — opened first, as a reader would
  await openSheetTab(page, 'controls', (p) => advance(p, 0.2));
  const r = await page.evaluate((n) => {
    const el = document.querySelector(`[data-ui="ctl-${n}"] input[type="range"]`);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width };
  }, id);
  if (!r) throw new Error(`slider '${id}' is not on screen`);
  return r;
}
