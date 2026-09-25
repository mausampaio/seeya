import { describe, expect, it } from 'vitest';
import { resolveChosenAdoptProjectId } from '../../../../packages/app/src/state/adopt-picker.js';

describe('resolveChosenAdoptProjectId (V2-T30 item 5)', () => {
  it('uses the existing-project selection when "new project" is not chosen', () => {
    expect(resolveChosenAdoptProjectId(false, 'auth-hardening', '')).toBe('auth-hardening');
  });

  it('uses the typed new-project id, trimmed, when "new project" is chosen', () => {
    expect(resolveChosenAdoptProjectId(true, 'auth-hardening', '  new-project  ')).toBe(
      'new-project',
    );
  });

  it('an empty existing-project selection (no projects yet) is null, never a guess', () => {
    expect(resolveChosenAdoptProjectId(false, '', 'ignored')).toBeNull();
  });

  it('a blank/whitespace-only typed id is null', () => {
    expect(resolveChosenAdoptProjectId(true, 'ignored', '   ')).toBeNull();
  });
});
