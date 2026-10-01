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
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
// V2-T65 PO review: Settings' own General section shows the installed version
// (docs/INTERFACE.md § 8) — `app.getVersion()` is the WRONG source for it: Electron falls back to
// its own runtime version (e.g. "44.3.0") whenever it can't find packaged app metadata, which is
// exactly the unpackaged case `npm run app`/this build script always produces. Read straight from
// this package's own package.json instead (`@seeya-ai/app`'s `"version"`, currently "0.1.0") and
// bake it into the main-process bundle at BUILD time via esbuild's `define` — a constant, not a
// runtime file read, so it survives being packaged into app.asar unchanged.
const appVersion = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
// D-052 (V2-T75): main.ts/preload.ts moved from src/electron to src/main (the Electron
// main-process side); the renderer bootstrap, the Preact tree and every asset it links moved to
// src/renderer. The OUTPUT directory name (dist/electron/) is unchanged on purpose — nothing
// outside this script names the source layout (package.json's "main", electron-builder.yml),
// so there is no reason to churn it too.
const srcMain = path.join(packageRoot, 'src', 'main');
const srcRenderer = path.join(packageRoot, 'src', 'renderer');
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
    entryPoints: [path.join(srcMain, 'main.ts')],
    outfile: path.join(outElectron, 'main.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['electron', 'node-pty'],
    // V2-T65: __SEEYA_APP_VERSION__ (declared ambient in src/main/build-constants.d.ts) — see
    // this file's own `appVersion` comment above for why this isn't `app.getVersion()`.
    define: { __SEEYA_APP_VERSION__: JSON.stringify(appVersion) },
  });

  // preload: forced to CommonJS (.cjs), not the package's default ESM — Electron's sandboxed
  // preload loader (main.ts's own `sandbox: true`) only guarantees CommonJS support; an ESM
  // preload under a sandboxed BrowserWindow is a newer, narrower Electron feature this task has
  // no reason to depend on for a skeleton. `electron` external, same reason as main.
  await esbuild.build({
    entryPoints: [path.join(srcMain, 'preload.ts')],
    outfile: path.join(outElectron, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  });

  // renderer: the browser context (loaded by index.html as `<script type="module">`) — bundled
  // for the browser, nothing external, so @xterm/xterm, @xterm/addon-fit and preact ship inline.
  // V2-T62 (D-051): `jsx: 'automatic'`/`jsxImportSource: 'preact'` compiles `.tsx` through
  // `preact/jsx-runtime`, never `preact/compat` (D-051's own "sem a camada de compatibilidade com
  // React") — the same setting `tsconfig.json` and the root `vitest.config.ts` repeat for `tsc -b`
  // and the unit tests, so all three tools agree on what a bare `<div/>` compiles to.
  // D-052 (V2-T75): `outdir` (not `outfile`) + `entryNames: '[name]'` — esbuild's own native CSS
  // Modules support (measured directly, no plugin: a `*.module.css` import through a bundled
  // entry produces a scoped JS class-name map AND a sibling `.css` file, but ONLY when the build
  // writes to a directory, not a single `outfile`) needs somewhere to put the bundled
  // `renderer.css` this task's design system now imports. `entryNames` keeps the JS output named
  // `renderer.js` (esbuild's outdir default is the entry file's own basename, and the entry file
  // is named `renderer.tsx` for exactly this reason — matching `index.html`'s own `<script src>`
  // without a second rename here).
  await esbuild.build({
    entryPoints: [path.join(srcRenderer, 'renderer.tsx')],
    outdir: outElectron,
    entryNames: '[name]',
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'chrome120',
    jsx: 'automatic',
    jsxImportSource: 'preact',
  });

  cpSync(path.join(srcRenderer, 'index.html'), path.join(outElectron, 'index.html'));
  // D-052 (V2-T75): the not-yet-rewritten screens' own layout — `renderer/legacy/legacy.css`
  // (formerly `electron/index.css`) — still copied to the same OUTPUT name, `index.css`: nothing
  // outside this script names the source file, and index.html's own `<link>` still points at
  // `index.css`.
  cpSync(path.join(srcRenderer, 'legacy', 'legacy.css'), path.join(outElectron, 'index.css'));
  // V2-T62 (D-051): the design tokens (both themes, spacing, radius, shadow, motion) — a separate
  // file from index.css so the two responsibilities (values vs. how they're applied) stay apart,
  // same split design/IDENTIDADE_VISUAL.md § 5.4 already documents as its own fenced block.
  cpSync(path.join(srcRenderer, 'tokens.css'), path.join(outElectron, 'tokens.css'));
  // V2-T62 (D-051): baseline styles for the LEGACY screens' own components
  // (`renderer/legacy/components.css`, formerly `electron/components.css`) — see that file's own
  // comment for why it's separate from both `tokens.css` (values only) and `index.css` (the
  // legacy screens' own layout). The design system's OWN components (`renderer/components/**`)
  // no longer use this file — each has its own CSS module now (D-052).
  cpSync(
    path.join(srcRenderer, 'legacy', 'components.css'),
    path.join(outElectron, 'components.css'),
  );
  // V2-T3: the embedded Nerd Font (`assets/fonts/`, packaged alongside its own SIL OFL 1.1
  // license file) — index.css's own @font-face rule loads it by this same relative path,
  // `fonts/<file>`, next to index.html in dist/electron/.
  cpSync(path.join(packageRoot, 'assets', 'fonts'), path.join(outElectron, 'fonts'), {
    recursive: true,
  });
  // V2-T63 (`docs/INTERFACE.md` § 1 item 2): the lateral's own logo, both pre-baked theme
  // variants (`design/seeya-logo.svg`/`-on-dark.svg`, identity § 2.1) — copied verbatim, never
  // loaded from the network, same "packaged, not fetched" discipline as the fonts above. Both are
  // always in the DOM (`app-shell.tsx`); `index.css`'s own `[data-theme='dark']` rule toggles
  // which one is visible, so no JS swap is needed.
  cpSync(path.join(packageRoot, 'assets', 'logo'), path.join(outElectron, 'logo'), {
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
