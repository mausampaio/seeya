import { describe, expect, it } from 'vitest';
import {
  formatAddRepositoryActionResult,
  formatRemoveProjectActionResult,
  formatRemoveRepositoryActionResult,
  formatRevertAdoptionActionResult,
} from '../../../../packages/app/src/state/project-details-result.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';

const HOLDER: ProjectLockInfo = {
  sessionId: 'abc123',
  pid: 9,
  procStart: undefined,
  acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
};

describe('formatAddRepositoryActionResult (V2-T83)', () => {
  it('added is success, with the CLI sentence', () => {
    expect(
      formatAddRepositoryActionResult({
        kind: 'added',
        projectId: 'p',
        name: 'api',
        hasRemote: true,
      }),
    ).toEqual({
      tone: 'success',
      lines: ['Linked repository "api" to project "p".'],
      projectRemoved: false,
    });
  });

  it('already associated is info — nothing changed, and that is fine', () => {
    const response = formatAddRepositoryActionResult({
      kind: 'alreadyAssociated',
      projectId: 'p',
      name: 'api',
    });
    expect(response.tone).toBe('info');
    expect(response.lines).toEqual(['Repository "api" is already associated with project "p".']);
  });

  it('a folder that does not exist, a missing project and an invalid id are errors with the reason', () => {
    expect(formatAddRepositoryActionResult({ kind: 'pathNotFound', path: '/x' })).toMatchObject({
      tone: 'error',
      lines: ['seeya: "/x" does not exist.'],
    });
    expect(formatAddRepositoryActionResult({ kind: 'projectNotFound', projectId: 'p' }).tone).toBe(
      'error',
    );
    expect(formatAddRepositoryActionResult({ kind: 'invalidId', projectId: 'P' }).tone).toBe(
      'error',
    );
  });
});

describe('formatRemoveRepositoryActionResult', () => {
  it('removed is success; a locked project is an error naming the holder', () => {
    expect(
      formatRemoveRepositoryActionResult({ kind: 'removed', projectId: 'p', name: 'api' }),
    ).toMatchObject({ tone: 'success', lines: ['Unlinked repository "api" from project "p".'] });
    const locked = formatRemoveRepositoryActionResult({
      kind: 'projectLocked',
      projectId: 'p',
      heldBy: HOLDER,
    });
    expect(locked.tone).toBe('error');
    expect(locked.lines[0]).toContain('session abc123');
    expect(locked.lines[0]).toContain('refusing to change it');
  });

  it('a repository that is no longer associated is an error', () => {
    expect(
      formatRemoveRepositoryActionResult({
        kind: 'repositoryNotFound',
        projectId: 'p',
        name: 'api',
      }),
    ).toMatchObject({ tone: 'error' });
  });
});

describe('formatRevertAdoptionActionResult', () => {
  it('reverted is success and reports what happened to the copy', () => {
    const response = formatRevertAdoptionActionResult({
      kind: 'reverted',
      projectId: 'p',
      originalSessionId: 'o1',
      forkSessionId: 'f1',
      revertedCommits: ['c1', 'c2'],
      copyOutcome: { kind: 'kept', reason: 'grew' },
    });
    expect(response.tone).toBe('success');
    expect(response.lines).toHaveLength(2);
    expect(response.lines[0]).toContain('reverted 2 commits');
    expect(response.lines[1]).toContain('was kept');
  });

  it('a refusal by a later commit is an error that names the blocking commit', () => {
    const response = formatRevertAdoptionActionResult({
      kind: 'blocked',
      projectId: 'p',
      originalSessionId: 'o1',
      forkSessionId: 'f1',
      blockingCommit: 'c0ffee',
    });
    expect(response.tone).toBe('error');
    expect(response.lines[0]).toContain('c0ffee');
  });

  it('cancelling is info; a failed revert is an error', () => {
    const identity = { projectId: 'p', originalSessionId: 'o1', forkSessionId: 'f1' };
    expect(
      formatRevertAdoptionActionResult({ kind: 'confirmationDeclined', ...identity }).tone,
    ).toBe('info');
    expect(
      formatRevertAdoptionActionResult({ kind: 'revertFailed', ...identity, failedCommit: 'c1' })
        .tone,
    ).toBe('error');
    expect(formatRevertAdoptionActionResult({ kind: 'nothingToRevert', ...identity }).tone).toBe(
      'info',
    );
  });

  it('an adoption that is no longer registered says so, for every way the lookup can miss', () => {
    for (const kind of ['noAdoption'] as const) {
      expect(formatRevertAdoptionActionResult({ kind, projectId: 'p' }).lines[0]).toContain(
        'no longer registered',
      );
    }
    expect(
      formatRevertAdoptionActionResult({ kind: 'sessionNotFound', projectId: 'p', sessionRef: 'x' })
        .lines[0],
    ).toContain('no longer registered');
    expect(
      formatRevertAdoptionActionResult({ kind: 'ambiguousAdoption', projectId: 'p', matches: [] })
        .lines[0],
    ).toContain('no longer registered');
  });

  it('a locked project is an error naming the holder', () => {
    const response = formatRevertAdoptionActionResult({
      kind: 'projectLocked',
      projectId: 'p',
      heldBy: HOLDER,
    });
    expect(response.tone).toBe('error');
    expect(response.lines[0]).toContain('refusing to revert');
  });
});

describe('formatRemoveProjectActionResult', () => {
  it('removed marks the project as gone and carries the recovery line', () => {
    const response = formatRemoveProjectActionResult({
      kind: 'removed',
      projectId: 'p',
      fileCount: 3,
      previousCommit: 'abc1234',
      removedAdoptions: [{ originalSessionId: 'o1', forkSessionId: 'f1' }],
    });
    expect(response.projectRemoved).toBe(true);
    expect(response.tone).toBe('success');
    expect(response.lines[0]).toBe('Project "p" removed (3 files).');
    expect(response.lines[1]).toBe(
      'To recover: git -C <workspace> checkout abc1234 -- p (then commit that restoration yourself).',
    );
    expect(response.lines[3]).toBe('  - original o1 (copy f1)');
  });

  it('cancelling does not mark the project as gone', () => {
    const response = formatRemoveProjectActionResult({
      kind: 'confirmationDeclined',
      projectId: 'p',
    });
    expect(response.tone).toBe('info');
    expect(response.projectRemoved).toBe(false);
  });

  it('a locked project is an error naming the holder', () => {
    const response = formatRemoveProjectActionResult({
      kind: 'projectLocked',
      projectId: 'p',
      heldBy: HOLDER,
    });
    expect(response).toMatchObject({ tone: 'error', projectRemoved: false });
    expect(response.lines[0]).toContain('refusing to remove it');
  });
});
