import { describe, expect, it } from 'vitest';
import {
  formatAdoptSessionOutcomeText,
  isAdoptedResult,
} from '../../../../packages/app/src/state/adopt-session-result.js';
import type { AdoptSessionResult } from '@seeya-ai/engine/application/project-adopt.js';

describe('formatAdoptSessionOutcomeText (V2-T30 item 5)', () => {
  it('noChanges says nothing to commit', () => {
    const result: AdoptSessionResult = {
      kind: 'noChanges',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
    };
    expect(formatAdoptSessionOutcomeText(result)).toContain('nothing to commit');
  });

  it('adopted is short, no changed-files list repeated (the commit dialog already showed it)', () => {
    const result: AdoptSessionResult = {
      kind: 'adopted',
      projectId: 'auth-hardening',
      forkSessionId: '22222222-2222-4222-8222-222222222222',
      changedFiles: ['AGENTS.md'],
    };
    const text = formatAdoptSessionOutcomeText(result);
    expect(text).toBe('Project "auth-hardening": adopted.');
    expect(text).not.toContain('AGENTS.md');
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
      }),
    ).toBe(true);
    expect(isAdoptedResult({ kind: 'noChanges', projectId: 'x', forkSessionId: 'y' })).toBe(false);
  });
});
