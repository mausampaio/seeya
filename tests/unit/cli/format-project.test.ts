import { describe, expect, it } from 'vitest';
import {
  formatAddRepoReport,
  formatAdoptAmbiguousMatchMessage,
  formatAdoptNoMatchMessage,
  formatAdoptSessionReport,
  formatCreateProjectReport,
  formatMissingRepositoryLines,
  formatOpenProjectReport,
  formatProjectsReport,
  formatShowProjectReport,
  parseReadOnlyOpenConfirmation,
  renderAdoptionCommitConfirmation,
  renderReadOnlyOpenConfirmation,
} from '../../../packages/cli/src/format-project.js';
import type { DiscoveredSession, ProjectManifest } from '@seeya-ai/engine/core/types.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';

const SOME_LOCK: ProjectLockInfo = {
  sessionId: 'abc123',
  pid: 9999,
  procStart: undefined,
  acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
};

const EMPTY_MANIFEST: ProjectManifest = {
  id: 'auth-hardening',
  name: 'auth-hardening',
  defaultHarness: null,
  repositories: [],
  trackers: [],
};

describe('formatCreateProjectReport', () => {
  it('invalidId names the id and the allowed shape', () => {
    const text = formatCreateProjectReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
    expect(text).toContain('lowercase');
  });

  it('alreadyExists names the project', () => {
    const text = formatCreateProjectReport({ kind: 'alreadyExists', projectId: 'auth-hardening' });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('already exists');
  });

  it('created names the project and the path', () => {
    const text = formatCreateProjectReport({
      kind: 'created',
      projectId: 'auth-hardening',
      root: 'C:\\seeya-home\\workspace\\auth-hardening',
    });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('C:\\seeya-home\\workspace\\auth-hardening');
  });
});

describe('formatProjectsReport', () => {
  it('says "no projects" honestly when the workspace is empty', () => {
    const text = formatProjectsReport({ root: 'C:\\workspace', manifests: [], rejected: [] });
    expect(text).toContain('0 projects found');
    expect(text).not.toContain('Ignored entries');
  });

  it('lists each project with its default harness and repositories, D-025 says "not set" not a guess', () => {
    const text = formatProjectsReport({
      root: 'C:\\workspace',
      manifests: [EMPTY_MANIFEST],
      rejected: [],
    });
    expect(text).toContain('1 project found');
    expect(text).toContain('auth-hardening');
    expect(text).toContain('default harness: not set');
    expect(text).toContain('repositories: none');
  });

  it('D-022: both sides — a summary that mentions ignored entries and lists the reason', () => {
    const text = formatProjectsReport({
      root: 'C:\\workspace',
      manifests: [],
      rejected: [{ file: 'C:\\workspace\\broken\\seeya.json', raw: undefined, reason: 'bad json' }],
    });
    expect(text).toContain('0 projects found, 1 entry ignored');
    expect(text).toContain('Ignored entries:');
    expect(text).toContain('bad json');
  });
});

describe('formatShowProjectReport', () => {
  it('invalidId names the id', () => {
    const text = formatShowProjectReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
  });

  it('notFound names the id', () => {
    const text = formatShowProjectReport({ kind: 'notFound', projectId: 'ghost' });
    expect(text).toContain('"ghost"');
    expect(text).toContain('not found');
  });

  it('found shows path, default harness, repositories and trackers', () => {
    const text = formatShowProjectReport({
      kind: 'found',
      manifest: {
        ...EMPTY_MANIFEST,
        defaultHarness: 'claude',
        repositories: [
          {
            hasRemote: true,
            name: 'api',
            remote: 'https://host/acme-widgets/a.git',
            identity: null,
          },
        ],
        trackers: [{ type: 'gitlab', project: 'acme/app' }],
      },
      root: 'C:\\workspace\\auth-hardening',
      lockStatus: { kind: 'unlocked' },
    });
    expect(text).toContain('C:\\workspace\\auth-hardening');
    expect(text).toContain('default harness: claude');
    expect(text).toContain('repositories: api');
    expect(text).toContain('trackers: gitlab:acme/app');
    expect(text).toContain('lock: none');
  });

  it('found names who holds a live lock and since when (V2-T33, D-047 item 5)', () => {
    const text = formatShowProjectReport({
      kind: 'found',
      manifest: EMPTY_MANIFEST,
      root: 'C:\\workspace\\auth-hardening',
      lockStatus: { kind: 'heldByLiveSession', lock: SOME_LOCK },
    });
    expect(text).toContain('lock: held by session abc123');
    expect(text).toContain('pid 9999');
    expect(text).toContain('2026-09-20T09:00:00.000Z');
  });

  it('found names a stale lock as reclaimable, not as currently held', () => {
    const text = formatShowProjectReport({
      kind: 'found',
      manifest: EMPTY_MANIFEST,
      root: 'C:\\workspace\\auth-hardening',
      lockStatus: { kind: 'staleLock', lock: SOME_LOCK },
    });
    expect(text).toContain('lock: stale');
    expect(text).toContain('reclaimable');
    expect(text).toContain('session abc123');
  });

  it('found describes an unidentified holder (no CLAUDE_CODE_SESSION_ID) without inventing an id (D-025)', () => {
    const text = formatShowProjectReport({
      kind: 'found',
      manifest: EMPTY_MANIFEST,
      root: 'C:\\workspace\\auth-hardening',
      lockStatus: {
        kind: 'heldByLiveSession',
        lock: { ...SOME_LOCK, sessionId: undefined },
      },
    });
    expect(text).toContain('an unidentified session');
    expect(text).not.toContain('undefined');
  });
});

