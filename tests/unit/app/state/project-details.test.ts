import { describe, expect, it } from 'vitest';
import {
  buildProjectDetailsData,
  collectRepositoryPaths,
  resolveWriteBlockedReason,
  type ProjectDetailsInputs,
} from '../../../../packages/app/src/state/project-details.js';
import type {
  AdoptionRecord,
  ProjectManifest,
  RepositoryMapEntry,
} from '@seeya-ai/engine/core/types.js';

const IDENTITY = { host: 'example.com', owner: 'acme', repository: 'api' };

function manifest(overrides: Partial<ProjectManifest> = {}): ProjectManifest {
  return {
    id: 'auth-hardening',
    name: 'Auth hardening',
    defaultHarness: null,
    repositories: [],
    trackers: [],
    ...overrides,
  };
}

function inputs(overrides: Partial<ProjectDetailsInputs> = {}): ProjectDetailsInputs {
  return {
    manifest: manifest(),
    dir: '/ws/auth-hardening',
    lockStatus: { kind: 'unlocked' },
    lockHeldByText: '',
    repositoryMap: [],
    existingPaths: new Set(),
    adoptions: [],
    fileCount: 4,
    ...overrides,
  };
}

const WITH_REMOTE = {
  hasRemote: true as const,
  name: 'api',
  remote: 'git@example.com:acme/api.git',
  identity: IDENTITY,
};
const WITHOUT_REMOTE = { hasRemote: false as const, name: 'notes' };

const MAP: readonly RepositoryMapEntry[] = [
  { hasIdentity: true, identity: IDENTITY, path: '/code/api' },
  { hasIdentity: false, projectId: 'auth-hardening', name: 'notes', path: '/code/notes' },
];

