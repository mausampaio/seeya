#!/usr/bin/env node
// Removes `dist/` before `tsc` runs (S3-T7, docs/PLANO-DE-ENTREGA.md). `tsc -p
// tsconfig.build.json` only ever writes and overwrites; it never deletes a file that no longer
// has a corresponding source. When a directory gets renamed — as happened when this project's
// source moved to English — the old output (`dist/adaptadores`, `dist/aplicacao`, `dist/nucleo`,
// `dist/agendador`) keeps sitting next to the new one, invisible unless someone opens `dist/` by
// hand. That happened here for two weeks before anyone noticed.
//
// This is more than tidiness: `package.json`'s `files` field is `["dist"]`, so `npm publish`
// packages whatever is actually in that directory — stale output in the old language would ship
// in a package meant to be read by strangers.
//
// Plain `node:fs`, not a new dependency: this project has exactly two production dependencies
// (`commander`, `zod`) and AGENTS.md § "Dependências" is explicit that a new one needs asking
// first. `rmSync(..., { recursive: true, force: true })` works identically on Windows, macOS and
// Linux — no shell, no `rm -rf` (which isn't a thing on Windows), no dependency at all. `force:
// true` makes a first build (no `dist/` yet) a no-op instead of an ENOENT crash — this script's
// job is "make sure dist/ doesn't exist yet", and an absent directory already satisfies that.
//
// A standalone script rather than an inline `package.json` command for the same reason
// `verificar-linux.mjs` is one: `rm -rf` has no single cross-platform shell equivalent, and typing
// the wrong one (`rimraf`-as-a-dependency, or a `rd /s /q` that only works in cmd.exe) is exactly
// the kind of platform assumption this project has been burned by before (docs/DECISOES.md D-015,
// Spike C: PowerShell silently mangling something that worked fine as a plain array/API call).
//
// V2-T1 (D-043): one `dist/` per workspace package now, not one at the repo root — each package
// builds and ships its own. `force: true` (a missing directory already satisfies "make sure
// dist/ doesn't exist") is what keeps this a no-op for packages/app, reserved but not created yet.
//
// Also removes each package's `tsconfig.build.tsbuildinfo` (`tsc -b`'s incremental-build cache,
// introduced by this same task): measured directly that skipping this reintroduces the exact
// class of bug this whole script exists to prevent. `tsc -b` decides whether a project is
// up to date from source mtimes recorded in that file — NOT from whether `dist/` still physically
// exists — so deleting only `dist/` left a build that had already run once produce a completely
// EMPTY `dist/` on the next `npm run build`: `tsc -b` saw an unchanged, still-valid buildinfo and
// silently skipped re-emitting anything, exiting 0. `npm link`'s `seeya` then failed with
// `MODULE_NOT_FOUND` even though `npm run verificar` had just reported success.
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePathsToClean = [
  ...['packages/engine', 'packages/cli'].flatMap((pkg) => [
    path.join(repoRoot, pkg, 'dist'),
    path.join(repoRoot, pkg, 'tsconfig.build.tsbuildinfo'),
  ]),
  // V2-T2: packages/app has no "dist"/tsconfig.build.json of its own (see
  // packages/app/tsconfig.json's own comment) — its tsc output is "dist-tsc" (never run, only
  // type-checked as part of `npm run build`) and its buildinfo file is named after its own
  // tsconfig.json, not tsconfig.build.json. The esbuild bundle scripts/build.mjs writes for real
  // ("dist") is NOT cleaned here: it isn't part of `npm run build`'s tsc graph, and `npm run app`
  // (packages/app's own "dev" script) rebuilds it fresh on every invocation anyway.
  path.join(repoRoot, 'packages/app', 'dist-tsc'),
  path.join(repoRoot, 'packages/app', 'tsconfig.tsbuildinfo'),
];

for (const target of packagePathsToClean) {
  rmSync(target, { recursive: true, force: true });
}

// Residue of an INTERRUPTED test run (measured 2026-09-17, after the machine's low-memory guard
// killed `npm run cobertura` mid-way): the guard tests in tests/integration/guards/ write
// deliberate-violation fixtures under `packages/*/src/**/_guard-*/` (one of them imports the CLI
// from inside the engine) and delete them in `afterEach`/`afterAll` — which never ran. The engine's
// tsconfig.build.json includes all of `src`, so the next `tsc -b` pulled the CLI into the engine
// program, failed with rootDir errors, and even emitted `.js`/`.d.ts` next to the CLI's sources.
// `npm run app` was broken until someone deleted the residue by hand. This sweep runs before every
// build (same trigger as the dist cleanup above), so a killed test run can never leave the tree in
// a state that fails the next build. Nothing legitimate ever lives under a `_guard-*` directory or
// as a `.js`/`.d.ts` inside a package's `src` — every source is TypeScript. The test suite's own
// guards run AFTER `npm run build` inside `npm run verificar`, so this sweep never races them.
const packageSrcRoots = ['packages/engine', 'packages/cli', 'packages/app'].map((pkg) =>
  path.join(repoRoot, pkg, 'src'),
);
const EMITTED_INTO_SRC = /\.(js|js\.map|d\.ts|d\.ts\.map)$/;

/** @param {string} directory */
function sweepResidue(directory) {
  /** @type {import('node:fs').Dirent[]} */
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_guard-')) {
        rmSync(full, { recursive: true, force: true });
      } else {
        sweepResidue(full);
      }
    } else if (EMITTED_INTO_SRC.test(entry.name)) {
      rmSync(full, { force: true });
    }
  }
}

for (const srcRoot of packageSrcRoots) {
  sweepResidue(srcRoot);
}
