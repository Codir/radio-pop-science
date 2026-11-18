/* global window, document */
// `volume-walk.mjs --map`: every stop of the volume's journey map, the reader's way.
//
// 1. The «Мапа» overlay (system bar «Мапа»): each chapter's node is tapped, its card must name the chapter, its «go»
//    button must land in that chapter (any step: a chapter never opened lands on its first step).
// 2. A map step inside the volume (the path format's prologue `map`, found by its `journey-stop:*` buttons): each
//    stop is tapped and its card must show that chapter's question (that map is for reading; it has no way in).
// Each landing is shot (`map-<chapter>.jpg`); the overlay's stop count and its words are checked for «у роботі».

/** Run the map checks. `io`: { page, volume, press, tapAt, wait, fail, save, log }. */
export async function mapWalk(io) {
  const { page, volume, press, tapAt, wait, fail, log } = io;
  // typography puts no-break spaces into titles on screen
  const plain = (t) => t.replace(/[\u00a0\u202f]/g, ' ');
  const chapters = await page.evaluate((v) => window.__app.listChapters(v).filter((c) => !c.dev), volume);
  const overlay = () => page.evaluate(() => window.__ui.overlay());
  const result = { overlay: [], step: [] };
  for (const c of chapters) {
    for (let k = 0; k < 3 && (await overlay()) !== 'map'; k++) {
      await press('[data-ui="sys-map"]');
      await wait(2);
    }
    // the whole journey in view (the map opens on the reader's own stop)
    await page.evaluate(() => document.querySelector('[data-ui="map-overview"]')?.click());
    await wait(2);
    // the map's camera glides to the reader's stop: take the node where it rests
    for (let k = 0; k < 8; k++) {
      const a = await page.evaluate((id) => window.__ui.mapNode(id), c.id);
      await wait(0.25);
      const b = await page.evaluate((id) => window.__ui.mapNode(id), c.id);
      if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < 1) break;
    }
    const node = await page.evaluate((id) => window.__ui.mapNode(id), c.id);
    if (!node) {
      fail(`map: no node for ${c.id}`);
      continue;
    }
    await tapAt(node.x, node.y);
    await wait(1);
    const card = await page.evaluate(() => document.querySelector('[data-ui="map-card"]')?.textContent ?? '');
    if (!plain(card).includes(plain(c.title))) {
      fail(`map: the card of ${c.id} does not name «${c.title}» (card: «${card.slice(0, 80)}»)`);
      await io.save(`map-${c.id}-card.jpg`);
      await press('[data-ui="map-card-close"]').catch(() => undefined);
      continue;
    }
    const words = await page.evaluate(
      () => /у роботі|готується|будується/i.exec(document.body.innerText)?.[0] ?? null,
    );
    if (words) fail(`map: «${words}» on the map at ${c.id}`);
    await press('[data-ui="map-go"]');
    // a neighbour walks to the border first (a flight up from below takes a few seconds)
    await page
      .waitForFunction((id) => window.__app.position().chapterId === id, c.id, {
        timeout: 16000,
      })
      .catch(() => undefined);
    await wait(3);
    const at = await page.evaluate(() => window.__app.position());
    const ok = at.chapterId === c.id && (await overlay()) === null;
    result.overlay.push({
      id: c.id,
      landed: `${at.chapterId}/${at.stepId}`,
      ok,
    });
    log(`  map  ${ok ? 'ok  ' : 'FAIL'} «Мапа» → ${c.id}: landed on ${at.chapterId}/${at.stepId}`);
    if (!ok) fail(`map: the «Мапа» stop ${c.id} landed on ${at.chapterId}/${at.stepId}`);
    await io.save(`map-${c.id}.jpg`);
  }
  // the map step: the first step whose panel holds the journey inset
  const where = await page.evaluate((v) => {
    for (const c of window.__app.listChapters(v))
      for (const s of c.steps) if (s.id === 'map') return `${v}/${c.id}/${s.id}`;
    return null;
  }, volume);
  if (!where) return result;
  await page.evaluate((a) => window.__app.goto(a), where);
  await wait(4);
  for (const c of chapters) {
    const sel = `[data-ui="journey-stop:${c.id}"]`;
    const there = await page.evaluate((s) => !!document.querySelector(s), sel);
    if (!there) {
      fail(`map step: no stop for ${c.id}`);
      continue;
    }
    await press(sel);
    await wait(0.6);
    const card = await page.evaluate(
      () => document.querySelector('[data-ui="journey-card"]')?.textContent ?? '',
    );
    const ok = plain(card).includes(plain(c.title));
    result.step.push({ id: c.id, ok });
    log(`  map  ${ok ? 'ok  ' : 'FAIL'} ${where} stop ${c.id}: its card shows «${c.title.slice(0, 40)}»`);
    if (!ok) fail(`map step: the stop ${c.id} does not show its question`);
  }
  await io.save('map-step.jpg');
  return result;
}
