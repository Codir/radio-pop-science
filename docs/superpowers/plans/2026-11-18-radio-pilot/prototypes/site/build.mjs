#!/usr/bin/env node
// Site profile: a production build of app/ that contains ONE volume, shown as a stand-alone course.
// The repository tree is not touched: the profile is applied to a temporary copy of app/.
//
//   node tools/site/build.mjs [--volume radio] [--out tools/site/dist] [--sub radio-pop-science]
//                             [--port 5391] [--no-smoke] [--keep-work]
//
//   1. copy app/ (without node_modules, dist, .vite) to a temporary directory; link app/node_modules into it
//   2. keep only src/volumes/<volume>/ (other volumes and the dev volumes `_…` are not in the build)
//   3. write src/volumes/library.json = { title: null, defaultVolume: <volume> }; set the volume's status to published
//   4. typecheck the copy and build it (`tsc --noEmit`, `vite build`) into --out
//   5. serve --out under /<sub>/ and check it in the browser (tools/site/smoke.mjs)
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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

// 1. the copy -------------------------------------------------------------------------------------------------
const work = mkdtempSync(join(tmpdir(), 'site-profile-'));
const skip = new Set(['node_modules', 'dist', '.vite']);
cpSync(app, work, { recursive: true, filter: (src) => !skip.has(src.slice(app.length + 1).split('/')[0]) });
symlinkSync(join(app, 'node_modules'), join(work, 'node_modules'), 'dir');

// 2. one volume -----------------------------------------------------------------------------------------------
const volumes = join(work, 'src/volumes');
const removed = [];
for (const entry of readdirSync(volumes, { withFileTypes: true })) {
  if (entry.name === volume) continue;
  rmSync(join(volumes, entry.name), { recursive: true, force: true });
  if (entry.isDirectory()) removed.push(entry.name);
}

// 3. the front door -------------------------------------------------------------------------------------------
// no `legacyVolume`: it defaults to the default volume (app/src/engine/library.ts)
writeFileSync(join(volumes, 'library.json'), `${JSON.stringify({ title: null, defaultVolume: volume }, null, 2)}\n`);
const identityFile = join(volumes, volume, 'volume.json');
const identity = JSON.parse(readFileSync(identityFile, 'utf8'));
if (identity.id !== volume) fail(`volume.json: id '${identity.id}' is not '${volume}'`);
if (identity.aside !== undefined) fail('volume.json: an aside volume cannot be the front door');
const was = identity.status;
identity.status = 'published';
writeFileSync(identityFile, `${JSON.stringify(identity, null, 2)}\n`);
console.log(`site: volume ${volume} (${was} → published); removed from the copy: ${removed.join(' ')}`);

// 4. build ----------------------------------------------------------------------------------------------------
const bin = (name) => join(app, 'node_modules/.bin', name);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: work, stdio: 'inherit' });
  if (r.status !== 0) fail(`${[cmd, ...args].join(' ')} failed (work copy kept: ${work})`);
};
run(bin('tsc'), ['-p', 'tsconfig.json', '--noEmit']);
run(bin('vite'), ['build', '--outDir', out, '--emptyOutDir']);
if (flag('keep-work')) console.log(`site: work copy kept at ${work}`);
else rmSync(work, { recursive: true, force: true });

// 5. browser check --------------------------------------------------------------------------------------------
const headline = identity.headline === 'subtitle' ? identity.subtitle : identity.title;
if (flag('no-smoke')) console.log(`site: built ${out} (browser check skipped)`);
else process.exit((await smoke({ dist: out, sub, port, volume, title: headline, appDir: app })) ? 0 : 1);
