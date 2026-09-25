import { describe, expect, it } from 'vitest';
import { formatCreateProjectErrorText } from '../../../../packages/app/src/state/create-project-result.js';

describe('formatCreateProjectErrorText (V2-T30 item 4)', () => {
  it('invalidId names the offending value and the expected shape', () => {
    const text = formatCreateProjectErrorText({ kind: 'invalidId', projectId: 'Not Valid!' });
    expect(text).toBe(
      '"Not Valid!" is not a valid project id — use lowercase letters, digits and hyphens only.',
    );
  });

  it('alreadyExists names the project', () => {
    const text = formatCreateProjectErrorText({
      kind: 'alreadyExists',
      projectId: 'auth-hardening',
    });
    expect(text).toBe('Project "auth-hardening" already exists.');
  });
});
