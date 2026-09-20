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
import { chmodSync, cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const srcElectron = path.join(packageRoot, 'src', 'electron');
const outElectron = path.join(packageRoot, 'dist', 'electron');

// V2-T11 item 2: kept in sync by hand with composition/window-icon.ts's own constant of the same
// name — see this script's own comment on the `cpSync` call below for why this can't be a shared
// import instead.
const WINDOW_ICON_FILE_NAME = '256x256.png';

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
  // V2-T3: the embedded Nerd Font (`assets/fonts/`, packaged alongside its own SIL OFL 1.1
  // license file) — index.css's own @font-face rule loads it by this same relative path,
  // `fonts/<file>`, next to index.html in dist/electron/.
  cpSync(path.join(packageRoot, 'assets', 'fonts'), path.join(outElectron, 'fonts'), {
    recursive: true,
  });
  // Resolved via import.meta.resolve, not a hardcoded node_modules path: npm workspaces hoist
  // @xterm/xterm to the REPO ROOT's node_modules, not packages/app/node_modules — the same
  // resolution Node's own module loader uses, so this never drifts from wherever npm actually
  // placed it.
  const xtermCssUrl = import.meta.resolve('@xterm/xterm/css/xterm.css');
  cpSync(fileURLToPath(xtermCssUrl), path.join(outElectron, 'xterm.css'));
  // V2-T11 item 2: the `BrowserWindow` icon, copied from `design/icons/png/` (the single source,
  // `design/IDENTIDADE_VISUAL.md` § 2.6 — never a versioned copy under packages/app), same
  // "alongside the bundle" pattern as the Nerd Font above. The file name here MUST match
  // `composition/window-icon.ts#WINDOW_ICON_FILE_NAME` — that module's own docstring has the
  // 256-vs-512 measurement behind the choice; this script can't import that TypeScript module
  // directly (it runs as a plain Node ESM script, no TS loader), so the name is repeated here the
  // same way `assets/fonts` above is repeated in index.css's own @font-face rule, by convention,
  // not by shared code.
  cpSync(
    path.join(repoRoot, 'design', 'icons', 'png', WINDOW_ICON_FILE_NAME),
    path.join(outElectron, WINDOW_ICON_FILE_NAME),
  );
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

/**
 * Locates node-pty's `spawn-helper` the SAME way `node_modules/node-pty/lib/unixTerminal.js`
 * resolves it itself: `native.dir + '/spawn-helper'`, where `native.dir` comes from
 * `node_modules/node-pty/lib/utils.js#loadNativeModule`'s own search order (`build/Release`,
 * `build/Debug`, then `prebuilds/<platform>-<arch>`, each relative to node-pty's own `lib/`
 * directory) — walked here WITHOUT loading the native `.node` addon itself (this script has no
 * reason to touch it, only to find a sibling file). `require.resolve` finds node-pty's actual
 * installed location, wherever npm workspaces hoisted it — never a hand-typed relative guess.
 *
 * **Measured inside the `verificar:linux` container (V2-T3, `node:22-bookworm`, node-pty 1.1.0):
 * `spawn-helper` is a target that only exists for `OS=="mac"` in node-pty's own `binding.gyp`** —
 * Linux's `pty` addon uses `forkpty`/`-lutil` directly and never even defines the target, so a
 * from-source Linux build (Q-071 item 6: Linux has no node-pty prebuild, it always compiles) never
 * produces this file at all. On Linux this function returns `null`, and `unixTerminal.js` still
 * computes and PASSES a `spawn-helper` path into the native call unconditionally on every POSIX
 * platform — harmless, because the Linux-compiled addon has no code path that ever opens it. So
 * `null` here is the expected, healthy Linux result, not a sign anything is broken.
 */
function locateSpawnHelper() {
  const require = createRequire(import.meta.url);
  const nodePtyRoot = path.dirname(require.resolve('node-pty/package.json'));
  const candidateDirs = [
    path.join(nodePtyRoot, 'build', 'Release'),
    path.join(nodePtyRoot, 'build', 'Debug'),
    path.join(nodePtyRoot, 'prebuilds', `${process.platform}-${process.arch}`),
  ];
  for (const dir of candidateDirs) {
    const candidate = path.join(dir, 'spawn-helper');
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * V2-T3, item 3. On macOS, node-pty launches every process through `spawn-helper` — if it lost
 * its execute bit during install, every tab fails with `posix_spawnp failed` (the finding from
 * V2-T2's macOS pass; a HYPOTHESIS pending the maintainer's own `ls -l` on his Mac, not a
 * confirmed cause). **Measured evidence that makes the hypothesis plausible, not proven:** inside
 * the `verificar:linux` container, `npm ci` extracts node-pty's DARWIN prebuilds
 * (`prebuilds/darwin-x64/spawn-helper`, `prebuilds/darwin-arm64/spawn-helper` — present even on
 * Linux, just unused there) with mode `644` — **no execute bit at all** — because npm preserves
 * whatever mode was packed into the tarball, regardless of the extracting OS; a real macOS
 * `npm ci` would extract the identical bytes with the identical mode. This function's own
 * find-and-chmod logic was verified against that real (non-executable) file inside the container:
 * it locates it, confirms mode `644`, and `chmod`s it to `755` correctly. Still not the same as
 * measuring on an actual Mac — the maintainer's own `ls -l` remains the real confirmation.
 *
 * Runs on darwin AND linux (cheap, no side effect when the bit is already set, or when
 * `locateSpawnHelper` finds nothing — the expected Linux case, see its own docstring). A no-op on
 * win32: node-pty has no `spawn-helper` there (ConPTY doesn't need one).
 */
function ensureSpawnHelperExecutable() {
  if (process.platform === 'win32') {
    return;
  }
  const helperPath = locateSpawnHelper();
  if (helperPath === null) {
    console.log('spawn-helper not found under node_modules/node-pty — nothing to fix.');
    return;
  }
  const mode = statSync(helperPath).mode;
  // Any of the three execute bits (owner/group/other, 0o111) being set is enough — this only
  // fixes the "lost every execute bit" case (an install/copy that stripped permissions), it never
  // tightens or loosens who specifically may run it.
  if ((mode & 0o111) !== 0) {
    console.log(`spawn-helper already executable: ${helperPath}`);
    return;
  }
  chmodSync(helperPath, mode | 0o755);
  console.log(`spawn-helper was missing its execute bit — chmod +x applied: ${helperPath}`);
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
  // V2-T15 item 2: called unconditionally now, not just under `--dev`. Measured
  // (docs/PLANO-DE-ENTREGA.md V2-T15): this fix used to run only inside `launchElectron` (`npm run
  // app`'s own path), so the `dist` path (this same script, non-dev, then `electron-builder`) left
  // `node_modules` exactly as broken as node-pty's own tarball — the packaged `.dmg` inherited the
  // same missing execute bit. `scripts/after-pack.mjs` (wired via `electron-builder.yml`'s own
  // `afterPack:`) re-applies this again on the PACKAGED output after asarUnpack extraction; see
  // that file's own docstring for why the pre-pack fix here, alone, was measured not to be enough.
  ensureSpawnHelperExecutable();
  if (isDev) {
    console.log('Launching Electron...');
    await launchElectron();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
