/**
 * `core/project-management-message.ts` (V2-T83). Pure text moved out of `cli/format-project-*.ts`
 * so the window's "Project details" dialog shows the CLI's own sentences. The CLI's own
 * `format-project-undo.test.ts`/`format-project.test.ts` already pin the assembled reports
 * byte for byte; these pin each moved sentence on its own.
 */
import { describe, expect, it } from 'vitest';
import {
  formatAdoptedCopyOutcomeLine,
  formatInvalidProjectIdLine,
  formatNothingToRevertLine,
  formatPathNotFoundLine,
  formatProjectLockedRefusalLine,
  formatProjectNotFoundLine,
  formatProjectRemovedLine,
  formatRecoveryLine,
  formatRemovedAdoptionsLines,
  formatRepositoryAlreadyAssociatedLine,
  formatRepositoryLinkedLine,
  formatRepositoryNotAssociatedLine,
  formatRepositoryUnlinkedLine,
  formatRevertBlockedLine,
  formatRevertFailedLine,
  formatRevertedLine,
  renderDeleteAdoptedCopyQuestionLine,
  renderRevertAdoptionQuestionLine,
} from '@seeya-ai/engine/core/project-management-message.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';

const HOLDER: ProjectLockInfo = {
  sessionId: 'abc123',
  pid: 9999,
  procStart: undefined,
  acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
};

describe('project-management sentences', () => {
  it('names the invalid id and the allowed shape', () => {
    expect(formatInvalidProjectIdLine('Bad_Id')).toBe(
      'seeya: "Bad_Id" is not a valid project id — use lowercase letters, digits and hyphens only, e.g. "auth-hardening".',
    );
  });

  it('refusal lines complete "refusing to ..." with the action, and name the holder', () => {
    expect(formatProjectLockedRefusalLine('p', HOLDER, 'remove it')).toBe(
      'seeya: project "p" is locked by session abc123 (pid 9999) since 2026-09-20T09:00:00.000Z — refusing to remove it while it\'s held by another live session.',
    );
    expect(formatProjectLockedRefusalLine('p', HOLDER, 'change it')).toContain(
      'refusing to change it',
    );
    expect(formatProjectLockedRefusalLine('p', HOLDER, 'revert')).toContain(
      'refusing to revert while',
    );
  });

  it('repository lines', () => {
    expect(formatProjectNotFoundLine('p')).toBe('Project "p" not found.');
    expect(formatPathNotFoundLine('/x')).toBe('seeya: "/x" does not exist.');
    expect(formatRepositoryAlreadyAssociatedLine('api', 'p')).toBe(
      'Repository "api" is already associated with project "p".',
    );
    expect(formatRepositoryLinkedLine('api', 'p', true)).toBe(
      'Linked repository "api" to project "p".',
    );
    expect(formatRepositoryLinkedLine('api', 'p', false)).toContain(
      '(no remote — only resolvable on this device',
    );
    expect(formatRepositoryNotAssociatedLine('api', 'p')).toBe(
      'Repository "api" is not associated with project "p".',
    );
    expect(formatRepositoryUnlinkedLine('api', 'p')).toBe(
      'Unlinked repository "api" from project "p".',
    );
  });

  it('removal lines: singular/plural file count and the recovery hint', () => {
    expect(formatProjectRemovedLine('p', 1)).toBe('Project "p" removed (1 file).');
    expect(formatProjectRemovedLine('p', 12)).toBe('Project "p" removed (12 files).');
    expect(formatRecoveryLine('p', 'abc1234')).toBe(
      'To recover: git -C <workspace> checkout abc1234 -- p (then commit that restoration yourself).',
    );
    expect(formatRecoveryLine('p', null)).toBe(
      'seeya: no previous commit was found to recover "p" from.',
    );
  });

  it('lists removed adoptions, and says nothing when there were none (D-025)', () => {
    expect(formatRemovedAdoptionsLines([])).toEqual([]);
    const lines = formatRemovedAdoptionsLines([{ originalSessionId: 'o1', forkSessionId: 'f1' }]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('  - original o1 (copy f1)');
  });

  it('revert lines', () => {
    expect(formatNothingToRevertLine('p', 'f1')).toContain('never committed anything here');
    expect(formatRevertBlockedLine('c0ffee')).toContain('commit c0ffee (from a different session)');
    expect(formatRevertFailedLine('c0ffee')).toContain('stopped at commit c0ffee');
    expect(renderRevertAdoptionQuestionLine('o1', 'f1', 1)).toBe(
      'This reverts 1 commit made by the adopted session (copy f1, original o1), newest first:',
    );
    expect(renderRevertAdoptionQuestionLine('o1', 'f1', 3)).toContain('This reverts 3 commits');
    expect(formatRevertedLine('p', 2, 'f1', 'o1')).toBe(
      'Project "p": reverted 2 commits from the adopted session (copy f1). The original session (o1) can be adopted again.',
    );
    expect(formatRevertedLine('p', 1, 'f1', 'o1')).toContain('reverted 1 commit from');
  });

  it('says what happened to the adopted copy, with the reason when it was kept', () => {
    expect(formatAdoptedCopyOutcomeLine('f1', { kind: 'deleted' })).toBe(
      'The adopted copy (session f1) was deleted.',
    );
    expect(formatAdoptedCopyOutcomeLine('f1', { kind: 'kept', reason: 'grew' })).toContain(
      'it kept writing after being adopted',
    );
    expect(formatAdoptedCopyOutcomeLine('f1', { kind: 'kept', reason: 'unknownGrowth' })).toContain(
      "couldn't be found",
    );
    expect(
      formatAdoptedCopyOutcomeLine('f1', { kind: 'kept', reason: 'confirmationUnavailable' }),
    ).toContain('no interactive terminal');
  });

  it('the delete-copy question carries the growth facts, or says growth is unknown', () => {
    const adoptedAt = new Date('2026-09-24T10:00:00.000Z');
    expect(
      renderDeleteAdoptedCopyQuestionLine({
        forkSessionId: 'f1',
        adoptedAt,
        growth: { kind: 'grew', lastWrite: new Date('2026-09-24T11:00:00.000Z'), sizeBytes: 2048 },
      }),
    ).toBe(
      'The adopted copy (session f1) it kept writing after being adopted on 2026-09-24T10:00:00.000Z — last activity 2026-09-24T11:00:00.000Z, now 2048 bytes. Delete it anyway?',
    );
    expect(
      renderDeleteAdoptedCopyQuestionLine({
        forkSessionId: 'f1',
        adoptedAt,
        growth: { kind: 'unknown' },
      }),
    ).toContain("its transcript couldn't be found");
  });
});
