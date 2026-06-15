import { rm, cp, mkdir, watch as fsWatch } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src');
const PUBLIC = resolve(root, 'public');
const BUILD = resolve(root, 'build');

const dev = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: {
    popup: resolve(SRC, 'popup.ts'),
    contentScript: resolve(SRC, 'contentScript.ts'),
    background: resolve(SRC, 'background.ts'),
  },
  outdir: BUILD,
  entryNames: '[name]', // -> build/popup.js, contentScript.js, background.js
  bundle: true,
  format: 'iife', // CRITICAL: classic self-contained scripts for MV3
  target: 'chrome120', // matches manifest.minimum_chrome_version
  sourcemap: dev,
  minify: !dev,
  legalComments: 'none',
  logLevel: 'info',
};

async function copyPublic() {
  // Copy static assets (manifest, popup.html, fonts.css, fonts/, icons/) verbatim.
  await cp(PUBLIC, BUILD, { recursive: true });
}

await rm(BUILD, { recursive: true, force: true });
await mkdir(BUILD, { recursive: true });

if (dev) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  await copyPublic();
  console.log('watching… (rebuilds src + re-copies public on change)');
  // Re-copy static assets when anything in public/ changes.
  (async () => {
    for await (const _event of fsWatch(PUBLIC, { recursive: true })) {
      await copyPublic().catch((e) => console.error('copy failed:', e));
    }
  })();
} else {
  await esbuild.build(options);
  await copyPublic();
  console.log('build complete -> build/');
}
