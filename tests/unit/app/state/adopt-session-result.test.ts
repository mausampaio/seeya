import { describe, expect, it } from 'vitest';
import {
  formatAdoptSessionOutcomeText,
  formatSessionNotDiscoverableText,
  isAdoptedResult,
} from '../../../../packages/app/src/state/adopt-session-result.js';
import type { AdoptSessionResult } from '@seeya-ai/engine/application/project-adopt.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';

const HELD_BY: ProjectLockInfo = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  pid: 4242,
  procStart: undefined,
  acquiredAt: new Date('2026-09-24T12:00:00.000Z'),
};

describe('formatAdoptSessionOutcomeText (V2-T30 item 5)', () => {
  it('invalidId names the offending value', () => {
    const result: AdoptSessionResult = { kind: 'invalidId', projectId: 'Not Valid!' };
    expect(formatAdoptSessionOutcomeText(result)).toBe('"Not Valid!" is not a valid project id.');
  });

  it('sessionRunning names the session and its state', () => {
    const result: AdoptSessionResult = {
      kind: 'sessionRunning',
      sessionId: '11111111-1111-4111-8111-111111111111',
      name: 'my-session',
      state: 'alive',
    };
    const text = formatAdoptSessionOutcomeText(result);
    expect(text).toContain('"my-session"');
    expect(text).toContain('(alive)');
  });

  it('alreadyAdopted names the project', () => {
    const result: AdoptSessionResult = {
      kind: 'alreadyAdopted',
      sessionId: '11111111-1111-4111-8111-111111111111',
      projectId: 'auth-hardening',
      adoptedAt: new Date('2026-09-20T00:00:00.000Z'),
    };
    expect(formatAdoptSessionOutcomeText(result)).toContain('"auth-hardening"');
  });

  it('launchConfirmationDeclined says cancelled', () => {
    const result: AdoptSessionResult = {
      kind: 'launchConfirmationDeclined',
      projectId: 'auth-hardening',
    };
    expect(formatAdoptSessionOutcomeText(result)).toBe(
      'Project "auth-hardening": adoption cancelled — you chose not to continue.',
    );
  });

  it('launchConfirmationUnavailable refuses without confirmation', () => {
    const result: AdoptSessionResult = {
      kind: 'launchConfirmationUnavailable',
      projectId: 'auth-hardening',
    };
    expect(formatAdoptSessionOutcomeText(result)).toContain('without confirmation');
  });

  it('projectLocked names who holds it', () => {
    const result: AdoptSessionResult = {
      kind: 'projectLocked',
      projectId: 'auth-hardening',
      heldBy: HELD_BY,
    };
    expect(formatAdoptSessionOutcomeText(result)).toContain('session 11111111');
  });

  it('failedToStart names the project', () => {
    const result: AdoptSessionResult = { kind: 'failedToStart', projectId: 'auth-hardening' };
    expect(formatAdoptSessionOutcomeText(result)).toContain('"auth-hardening"');
  });

  it('declined says the copy was discarded', () => {
    const result: AdoptSessionResult = {
      kind: 'declined',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['AGENTS.md'],
      manifestRestore: { kind: 'unchanged' },
    };
    expect(formatAdoptSessionOutcomeText(result)).toBe(
      'Project "auth-hardening": adoption declined — the copy was discarded.',
    );
  });

  it('confirmationUnavailable says nothing was committed or discarded', () => {
    const result: AdoptSessionResult = {
      kind: 'confirmationUnavailable',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['AGENTS.md'],
      manifestRestore: { kind: 'unchanged' },
    };
    const text = formatAdoptSessionOutcomeText(result);
    expect(text).toContain('no way to');
    expect(text).toContain('Nothing was committed or discarded');
  });

  it('noChanges says nothing to commit', () => {
    const result: AdoptSessionResult = {
      kind: 'noChanges',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      manifestRestore: { kind: 'unchanged' },
    };
    expect(formatAdoptSessionOutcomeText(result)).toContain('nothing to commit');
  });

  it('commitFailed names the reason and says the copy/fork are still there (V2-T34 production defect, PO review 2026-09-25)', () => {
    const result: AdoptSessionResult = {
      kind: 'commitFailed',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['AGENTS.md'],
      reason: 'git commit failed in workspace at "/x": exit 1: hook refused',
      manifestRestore: { kind: 'unchanged' },
    };
    const text = formatAdoptSessionOutcomeText(result);
    expect(text).toContain('committing them failed');
    expect(text).toContain('hook refused');
    expect(text).toContain('still on disk');
  });

  it('adopted is short, no changed-files list repeated (the commit dialog already showed it)', () => {
    const result: AdoptSessionResult = {
      kind: 'adopted',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['AGENTS.md'],
      alreadyCommittedFiles: [],
      pendingFiles: [],
      manifestRestore: { kind: 'unchanged' },
    };
    const text = formatAdoptSessionOutcomeText(result);
    expect(text).toBe('Project "auth-hardening": adopted.');
    expect(text).not.toContain('AGENTS.md');
  });

  it('adopted names how many files the copy already committed on its own (V2-T72 item 1)', () => {
    const result: AdoptSessionResult = {
      kind: 'adopted',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: [],
      alreadyCommittedFiles: ['AGENTS.md', 'status/README.md'],
      pendingFiles: [],
      manifestRestore: { kind: 'unchanged' },
    };
    const text = formatAdoptSessionOutcomeText(result);
    expect(text).toContain('already committed 2 file(s) on its own');
  });

  it('adopted names how many files are still uncommitted, without withholding the adoption (V2-T72 item 1)', () => {
    const result: AdoptSessionResult = {
      kind: 'adopted',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: [],
      alreadyCommittedFiles: ['AGENTS.md'],
      pendingFiles: ['status/README.md'],
      manifestRestore: { kind: 'unchanged' },
    };
    const text = formatAdoptSessionOutcomeText(result);
    expect(text).toBe(
      'Project "auth-hardening": adopted. The copy had already committed 1 file(s) on its own. ' +
        '1 file(s) are still uncommitted — open the project to finish them.',
    );
  });
});

describe('isAdoptedResult', () => {
  it('true only for kind "adopted"', () => {
    expect(
      isAdoptedResult({
        kind: 'adopted',
        projectId: 'x',
        forkSessionId: 'y',
        changedFiles: [],
        alreadyCommittedFiles: [],
        pendingFiles: [],
        manifestRestore: { kind: 'unchanged' },
      }),
    ).toBe(true);
    expect(
      isAdoptedResult({
        kind: 'noChanges',
        projectId: 'x',
        forkSessionId: 'y',
        manifestRestore: { kind: 'unchanged' },
      }),
    ).toBe(false);
  });
});

describe('formatSessionNotDiscoverableText (V2-T30 item 5)', () => {
  it('names the session id that no longer resolves', () => {
    expect(formatSessionNotDiscoverableText('11111111-1111-4111-8111-111111111111')).toBe(
      'seeya: session 11111111-1111-4111-8111-111111111111 is no longer discoverable.',
    );
  });
});
