/**
 * `ClaudeHarnessLauncher` (V2-T28, `adapters/harness/index.ts`) against a real spawned process —
 * reuses `tests/integration/resumption/_fixtures.ts`'s fake `claude` binary (the same
 * `stdio: 'inherit'` contract `adapters/resumption` already proves against it; this adapter reuses
 * `spawn-interactive.ts#runInteractive` directly rather than reimplementing the spawn, so the
 * fixture's own script — which never assumes `--resume` is present — works unmodified here too).
 *
 * **Never spawns the literal string `'claude'`** — AGENTS.md/`docs/PLANO-DE-ENTREGA.md`: no test
 * opens the real harness against a real session; every call here targets the fixture's own
 * `binaryPath`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClaudeHarnessLauncher } from '@seeya-ai/engine/adapters/harness/index.js';
import {
  createFakeInteractiveClaudeFixture,
  readCapturedInteractiveClaudeCalls,
  removeFakeInteractiveClaudeFixture,
  type FakeInteractiveClaudeFixture,
} from '../resumption/_fixtures.js';

const ENV_VARS_UNDER_TEST = [
  'FAKE_CLAUDE_CAPTURE_FILE',
  'FAKE_CLAUDE_EXIT_CODE',
  'CLAUDE_CODE_CHILD_SESSION',
] as const;

const PROJECT_CWD = process.cwd();

describe('ClaudeHarnessLauncher — V2-T28', () => {
  let fixture: FakeInteractiveClaudeFixture;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    fixture = await createFakeInteractiveClaudeFixture();
    savedEnv = Object.fromEntries(ENV_VARS_UNDER_TEST.map((name) => [name, process.env[name]]));
    process.env['FAKE_CLAUDE_CAPTURE_FILE'] = fixture.captureFile;
  });

  afterEach(async () => {
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await removeFakeInteractiveClaudeFixture(fixture);
  });

  it('opens with no --add-dir at all when there are no associated repositories', async () => {
    process.env['FAKE_CLAUDE_EXIT_CODE'] = '0';
    const launcher = new ClaudeHarnessLauncher({ claudeBinary: fixture.binaryPath });

    const result = await launcher.open(PROJECT_CWD, []);

    expect(result).toStrictEqual({ kind: 'opened', exitCode: 0 });
    const calls = await readCapturedInteractiveClaudeCalls(fixture);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv).toStrictEqual([]);
  });

  it('opens with --add-dir <dirs...> -- when repositories are associated — the exact argv, terminator included', async () => {
    process.env['FAKE_CLAUDE_EXIT_CODE'] = '0';
    const launcher = new ClaudeHarnessLauncher({ claudeBinary: fixture.binaryPath });
    const addDirs = [path.join(PROJECT_CWD, 'app-api'), path.join(PROJECT_CWD, 'app-web')];

    const result = await launcher.open(PROJECT_CWD, addDirs);

    expect(result).toStrictEqual({ kind: 'opened', exitCode: 0 });
    const calls = await readCapturedInteractiveClaudeCalls(fixture);
    expect(calls[0]?.argv).toStrictEqual(['--add-dir', addDirs[0], addDirs[1], '--']);
  });

  it('reports the real exit code the harness closed with, even non-zero — never a "failure"', async () => {
    process.env['FAKE_CLAUDE_EXIT_CODE'] = '7';
    const launcher = new ClaudeHarnessLauncher({ claudeBinary: fixture.binaryPath });

    const result = await launcher.open(PROJECT_CWD, []);

    expect(result).toStrictEqual({ kind: 'opened', exitCode: 7 });
  });

  it('D-017: the environment handed to the child has the inherited session variables removed', async () => {
    process.env['FAKE_CLAUDE_EXIT_CODE'] = '0';
    process.env['CLAUDE_CODE_CHILD_SESSION'] = 'contaminated-value';
    const launcher = new ClaudeHarnessLauncher({ claudeBinary: fixture.binaryPath });

    await launcher.open(PROJECT_CWD, []);

    const calls = await readCapturedInteractiveClaudeCalls(fixture);
    expect(calls[0]?.env['CLAUDE_CODE_CHILD_SESSION']).toBeUndefined();
  });

  it('failedToStart when the binary itself cannot be found — never mistaken for a real session', async () => {
    const missingDir = await mkdtemp(path.join(tmpdir(), 'seeya-harness-missing-binary-'));
    try {
      const launcher = new ClaudeHarnessLauncher({
        claudeBinary: path.join(missingDir, 'no-such-claude-binary'),
      });

      const result = await launcher.open(PROJECT_CWD, []);

      expect(result).toStrictEqual({ kind: 'failedToStart' });
    } finally {
      await rm(missingDir, { recursive: true, force: true });
    }
  });
});
