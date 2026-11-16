import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// `base: './'` keeps every asset URL relative, so the build works from any sub-path
// (nginx serves it from `/`, QA serves `vite preview`, a file server may serve `/app/`).
const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

/**
 * `@/…` is the platform; every published volume gets `@<volume>/…` → `src/volumes/<volume>/…`
 * (dev volumes — directories starting with `_` — have no alias). tsconfig.json `paths` lists the same aliases.
 */
const volumeAliases = Object.fromEntries(
  readdirSync(src('volumes'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => [`@${d.name}`, src(`volumes/${d.name}`)]),
);

/**
 * The name on the splash screen and the browser tab (`%LIBRARY_TITLE%` in index.html; also `%LIBRARY_SUBTITLE%`, `%LIBRARY_DESCRIPTION%`): the umbrella title of
 * `src/volumes/library.json`, or — while it is null — the headline of the default volume (`volume.json`).
 * The names live in those two files only.
 */
function libraryTitle(): Plugin {
  const json = (path: string): Record<string, unknown> => JSON.parse(readFileSync(src(path), 'utf8'));
  const library = json('volumes/library.json');
  const volume = json(`volumes/${String(library.defaultVolume)}/volume.json`);
  const title = String(library.title ?? (volume.headline === 'subtitle' ? volume.subtitle : volume.title));
  // the splash's second line is the default volume's other name; the page description names both
  const subtitle = String(volume.headline === 'subtitle' ? volume.title : volume.subtitle);
  const description = `${String(volume.title)}. ${String(volume.subtitle)}.`;
  const esc = (t: string): string =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return {
    name: 'library-title',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%LIBRARY_TITLE%', esc(title))
        .replaceAll('%LIBRARY_DESCRIPTION%', esc(description))
        .replaceAll('%LIBRARY_SUBTITLE%', esc(subtitle)),
  };
}

export default defineConfig({
  base: './',
  plugins: [libraryTitle()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), ...volumeAliases },
  },
  server: { host: '0.0.0.0', strictPort: true },
  preview: { host: '0.0.0.0', strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        // recognisable names for the lazy chunks of a volume:
        //   assets/volume-<volume>-<hash>.js          its chapter manifests (src/volumes/<volume>/chapters.ts)
        //   assets/chapter-<volume>-<id>-<hash>.js    a chapter scene
        chunkFileNames: (chunk) => {
          const id = chunk.facadeModuleId ?? '';
          const scene = /volumes\/([^/]+)\/chapters\/([^/]+)\/scene\.ts$/.exec(id);
          if (scene) return `assets/chapter-${scene[1]}-${scene[2]}-[hash].js`;
          const volume = /volumes\/([^/]+)\/chapters\.ts$/.exec(id);
          return volume ? `assets/volume-${volume[1]}-[hash].js` : 'assets/[name]-[hash].js';
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 10 }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
