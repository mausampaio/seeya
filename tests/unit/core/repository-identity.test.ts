/**
 * `normalizeRepositoryIdentity`/`repositoryIdentitiesEqual` (V2-T28,
 * `packages/engine/src/core/repository-identity.ts`) — the pure function `docs/PLANO-DE-ENTREGA.md`
 * V2-T28 item 1 asks for explicitly: "função pura, com teste das duas formas [SSH e HTTPS] e de um
 * provedor desconhecido (normalização conservadora)".
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeRepositoryIdentity,
  repositoryIdentitiesEqual,
} from '@seeya-ai/engine/core/repository-identity.js';

describe('normalizeRepositoryIdentity', () => {
  it('parses the SSH scp-like form', () => {
    expect(normalizeRepositoryIdentity('git@host:acme-widgets/app-api.git')).toEqual({
      host: 'host',
      owner: 'acme-widgets',
      repository: 'app-api',
    });
  });

  it('parses the HTTPS form to the SAME identity as the SSH form of the same repository', () => {
    const ssh = normalizeRepositoryIdentity('git@host:acme-widgets/app-api.git');
    const https = normalizeRepositoryIdentity('https://host/acme-widgets/app-api.git');
    expect(https).toEqual(ssh);
  });

  it('HTTPS without a trailing .git normalizes the same way', () => {
    expect(normalizeRepositoryIdentity('https://host/acme-widgets/app-api')).toEqual({
      host: 'host',
      owner: 'acme-widgets',
      repository: 'app-api',
    });
  });

  it('an unknown, self-hosted provider with a nested group still normalizes — conservative, not provider-specific', () => {
    expect(
      normalizeRepositoryIdentity('https://internal-git-host:8443/team/sub/service.git'),
    ).toEqual({
      host: 'internal-git-host',
      owner: 'team/sub',
      repository: 'service',
    });
  });

  it('an unknown provider over ssh:// (not the scp-like shorthand) also normalizes', () => {
    expect(normalizeRepositoryIdentity('ssh://git@internal-git-host/team/service.git')).toEqual({
      host: 'internal-git-host',
      owner: 'team',
      repository: 'service',
    });
  });

  it('lowercases the host but keeps owner/repository case', () => {
    expect(normalizeRepositoryIdentity('git@HOST:Acme-Widgets/App-Api.git')).toEqual({
      host: 'host',
      owner: 'Acme-Widgets',
      repository: 'App-Api',
    });
  });

  it('a bare local path (no host, no scheme) is not a remote — null, not a guess', () => {
    expect(normalizeRepositoryIdentity('./local-only-repo')).toBeNull();
  });

  it('a Windows absolute path typed by mistake as a remote is not mistaken for scp-like syntax', () => {
    expect(normalizeRepositoryIdentity('C:\\code\\app-api')).toBeNull();
  });

  it('an empty string is null', () => {
    expect(normalizeRepositoryIdentity('')).toBeNull();
    expect(normalizeRepositoryIdentity('   ')).toBeNull();
  });

  it('a path with only one segment (no owner) is null — cannot split owner from repository', () => {
    expect(normalizeRepositoryIdentity('https://host/just-one-segment')).toBeNull();
  });
});

describe('repositoryIdentitiesEqual', () => {
  it('true for identical identities', () => {
    const identity = { host: 'host', owner: 'acme-widgets', repository: 'app-api' };
    expect(repositoryIdentitiesEqual(identity, { ...identity })).toBe(true);
  });

  it('false when any single field differs', () => {
    const base = { host: 'host', owner: 'acme-widgets', repository: 'app-api' };
    expect(repositoryIdentitiesEqual(base, { ...base, host: 'other-host' })).toBe(false);
    expect(repositoryIdentitiesEqual(base, { ...base, owner: 'other-owner' })).toBe(false);
    expect(repositoryIdentitiesEqual(base, { ...base, repository: 'other-repo' })).toBe(false);
  });
});
