/**
 * `packages/cli/src/composition.ts` — the project's only composition root (D-020) — exercised for real:
 * a real `StorageAdapter` reading `config.json` from a `tmpdir`, and a real `DiscoverySessionProvider`
 * wired to the real `adapters/process` `ProcessControl` (not `FakeProcessControl`). Unlike
 * `sessions-command.test.ts`/`status-command.test.ts`, which build their own fakes to isolate the
 * command logic, this file's whole point is proving the wiring itself — that `buildCliContext`
 * really does hand back ports that work against the real OS and real disk, the same shape of proof
 * `tests/integration/process/liveness.test.ts` gives `adapters/process` on its own.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildCliContext,
  buildConfigContext,
  buildEndDayContext,
  buildProjectContext,
  buildProjectOpenDeps,
  buildSnoozeContext,
  buildStartDayContext,
  resolveCliHome,
} from '../../../packages/cli/src/composition.js';
import { captureObservedProcStart } from '@seeya-ai/engine/adapters/process/proc-start.js';
import { processExists } from '@seeya-ai/engine/adapters/process/existence.js';
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

describe('resolveCliHome', () => {
  it('joins the injected home directory into .claude/.seeya, never calling os.homedir() itself', () => {
    const home = resolveCliHome(path.join('c:', 'fake', 'home'));

    expect(home.claudeHome).toBe(path.join('c:', 'fake', 'home', '.claude'));
    expect(home.seeyaHome).toBe(path.join('c:', 'fake', 'home', '.seeya'));
  });
});

describe('buildCliContext', () => {
  it('reads config.json for relevanceHours and wires a SessionProvider that discovers real fixture sessions', async () => {
    fixture = await createDiscoveryFixture();
    await writeFile(
      path.join(fixture.seeyaHome, 'config.json'),
      JSON.stringify({ schemaVersion: 1, relevanceHours: 6 }),
      'utf8',
    );
    // A dead PID keeps this test independent of any real running process — discovery still has
    // to find and report the entry (as "ended"), which is all this test needs to prove wiring.
    await writeSessionRecord(fixture, 'stale', {
      pid: 999_999,
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: 'c:\\code\\projeto',
      startedAt: Date.now() - 60_000,
      procStart: 'this-will-never-match-a-real-process',
      name: 'projeto',
    });

    const context = await buildCliContext(fixture.root);

    expect(context.config.relevanceHours).toBe(6);
    const result = await context.sessionProvider.list();
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({ sessionId: '11111111-1111-4111-8111-111111111111' });
  });

  it('falls back to Config defaults when config.json does not exist yet (D-025)', async () => {
    fixture = await createDiscoveryFixture();

    const context = await buildCliContext(fixture.root);

    expect(context.config.relevanceHours).toBe(12);
    expect(context.config.idleMinutes).toBe(45);
  });

  /**
   * The one test in this file that proves the REAL `ProcessControl` (not a fake) is what
   * `buildCliContext` wires in: this test process's own PID is genuinely alive right now, and its
   * real `procStart` really round-trips through the OS-querying adapter — the same proof
   * `tests/integration/process/liveness.test.ts` gives `adapters/process` alone, done here through
   * the composition root instead.
   */
  it('the real ProcessControl reports this test process itself as alive', async () => {
    fixture = await createDiscoveryFixture();
    const pid = process.pid;
    const capture = await captureObservedProcStart(pid, processExists);
    if (capture.kind !== 'value') {
      throw new Error(
        `expected a real procStart capture for pid ${pid}, got ${JSON.stringify(capture)}`,
      );
    }
    await writeSessionRecord(fixture, 'self', {
      pid,
      sessionId: '22222222-2222-4222-8222-222222222222',
      cwd: 'c:\\code\\self',
      startedAt: Date.now() - 60_000,
      procStart: capture.value,
      name: 'self',
    });

    const context = await buildCliContext(fixture.root);
    const result = await context.sessionProvider.list();

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({ hasPid: true, processIsAlive: true });
  });
});

/**
 * `buildEndDayContext` (S2-T5): the composition step for `seeya end-day`, switching on the two
 * pieces that were "pronto e desligado" until this task — S2-T2's generators and S2-T6's
 * `ForkCleanup` — alongside the git/transcript readers S2-T5 itself is the first caller of. Doesn't
 * spawn a real (or fake) `claude`: that full round trip is covered end-to-end by
 * `tests/e2e/end-day.test.ts`; this integration test's own job is proving the WIRING — every port
 * really is the real adapter, reading the real `config.json`, not a stub silently standing in.
 */
