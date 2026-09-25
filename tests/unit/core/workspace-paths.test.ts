/**
 * `core/workspace-paths.ts` (V2-T34 items 1/3). Pure — no I/O.
 */
import { describe, expect, it } from 'vitest';
import { distinctProjectDirs, firstPathSegment } from '@seeya-ai/engine/core/workspace-paths.js';

describe('firstPathSegment', () => {
  it('returns the project directory name for a nested path', () => {
    expect(firstPathSegment('auth-hardening/status/current.md')).toBe('auth-hardening');
  });

  it('returns null for a path at the workspace root (D-025: no project claimed)', () => {
    expect(firstPathSegment('.gitignore')).toBeNull();
  });

  it('normalizes backslashes before splitting', () => {
    expect(firstPathSegment('auth-hardening\\status\\current.md')).toBe('auth-hardening');
  });
});

describe('distinctProjectDirs', () => {
  it('lists each project touched exactly once', () => {
    expect(
      distinctProjectDirs([
        'auth-hardening/status/current.md',
        'auth-hardening/AGENTS.md',
        'billing-v2/INDEX.md',
      ]),
    ).toEqual(['auth-hardening', 'billing-v2']);
  });

  it('ignores workspace-root files', () => {
    expect(distinctProjectDirs(['.gitignore', 'auth-hardening/AGENTS.md'])).toEqual([
      'auth-hardening',
    ]);
  });

  it('returns an empty array when nothing touches a project', () => {
    expect(distinctProjectDirs(['.gitignore'])).toEqual([]);
  });
});
