/**
 * `application/project-lock.ts` (V2-T33, D-047 item 1) — `checkProjectLock`/`acquireProjectLock`/
 * `releaseProjectLock`/`describeProjectLockStatus`, against `FakeProjectLock` and
 * `ControllableProcessControl`. The real recycled-pid tie-break (`ProcessControl.isAlive`'s own
 * job) is proven separately, against a real process, by
 * `tests/integration/application/project-lock.test.ts` — same split
 * `tests/unit/scheduler/lock.test.ts`/`tests/integration/scheduler/lock.test.ts` already
 * established for the daemon's own lock.
 */
import { describe, expect, it } from 'vitest';
import {
  acquireProjectLock,
  checkProjectLock,
  describeProjectLockStatus,
  releaseProjectLock,
  type ProjectLockDeps,
} from '@seeya-ai/engine/application/project-lock.js';
import { ControllableProcessControl, FakeProjectLock } from './_fakes.js';

const ROOT = 'C:\\workspace';
const PROJECT_ID = 'auth-hardening';
const NOW = new Date('2026-09-22T10:00:00.000Z');

function buildDeps(
  projectLock: FakeProjectLock,
  processControl: ControllableProcessControl,
): ProjectLockDeps {
  return { projectLock, processControl };
}

describe('checkProjectLock', () => {
  it('acquire when nothing was ever taken', async () => {
    const deps = buildDeps(new FakeProjectLock(), new ControllableProcessControl());
    expect(await checkProjectLock(deps, ROOT, PROJECT_ID)).toEqual({ kind: 'acquire' });
  });

  it('never writes anything — a second read sees the exact same nothing', async () => {
    const projectLock = new FakeProjectLock();
    const deps = buildDeps(projectLock, new ControllableProcessControl());
    await checkProjectLock(deps, ROOT, PROJECT_ID);
    expect(await projectLock.read(ROOT, PROJECT_ID)).toBeNull();
  });

  it('refuses when the recorded pid answers alive, passing pid+procStart through to ProcessControl', async () => {
    const projectLock = new FakeProjectLock();
    await projectLock.write(ROOT, PROJECT_ID, {
      sessionId: 'session-abc',
      pid: 4242,
      procStart: 'p-1',
      acquiredAt: NOW,
    });
    const processControl = new ControllableProcessControl(new Map([[4242, true]]));
    const deps = buildDeps(projectLock, processControl);
    const decision = await checkProjectLock(deps, ROOT, PROJECT_ID);
    expect(decision.kind).toBe('refuse');
    expect(processControl.isAliveCalls).toEqual([{ pid: 4242, procStart: 'p-1' }]);
  });
});

describe('acquireProjectLock', () => {
  it('writes the caller-supplied holder, reclaimedStale null for a genuinely free lock', async () => {
    const projectLock = new FakeProjectLock();
    const deps = buildDeps(projectLock, new ControllableProcessControl());
    const outcome = await acquireProjectLock(
      deps,
      ROOT,
      PROJECT_ID,
      { pid: 111, procStart: 'p-x', sessionId: 'session-new' },
      NOW,
    );
    expect(outcome).toEqual({ decision: { kind: 'acquire' }, reclaimedStale: null });
    expect(await projectLock.read(ROOT, PROJECT_ID)).toEqual({
      sessionId: 'session-new',
      pid: 111,
      procStart: 'p-x',
      acquiredAt: NOW,
    });
  });

  it('reclaims a stale lock, reporting the OLD holder as reclaimedStale', async () => {
    const projectLock = new FakeProjectLock();
    const stale = {
      sessionId: 'stale-session',
      pid: 999,
      procStart: undefined,
      acquiredAt: new Date('2026-09-01T00:00:00.000Z'),
    };
    await projectLock.write(ROOT, PROJECT_ID, stale);
    // 999 absent from aliveByPid — dead.
    const deps = buildDeps(projectLock, new ControllableProcessControl());
    const outcome = await acquireProjectLock(
      deps,
      ROOT,
      PROJECT_ID,
      { pid: 111, procStart: undefined, sessionId: 'session-new' },
      NOW,
    );
    expect(outcome.decision).toEqual({ kind: 'acquire' });
    expect(outcome.reclaimedStale).toEqual(stale);
    expect(await projectLock.read(ROOT, PROJECT_ID)).toEqual({
      sessionId: 'session-new',
      pid: 111,
      procStart: undefined,
      acquiredAt: NOW,
    });
  });

  it('never writes when refused — the live holder stays exactly as it was', async () => {
    const projectLock = new FakeProjectLock();
    const holder = {
      sessionId: 'other-session',
      pid: 555,
      procStart: undefined,
      acquiredAt: NOW,
    };
    await projectLock.write(ROOT, PROJECT_ID, holder);
    const processControl = new ControllableProcessControl(new Map([[555, true]]));
    const deps = buildDeps(projectLock, processControl);
    const outcome = await acquireProjectLock(
      deps,
      ROOT,
      PROJECT_ID,
      { pid: 111, procStart: undefined, sessionId: 'session-new' },
      NOW,
    );
    expect(outcome).toEqual({
      decision: { kind: 'refuse', heldBy: holder },
      reclaimedStale: null,
    });
    expect(await projectLock.read(ROOT, PROJECT_ID)).toEqual(holder);
  });
});