describe('buildEndDayContext', () => {
  it('reads config.json for captureModel/budgetPerSessionUsd/forkCleanupDays and wires every port', async () => {
    fixture = await createDiscoveryFixture();
    await writeFile(
      path.join(fixture.seeyaHome, 'config.json'),
      JSON.stringify({
        schemaVersion: 1,
        captureModel: 'opus',
        budgetPerSessionUsd: 0.5,
        forkCleanupDays: 3,
      }),
      'utf8',
    );

    const { deps, config } = await buildEndDayContext(fixture.root);

    expect(config.captureModel).toBe('opus');
    expect(config.budgetPerSessionUsd).toBe(0.5);
    expect(config.forkCleanupDays).toBe(3);
    // Every EndDayDeps field is the real adapter, not left undefined by an incomplete wire-up.
    expect(deps.sessionProvider).toBeDefined();
    expect(deps.transcriptReader).toBeDefined();
    expect(deps.gitReader).toBeDefined();
    expect(deps.leanGenerator).toBeDefined();
    expect(deps.deepGenerator).toBeDefined();
    expect(deps.storage).toBeDefined();
    expect(deps.processControl).toBeDefined();
    expect(deps.forkCleanup).toBeDefined();
  });

  // S4-T1: `notifier` is on `EndDayContext` itself, not `EndDayDeps` — see that field's own
  // docstring for why (`application/end-day.ts` never calls it; `end-day-command.ts` does, after).
  it('wires a real Notifier alongside deps', async () => {
    fixture = await createDiscoveryFixture();

    const { notifier } = await buildEndDayContext(fixture.root);

    expect(notifier).toBeDefined();
    expect(typeof notifier.notify).toBe('function');
  });

  it('the real SessionProvider it wires discovers a fixture session, same as buildCliContext', async () => {
    fixture = await createDiscoveryFixture();
    await writeSessionRecord(fixture, 'stale', {
      pid: 999_999,
      sessionId: '11111111-1111-4111-8111-111111111111',
      cwd: 'c:\\code\\projeto',
      startedAt: Date.now() - 60_000,
      procStart: 'this-will-never-match-a-real-process',
      name: 'projeto',
    });

    const { deps } = await buildEndDayContext(fixture.root);
    const result = await deps.sessionProvider.list();

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({ sessionId: '11111111-1111-4111-8111-111111111111' });
  });

  it('the real ForkCleanup it wires reads an empty forks.json without error', async () => {
    fixture = await createDiscoveryFixture();

    const { deps, config } = await buildEndDayContext(fixture.root);
    const result = await deps.forkCleanup.cleanup(config.forkCleanupDays);

    expect(result).toEqual({ outcomes: [], rejected: [] });
  });
});

/**
 * `buildStartDayContext` (S3-T3): proves the wiring, not the command — `Storage` and
 * `SessionResumer` really are the real adapters, reading/writing under the injected root, and
 * `SessionProvider`/git/generation are correctly absent (`seeya start-day` never re-discovers
 * sessions, D-004). No `claude` is spawned here: that full round trip is
 * `tests/e2e/start-day.test.ts`'s job.
 */
describe('buildStartDayContext', () => {
  it('wires a Storage that reads/writes under the injected root, and a SessionResumer', async () => {
    fixture = await createDiscoveryFixture();

    const context = await buildStartDayContext(fixture.root);
    expect(context.sessionResumer).toBeDefined();
    expect(context.clock).toBeDefined();

    // Real StorageAdapter, not a stub: a write really lands under fixture.root and reads back.
    await context.storage.saveResumedSessionIds('2026-08-16', new Set(['session-1']));
    const reread = await context.storage.readResumedSessionIds('2026-08-16');
    expect([...reread]).toEqual(['session-1']);
  });

  it('D-035: reads config.json, so maxBriefingScanDays reflects a real config.json edit', async () => {
    fixture = await createDiscoveryFixture();
    await writeFile(
      path.join(fixture.seeyaHome, 'config.json'),
      JSON.stringify({ schemaVersion: 1, maxBriefingScanDays: 90 }),
      'utf8',
    );

    const context = await buildStartDayContext(fixture.root);
    expect(context.config.maxBriefingScanDays).toBe(90);
  });
});

/**
 * `buildSnoozeContext` (S4-T4): `seeya snooze`/`seeya skip-today`'s own composition — just
 * `Storage` and `Clock`, plus `config` read once up front for rendering. Proves the wiring, not
 * the command logic (`tests/unit/cli/snooze-command.test.ts` and
 * `tests/integration/cli/snooze-command.test.ts` already cover that).
 */
describe('buildSnoozeContext', () => {
  it('reads config.json and wires a real Storage/Clock', async () => {
    fixture = await createDiscoveryFixture();
    await writeFile(
      path.join(fixture.seeyaHome, 'config.json'),
      JSON.stringify({ schemaVersion: 1, endOfDayTime: '19:30' }),
      'utf8',
    );

    const context = await buildSnoozeContext(fixture.root);
    expect(context.config.endOfDayTime).toBe('19:30');
    expect(context.clock).toBeDefined();

    // Real StorageAdapter: a write really lands under fixture.root.
    await context.storage.saveState({
      day: '2026-08-16',
      skipped: true,
      snoozeMinutesTotal: 0,
      firedLeadTimesInMinutes: [],
      firedLeadTimesEffectiveEndOfDay: null,
      lastLeadTimeWarningNoticeAt: null,
      endOfDayFired: false,
      captureAttemptsToday: {},
      daemonHealth: { lastCycleError: null, consecutiveCycleFailures: 0 },
    });
    expect((await context.storage.readState())?.skipped).toBe(true);
  });
});

