/**
 * `ClaudeSessionAdoptionLauncher` (V2-T29, `adapters/harness/session-adoption.ts`) against a real
 * spawned process — same fake `claude` binary/fixture `harness-launcher.test.ts` already proves
 * `ClaudeHarnessLauncher` against; this adapter reuses the identical
 * `spawn-interactive.ts#runInteractive` call, so the fixture works unmodified here too.
 *
 * **Never spawns the literal string `'claude'`** — AGENTS.md/`docs/PLANO-DE-ENTREGA.md`: no test
 * opens the real harness against a real session; every call here targets the fixture's own
 * `binaryPath`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ClaudeSessionAdoptionLauncher } from '@seeya-ai/engine/adapters/harness/session-adoption.js';
import { ADOPTION_INSTRUCTION } from '@seeya-ai/engine/adapters/harness/adopt-instruction.js';
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

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_SESSION_ID = '11111111-1111-4111-8111-111111111111';
const FORK_SESSION_ID = '22222222-2222-4222-8222-222222222222';

describe('ClaudeSessionAdoptionLauncher — V2-T29', () => {
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

  it('adopts with the exact argv: --resume, --fork-session, --session-id, --add-dir, --, the instruction', async () => {
    process.env['FAKE_CLAUDE_EXIT_CODE'] = '0';
    const launcher = new ClaudeSessionAdoptionLauncher({ claudeBinary: fixture.binaryPath });
    const projectDir = path.join(ORIGINAL_CWD, 'auth-hardening');

    const result = await launcher.adopt(
      ORIGINAL_CWD,
      [projectDir],
      ORIGINAL_SESSION_ID,
      FORK_SESSION_ID,
    );

    expect(result).toStrictEqual({ kind: 'opened', exitCode: 0 });
    const calls = await readCapturedInteractiveClaudeCalls(fixture);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv).toStrictEqual([
      '--resume',
      ORIGINAL_SESSION_ID,
      '--fork-session',
      '--session-id',
      FORK_SESSION_ID,
      '--add-dir',
      projectDir,
      '--',
      ADOPTION_INSTRUCTION,
    ]);
  });

  it('reports the real exit code the fork closed with, even non-zero — never a "failure"', async () => {
    process.env['FAKE_CLAUDE_EXIT_CODE'] = '7';
    const launcher = new ClaudeSessionAdoptionLauncher({ claudeBinary: fixture.binaryPath });

    const result = await launcher.adopt(ORIGINAL_CWD, [], ORIGINAL_SESSION_ID, FORK_SESSION_ID);

    expect(result).toStrictEqual({ kind: 'opened', exitCode: 7 });
  });

  it('D-017: the environment handed to the child has the inherited session variables removed', async () => {
    process.env['FAKE_CLAUDE_EXIT_CODE'] = '0';
    process.env['CLAUDE_CODE_CHILD_SESSION'] = 'contaminated-value';
    const launcher = new ClaudeSessionAdoptionLauncher({ claudeBinary: fixture.binaryPath });

    await launcher.adopt(ORIGINAL_CWD, [], ORIGINAL_SESSION_ID, FORK_SESSION_ID);

    const calls = await readCapturedInteractiveClaudeCalls(fixture);
    expect(calls[0]?.env['CLAUDE_CODE_CHILD_SESSION']).toBeUndefined();
  });

  it('failedToStart when the binary itself cannot be found — never mistaken for a real session', async () => {
    const missingDir = await mkdtemp(path.join(tmpdir(), 'seeya-adoption-missing-binary-'));
    try {
      const launcher = new ClaudeSessionAdoptionLauncher({
        claudeBinary: path.join(missingDir, 'no-such-claude-binary'),
      });

      const result = await launcher.adopt(ORIGINAL_CWD, [], ORIGINAL_SESSION_ID, FORK_SESSION_ID);

      expect(result).toStrictEqual({ kind: 'failedToStart' });
    } finally {
      await rm(missingDir, { recursive: true, force: true });
    }
  });
});