// `formatProjectLockWarningLines`'s own tests moved to
// `tests/unit/core/project-lock-message.test.ts` — it lives in `core/` since V2-T35 (shared, pure
// text `application/project-open.ts` also needs for `--append-system-prompt`); `cli/format-project.ts`
// only re-exports it now.

describe('renderReadOnlyOpenConfirmation (V2-T35 item 1)', () => {
  it('names the holder in the question', () => {
    const text = renderReadOnlyOpenConfirmation(SOME_LOCK);
    expect(text).toContain('session abc123');
    expect(text).toContain('pid 9999');
    expect(text).toContain('Continue and open this project for reading only');
  });

  it('asks a complete question — the holder is never glued on after a dangling "while"', () => {
    // Maintainer's acceptance run, 2026-09-24: the prompt read "...for reading only, while session
    // <id> (pid <n>) since <time>?" — the holder description has no verb of its own, so gluing it
    // after "while" left a sentence that never said what the holder was doing.
    const text = renderReadOnlyOpenConfirmation(SOME_LOCK);
    expect(text).not.toContain(', while ');
    expect(text).toMatch(/for reading only\? \(It stays locked by session abc123 .*\) \[y\/N\] $/);
  });
});

describe('parseReadOnlyOpenConfirmation (V2-T35 item 1)', () => {
  it('an explicit "y" (any case, with surrounding space) is a yes', () => {
    expect(parseReadOnlyOpenConfirmation('y')).toBe(true);
    expect(parseReadOnlyOpenConfirmation('Y')).toBe(true);
    expect(parseReadOnlyOpenConfirmation('  yes  ')).toBe(true);
    expect(parseReadOnlyOpenConfirmation('YES')).toBe(true);
  });

  it('a blank answer, or anything else, is a decline — never a guessed yes (D-025)', () => {
    expect(parseReadOnlyOpenConfirmation('')).toBe(false);
    expect(parseReadOnlyOpenConfirmation('\n')).toBe(false);
    expect(parseReadOnlyOpenConfirmation('n')).toBe(false);
    expect(parseReadOnlyOpenConfirmation('sure')).toBe(false);
  });
});

describe('formatAddRepoReport', () => {
  it('invalidId names the id', () => {
    const text = formatAddRepoReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
  });

  it('projectNotFound names the id', () => {
    const text = formatAddRepoReport({ kind: 'projectNotFound', projectId: 'ghost' });
    expect(text).toContain('"ghost" not found');
  });

  it('pathNotFound names the path', () => {
    const text = formatAddRepoReport({ kind: 'pathNotFound', path: 'C:\\code\\missing' });
    expect(text).toContain('"C:\\code\\missing" does not exist');
  });

  it('alreadyAssociated names both the repository and the project', () => {
    const text = formatAddRepoReport({
      kind: 'alreadyAssociated',
      projectId: 'auth-hardening',
      name: 'app-api',
    });
    expect(text).toContain('"app-api"');
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('already associated');
  });

  it('added with a remote names the repository and the project, no "no remote" note', () => {
    const text = formatAddRepoReport({
      kind: 'added',
      projectId: 'auth-hardening',
      name: 'app-api',
      hasRemote: true,
    });
    expect(text).toContain('Linked repository "app-api" to project "auth-hardening"');
    expect(text).not.toContain('no remote');
  });

  it('added without a remote says so — D-025, never silent', () => {
    const text = formatAddRepoReport({
      kind: 'added',
      projectId: 'auth-hardening',
      name: 'legacy-scripts',
      hasRemote: false,
    });
    expect(text).toContain('no remote');
    expect(text).toContain('only resolvable on this device');
  });
});

