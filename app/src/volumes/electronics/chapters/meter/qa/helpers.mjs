/* global window, document */
// Copied from the bench's sandbox `_dev/chapters/_sandbox-electronics-bench/qa/helpers.mjs` (itself a copy of
// `circuit/chapters/build/qa/helpers.mjs`; docs/volumes/electronics/REUSE.md, «Копії»), unchanged below this note: a
// chapter never imports another chapter, and `_dev` is not in the site's profile.
// Playwright helpers of the chapter's QA scripts (production hooks only; positions in CSS px from
// `__ui.locate` / `__app.locate`, so one script serves every size). Runs on the frozen engine clock (`?freeze`).

/** Advance the frozen engine clock by `seconds`, then a few single frames so HUD fades settle. */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  for (let i = 0; i < 10; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/** Rectangle { x, y, w, h } (centre + size) of the control `ctl-<id>`; throws when it is not on screen. */
export async function locate(page, id) {
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
export const shown = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.closest('[hidden]');
  }, sel);

/** Click a panel element by CSS selector. */
export async function press(page, sel) {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await advance(page, 0.3);
}

/**
 * A pointer that is a mouse or a finger (`--touch`: real touch events through the DevTools protocol, which the page
 * receives as Pointer Events with `pointerType: 'touch'`). Every move is followed by one engine frame, so the scene
 * sees each intermediate position on the frozen clock.
 */
export async function pointer(page, isTouch) {
  const cdp = isTouch ? await page.context().newCDPSession(page) : null;
  const touchAt = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0, radiusX: 6, radiusY: 6, force: 1 }],
    });
  const frame = () => page.evaluate(() => window.__app.step(1 / 60, 1));
  let last = [0, 0];
  const p = {
    async down(x, y) {
      last = [x, y];
      if (cdp) await touchAt('touchStart', x, y);
      else {
        await page.mouse.move(x, y);
        await frame();
        await page.mouse.down();
      }
      await frame();
    },
    async move(x, y) {
      last = [x, y];
      if (cdp) await touchAt('touchMove', x, y);
      else await page.mouse.move(x, y);
      await frame();
    },
    async up() {
      if (cdp) await touchAt('touchEnd', ...last);
      else await page.mouse.up();
      await frame();
    },
    async tap(x, y) {
      await p.down(x, y);
      await p.up();
      await advance(page, 0.2);
    },
    /** Drag through the points [{x, y}, …], `steps` moves between each pair. */
    async path(points, steps = 8) {
      await p.down(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++)
        for (let k = 1; k <= steps; k++) {
          const a = points[i - 1];
          const b = points[i];
          await p.move(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
        }
      await p.up();
    },
  };
  return p;
}

/**
 * Sample the reader `name` every frame for `seconds`; return the largest per-frame change of each numeric field
 * (arrays: the length of the difference vector).
 */
export async function strides(page, name, seconds) {
  return page.evaluate(
    async ([n, frames]) => {
      const big = {};
      let prev = window.__app.read(n);
      for (let i = 0; i < frames; i++) {
        await window.__app.step(1 / 60, 1);
        const cur = window.__app.read(n);
        for (const k of Object.keys(cur)) {
          const a = cur[k];
          const b = prev[k];
          const d = Array.isArray(a) ? Math.hypot(...a.map((v, j) => v - b[j])) : Math.abs(a - b);
          big[k] = Math.max(big[k] ?? 0, d);
        }
        prev = cur;
      }
      return big;
    },
    [name, Math.round(seconds * 60)],
  );
}