describe('buildProjectDetailsData (V2-T83)', () => {
  it('carries the id, name, folder and file count of the project', () => {
    const data = buildProjectDetailsData(inputs());
    expect(data).toMatchObject({
      kind: 'found',
      projectId: 'auth-hardening',
      name: 'Auth hardening',
      dir: '/ws/auth-hardening',
      fileCount: 4,
      repositories: [],
      adoptions: [],
    });
  });

  it('a repository with a remote and a mapped, existing path is on this device; one without a remote reads "remote: null"', () => {
    const data = buildProjectDetailsData(
      inputs({
        manifest: manifest({ repositories: [WITH_REMOTE, WITHOUT_REMOTE] }),
        repositoryMap: MAP,
        existingPaths: new Set(['/code/api', '/code/notes']),
      }),
    );
    if (data.kind !== 'found') throw new Error(JSON.stringify(data));
    expect(data.repositories).toEqual([
      {
        name: 'api',
        remote: 'git@example.com:acme/api.git',
        localPath: { kind: 'onThisDevice', path: '/code/api' },
      },
      { name: 'notes', remote: null, localPath: { kind: 'onThisDevice', path: '/code/notes' } },
    ]);
  });

  it('a repository the map has no entry for is "not on this device" (D-025)', () => {
    const data = buildProjectDetailsData(
      inputs({ manifest: manifest({ repositories: [WITH_REMOTE] }), repositoryMap: [] }),
    );
    if (data.kind !== 'found') throw new Error(JSON.stringify(data));
    expect(data.repositories[0]?.localPath).toEqual({ kind: 'notOnThisDevice' });
  });

  it('a mapped path whose directory is gone is also "not on this device", never the dead path', () => {
    const data = buildProjectDetailsData(
      inputs({
        manifest: manifest({ repositories: [WITH_REMOTE] }),
        repositoryMap: MAP,
        existingPaths: new Set(),
      }),
    );
    if (data.kind !== 'found') throw new Error(JSON.stringify(data));
    expect(data.repositories[0]?.localPath).toEqual({ kind: 'notOnThisDevice' });
  });

  it('a no-remote repository is only resolved by THIS project (the map entry is project-scoped)', () => {
    const otherProjectsEntry: RepositoryMapEntry = {
      hasIdentity: false,
      projectId: 'other',
      name: 'notes',
      path: '/code/other-notes',
    };
    const data = buildProjectDetailsData(
      inputs({
        manifest: manifest({ repositories: [WITHOUT_REMOTE] }),
        repositoryMap: [otherProjectsEntry],
        existingPaths: new Set(['/code/other-notes']),
      }),
    );
    if (data.kind !== 'found') throw new Error(JSON.stringify(data));
    expect(data.repositories[0]?.localPath).toEqual({ kind: 'notOnThisDevice' });
  });

  it("keeps only this project's adoptions, with short ids and the adoption instant", () => {
    const adoptedAt = new Date('2026-09-24T10:00:00.000Z');
    const adoptions: AdoptionRecord[] = [
      {
        originalSessionId: 'aaaaaaaa-1111-4111-8111-111111111111',
        forkSessionId: 'bbbbbbbb-2222-4222-8222-222222222222',
        projectId: 'auth-hardening',
        adoptedAt,
      },
      {
        originalSessionId: 'cccccccc-3333-4333-8333-333333333333',
        forkSessionId: 'dddddddd-4444-4444-8444-444444444444',
        projectId: 'someone-else',
        adoptedAt,
      },
    ];
    const data = buildProjectDetailsData(inputs({ adoptions }));
    if (data.kind !== 'found') throw new Error(JSON.stringify(data));
    expect(data.adoptions).toEqual([
      {
        originalSessionId: 'aaaaaaaa-1111-4111-8111-111111111111',
        forkSessionId: 'bbbbbbbb-2222-4222-8222-222222222222',
        originalDisplayId: 'aaaaaaaa',
        forkDisplayId: 'bbbbbbbb',
        adoptedAt,
      },
    ]);
  });

  it('a live lock holder blocks writes; unlocked and stale locks do not (a stale one is reclaimed)', () => {
    const holder = { sessionId: 's', pid: 1, procStart: undefined, acquiredAt: new Date(0) };
    const live = buildProjectDetailsData(
      inputs({
        lockStatus: { kind: 'heldByLiveSession', lock: holder },
        lockHeldByText: 'session s (pid 1)',
      }),
    );
    const stale = buildProjectDetailsData(
      inputs({ lockStatus: { kind: 'staleLock', lock: holder } }),
    );
    const free = buildProjectDetailsData(inputs());
    if (live.kind !== 'found' || stale.kind !== 'found' || free.kind !== 'found') {
      throw new Error('expected found');
    }
    expect(live.writeAccess).toEqual({ kind: 'blocked', heldByText: 'session s (pid 1)' });
    expect(stale.writeAccess).toEqual({ kind: 'open' });
    expect(free.writeAccess).toEqual({ kind: 'open' });
  });
});

describe('collectRepositoryPaths', () => {
  it('lists the mapped path of each associated repository, skipping the unmapped one', () => {
    expect(
      collectRepositoryPaths(
        'auth-hardening',
        [WITH_REMOTE, WITHOUT_REMOTE, { hasRemote: false, name: 'unmapped' }],
        MAP,
      ),
    ).toEqual(['/code/api', '/code/notes']);
  });
});

describe('resolveWriteBlockedReason', () => {
  it('open access has no reason', () => {
    expect(resolveWriteBlockedReason({ kind: 'open' }, null)).toBeUndefined();
  });

  it('blocked while the project is open in a tab of THIS window says to close the tab', () => {
    expect(
      resolveWriteBlockedReason(
        { kind: 'blocked', heldByText: 'session s (pid 1)' },
        { kind: 'openHere', tabId: 'tab-1' },
      ),
    ).toBe('This project is open in a tab. Close that tab to change it from here.');
  });

  it('blocked by another session names the holder', () => {
    expect(
      resolveWriteBlockedReason(
        { kind: 'blocked', heldByText: 'session s (pid 1) since X' },
        { kind: 'lockedByOther', holderDisplaySessionId: 's' },
      ),
    ).toBe(
      'Locked — held by session s (pid 1) since X. Changes are disabled until the lock is released.',
    );
  });

  it('blocked with no panel row falls back to the holder wording', () => {
    expect(resolveWriteBlockedReason({ kind: 'blocked', heldByText: 'someone' }, null)).toContain(
      'held by someone',
    );
  });
});
