import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  TEST_TIMEOUT_MS,
  deleteTempFile,
  guardFixturePath,
  writeTempFile,
  cleanUpGuardResidue,
  runDependencyCruiser,
  violationsOfFixture,
} from './_support.js';

const GUARD_NAME = 'app-boundaries';

/** Shortcut for a fixture path in this file, always isolated in its package's own
 * <layer>/_guard-app-boundaries/ (see `guardFixturePath`/`srcRootForLayer` in `_support.ts`). */
function fixture(layerDir: string, fileName: string): string {
  return guardFixturePath(GUARD_NAME, layerDir, fileName);
}

/**
 * V2-T2 (D-042/D-043): `packages/app/src` is the second composition root, a sibling of `cli/`,
 * not a sixth layer of the docs/ARQUITETURA.md matrix (layer-matrix.test.ts stays unchanged and
 * exhaustive over the engine's 5 original layers + `cli`). This file proves the four rules
 * `.dependency-cruiser.cjs` adds for it, the same "write a real violation/control fixture, run the
 * real tool, delete it in afterEach" discipline as dependency-cruiser.test.ts — see that file's
 * own module docstring for why each test scopes `runDependencyCruiser` to just its own fixture
 * rather than the whole tree.
 *
 * `runDependencyCruiserOnFullTree`'s own "approves the real tree, no violation" control (in
 * dependency-cruiser.test.ts) already covers the real packages/app/src once it exists — nothing
 * new needed here for that.
 */
describe('guard: packages/app/src (V2-T2, D-043 second composition root) has complete boundary coverage', () => {
  const created: string[] = [];

  afterEach(() => {
    for (const createdPath of created.splice(0)) {
      deleteTempFile(createdPath);
    }
  });

  afterAll(() => {
    cleanUpGuardResidue(GUARD_NAME);
  });

  it(
    'rejects app/ reaching into packages/engine/src by a raw relative path (app-only-imports-engine-public-subpaths)',
    () => {
      const filePath = fixture('app', 'violation-test-engine-relative.ts');
      // packages/app/src/_guard-app-boundaries/ -> packages/engine/src/core/index.ts: 3 ups reach
      // packages/, then engine/src/core/index.js.
      created.push(
        writeTempFile(filePath, "import '../../../engine/src/core/index.js';\nexport {};\n"),
      );

      const result = runDependencyCruiser([filePath]);
      expect(result.jsonValid, result.raw).toBe(true);
      const rules = violationsOfFixture(result.violations, filePath).map((v) => v.rule);

      expect(rules, result.raw).toContain('app-only-imports-engine-public-subpaths');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'approves app/ importing engine through the package export map (control, same technique as cli/)',
    () => {
      const filePath = fixture('app', 'control-test-engine-subpath.ts');
      created.push(
        writeTempFile(filePath, "import '@seeya-ai/engine/core/index.js';\nexport {};\n"),
      );

      const result = runDependencyCruiser([filePath]);
      expect(result.jsonValid, result.raw).toBe(true);
      const violations = violationsOfFixture(result.violations, filePath);

      expect(violations, result.raw).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects the engine importing app/ (engine-does-not-import-app)',
    () => {
      const filePath = fixture('core', 'violation-test-app.ts');
      // packages/engine/src/core/_guard-app-boundaries/ -> packages/app/src/tabs/tab-model.ts: 4
      // ups reach packages/, then app/src/tabs/tab-model.js — a REAL file (unlike the
      // cli-does-not-import-app pair below, which resolves into cli/src/index.ts, also real):
      // dependency-cruiser's own path-based rule matching only fires on a specifier it can
      // actually RESOLVE, so a nonexistent target silently produces no violation at all instead of
      // one for this rule (measured while writing this test).
      created.push(
        writeTempFile(filePath, "import '../../../../app/src/tabs/tab-model.js';\nexport {};\n"),
      );

      const result = runDependencyCruiser([filePath]);
      expect(result.jsonValid, result.raw).toBe(true);
      const rules = violationsOfFixture(result.violations, filePath).map((v) => v.rule);

      expect(rules, result.raw).toContain('engine-does-not-import-app');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects app/ importing cli/ (app-does-not-import-cli)',
    () => {
      const filePath = fixture('app', 'violation-test-cli.ts');
      created.push(writeTempFile(filePath, "import '../../../cli/src/index.js';\nexport {};\n"));

      const result = runDependencyCruiser([filePath]);
      expect(result.jsonValid, result.raw).toBe(true);
      const rules = violationsOfFixture(result.violations, filePath).map((v) => v.rule);

      expect(rules, result.raw).toContain('app-does-not-import-cli');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects cli/ importing app/ (cli-does-not-import-app)',
    () => {
      const filePath = fixture('cli', 'violation-test-app.ts');
      // A real file, same reason as engine-does-not-import-app's own comment above.
      created.push(
        writeTempFile(filePath, "import '../../../app/src/tabs/tab-model.js';\nexport {};\n"),
      );

      const result = runDependencyCruiser([filePath]);
      expect(result.jsonValid, result.raw).toBe(true);
      const rules = violationsOfFixture(result.violations, filePath).map((v) => v.rule);

      expect(rules, result.raw).toContain('cli-does-not-import-app');
    },
    TEST_TIMEOUT_MS,
  );
});
