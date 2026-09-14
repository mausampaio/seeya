import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  APP_SRC_ROOT,
  PROJECT_ROOT,
  TEST_TIMEOUT_MS,
  deleteTempFile,
  guardSubdirectory,
  writeTempFile,
  cleanUpGuardResidue,
  runEslint,
} from './_support.js';

const GUARD_NAME = 'app-eslint';

/**
 * Shortcut for a fixture path in this file, isolated in packages/app/src/<subdir>/_guard-app-eslint/.
 * NOT built with `guardFixturePath`/`srcRootForLayer` (those two only know the engine's per-layer
 * scan and the two flat package roots, `cli`/`app` themselves — neither models a subdirectory
 * INSIDE the app package the way this file needs, e.g. `electron/`, `pty/`, `tabs/`): built
 * directly against `APP_SRC_ROOT` instead.
 */
function fixture(subdir: string, fileName: string): string {
  return path.join(APP_SRC_ROOT, subdir, guardSubdirectory(GUARD_NAME), fileName);
}

/**
 * V2-T2 (docs/PLANO-DE-ENTREGA.md, item 5): proves eslint.config.js's two app-specific
 * inversion-of-onus rules really reject — `electron` importable only from
 * packages/app/src/electron/**, `node-pty` only from packages/app/src/pty/** — same D-038-style
 * "the exception is declared at the call site, not forgotten in silence" this project already
 * uses for `spawn` (see eslint-restrictions.test.ts's own second describe block). Each test writes
 * a fixture in the real tree, runs the real eslint, and deletes it in `afterEach`.
 */
describe('guard: eslint restricts electron/node-pty to their own directories inside packages/app/src', () => {
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
    'rejects electron imported outside packages/app/src/electron/**, with a message pointing at electron/',
    () => {
      const filePath = writeTempFile(
        fixture('tabs', 'violation-test-electron.ts'),
        "import { BrowserWindow } from 'electron';\nexport const w = BrowserWindow;\n",
      );
      created.push(filePath);

      const result = runEslint([filePath]);

      expect(result.exitCode, result.output).not.toBe(0);
      expect(result.output).toContain('no-restricted-imports');
      expect(result.output).toContain('packages/app/src/electron/**');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects node-pty imported outside packages/app/src/pty/**, with a message pointing at pty/',
    () => {
      const filePath = writeTempFile(
        fixture('tabs', 'violation-test-node-pty.ts'),
        "import * as pty from 'node-pty';\nexport const spawnFn = pty.spawn;\n",
      );
      created.push(filePath);

      const result = runEslint([filePath]);

      expect(result.exitCode, result.output).not.toBe(0);
      expect(result.output).toContain('no-restricted-imports');
      expect(result.output).toContain('packages/app/src/pty/**');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects node-pty imported inside packages/app/src/electron/** too (electron/ is exempt from the electron ban, not the node-pty one)',
    () => {
      const filePath = writeTempFile(
        fixture('electron', 'violation-test-node-pty-from-electron.ts'),
        "import * as pty from 'node-pty';\nexport const spawnFn = pty.spawn;\n",
      );
      created.push(filePath);

      const result = runEslint([filePath]);

      expect(result.exitCode, result.output).not.toBe(0);
      expect(result.output).toContain('no-restricted-imports');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects electron imported inside packages/app/src/pty/** too (pty/ is exempt from the node-pty ban, not the electron one)',
    () => {
      const filePath = writeTempFile(
        fixture('pty', 'violation-test-electron-from-pty.ts'),
        "import { app } from 'electron';\nexport const application = app;\n",
      );
      created.push(filePath);

      const result = runEslint([filePath]);

      expect(result.exitCode, result.output).not.toBe(0);
      expect(result.output).toContain('no-restricted-imports');
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'approves node-pty imported inside packages/app/src/pty/** (control for the exemption)',
    () => {
      const filePath = writeTempFile(
        fixture('pty', 'control-test-node-pty.ts'),
        "import * as pty from 'node-pty';\nexport const spawnFn = pty.spawn;\n",
      );
      created.push(filePath);

      const result = runEslint([filePath]);

      expect(result.exitCode, result.output).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'approves the real packages/app/src/pty adapter importing node-pty (control against the real file, once it exists)',
    () => {
      const result = runEslint([
        path.join(PROJECT_ROOT, 'packages/app/src/pty/node-pty-adapter.ts'),
      ]);

      expect(result.exitCode, result.output).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'approves the real packages/app/src/electron files importing electron (control against the real files)',
    () => {
      const result = runEslint(
        ['packages/app/src/electron/main.ts', 'packages/app/src/electron/preload.ts'].map(
          (relativePath) => path.join(PROJECT_ROOT, relativePath),
        ),
      );

      expect(result.exitCode, result.output).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
