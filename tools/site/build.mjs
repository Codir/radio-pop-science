#!/usr/bin/env node
// Site profile: a production build of app/ that contains ONE volume, shown as a stand-alone course.
// The repository tree is not touched: the profile is applied to a temporary copy of app/.
//
//   node tools/site/build.mjs [--volume radio] [--out tools/site/dist] [--sub radio-pop-science]
//                             [--port 5391] [--no-smoke] [--keep-work]
//
//   0. refuse before the copy exists: volume.json in the tree (id ≠ --volume, an `aside`), a busy --port (not with
//      --no-smoke)
//   1. copy app/ (without node_modules, dist, .vite) to a temporary directory; link app/node_modules into it
//   2. keep only src/volumes/<volume>/ (other volumes and the dev volumes `_…` are not in the build)
//   3. write src/volumes/library.json = { title: null, defaultVolume: <volume> }; set the volume's status to published
//   4. typecheck the copy and build it (`tsc --noEmit`, `vite build`) into --out
//   5. serve --out under /<sub>/ and check it in the browser (tools/site/smoke.mjs)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smoke } from './smoke.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const opt = (name, fallback) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : fallback);
const flag = (name) => argv.includes(`--${name}`);
const volume = opt('volume', 'radio');
const out = resolve(opt('out', join(repo, 'tools/site/dist')));
const sub = opt('sub', 'radio-pop-science');
const port = Number(opt('port', 5391));

const app = join(repo, 'app');
const fail = (message) => {
  console.error(`site: ${message}`);
  process.exit(1);
};
if (!existsSync(join(app, 'node_modules'))) fail('app/node_modules is missing: run `pnpm install --frozen-lockfile` in app/');
if (!existsSync(join(app, 'src/volumes', volume, 'volume.json'))) fail(`app/src/volumes/${volume}/volume.json is missing`);
// Every refusal comes before the copy exists, so none of them leaves a copy behind. The port is checked now, not
// after the build: a busy port would otherwise leave --out holding a build no browser has checked.
const identity = JSON.parse(readFileSync(join(app, 'src/volumes', volume, 'volume.json'), 'utf8'));
if (identity.id !== volume) fail(`volume.json: id '${identity.id}' is not '${volume}'`);
if (identity.aside !== undefined) fail('volume.json: an aside volume cannot be the front door');
const BUSY = `(site_stop ${port} from tools/site/qa-env.sh frees it if a server of this repository holds it; or pass --port)`;
if (!flag('no-smoke'))
  await new Promise((ok) => {
    const probe = createServer()
      .once('error', (error) => fail(`port ${port} on 127.0.0.1 is not free: ${error.code} ${BUSY}`))
      .listen(port, '127.0.0.1', () => probe.close(ok));
  });

// 1–3. the copy with one volume and its front door ------------------------------------------------------------
const work = mkdtempSync(join(tmpdir(), 'site-profile-'));
const volumes = join(work, 'src/volumes');
const removed = [];
try {
  // 1. the copy
  const skip = new Set(['node_modules', 'dist', '.vite']);
  cpSync(app, work, { recursive: true, filter: (src) => !skip.has(src.slice(app.length + 1).split('/')[0]) });
  symlinkSync(join(app, 'node_modules'), join(work, 'node_modules'), 'dir');
  // 2. one volume
  for (const entry of readdirSync(volumes, { withFileTypes: true })) {
    if (entry.name === volume) continue;
    rmSync(join(volumes, entry.name), { recursive: true, force: true });
    if (entry.isDirectory()) removed.push(entry.name);
  }
  // 3. the front door; no `legacyVolume`: it defaults to the default volume (app/src/engine/library.ts)
  writeFileSync(join(volumes, 'library.json'), `${JSON.stringify({ title: null, defaultVolume: volume }, null, 2)}\n`);
  const copied = join(volumes, volume, 'volume.json');
  writeFileSync(copied, `${JSON.stringify({ ...JSON.parse(readFileSync(copied, 'utf8')), status: 'published' }, null, 2)}\n`);
} catch (error) {
  rmSync(work, { recursive: true, force: true }); // a half-made copy is of no use to anyone
  fail(`cannot make the work copy (${error.message})`);
}
console.log(`site: volume ${volume} (${identity.status} → published); removed from the copy: ${removed.join(' ')}`);

// 4. build ----------------------------------------------------------------------------------------------------
// The copy's node_modules is a link to app/node_modules: pnpm 12 run inside the copy re-links the real store to the
// copy's path, and once the copy is gone tsc, vite and vitest in app/ no longer find their packages. So the build
// calls the binaries directly, and every message that leaves the copy behind says so.
const KEPT = ' — do not run pnpm or corepack in it';
const bin = (name) => join(app, 'node_modules/.bin', name);
const run = (cmd, args) => {
  // a hung tool must not hold a background check for ever (vite once hung on an --out it could not write)
  const r = spawnSync(cmd, args, { cwd: work, stdio: 'inherit', timeout: 10 * 60 * 1000 });
  const why = r.error ? ` (${r.error.message})` : '';
  if (r.status !== 0) fail(`${[cmd, ...args].join(' ')} failed${why} (work copy kept: ${work})${KEPT}`);
};
run(bin('tsc'), ['-p', 'tsconfig.json', '--noEmit']);
run(bin('vite'), ['build', '--outDir', out, '--emptyOutDir']);
if (flag('keep-work')) console.log(`site: work copy kept at ${work}${KEPT}`);
else rmSync(work, { recursive: true, force: true });

// 5. browser check --------------------------------------------------------------------------------------------
const headline = identity.headline === 'subtitle' ? identity.subtitle : identity.title;
if (flag('no-smoke')) console.log(`site: built ${out} (browser check skipped)`);
else process.exit((await smoke({ dist: out, sub, port, volume, title: headline, note: identity.emptyNote ?? '', appDir: app })) ? 0 : 1);