/**
 * `buildConfigContext` (S4-T4): `seeya config`'s own composition — just `Storage`, since every
 * sub-action reads `config.json` fresh itself rather than trusting a value read at composition
 * time (this function's own docstring).
 */
describe('buildConfigContext', () => {
  it('wires a real Storage that reads/writes config.json under the injected root', async () => {
    fixture = await createDiscoveryFixture();
    const context = buildConfigContext(fixture.root);

    expect((await context.storage.readConfig()).relevanceHours).toBe(12);
    await context.storage.saveConfig({
      ...(await context.storage.readConfig()),
      relevanceHours: 6,
    });
    expect((await context.storage.readConfig()).relevanceHours).toBe(6);
  });
});

/**
 * `buildProjectContext` (V2-T27/V2-T28/V2-T33): proves the V2-T33 wiring specifically —
 * `FsProjectLock` round-trips through the real filesystem, and `sessionId` really is
 * `process.env.CLAUDE_CODE_SESSION_ID`, read only here (`readCurrentSessionId`'s own docstring).
 * Everything else this function wires (`FsWorkspaceRepository`/`GitAdapter`/etc.) already has its
 * own dedicated integration coverage (`tests/integration/workspace/fs-workspace-repository.test.ts`
 * and friends) — this is only about the composition itself.
 */
describe('buildProjectContext', () => {
  const ENV_VAR = 'CLAUDE_CODE_SESSION_ID';
  const originalEnvValue = process.env[ENV_VAR];

  afterEach(() => {
    if (originalEnvValue === undefined) {
      delete process.env[ENV_VAR];
    } else {
      process.env[ENV_VAR] = originalEnvValue;
    }
  });

  it('sessionId is undefined outside a Claude Code session (D-025) and the real value when one is set', async () => {
    fixture = await createDiscoveryFixture();
    delete process.env[ENV_VAR];
    expect(buildProjectContext(fixture.root).sessionId).toBeUndefined();

    process.env[ENV_VAR] = 'real-session-id';
    expect(buildProjectContext(fixture.root).sessionId).toBe('real-session-id');
  });

  it('projectLock is a real FsProjectLock — a write really lands on disk and reads back', async () => {
    fixture = await createDiscoveryFixture();
    const context = buildProjectContext(fixture.root);
    const workspaceRoot = path.join(fixture.seeyaHome, 'workspace');
    // The project directory doesn't exist yet on a fresh fixture — `writeProjectSkeleton` would
    // normally create it before any lock is ever taken for a real project; this test only cares
    // about the lock file itself, so it creates the bare directory directly.
    await mkdir(path.join(workspaceRoot, 'auth-hardening'), { recursive: true });
    const lockInfo = {
      sessionId: undefined,
      pid: process.pid,
      procStart: undefined,
      acquiredAt: new Date('2026-09-22T10:00:00.000Z'),
    };
    await context.projectLock.write(workspaceRoot, 'auth-hardening', lockInfo);
    expect(await context.projectLock.read(workspaceRoot, 'auth-hardening')).toEqual(lockInfo);
  });
});

/**
 * `buildProjectOpenDeps` (V2-T33): the ONE composition function that pays for a real `procStart`
 * capture (S4-T3b's own `powershell.exe` cost on Windows) — proven here, not in
 * `tests/unit/cli/project-command.test.ts`, which deliberately never touches this function at all
 * (that file's own `buildOpenDeps` docstring).
 */
describe('buildProjectOpenDeps', () => {
  it("captures this process's own real pid/procStart, spreading the rest of the context through unchanged", async () => {
    fixture = await createDiscoveryFixture();
    const context = buildProjectContext(fixture.root);

    const deps = await buildProjectOpenDeps(context);

    expect(deps.pid).toBe(process.pid);
    expect(deps.seeyaHome).toBe(context.seeyaHome);
    expect(deps.workspace).toBe(context.workspace);
    // `procStart` capture is best-effort (D-025): either a real captured value, or `undefined` if
    // this platform's capture strategy genuinely failed — never anything else.
    expect(deps.procStart === undefined || typeof deps.procStart === 'string').toBe(true);
  });

  it('V2-T35 item 4: generates a real, valid UUID for launchedSessionId — a different one per call', async () => {
    fixture = await createDiscoveryFixture();
    const context = buildProjectContext(fixture.root);

    const first = await buildProjectOpenDeps(context);
    const second = await buildProjectOpenDeps(context);

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(first.launchedSessionId).toMatch(uuidPattern);
    expect(second.launchedSessionId).toMatch(uuidPattern);
    expect(first.launchedSessionId).not.toBe(second.launchedSessionId);
  });
});