describe('formatMissingRepositoryLines', () => {
  it('notInDeviceMap points at add-repo with the project id already filled in', () => {
    const lines = formatMissingRepositoryLines('auth-hardening', [
      { name: 'frontend', reason: 'notInDeviceMap' },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"frontend"');
    expect(lines[0]).toContain('not registered on this device');
    expect(lines[0]).toContain('seeya project add-repo auth-hardening <path>');
  });

  it('pathMissing names both the old path and how to update it', () => {
    const lines = formatMissingRepositoryLines('auth-hardening', [
      { name: 'frontend', reason: 'pathMissing', path: 'C:\\code\\app-web' },
    ]);
    expect(lines[0]).toContain('"C:\\code\\app-web"');
    expect(lines[0]).toContain('no longer exists');
  });

  it('empty list for no missing repositories', () => {
    expect(formatMissingRepositoryLines('auth-hardening', [])).toEqual([]);
  });
});

describe('formatOpenProjectReport', () => {
  it('invalidId names the id', () => {
    const text = formatOpenProjectReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
  });

  it('notFound names the id', () => {
    const text = formatOpenProjectReport({ kind: 'notFound', projectId: 'ghost' });
    expect(text).toContain('"ghost" not found');
  });

  it('noHarnessChosen tells how to choose one, never assumes claude', () => {
    const text = formatOpenProjectReport({ kind: 'noHarnessChosen', projectId: 'auth-hardening' });
    expect(text).toContain('no default harness set');
    expect(text).toContain('--with');
  });

  it('unsupportedHarness names the harness and says only claude is supported', () => {
    const text = formatOpenProjectReport({ kind: 'unsupportedHarness', harness: 'codex' });
    expect(text).toContain('"codex"');
    expect(text).toContain('not supported yet');
    expect(text).toContain('"claude"');
  });

  it('failedToStart names the harness and the project', () => {
    const text = formatOpenProjectReport({
      kind: 'failedToStart',
      projectId: 'auth-hardening',
      harness: 'claude',
    });
    expect(text).toContain('claude');
    expect(text).toContain('"auth-hardening"');
  });

  it('opened names the project, the harness, the exit code, and the lock final state (item 3)', () => {
    const text = formatOpenProjectReport({
      kind: 'opened',
      projectId: 'auth-hardening',
      harness: 'claude',
      exitCode: 0,
      addedDirs: ['C:\\code\\app-api'],
      missing: [],
      lock: { kind: 'acquired', reclaimedStale: null },
      finalLockStatus: { kind: 'unlocked' },
    });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('claude');
    expect(text).toContain('code 0');
    expect(text).toContain('lock: none');
  });

  it('opened with a readOnly lock repeats the SAME warning the person could not read before the harness took over (item 3)', () => {
    const text = formatOpenProjectReport({
      kind: 'opened',
      projectId: 'auth-hardening',
      harness: 'claude',
      exitCode: 0,
      addedDirs: [],
      missing: [],
      lock: { kind: 'readOnly', heldBy: SOME_LOCK },
      finalLockStatus: { kind: 'heldByLiveSession', lock: SOME_LOCK },
    });
    expect(text).toContain('locked by session abc123');
    expect(text).toContain('opening for reading only');
    expect(text).toContain('lock: held by session abc123');
  });

  it('lockConfirmationDeclined names who holds the project and that the person chose not to continue (item 1)', () => {
    const text = formatOpenProjectReport({
      kind: 'lockConfirmationDeclined',
      projectId: 'auth-hardening',
      heldBy: SOME_LOCK,
    });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('not opened');
    expect(text).toContain('chose not to continue');
    expect(text).toContain('session abc123');
  });

  it('lockConfirmationUnavailable refuses and says why, no interactive terminal (item 1)', () => {
    const text = formatOpenProjectReport({
      kind: 'lockConfirmationUnavailable',
      projectId: 'auth-hardening',
      heldBy: SOME_LOCK,
    });
    expect(text).toContain('seeya:');
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('session abc123');
    expect(text).toContain('refusing to open');
    expect(text).toContain('no interactive terminal');
  });
});

const DISCOVERED_A: DiscoveredSession = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  cwd: 'c:\\code\\projeto',
  name: 'projeto-01',
  hasTranscript: true,
  lastTranscriptWrite: new Date('2026-09-24T10:00:00.000Z'),
  lastActivity: new Date('2026-09-24T10:00:00.000Z'),
  hasPid: false,
};

describe('formatAdoptNoMatchMessage', () => {
  it('names the raw value and the discovered count', () => {
    const text = formatAdoptNoMatchMessage('nothing-like-this', 3);
    expect(text).toContain('"nothing-like-this"');
    expect(text).toContain('3 sessions were discovered');
  });

  it('singular phrasing for exactly one discovered session', () => {
    expect(formatAdoptNoMatchMessage('x', 1)).toContain('1 session was discovered');
  });
});

describe('formatAdoptAmbiguousMatchMessage', () => {
  it('names every match by sessionId, refusing to guess', () => {
    const text = formatAdoptAmbiguousMatchMessage('projeto', [DISCOVERED_A]);
    expect(text).toContain('matches 1 discovered sessions');
    expect(text).toContain(DISCOVERED_A.sessionId);
    expect(text).toContain('refusing to guess');
  });
});

describe('renderAdoptionCommitConfirmation', () => {
  it('shows every changed file, then asks to commit', () => {
    const text = renderAdoptionCommitConfirmation(['auth-hardening/AGENTS.md']);
    expect(text).toContain('auth-hardening/AGENTS.md');
    expect(text).toContain('Commit these changes?');
  });
});

describe('formatAdoptSessionReport', () => {
  it('invalidId names the id and the allowed shape', () => {
    const text = formatAdoptSessionReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
    expect(text).toContain('lowercase');
  });

  it('sessionRunning explains a second copy would open', () => {
    const text = formatAdoptSessionReport({
      kind: 'sessionRunning',
      sessionId: DISCOVERED_A.sessionId,
      name: 'projeto-01',
      state: 'alive',
    });
    expect(text).toContain('"projeto-01"');
    expect(text).toContain('running right now (alive)');
    expect(text).toContain('second copy');
  });

  it('alreadyAdopted names the existing project and the date', () => {
    const text = formatAdoptSessionReport({
      kind: 'alreadyAdopted',
      sessionId: DISCOVERED_A.sessionId,
      projectId: 'billing',
      adoptedAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(text).toContain(DISCOVERED_A.sessionId);
    expect(text).toContain('"billing"');
    expect(text).toContain('2026-09-01T00:00:00.000Z');
    expect(text).toContain('refusing to adopt it a second time');
  });

  it('projectLocked names who holds it', () => {
    const text = formatAdoptSessionReport({
      kind: 'projectLocked',
      projectId: 'auth-hardening',
      heldBy: SOME_LOCK,
    });
    expect(text).toContain('seeya:');
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('session abc123');
  });

  it('failedToStart names the project', () => {
    const text = formatAdoptSessionReport({ kind: 'failedToStart', projectId: 'auth-hardening' });
    expect(text).toContain('seeya:');
    expect(text).toContain('"auth-hardening"');
  });

  it('noChanges names the project and the fork, and says nothing was kept', () => {
    const text = formatAdoptSessionReport({
      kind: 'noChanges',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
    });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('22222222-2222-4222-8222-222222222222');
    expect(text).toContain('nothing to commit');
  });

  it('declined lists the changed files and says the fork was discarded', () => {
    const text = formatAdoptSessionReport({
      kind: 'declined',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['auth-hardening/AGENTS.md'],
    });
    expect(text).toContain('declined');
    expect(text).toContain('discarded');
    expect(text).toContain('auth-hardening/AGENTS.md');
  });

  it('confirmationUnavailable says nothing was committed or discarded, and lists what was written', () => {
    const text = formatAdoptSessionReport({
      kind: 'confirmationUnavailable',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['auth-hardening/status/README.md'],
    });
    expect(text).toContain('no interactive terminal');
    expect(text).toContain('Nothing was committed or discarded');
    expect(text).toContain('auth-hardening/status/README.md');
  });

  it('adopted says the fork is now the project session, and lists what was committed', () => {
    const text = formatAdoptSessionReport({
      kind: 'adopted',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['auth-hardening/AGENTS.md', 'auth-hardening/context/know-how.md'],
    });
    expect(text).toContain('adopted');
    expect(text).toContain("project's own session");
    expect(text).toContain('auth-hardening/AGENTS.md');
    expect(text).toContain('auth-hardening/context/know-how.md');
  });
});
