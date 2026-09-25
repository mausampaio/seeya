import { describe, expect, it } from 'vitest';
import {
  formatRemoveProjectReport,
  formatRemoveRepositoryReport,
  formatRevertAdoptionAmbiguous,
  formatRevertAdoptionReport,
  formatRevertAdoptionSessionNotFound,
  parseUndoConfirmation,
  renderDeleteAdoptedCopyConfirmation,
  renderRemoveProjectConfirmation,
  renderRevertAdoptionConfirmation,
} from '../../../packages/cli/src/format-project-undo.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';
import type { AdoptionRecord } from '@seeya-ai/engine/core/types.js';

const SOME_LOCK: ProjectLockInfo = {
  sessionId: 'abc123',
  pid: 9999,
  procStart: undefined,
  acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
};

describe('parseUndoConfirmation', () => {
  it('is true only for an explicit y/yes', () => {
    expect(parseUndoConfirmation('y')).toBe(true);
    expect(parseUndoConfirmation('yes')).toBe(true);
    expect(parseUndoConfirmation('')).toBe(false);
    expect(parseUndoConfirmation('n')).toBe(false);
    expect(parseUndoConfirmation('anything else')).toBe(false);
  });
});

describe('renderRemoveProjectConfirmation', () => {
  it('names the project and the file count', () => {
    const text = renderRemoveProjectConfirmation('auth-hardening', 3);
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('3 files');
  });

  it('singularizes for one file', () => {
    expect(renderRemoveProjectConfirmation('auth-hardening', 1)).toContain('1 file)');
  });
});

