/**
 * `adapters/workspace/manifest-write-env.ts` (V2-T73 item 1). Pure string/env shaping — the real
 * end-to-end proof (a real `git commit` authorized through this exact mechanism, and refused
 * without it) is `tests/integration/workspace/commit-msg-hook.test.ts`'s own "manifest-ownership
 * guard" suite.
 */
import { describe, expect, it } from 'vitest';
import {
  MANIFEST_WRITE_AUTHORIZED_ENV_VAR,
  buildManifestWriteEnv,
  readManifestWriteAuthorized,
} from '@seeya-ai/engine/adapters/workspace/manifest-write-env.js';

describe('buildManifestWriteEnv', () => {
  it('sets the marker when authorized', () => {
    expect(buildManifestWriteEnv(true)).toEqual({ [MANIFEST_WRITE_AUTHORIZED_ENV_VAR]: '1' });
  });

  it('returns an empty object when not authorized', () => {
    expect(buildManifestWriteEnv(false)).toEqual({});
  });
});

describe('readManifestWriteAuthorized', () => {
  it('reads true back for the exact literal "1"', () => {
    expect(readManifestWriteAuthorized({ [MANIFEST_WRITE_AUTHORIZED_ENV_VAR]: '1' })).toBe(true);
  });

  it('reads false when the variable is missing entirely', () => {
    expect(readManifestWriteAuthorized({})).toBe(false);
  });

  it('reads false for any value other than the exact literal "1" (never inferred from mere presence)', () => {
    expect(readManifestWriteAuthorized({ [MANIFEST_WRITE_AUTHORIZED_ENV_VAR]: 'true' })).toBe(
      false,
    );
    expect(readManifestWriteAuthorized({ [MANIFEST_WRITE_AUTHORIZED_ENV_VAR]: '' })).toBe(false);
  });

  it('round-trips through buildManifestWriteEnv', () => {
    expect(readManifestWriteAuthorized(buildManifestWriteEnv(true))).toBe(true);
    expect(readManifestWriteAuthorized(buildManifestWriteEnv(false))).toBe(false);
  });
});
