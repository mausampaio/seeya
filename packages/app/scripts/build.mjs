#!/usr/bin/env node
// The app's own bundler entry (D-041: minimum that resolves the three Electron targets — main,
// preload, renderer — registered as Q-071's tooling decision: esbuild over electron-vite, because
// this task needs exactly three bundle calls and no dev server, no framework plugin, no opinionated
// project layout). Bundles TypeScript straight from packages/app/src (esbuild transpiles, it does
// not type-check — `npm run verificar`'s `tsc -b`/`tsc -p tsconfig.json --noEmit` steps are what
// catch a type error; this script's only job is producing runnable JS fast).
//
// console.* solto: this is tooling outside src/, same precedent as
// scripts/verificar-linux.mjs (AGENTS.md § "Registro e saída").
//
// Usage: `node scripts/build.mjs` (production bundle only) or `node scripts/build.mjs --dev`
// (bundle, then launch the real Electron binary against the result) — `npm run app` at the repo
// root runs the latter via `npm run dev --workspace=@seeya-ai/app`.

import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcElectron = path.join(packageRoot, 'src', 'electron');
const outElectron = path.join(packageRoot, 'dist', 'electron');

const isDev = process.argv.includes('--dev');

async function bundle() {
  mkdirSync(outElectron, { recursive: true });

  // main: the Electron main process, a Node context. ESM (the package is "type": "module"),
  // `electron`/`node-pty` external — both ship native bindings esbuild cannot bundle, and
  // `electron` is provided by the Electron runtime itself at launch.
  await esbuild.build({
    entryPoints: [path.join(srcElectron, 'main.ts')],
    outfile: path.join(outElectron, 'main.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['electron', 'node-pty'],
  });

  // preload: forced to CommonJS (.cjs), not the package's default ESM — Electron's sandboxed
  // preload loader (main.ts's own `sandbox: true`) only guarantees CommonJS support; an ESM
  // preload under a sandboxed BrowserWindow is a newer, narrower Electron feature this task has
  // no reason to depend on for a skeleton. `electron` external, same reason as main.
  await esbuild.build({
    entryPoints: [path.join(srcElectron, 'preload.ts')],
    outfile: path.join(outElectron, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  });

  // renderer: the browser context (loaded by index.html as `<script type="module">`) — bundled
  // for the browser, nothing external, so @xterm/xterm and @xterm/addon-fit ship inline.
  await esbuild.build({
    entryPoints: [path.join(srcElectron, 'renderer.ts')],
    outfile: path.join(outElectron, 'renderer.js'),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'chrome120',
  });

  cpSync(path.join(srcElectron, 'index.html'), path.join(outElectron, 'index.html'));
  cpSync(path.join(srcElectron, 'index.css'), path.join(outElectron, 'index.css'));
  // Resolved via import.meta.resolve, not a hardcoded node_modules path: npm workspaces hoist
  // @xterm/xterm to the REPO ROOT's node_modules, not packages/app/node_modules — the same
  // resolution Node's own module loader uses, so this never drifts from wherever npm actually
  // placed it.
  const xtermCssUrl = import.meta.resolve('@xterm/xterm/css/xterm.css');
  cpSync(fileURLToPath(xtermCssUrl), path.join(outElectron, 'xterm.css'));
}

/**
 * Makes sure the Electron binary is actually on disk before anything imports `electron`.
 * Measured on the maintainer's Windows machine right after the V2-T2 merge (Q-071 item 6 saw the
 * same thing inside the Linux container): `electron@44`'s published package has NO install
 * script — `npm ci` leaves `node_modules/electron` without `dist/` and without `path.txt`, and
 * the download only happens the first time `electron/cli.js` runs. `import('electron')` (the
 * package's index.js, used below) does not download; it throws "Electron failed to install
 * correctly" instead — so on a fresh clone `npm run app` would fail on its first run for no reason
 * the person could act on. Running the package's own `install.js` here (the exact script the CLI
 * shim would have run) closes that gap once; it is a no-op when the binary already exists.
 */
function ensureElectronBinary() {
  const require = createRequire(import.meta.url);
  const electronPackageDir = path.dirname(require.resolve('electron/package.json'));
  if (existsSync(path.join(electronPackageDir, 'path.txt'))) {
    return;
  }
  console.log('Electron binary not downloaded yet — running electron/install.js once...');
  const result = spawnSync(process.execPath, [path.join(electronPackageDir, 'install.js')], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(
      `electron/install.js exited with ${String(result.status)} — the Electron binary is not ` +
        `available under ${electronPackageDir}; run it by hand to see the download error.`,
    );
  }
}

function launchElectron() {
  ensureElectronBinary();
  // `import electron from 'electron'` (the package's own main export) resolves to the path of
  // the real Electron binary for this platform — the standard way an npm-installed `electron`
  // package is launched from a script, rather than guessing `node_modules/.bin/electron`'s exact
  // shim shape per OS.
  return import('electron').then(({ default: electronPath }) => {
    const child = spawn(electronPath, [path.join(packageRoot, 'dist', 'electron', 'main.js')], {
      cwd: packageRoot,
      stdio: 'inherit',
      shell: false,
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  });
}

async function main() {
  console.log(`Bundling @seeya-ai/app (esbuild) into ${outElectron}`);
  await bundle();
  if (isDev) {
    console.log('Launching Electron...');
    await launchElectron();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