describe('formatRemoveProjectReport', () => {
  it('invalidId names the id and the allowed shape', () => {
    const text = formatRemoveProjectReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
    expect(text).toContain('lowercase');
  });

  it('notFound names the project', () => {
    expect(formatRemoveProjectReport({ kind: 'notFound', projectId: 'ghost' })).toBe(
      'Project "ghost" not found.',
    );
  });

  it('projectLocked names who holds the lock', () => {
    const text = formatRemoveProjectReport({
      kind: 'projectLocked',
      projectId: 'auth-hardening',
      heldBy: SOME_LOCK,
    });
    expect(text).toContain('session abc123');
  });

  it('confirmationDeclined and confirmationUnavailable read distinctly', () => {
    expect(
      formatRemoveProjectReport({ kind: 'confirmationDeclined', projectId: 'auth-hardening' }),
    ).toContain('cancelled');
    expect(
      formatRemoveProjectReport({ kind: 'confirmationUnavailable', projectId: 'auth-hardening' }),
    ).toContain('no interactive terminal');
  });

  it('removed shows the recovery line and any removed adoptions (item 1/7)', () => {
    const text = formatRemoveProjectReport({
      kind: 'removed',
      projectId: 'auth-hardening',
      fileCount: 5,
      previousCommit: 'abc123',
      removedAdoptions: [
        {
          originalSessionId: '11111111-1111-4111-8111-111111111111',
          forkSessionId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    });
    expect(text).toContain('removed (5 files)');
    expect(text).toContain('abc123');
    expect(text).toContain('checkout');
    expect(text).toContain('11111111-1111-4111-8111-111111111111');
    expect(text).toContain('22222222-2222-4222-8222-222222222222');
  });

  it('removed with no previous commit names the gap instead of an empty checkout line', () => {
    const text = formatRemoveProjectReport({
      kind: 'removed',
      projectId: 'auth-hardening',
      fileCount: 5,
      previousCommit: null,
      removedAdoptions: [],
    });
    expect(text).toContain('no previous commit was found');
  });

  it('removed with no adoptions never mentions adoptions.json', () => {
    const text = formatRemoveProjectReport({
      kind: 'removed',
      projectId: 'auth-hardening',
      fileCount: 5,
      previousCommit: 'abc123',
      removedAdoptions: [],
    });
    expect(text).not.toContain('adoption');
  });
});

describe('formatRemoveRepositoryReport', () => {
  it('repositoryNotFound names both the repository and the project', () => {
    const text = formatRemoveRepositoryReport({
      kind: 'repositoryNotFound',
      projectId: 'auth-hardening',
      name: 'app-api',
    });
    expect(text).toContain('"app-api"');
    expect(text).toContain('"auth-hardening"');
  });

  it('removed confirms the unlink', () => {
    const text = formatRemoveRepositoryReport({
      kind: 'removed',
      projectId: 'auth-hardening',
      name: 'app-api',
    });
    expect(text).toContain('Unlinked repository "app-api"');
  });
});

describe('renderRevertAdoptionConfirmation', () => {
  it('lists every commit, newest first, exactly as given', () => {
    const text = renderRevertAdoptionConfirmation('orig-1', 'fork-1', ['b', 'a']);
    expect(text.indexOf('\n  b')).toBeLessThan(text.indexOf('\n  a'));
    expect(text).toContain('2 commits');
    expect(text).toContain('fork-1');
    expect(text).toContain('orig-1');
  });
});

describe('renderDeleteAdoptedCopyConfirmation', () => {
  it('describes growth with the last-write time and size', () => {
    const text = renderDeleteAdoptedCopyConfirmation({
      forkSessionId: 'fork-1',
      adoptedAt: new Date('2026-09-23T10:00:00.000Z'),
      growth: {
        kind: 'grew',
        lastWrite: new Date('2026-09-24T10:00:00.000Z'),
        sizeBytes: 4096,
      },
    });
    expect(text).toContain('4096 bytes');
    expect(text).toContain('keeps it');
  });

  it('describes an unknown growth without inventing a size', () => {
    const text = renderDeleteAdoptedCopyConfirmation({
      forkSessionId: 'fork-1',
      adoptedAt: new Date('2026-09-23T10:00:00.000Z'),
      growth: { kind: 'unknown' },
    });
    expect(text).toContain("couldn't be found");
    expect(text).not.toContain('bytes');
  });
});

describe('formatRevertAdoptionSessionNotFound / formatRevertAdoptionAmbiguous', () => {
  it('sessionNotFound names the reference that failed to match', () => {
    expect(formatRevertAdoptionSessionNotFound('auth-hardening', 'zzzz')).toContain('"zzzz"');
  });

  it('ambiguous lists every match with its own original/copy ids', () => {
    const matches: AdoptionRecord[] = [
      {
        originalSessionId: '11111111-1111-4111-8111-111111111111',
        forkSessionId: '22222222-2222-4222-8222-222222222222',
        projectId: 'auth-hardening',
        adoptedAt: new Date('2026-09-23T10:00:00.000Z'),
      },
      {
        originalSessionId: '33333333-3333-4333-8333-333333333333',
        forkSessionId: '44444444-4444-4444-8444-444444444444',
        projectId: 'auth-hardening',
        adoptedAt: new Date('2026-09-23T11:00:00.000Z'),
      },
    ];
    const text = formatRevertAdoptionAmbiguous('auth-hardening', matches);
    expect(text).toContain('2 adopted sessions');
    expect(text).toContain('11111111-1111-4111-8111-111111111111');
    expect(text).toContain('44444444-4444-4444-8444-444444444444');
  });
});

describe('formatRevertAdoptionReport', () => {
  const IDENTITY = {
    projectId: 'auth-hardening',
    originalSessionId: '11111111-1111-4111-8111-111111111111',
    forkSessionId: '22222222-2222-4222-8222-222222222222',
  };

  it('projectLocked names who holds the lock', () => {
    const text = formatRevertAdoptionReport({
      kind: 'projectLocked',
      projectId: 'auth-hardening',
      heldBy: SOME_LOCK,
    });
    expect(text).toContain('session abc123');
  });

  it('nothingToRevert says the session never committed here', () => {
    const text = formatRevertAdoptionReport({ kind: 'nothingToRevert', ...IDENTITY });
    expect(text).toContain('never committed');
  });

  it('blocked names the blocking commit', () => {
    const text = formatRevertAdoptionReport({
      kind: 'blocked',
      ...IDENTITY,
      blockingCommit: 'deadbeef',
    });
    expect(text).toContain('deadbeef');
  });

  it('revertFailed names the commit where the sequence stopped', () => {
    const text = formatRevertAdoptionReport({
      kind: 'revertFailed',
      ...IDENTITY,
      failedCommit: 'deadbeef',
    });
    expect(text).toContain('deadbeef');
  });

  it('reverted names the count, the original session, and the copy outcome', () => {
    const text = formatRevertAdoptionReport({
      kind: 'reverted',
      ...IDENTITY,
      revertedCommits: ['a', 'b'],
      copyOutcome: { kind: 'deleted' },
    });
    expect(text).toContain('2 commits');
    expect(text).toContain(IDENTITY.originalSessionId);
    expect(text).toContain('was deleted');
  });

  it('reverted with a kept copy explains why, per reason', () => {
    const grewText = formatRevertAdoptionReport({
      kind: 'reverted',
      ...IDENTITY,
      revertedCommits: ['a'],
      copyOutcome: { kind: 'kept', reason: 'grew' },
    });
    expect(grewText).toContain('kept');
    expect(grewText).toContain('the answer was to keep it');

    const unavailableText = formatRevertAdoptionReport({
      kind: 'reverted',
      ...IDENTITY,
      revertedCommits: ['a'],
      copyOutcome: { kind: 'kept', reason: 'confirmationUnavailable' },
    });
    expect(unavailableText).toContain('no interactive terminal');
  });
});
