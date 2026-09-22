/**
 * `repositoryMapEntriesMatch`/`upsertRepositoryMapEntry`/`findRepositoryMapEntry` (V2-T28,
 * `packages/engine/src/core/repository-map.ts`) — pure over `RepositoryMapEntry[]`.
 */
import { describe, expect, it } from 'vitest';
import {
  findRepositoryMapEntry,
  repositoryMapEntriesMatch,
  upsertRepositoryMapEntry,
} from '@seeya-ai/engine/core/repository-map.js';
import type { AssociatedRepository, RepositoryMapEntry } from '@seeya-ai/engine/core/types.js';

const IDENTITY = { host: 'host', owner: 'acme-widgets', repository: 'app-api' };
const WITH_IDENTITY: RepositoryMapEntry = { hasIdentity: true, identity: IDENTITY, path: '/a' };
const WITHOUT_IDENTITY: RepositoryMapEntry = {
  hasIdentity: false,
  projectId: 'auth-hardening',
  name: 'legacy-scripts',
  path: '/b',
};

describe('repositoryMapEntriesMatch', () => {
  it('true for two with-identity entries carrying the same identity', () => {
    expect(repositoryMapEntriesMatch(WITH_IDENTITY, { ...WITH_IDENTITY, path: '/different' })).toBe(
      true,
    );
  });

  it('false for two with-identity entries carrying different identities', () => {
    const other: RepositoryMapEntry = {
      hasIdentity: true,
      identity: { ...IDENTITY, repository: 'app-web' },
      path: '/a',
    };
    expect(repositoryMapEntriesMatch(WITH_IDENTITY, other)).toBe(false);
  });

  it('true for two without-identity entries with the same projectId+name', () => {
    expect(
      repositoryMapEntriesMatch(WITHOUT_IDENTITY, { ...WITHOUT_IDENTITY, path: '/different' }),
    ).toBe(true);
  });

  it('false for two without-identity entries with a different projectId or name', () => {
    expect(
      repositoryMapEntriesMatch(WITHOUT_IDENTITY, { ...WITHOUT_IDENTITY, projectId: 'other' }),
    ).toBe(false);
    expect(
      repositoryMapEntriesMatch(WITHOUT_IDENTITY, { ...WITHOUT_IDENTITY, name: 'other' }),
    ).toBe(false);
  });

  it('an entry with an identity never matches one without — disjoint key spaces', () => {
    expect(repositoryMapEntriesMatch(WITH_IDENTITY, WITHOUT_IDENTITY)).toBe(false);
  });
});

describe('upsertRepositoryMapEntry', () => {
  it('appends when there is no existing match', () => {
    expect(upsertRepositoryMapEntry([], WITH_IDENTITY)).toEqual([WITH_IDENTITY]);
  });

  it('replaces the existing entry for the same key, never duplicating it', () => {
    const updated = { ...WITH_IDENTITY, path: '/updated' };
    const result = upsertRepositoryMapEntry([WITH_IDENTITY], updated);
    expect(result).toEqual([updated]);
  });

  it('leaves entries for a different key untouched', () => {
    const result = upsertRepositoryMapEntry([WITHOUT_IDENTITY], WITH_IDENTITY);
    expect(result).toEqual([WITHOUT_IDENTITY, WITH_IDENTITY]);
  });
});

describe('findRepositoryMapEntry', () => {
  const withRemote: AssociatedRepository = {
    hasRemote: true,
    name: 'api',
    remote: 'git@host:acme-widgets/app-api.git',
    identity: IDENTITY,
  };
  const withoutRemote: AssociatedRepository = { hasRemote: false, name: 'legacy-scripts' };

  it('finds a with-remote repository by identity alone, regardless of projectId', () => {
    const entries = [WITH_IDENTITY];
    expect(findRepositoryMapEntry(entries, 'some-other-project', withRemote)).toEqual(
      WITH_IDENTITY,
    );
  });

  it('finds a without-remote repository only by projectId+name', () => {
    const entries = [WITHOUT_IDENTITY];
    expect(findRepositoryMapEntry(entries, 'auth-hardening', withoutRemote)).toEqual(
      WITHOUT_IDENTITY,
    );
  });

  it('does not find a without-remote repository under a different projectId', () => {
    const entries = [WITHOUT_IDENTITY];
    expect(findRepositoryMapEntry(entries, 'different-project', withoutRemote)).toBeNull();
  });

  it('null when nothing matches', () => {
    expect(findRepositoryMapEntry([], 'auth-hardening', withRemote)).toBeNull();
  });

  it('a with-remote repository whose identity failed to normalize falls back to the without-identity lookup', () => {
    const unresolvable: AssociatedRepository = {
      hasRemote: true,
      name: 'legacy-scripts',
      remote: 'some-unparseable-value',
      identity: null,
    };
    const entries = [WITHOUT_IDENTITY];
    expect(findRepositoryMapEntry(entries, 'auth-hardening', unresolvable)).toEqual(
      WITHOUT_IDENTITY,
    );
  });
});
