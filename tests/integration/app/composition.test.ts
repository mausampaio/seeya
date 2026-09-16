/**
 * `packages/app/src/composition/index.ts` — the interface's own composition root (D-020, D-043)
 * — exercised for real, same discipline as `tests/integration/cli/composition.test.ts`: a real
 * `StorageAdapter` reading `config.json` from a `tmpdir`, and a real `DiscoverySessionProvider`
 * wired to the real `adapters/process` `ProcessControl`. `buildAppContext` reads `config.json`
 * (for `relevanceHours`), so this can't be a `tests/unit/` test the way it first was written —
 * moved here once that became true.
 */
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import {
  buildAppContext,
  resolveAppHome,
  toEndDayDeps,
} from '../../../packages/app/src/composition/index.js';
import {
  createDiscoveryFixture,
  removeDiscoveryFixture,
  writeSessionRecord,
  type DiscoveryFixture,
} from '../discovery/_fixtures.js';

let fixture: DiscoveryFixture | undefined;

afterEach(async () => {
  if (fixture !== undefined) {
    await removeDiscoveryFixture(fixture);
    fixture = undefined;
  }
});

describe('resolveAppHome', () => {
  it('mirrors packages/cli/src/composition.ts#resolveCliHome: .claude and .seeya under the given home', () => {
    const home = resolveAppHome(path.join('C:', 'Users', 'someone'));

    expect(home.claudeHome).toBe(path.join('C:', 'Users', 'someone', '.claude'));
    expect(home.seeyaHome).toBe(path.join('C:', 'Users', 'someone', '.seeya'));
  });
});

describe('buildAppContext', () => {
  it('reads config.json for relevanceHours and wires a SessionProvider that discovers real fixture sessions', async () => {
    fixture = await createDiscoveryFixture();
    await writeFile(
      path.join(fixture.seeyaHome, 'config.json'),
      JSON.stringify({ schemaVersion: 1, relevanceHours: 6 }),
      'utf8',
    );
    await writeSessionRecord(fixture, 'stale', {
      // A dead PID keeps this test independent of any real running process (same technique
      // tests/integration/cli/composition.test.ts already uses).
      pid: 999_999,
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: fixture.root,
      startedAt: Date.now() - 60_000,
      procStart: 'this-will-never-match-a-real-process',
      name: 'fixture-session',
    });

    const context = await buildAppContext(fixture.root);
    const discovery = await context.sessionProvider.list();

    expect(discovery.sessions).toHaveLength(1);
    expect(discovery.sessions[0]?.sessionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(context.config.relevanceHours).toBe(6);
  });

  it('every other field is built without further I/O', async () => {
    fixture = await createDiscoveryFixture();

    const context = await buildAppContext(fixture.root);

    expect(context.homeDir).toBe(fixture.root);
    expect(context.home.seeyaHome).toBe(fixture.seeyaHome);
    expect(typeof context.clock.now).toBe('function');
    expect(typeof context.defaultShell.command).toBe('string');
  });

  it('tabEnv is buildResumptionEnv(process.env) — D-017 session variables stripped', async () => {
    fixture = await createDiscoveryFixture();
    const originalValue = process.env.CLAUDE_CODE_CHILD_SESSION;
    process.env.CLAUDE_CODE_CHILD_SESSION = 'contaminated';
    try {
      const context = await buildAppContext(fixture.root);
      expect(context.tabEnv.CLAUDE_CODE_CHILD_SESSION).toBeUndefined();
    } finally {
      if (originalValue === undefined) {
        delete process.env.CLAUDE_CODE_CHILD_SESSION;
      } else {
        process.env.CLAUDE_CODE_CHILD_SESSION = originalValue;
      }
    }
  });

  it('buildPtyManager wires the callbacks it is given (no real pty spawned by this alone)', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root);
    const onData = vi.fn();
    const onExit = vi.fn();

    const manager = context.buildPtyManager({ onData, onExit });

    expect(manager.hasTab('anything')).toBe(false);
  });

  it('resolveHarnessCommand resolves against the real PATH (a command every OS in CI actually has)', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root);
    const realCommand = process.platform === 'win32' ? 'cmd.exe' : 'sh';

    const result = await context.resolveHarnessCommand(realCommand, []);

    expect(result.kind).toBe('resolved');
  });

  it(
    'V2-T5a item 5: wires transcriptReader/gitReader/leanGenerator/deepGenerator/forkCleanup/' +
      'notifier — every port endDay needs beyond what this context already had',
    async () => {
      fixture = await createDiscoveryFixture();
      const context = await buildAppContext(fixture.root);

      expect(typeof context.transcriptReader.readFacts).toBe('function');
      expect(typeof context.gitReader.readEvidenceAcrossRepos).toBe('function');
      expect(typeof context.leanGenerator.generate).toBe('function');
      expect(typeof context.deepGenerator.generate).toBe('function');
      expect(typeof context.forkCleanup.cleanup).toBe('function');
      expect(typeof context.notifier.notify).toBe('function');
    },
  );
});

describe('toEndDayDeps', () => {
  it('maps AppContext fields straight through to EndDayDeps, one for one', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root);

    const deps = toEndDayDeps(context);

    expect(deps.sessionProvider).toBe(context.sessionProvider);
    expect(deps.transcriptReader).toBe(context.transcriptReader);
    expect(deps.gitReader).toBe(context.gitReader);
    expect(deps.leanGenerator).toBe(context.leanGenerator);
    expect(deps.deepGenerator).toBe(context.deepGenerator);
    expect(deps.storage).toBe(context.storage);
    expect(deps.processControl).toBe(context.processControl);
    expect(deps.clock).toBe(context.clock);
    expect(deps.forkCleanup).toBe(context.forkCleanup);
  });
});
