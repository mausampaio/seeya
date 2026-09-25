import { describe, expect, it } from 'vitest';
import { formatProjectOpenOutcomeText } from '../../../../packages/app/src/state/project-open-result.js';
import type { OpenProjectResult } from '@seeya-ai/engine/application/project-open.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';

const HELD_BY: ProjectLockInfo = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  pid: 4242,
  procStart: undefined,
  acquiredAt: new Date('2026-09-24T12:00:00.000Z'),
};

describe('formatProjectOpenOutcomeText (V2-T30 item 3)', () => {
  it('notFound names the project', () => {
    const result: OpenProjectResult = { kind: 'notFound', projectId: 'auth-hardening' };
    expect(formatProjectOpenOutcomeText(result)).toBe('Project "auth-hardening" not found.');
  });

  it('lockConfirmationDeclined names who holds it', () => {
    const result: OpenProjectResult = {
      kind: 'lockConfirmationDeclined',
      projectId: 'auth-hardening',
      heldBy: HELD_BY,
    };
    const text = formatProjectOpenOutcomeText(result);
    expect(text).toContain('chose not to continue');
    expect(text).toContain('session 11111111');
  });

  it('opened is short: exit code plus the final lock text, never the multi-line CLI report', () => {
    const result: OpenProjectResult = {
      kind: 'opened',
      projectId: 'auth-hardening',
      harness: 'claude',
      exitCode: 0,
      addedDirs: [],
      missing: [],
      lock: { kind: 'acquired', reclaimedStale: null },
      finalLockStatus: { kind: 'unlocked' },
    };
    const text = formatProjectOpenOutcomeText(result);
    expect(text).toBe('Project "auth-hardening" closed (exit code 0). Lock: unlocked.');
    expect(text).not.toContain('\n');
  });
});
