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
import { FakeAppInstallation } from './_fake-app-installation.js';
import { FakeAutostart } from '../../unit/cli/_autostart-fakes.js';

// V2-T46: `buildAppContext` always resolves `daemonOwner` from a real, per-platform
// `AppInstallation.find()` — on Windows a fresh `powershell.exe` registry query, measured at
// ~400ms once "warm" but ~3s on the very first spawn of a test run (this task's own notes have
// the full measurement). Every `buildAppContext` call below passes `{ appInstallation: new
// FakeAppInstallation() }` EXCEPT "daemonOwner is resolved for real" — the one test whose whole
// purpose is proving that real wiring — so the other fourteen never depend on, or pay for,
// whatever this machine's real installation state happens to be.

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

    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
    });
    const discovery = await context.sessionProvider.list();

    expect(discovery.sessions).toHaveLength(1);
    expect(discovery.sessions[0]?.sessionId).toBe('11111111-1111-4111-8111-111111111111');
    // V2-T16: `AppContext` no longer exposes a general-purpose `config` field (item 2) — asserting
    // the SessionProvider's own filtering above already proves relevanceHours: 6 was read; this
    // reads it back through the same `Storage` port every other caller now uses.
    expect((await context.storage.readConfig()).relevanceHours).toBe(6);
  });

  it(
    'V2-T16 item 2: initialTerminalFontOptions is the one config snapshot still on AppContext, ' +
      'resolved once from config.json at startup',
    async () => {
      fixture = await createDiscoveryFixture();
      await writeFile(
        path.join(fixture.seeyaHome, 'config.json'),
        JSON.stringify({
          schemaVersion: 1,
          terminalFontFamily: 'Fixture Mono',
          terminalFontSize: 21,
        }),
        'utf8',
      );

      const context = await buildAppContext(fixture.root, {
        appInstallation: new FakeAppInstallation(),
      });

      expect(context.initialTerminalFontOptions).toEqual({
        fontFamily: 'Fixture Mono',
        fontSize: 21,
      });
    },
  );

  it('every other field is built without further I/O', async () => {
    fixture = await createDiscoveryFixture();

    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
    });

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
      const context = await buildAppContext(fixture.root, {
        appInstallation: new FakeAppInstallation(),
      });
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
    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
    });
    const onData = vi.fn();
    const onExit = vi.fn();

    const manager = context.buildPtyManager({ onData, onExit });

    expect(manager.hasTab('anything')).toBe(false);
  });

  it('resolveHarnessCommand resolves against the real PATH (a command every OS in CI actually has)', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
    });
    const realCommand = process.platform === 'win32' ? 'cmd.exe' : 'sh';

    const result = await context.resolveHarnessCommand(realCommand, []);

    expect(result.kind).toBe('resolved');
  });

  it(
    "V2-T8 item 3: loginShellPathSource is 'not-applicable' on Windows, and either " +
      "'login-shell' or 'inherited' elsewhere (never rejects/throws either way)",
    async () => {
      fixture = await createDiscoveryFixture();
      const context = await buildAppContext(fixture.root, {
        appInstallation: new FakeAppInstallation(),
      });

      if (process.platform === 'win32') {
        expect(context.loginShellPathSource).toBe('not-applicable');
      } else {
        expect(['login-shell', 'inherited']).toContain(context.loginShellPathSource);
      }
      // Whichever source won, tabEnv.PATH is still a usable string — resolveHarnessCommand above
      // already proves this end to end.
      expect(typeof context.tabEnv.PATH).toBe('string');
    },
  );

  it(
    'V2-T5a item 5: wires transcriptReader/gitReader/leanGenerator/deepGenerator/forkCleanup/' +
      'notifier — every port endDay needs beyond what this context already had',
    async () => {
      fixture = await createDiscoveryFixture();
      const context = await buildAppContext(fixture.root, {
        appInstallation: new FakeAppInstallation(),
      });

      expect(typeof context.transcriptReader.readFacts).toBe('function');
      expect(typeof context.gitReader.readEvidenceAcrossRepos).toBe('function');
      expect(typeof context.leanGenerator.generate).toBe('function');
      expect(typeof context.deepGenerator.generate).toBe('function');
      expect(typeof context.forkCleanup.cleanup).toBe('function');
      expect(typeof context.notifier.notify).toBe('function');
    },
  );

  it('V2-T9 item 1/2: wires a real DirectoryExistence — proves against a directory that is really there', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
    });

    expect(await context.directoryExistence.exists(fixture.root)).toBe(true);
    expect(await context.directoryExistence.exists(path.join(fixture.root, 'never-created'))).toBe(
      false,
    );
  });

  // V2-T13, D-045 items 2/4: `daemonOwner` is resolved against the REAL OS installation record —
  // its exact value (`'app'`/`'cli'`/`'unknown'`) depends on whether THIS machine has seeya
  // installed, so this only asserts the shape, never a specific outcome (portable across every
  // machine this suite runs on, including one where the real app happens to be installed).
  it('daemonOwner is resolved for real, one of the three D-024 states', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root);

    expect(['app', 'cli', 'unknown']).toContain(context.daemonOwner.kind);
    if (context.daemonOwner.kind === 'app') {
      expect(typeof context.daemonOwner.launchPath).toBe('string');
    }
  });

  it('checkDaemonOwnershipTransitionOffer resolves to a boolean without throwing', async () => {
    fixture = await createDiscoveryFixture();
    // V2-T46: this is the test that used to pay BOTH real costs at once — `buildAppContext`'s
    // own `AppInstallation.find()` AND this function's own `autostart.status()`, which on
    // Windows spawns `Get-ScheduledTask` (measured ~1.3-4s per call, every call, because the
    // `ScheduledTasks` PowerShell module reloads inside a fresh `powershell.exe` process each
    // time — no warm state to fall back on). `FakeAutostart`'s default `disabled` status is
    // enough: this test only asserts the return type, never a specific `boolean` value.
    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
      autostart: new FakeAutostart(),
    });

    expect(typeof (await context.checkDaemonOwnershipTransitionOffer())).toBe('boolean');
  });

  it(
    'applyDaemonOwnershipTransition("declined") only persists the answer to the FIXTURE\'s own ' +
      '~/.seeya, never the real autostart mechanism',
    async () => {
      fixture = await createDiscoveryFixture();
      const context = await buildAppContext(fixture.root, {
        appInstallation: new FakeAppInstallation(),
      });
      expect(await context.storage.readDaemonOwnershipTransitionAnswer()).toBeNull();

      await context.applyDaemonOwnershipTransition('declined');

      expect(await context.storage.readDaemonOwnershipTransitionAnswer()).toBe('declined');
    },
  );

  it('enableAppAutostart is wired as a callable function (never invoked by this suite — see AGENTS.md)', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
    });

    expect(typeof context.enableAppAutostart).toBe('function');
  });
});

describe('toEndDayDeps', () => {
  it('maps AppContext fields straight through to EndDayDeps, one for one', async () => {
    fixture = await createDiscoveryFixture();
    const context = await buildAppContext(fixture.root, {
      appInstallation: new FakeAppInstallation(),
    });

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
