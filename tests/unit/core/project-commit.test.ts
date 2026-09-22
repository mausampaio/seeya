/**
 * `core/project-commit.ts` (V2-T33, D-047 item 4). Pure — no I/O.
 */
import { describe, expect, it } from 'vitest';
import {
  PROJECT_ID_TRAILER_KEY,
  SESSION_ID_TRAILER_KEY,
  UNKNOWN_SESSION_TRAILER_VALUE,
  buildProjectCommitMessage,
} from '@seeya-ai/engine/core/project-commit.js';

describe('buildProjectCommitMessage', () => {
  it('appends both trailers, blank line separated, subject first', () => {
    const message = buildProjectCommitMessage(
      'Create project auth-hardening',
      'auth-hardening',
      'session-abc',
    );
    expect(message).toBe(
      'Create project auth-hardening\n\nSeeya-Project-Id: auth-hardening\nSeeya-Session-Id: session-abc',
    );
  });

  it('a missing sessionId becomes the literal "unknown", never a fabricated identity (D-025)', () => {
    const message = buildProjectCommitMessage('Create project x', 'x', undefined);
    expect(message).toContain(`${SESSION_ID_TRAILER_KEY}: ${UNKNOWN_SESSION_TRAILER_VALUE}`);
    expect(message).not.toContain('undefined');
  });

  it('the projectId trailer always names the project, independent of the subject text', () => {
    const message = buildProjectCommitMessage(
      'Add repository app-api to project auth-hardening',
      'auth-hardening',
      undefined,
    );
    expect(message).toContain(`${PROJECT_ID_TRAILER_KEY}: auth-hardening`);
  });
});
