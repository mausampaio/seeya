import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../../../packages/app/src/text/messages.js';

describe('MESSAGES', () => {
  it('every plain string is non-empty (concentrated, but never accidentally blank)', () => {
    for (const [key, value] of Object.entries(MESSAGES)) {
      if (typeof value === 'string') {
        expect(value.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('tabExited renders the exit code', () => {
    expect(MESSAGES.tabExited(0)).toBe('exited (code 0)');
    expect(MESSAGES.tabExited(130)).toBe('exited (code 130)');
  });
});
