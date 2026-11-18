#!/usr/bin/env node
// Browser check of a site-profile build: serves <dist> under /<sub>/ exactly as a GitHub Pages project site does
// (nothing exists outside the sub-path, no fallback page) and opens it in headless Chrome.
//
//   node tools/site/smoke.mjs --dist tools/site/dist --volume radio [--sub radio-pop-science] [--port 5391]
//   node tools/site/smoke.mjs --dist tools/site/dist --serve [--port 5391]   only serve (for tools/qa: --base http://127.0.0.1:5391/<sub>/)
//   node tools/site/smoke.mjs --url http://127.0.0.1:5391/radio-pop-science/ --volume radio
//                                                     check a site that is already served (starts no server)
//
// The expected page title (the volume's headline) and lobby note (`emptyNote`) are read from
// app/src/volumes/<volume>/volume.json, not from the build.
// Environment: QA_CHROME (default /usr/bin/google-chrome), QA_CHROME_ARGS (replaces the software-rendering flags).
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
// SwiftShader through ANGLE: WebGL2 without a GPU (a CI runner, a machine whose GPU Chrome cannot use)
const SOFTWARE_ARGS =
  '--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox --hide-scrollbars --autoplay-policy=no-user-gesture-required';

/** Serve `dist` under `/<sub>/` only. Resolves to { url, close }. */
export function serve(dist, sub, port) {
  const root = resolve(dist);
  const prefix = sub ? `/${sub}/` : '/'; // a user site or a custom domain has no sub-path
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const end = (status, headers = {}, body = '') => res.writeHead(status, headers).end(body);
    if (sub && url.pathname === `/${sub}`) return end(301, { location: prefix + url.search });
    if (!url.pathname.startsWith(prefix)) return end(404, { 'content-type': 'text/plain' }, 'outside the site');
    let rel = normalize(decodeURIComponent(url.pathname.slice(prefix.length)));
    if (rel === '.' || rel === '') rel = 'index.html';
    const file = join(root, rel);
    if (!file.startsWith(root)) return end(403);
    try {
      const path = (await stat(file)).isDirectory() ? join(file, 'index.html') : file;
      end(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }, await readFile(path));
    } catch {
      end(404, { 'content-type': 'text/plain' }, 'not found');
    }
  });
  return new Promise((ok, bad) => {
    server.once('error', bad);
    server.listen(port, '127.0.0.1', () =>
      ok({ url: `http://127.0.0.1:${port}${prefix}`, close: () => new Promise((done) => server.close(done)) }),
    );
  });
}

/**
 * Returns true when every check passed. Either `dist` (served here under `/<sub>/` on `port`) or `url` (a site that
 * is already served, ending with a slash; every request must stay under it). `title`: the expected browser-tab
 * title (the volume's headline); `note`: the line a volume without built chapters shows in its lobby.
 */
