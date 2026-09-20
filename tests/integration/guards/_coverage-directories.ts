/**
 * Independent declaration of docs/TESTES.md's per-directory coverage floor (`core/` 95%, every
 * other production directory 80%) — the S1-T12 counterpart to `_layer-matrix.ts` (S0-T6) and
 * `_test-projects.ts` (S1-T0e), same philosophy applied to a third config file.
 *
 * S1-T12 found that vitest.config.ts's `coverage.thresholds` keyed `'src/**'` for "every other
 * directory" — a glob that matches every file under `src/`, not the complement of `src/core/**`.
 * Measured: it computed the SAME number as the unscoped aggregate (91.7% the day this was
 * found), so a directory sitting well below 80% (`adapters/process`, 78.19%) passed anyway. The
 * fix is one glob PER production directory (vitest.config.ts's `PRODUCTION_DIRECTORY_THRESHOLDS`)
 * — but a literal, hand-written list of glob keys has the exact same blind spot `_test-projects.ts`
 * already named for the vitest project list: a directory added to `src/` after that object was
 * written gets no glob, no threshold, no protection, and nothing says so.
 *
 * `coverage-directories.test.ts` closes that gap the same way `test-projects.test.ts` does for
 * vitest's projects: it compares this list against the REAL `src/` tree, and against
 * vitest.config.ts's REAL `coverage.thresholds` keys, in both directions — never deriving one
 * from the other. A directory that exists in `src/` but not here fails loudly instead of coasting
 * on whatever glob happens to also match it.
 */

export type CoverageExpectation =
  | { readonly kind: 'covered'; readonly threshold: number }
  | {
      readonly kind: 'excluded';
      /** Why this directory carries no coverage floor at all — read before adding logic here. */
      readonly reason: string;
    };

export interface DeclaredCoverageDirectory {
  /**
   * Path relative to the PROJECT ROOT, forward-slashed (e.g.
   * `'packages/engine/src/adapters/process'`) — root-relative, not `src/`-relative, since V2-T1
   * (D-043) split production code across two package roots (`packages/engine/src/*`,
   * `packages/cli/src`) with no shared `src/` ancestor any more. This is also exactly the string
   * vitest.config.ts's `PRODUCTION_DIRECTORY_THRESHOLDS` keys use (minus the trailing `/**`), so
   * `globFor` below is a plain string concatenation, not a rewrite.
   */
  readonly path: string;
  readonly expectation: CoverageExpectation;
}

/**
 * Every directory that holds at least one production `.ts` file directly under one of the two
 * package src roots, as of V2-T1. `core/` keeps the stricter 95% (docs/TESTES.md); every other
 * covered directory is 80%.
 *
 * `packages/cli/src` is `covered` at 80% since S1-T6 (`cli` in the pre-monorepo layout), not
 * `excluded` — the directory grew past its single wiring file the moment `sessions`/`status`
 * needed a composition root, view-model assembly and text formatting of their own. It is declared
 * as ONE entry covering the whole package (unlike engine's per-layer entries below) because,
 * unlike `packages/engine/src`, it has no further subdirectory of its own — `index.ts` and every
 * other cli file sit directly in `packages/cli/src`. Only `index.ts` itself stays out of
 * `coverage.include` in vitest.config.ts (thin `commander` wiring, exercised for real only by the
 * compiled e2e journey, docs/TESTES.md nº1) — every other file is real branching logic and
 * carries the same floor every other adapter directory does.
 */
export const DECLARED_COVERAGE_DIRECTORIES: readonly DeclaredCoverageDirectory[] = [
  { path: 'packages/engine/src/core', expectation: { kind: 'covered', threshold: 95 } },
  { path: 'packages/engine/src/application', expectation: { kind: 'covered', threshold: 80 } },
  { path: 'packages/engine/src/scheduler', expectation: { kind: 'covered', threshold: 80 } },
  {
    path: 'packages/engine/src/adapters/autostart',
    expectation: { kind: 'covered', threshold: 80 },
  },
  { path: 'packages/engine/src/adapters/clock', expectation: { kind: 'covered', threshold: 80 } },
  {
    path: 'packages/engine/src/adapters/discovery',
    expectation: { kind: 'covered', threshold: 80 },
  },
  {
    path: 'packages/engine/src/adapters/generation',
    expectation: { kind: 'covered', threshold: 80 },
  },
  { path: 'packages/engine/src/adapters/git', expectation: { kind: 'covered', threshold: 80 } },
  {
    // V2-T9 item 1: FsDirectoryExistence, the one adapter behind core/ports.ts#DirectoryExistence.
    path: 'packages/engine/src/adapters/filesystem',
    expectation: { kind: 'covered', threshold: 80 },
  },
  {
    // V2-T13: AppInstallation, one adapter per OS (D-045 item 2).
    path: 'packages/engine/src/adapters/installation',
    expectation: { kind: 'covered', threshold: 80 },
  },
  {
    path: 'packages/engine/src/adapters/notification',
    expectation: { kind: 'covered', threshold: 80 },
  },
  {
    path: 'packages/engine/src/adapters/process',
    expectation: { kind: 'covered', threshold: 80 },
  },
  {
    path: 'packages/engine/src/adapters/resumption',
    expectation: { kind: 'covered', threshold: 80 },
  },
  {
    path: 'packages/engine/src/adapters/storage',
    expectation: { kind: 'covered', threshold: 80 },
  },
  {
    path: 'packages/engine/src/adapters/transcript',
    expectation: { kind: 'covered', threshold: 80 },
  },
  { path: 'packages/cli/src', expectation: { kind: 'covered', threshold: 80 } },
  // V2-T2: same single-flat-entry shape as packages/cli/src above — packages/app/src has no
  // internal layer subdirectory of its own either. packages/app/src/electron/** carries no floor
  // (it never enters coverage.include at all, vitest.config.ts's APP_ELECTRON_SOURCE), the same
  // mechanism packages/cli/src/index.ts already uses — not a second, 'excluded' entry here, since
  // the real leaf-directory scan below never produces that path as its own leaf (it's one flat
  // package root, like cli, not a per-subdirectory scan like engine's adapters/*).
  { path: 'packages/app/src', expectation: { kind: 'covered', threshold: 80 } },
];