describe('releaseProjectLock', () => {
  it('notHeld when nothing was ever taken', async () => {
    const projectLock = new FakeProjectLock();
    const result = await releaseProjectLock({ projectLock }, ROOT, PROJECT_ID, 4242);
    expect(result).toEqual({ kind: 'notHeld' });
  });

  it('releases (and clears the file) when releasingPid matches the holder', async () => {
    const projectLock = new FakeProjectLock();
    await projectLock.write(ROOT, PROJECT_ID, {
      sessionId: 'session-abc',
      pid: 4242,
      procStart: undefined,
      acquiredAt: NOW,
    });
    const result = await releaseProjectLock({ projectLock }, ROOT, PROJECT_ID, 4242);
    expect(result).toEqual({ kind: 'released' });
    expect(await projectLock.read(ROOT, PROJECT_ID)).toBeNull();
  });

  it('refuses (and leaves the file untouched) when releasingPid does not match the holder', async () => {
    const projectLock = new FakeProjectLock();
    const holder = {
      sessionId: 'session-abc',
      pid: 4242,
      procStart: undefined,
      acquiredAt: NOW,
    };
    await projectLock.write(ROOT, PROJECT_ID, holder);
    const result = await releaseProjectLock({ projectLock }, ROOT, PROJECT_ID, 9999);
    expect(result).toEqual({ kind: 'refuse', heldBy: holder });
    expect(await projectLock.read(ROOT, PROJECT_ID)).toEqual(holder);
  });
});

describe('describeProjectLockStatus', () => {
  it('unlocked when nothing was ever taken', async () => {
    const deps = buildDeps(new FakeProjectLock(), new ControllableProcessControl());
    expect(await describeProjectLockStatus(deps, ROOT, PROJECT_ID)).toEqual({ kind: 'unlocked' });
  });

  it('heldByLiveSession when the recorded pid answers alive', async () => {
    const projectLock = new FakeProjectLock();
    const holder = {
      sessionId: 'session-abc',
      pid: 4242,
      procStart: undefined,
      acquiredAt: NOW,
    };
    await projectLock.write(ROOT, PROJECT_ID, holder);
    const processControl = new ControllableProcessControl(new Map([[4242, true]]));
    const deps = buildDeps(projectLock, processControl);
    expect(await describeProjectLockStatus(deps, ROOT, PROJECT_ID)).toEqual({
      kind: 'heldByLiveSession',
      lock: holder,
    });
  });

  it('staleLock (never unlocked) when a lock file exists but its pid is dead — distinct from never having been locked at all', async () => {
    const projectLock = new FakeProjectLock();
    const holder = {
      sessionId: 'session-abc',
      pid: 4242,
      procStart: undefined,
      acquiredAt: NOW,
    };
    await projectLock.write(ROOT, PROJECT_ID, holder);
    const deps = buildDeps(projectLock, new ControllableProcessControl());
    expect(await describeProjectLockStatus(deps, ROOT, PROJECT_ID)).toEqual({
      kind: 'staleLock',
      lock: holder,
    });
  });
});