export async function smoke({ dist, url, sub, port, volume, title, note = '', appDir }) {
  const { chromium } = createRequire(join(appDir, 'package.json'))('playwright-core');
  const site = url ? { url, close: async () => {} } : await serve(dist, sub, port);
  const failures = [];
  const check = (ok, name, detail = '') => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  const browser = await chromium.launch({
    executablePath: process.env.QA_CHROME ?? '/usr/bin/google-chrome',
    headless: true,
    args: (process.env.QA_CHROME_ARGS ?? SOFTWARE_ARGS).split(/\s+/).filter(Boolean),
  });
  /** One page load in a fresh profile; `label` prefixes the checks every load must pass. */
  const open = async (hash, label) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const bad = [];
    const outside = [];
    const errors = [];
    page.on('response', (r) => {
      if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
      if (!r.url().startsWith(site.url)) outside.push(r.url());
    });
    page.on('requestfailed', (r) => bad.push(`failed ${r.url()}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(site.url + hash, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof window.__app === 'object', null, { timeout: 60000 });
    await page.evaluate(() => window.__app.ready);
    await page.evaluate(() => window.__app.settled());
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({
      hash: window.location.hash,
      title: document.title,
      position: window.__app.position(),
      lobby: window.__app.lobby(),
      volumes: window.__app.listVolumes(),
      chapters: window.__app.listChapters().map((c) => `${c.id}/${c.steps[0]?.id}`),
      overlay: window.__ui?.overlay() ?? null,
      names: window.__ui?.names() ?? [],
      appErrors: window.__app.errors().filter((e) => e.level === 'error').map((e) => e.message),
      fatal: document.getElementById('fatal')?.hidden === false,
      splashGone: document.getElementById('boot')?.classList.contains('out') ?? false,
      text: document.body.innerText,
    }));
    check(bad.length === 0, `${label}: every request is answered`, bad.join(' '));
    check(outside.length === 0, `${label}: every request stays under ${new URL(site.url).pathname}`, outside.join(' '));
    check(errors.length === 0 && state.appErrors.length === 0, `${label}: no console error`, [...errors, ...state.appErrors].join(' | '));
    check(!state.fatal && state.splashGone, `${label}: the app booted (splash gone, no fatal screen)`);
    await context.close();
    return state;
  };
  try {
    const home = await open('', 'home');
    const where = home.lobby ? `lobby:${home.lobby}` : `${home.position.volumeId}/${home.position.chapterId}/${home.position.stepId}`;
    console.log(`  site: ${site.url} → ${where}, overlay ${home.overlay}, title «${home.title}», chapters: ${home.chapters.join(' ') || '(none built)'}`);
    check(home.volumes.map((v) => v.id).join(' ') === volume, `home: the only volume is ${volume}`, home.volumes.map((v) => v.id).join(' '));
    check(home.volumes[0]?.status === 'published' && home.volumes[0]?.role === 'default', 'home: it is published and is the front door');
    check((home.lobby ?? home.position.volumeId) === volume, `home: the plain address opens ${volume}`, where);
    check(home.overlay === 'home', 'home: on its home screen', String(home.overlay));
    check(home.title === title && home.text.includes(title), `home: the page is titled «${title}»`, home.title);
    check(!home.names.includes('home-library') && !home.names.some((n) => n.startsWith('home-aside')), 'home: no way to a library or to another volume');
    if (home.chapters.length === 0) {
      const lobby = home.names.includes('home-empty') && home.text.includes(note);
      check(lobby, "home: the lobby shows the volume's note", lobby ? '' : `«${note}»; names: ${home.names.join(' ')}`);
    } else {
      const start = home.names.includes('home-start') || home.names.includes('home-resume');
      check(start, 'home: the home screen offers a way in (home-start or home-resume)', start ? '' : home.names.join(' '));
      const first = home.chapters[0];
      const deep = await open(`#/${volume}/${first}`, 'deep link');
      check(deep.hash === `#/${volume}/${first}` && `${deep.position.chapterId}/${deep.position.stepId}` === first, `deep link: #/${volume}/${first} opens that step`, deep.hash);
    }
    const other = await open('#/no-such-volume/chapter/step', 'foreign link');
    check((other.lobby ?? other.position.volumeId) === volume, `foreign link: a link into a volume that is not here opens ${volume}`, other.hash);
  } catch (error) {
    failures.push(`exception: ${error.message}`);
    console.error(error);
  } finally {
    await browser.close();
    await site.close();
  }
  console.log(failures.length === 0 ? 'PASS site smoke' : `FAILED site smoke: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
  return failures.length === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
  const fail = (message) => {
    console.error(`site: ${message}`);
    process.exit(1);
  };
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../app');
  const volume = opt('volume', 'radio');
  const url = opt('url', undefined);
  const dist = url === undefined ? resolve(opt('dist', join(appDir, '../tools/site/dist'))) : undefined;
  const sub = opt('sub', 'radio-pop-science');
  const port = Number(opt('port', 5391));
  if (url !== undefined && !url.endsWith('/')) fail(`--url must end with a slash: ${url}`);
  if (dist !== undefined && !existsSync(join(dist, 'index.html'))) fail(`${join(dist, 'index.html')} is missing`);
  if (argv.includes('--serve')) {
    if (url !== undefined) fail('--serve serves a --dist directory; --url only checks a site served elsewhere');
    console.log(`serving ${dist} at ${(await serve(dist, sub, port)).url} (Ctrl+C to stop)`);
  } else {
    const identityFile = join(appDir, 'src/volumes', volume, 'volume.json');
    if (!existsSync(identityFile)) fail(`app/src/volumes/${volume}/volume.json is missing`);
    const identity = JSON.parse(readFileSync(identityFile, 'utf8'));
    const title = identity.headline === 'subtitle' ? identity.subtitle : identity.title;
    const note = identity.emptyNote ?? '';
    process.exit((await smoke({ dist, url, sub, port, volume, title, note, appDir })) ? 0 : 1);
  }
}
