/**
 * `realCommandResolutionFs` (`adapters/process/resolve-command.ts`) against a real, throwaway
 * temp directory (docs/TESTES.md § Integração) — the one piece of that module `tests/unit/
 * adapters/process/resolve-command.test.ts` deliberately doesn't cover, since that suite's whole
 * point is exercising the PATH/PATHEXT algorithm against a FAKE filesystem instead.
 *
 * V2-T3: proves the X_OK check this task added actually distinguishes an executable file from one
 * that exists but isn't — the defect this module had before (`access(path)` alone, no permission
 * check, so any file "found" in a PATH entry counted as resolved even without the execute bit).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, chmod, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { realCommandResolutionFs } from '@seeya-ai/engine/adapters/process/resolve-command.js';

let dir: string | undefined;

afterEach(async () => {
  if (dir !== undefined) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

describe('realCommandResolutionFs.isExecutable', () => {
  it('a file that does not exist is never executable', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-resolve-command-'));
    const missing = path.join(dir, 'does-not-exist');

    expect(await realCommandResolutionFs.isExecutable(missing)).toBe(false);
  });

  it('a file with the execute bit set is executable', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-resolve-command-'));
    const file = path.join(dir, 'runnable');
    await writeFile(file, '#!/bin/sh\n');
    await chmod(file, 0o755);

    expect(await realCommandResolutionFs.isExecutable(file)).toBe(true);
  });

  // POSIX only: on Windows, X_OK does not distinguish (this module's own docstring, and Node's) —
  // access(path, X_OK) there behaves like plain existence, which is the pre-existing behavior this
  // task must not disturb (see resolve-command.ts's own comment on realCommandResolutionFs).
  it.skipIf(process.platform === 'win32')(
    'a file that exists but has no execute bit is NOT executable (the defect this task fixes)',
    async () => {
      dir = await mkdtemp(path.join(tmpdir(), 'seeya-resolve-command-'));
      const file = path.join(dir, 'not-runnable');
      await writeFile(file, 'plain data\n');
      await chmod(file, 0o644);

      expect(await realCommandResolutionFs.isExecutable(file)).toBe(false);
    },
  );

  it("on Windows, a plain file (no execute bit in that platform's model) still resolves — X_OK does not distinguish there", async () => {
    if (process.platform !== 'win32') {
      return;
    }
    dir = await mkdtemp(path.join(tmpdir(), 'seeya-resolve-command-'));
    const file = path.join(dir, 'plain.txt');
    await writeFile(file, 'plain data\n');

    expect(await realCommandResolutionFs.isExecutable(file)).toBe(true);
  });
});
