#!/usr/bin/env node
// V2-T15 item 2: electron-builder's own `afterPack` hook (wired via `electron-builder.yml`'s own
// `afterPack:` field), the ONE point that can still fix node-pty's `spawn-helper` losing its
// execute bit on macOS after `build.mjs`'s own `ensureSpawnHelperExecutable` already fixed
// `node_modules` before packaging (that fix alone was measured NOT to be enough: the installed
// app's own unpacked copy still came out mode 644 — see `build.mjs`'s own docstring on
// `ensureSpawnHelperExecutable`/`locateSpawnHelper` for the full measurement). `afterPack` runs
// once the packaged app directory is fully assembled — the asar built, `asarUnpack` files (which
// `electron-builder.yml`'s own `asarUnpack` already lists `node-pty/**` under) extracted onto real
// disk — and BEFORE the mac target turns that directory into a `.dmg`, so a fix applied here
// protects the actual artifact whoever installs it gets, not just this machine's own
// `node_modules`.
//
// **The chmod/find logic is injectable (`fixSpawnHelperModeIn`), not hardcoded to `node:fs`,**
// specifically so `tests/unit/app/scripts/after-pack.test.ts` can prove the DECISION (which files
// get found, which get chmod'd) without depending on a real filesystem's own execute-bit support —
// measured on this machine (Windows): `chmodSync(path, 0o755)` on NTFS leaves
// `statSync(path).mode & 0o111` at 0 either way (Node's own docs: "on Windows only the write
// permission can be changed"), so a test asserting the REAL mode after a REAL chmod would pass on
// Linux/macOS CI and silently prove nothing on `windows-latest` — exactly the "não volta calado"
// guard this task's own item 3 asks for, applied to the seam that actually varies by OS.
//
// console.* solto: this is tooling outside src/, same precedent as scripts/build.mjs/dist.mjs
// (AGENTS.md § "Registro e saída").

import { chmodSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** The three `node:fs` functions this hook needs, as a narrow, swappable surface — a fake
 * implementing the same three methods is `tests/unit/app/scripts/after-pack.test.ts`'s own
 * "duplo de I/O nomeado" (AGENTS.md § Testes), standing in for a real macOS-packaged directory
 * tree this suite has no way to produce for real. */
const realFs = { readdirSync, statSync, chmodSync };

function spawnHelperCandidates(fs, prebuildsDir) {
  let entries;
  try {
    entries = fs.readdirSync(prebuildsDir);
  } catch {
    // Nothing unpacked under this name at all — a build that trimmed node-pty's own files
    // differently, or a target that never had darwin prebuilds asarUnpack'd to begin with.
    // Nothing to fix (D-025: absence here is not evidence of a stripped execute bit).
    return [];
  }
  return entries
    .filter((entry) => entry.startsWith('darwin-'))
    .map((entry) => path.join(prebuildsDir, entry, 'spawn-helper'))
    .filter((candidate) => statOrNull(fs, candidate) !== null);
}

function statOrNull(fs, candidate) {
  try {
    return fs.statSync(candidate);
  } catch {
    return null;
  }
}

/**
 * Finds every `spawn-helper` under a packaged node-pty `prebuilds/darwin-<arch>` directory and
 * chmods the ones missing an execute bit — idempotent, same "any of owner/group/other is enough"
 * discipline as `build.mjs#ensureSpawnHelperExecutable` (this never tightens or loosens WHO may
 * run it, only restores the bit an install/copy stripped). Returns the paths it actually changed,
 * so a test can assert on the decision without inspecting the fake's internal state directly.
 */
export function fixSpawnHelperModeIn(fs, prebuildsDir) {
  const fixed = [];
  for (const helperPath of spawnHelperCandidates(fs, prebuildsDir)) {
    const mode = fs.statSync(helperPath).mode;
    if ((mode & 0o111) !== 0) {
      console.log(`spawn-helper already executable in the packaged app: ${helperPath}`);
      continue;
    }
    fs.chmodSync(helperPath, mode | 0o755);
    console.log(
      `spawn-helper was missing its execute bit in the packaged app — chmod +x applied: ${helperPath}`,
    );
    fixed.push(helperPath);
  }
  return fixed;
}

/** electron-builder's own `AfterPackContext` shape (`app-builder-lib`'s
 * `configuration.d.ts#PackContext`): `electronPlatformName` ("darwin"/"win32"/"linux"),
 * `appOutDir` (the packaged app's own output directory for this target), and `packager`
 * (`getResourcesDir(appOutDir)` — mac-aware: `<appOutDir>/<name>.app/Contents/Resources` on
 * darwin, `<appOutDir>/resources` elsewhere, the same helper electron-builder's own packaging code
 * uses internally). */
export default async function afterPack(context) {
  // Only macOS ships spawn-helper at all (`build.mjs`'s own `ensureSpawnHelperExecutable`
  // docstring: a `binding.gyp` target exclusive to `OS=="mac"`) — a no-op every other platform
  // this hook also runs for (electron-builder calls `afterPack` for every target, win/linux too).
  if (context.electronPlatformName !== 'darwin') {
    return;
  }
  const prebuildsDir = path.join(
    context.packager.getResourcesDir(context.appOutDir),
    'app.asar.unpacked',
    'node_modules',
    'node-pty',
    'prebuilds',
  );
  fixSpawnHelperModeIn(realFs, prebuildsDir);
}
