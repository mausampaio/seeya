import { describe, expect, it } from 'vitest';
import {
  parseProjectManifestDocument,
  PROJECT_MANIFEST_SCHEMA_VERSION,
  serializeProjectManifestDocument,
} from '@seeya-ai/engine/adapters/workspace/project-manifest-schema.js';

const MINIMAL_DOCUMENT = {
  schemaVersion: 1,
  id: 'auth-hardening',
  name: 'auth-hardening',
  defaultHarness: null,
  repositories: [],
  trackers: [],
};

const IDENTITY = { host: 'host', owner: 'acme-widgets', repository: 'app-api' };

describe('parseProjectManifestDocument', () => {
  it('parses a minimal, empty manifest', () => {
    expect(parseProjectManifestDocument(MINIMAL_DOCUMENT)).toEqual({
      id: 'auth-hardening',
      name: 'auth-hardening',
      defaultHarness: null,
      repositories: [],
      trackers: [],
    });
  });

  it('parses a fully populated manifest, both repository shapes (V2-T28)', () => {
    const document = {
      ...MINIMAL_DOCUMENT,
      name: 'Auth hardening',
      defaultHarness: 'claude',
      repositories: [
        { name: 'api', remote: 'https://host/acme-widgets/app-api.git', identity: IDENTITY },
        { name: 'legacy-scripts', remote: null, identity: null },
      ],
      trackers: [{ type: 'gitlab', project: 'acme/app', labels: ['security'] }],
    };
    const manifest = parseProjectManifestDocument(document);
    expect(manifest.defaultHarness).toBe('claude');
    expect(manifest.repositories).toEqual([
      {
        hasRemote: true,
        name: 'api',
        remote: 'https://host/acme-widgets/app-api.git',
        identity: IDENTITY,
      },
      { hasRemote: false, name: 'legacy-scripts' },
    ]);
    expect(manifest.trackers).toEqual([
      { type: 'gitlab', project: 'acme/app', labels: ['security'] },
    ]);
  });

  it('a with-remote entry whose identity was never given defaults to null, never omitted (D-021)', () => {
    const document = {
      ...MINIMAL_DOCUMENT,
      repositories: [{ name: 'api', remote: 'https://host/acme-widgets/app-api.git' }],
    };
    const manifest = parseProjectManifestDocument(document);
    expect(manifest.repositories).toEqual([
      {
        hasRemote: true,
        name: 'api',
        remote: 'https://host/acme-widgets/app-api.git',
        identity: null,
      },
    ]);
  });

  it('omits labels on a tracker entry that never had any (never invents an empty array)', () => {
    const document = {
      ...MINIMAL_DOCUMENT,
      trackers: [{ type: 'gitlab', project: 'acme/app' }],
    };
    const manifest = parseProjectManifestDocument(document);
    expect(manifest.trackers).toEqual([{ type: 'gitlab', project: 'acme/app' }]);
    expect(manifest.trackers[0]).not.toHaveProperty('labels');
  });

  it('tolerates an unknown top-level field (D-021 — this file is meant to be hand-edited)', () => {
    const document = { ...MINIMAL_DOCUMENT, priority: 'high' };
    expect(() => parseProjectManifestDocument(document)).not.toThrow();
  });

  it('tolerates an unknown field on a repository entry', () => {
    const document = {
      ...MINIMAL_DOCUMENT,
      repositories: [
        {
          name: 'api',
          remote: 'https://host/acme-widgets/a.git',
          identity: null,
          addedBy: 'someone',
        },
      ],
    };
    expect(() => parseProjectManifestDocument(document)).not.toThrow();
  });

  it('throws with the field path when "id" is missing', () => {
    const { id, ...rest } = MINIMAL_DOCUMENT;
    void id;
    expect(() => parseProjectManifestDocument(rest)).toThrow(/id/);
  });

  it('throws when "defaultHarness" is an empty string instead of null or a real name', () => {
    const document = { ...MINIMAL_DOCUMENT, defaultHarness: '' };
    expect(() => parseProjectManifestDocument(document)).toThrow();
  });

  it('throws when "repositories" is not an array', () => {
    const document = { ...MINIMAL_DOCUMENT, repositories: 'none' };
    expect(() => parseProjectManifestDocument(document)).toThrow();
  });

  it('throws when a repository entry has an identity but remote is null (D-025: no identity without a source)', () => {
    const document = {
      ...MINIMAL_DOCUMENT,
      repositories: [{ name: 'orphan', remote: null, identity: IDENTITY }],
    };
    expect(() => parseProjectManifestDocument(document)).toThrow();
  });
});

describe('serializeProjectManifestDocument', () => {
  it('round-trips through parse, both repository shapes', () => {
    const document = {
      ...MINIMAL_DOCUMENT,
      repositories: [
        { name: 'api', remote: 'https://host/acme-widgets/app-api.git', identity: IDENTITY },
        { name: 'legacy-scripts', remote: null, identity: null },
      ],
    };
    const manifest = parseProjectManifestDocument(document);
    const serialized = serializeProjectManifestDocument(manifest);
    expect(parseProjectManifestDocument(serialized)).toEqual(manifest);
  });

  it('writes the current schemaVersion', () => {
    const manifest = parseProjectManifestDocument(MINIMAL_DOCUMENT);
    expect(serializeProjectManifestDocument(manifest).schemaVersion).toBe(
      PROJECT_MANIFEST_SCHEMA_VERSION,
    );
  });

  it('serializes a without-remote repository as remote: null, identity: null — never omitted', () => {
    const manifest = parseProjectManifestDocument({
      ...MINIMAL_DOCUMENT,
      repositories: [{ name: 'legacy-scripts', remote: null, identity: null }],
    });
    const serialized = serializeProjectManifestDocument(manifest);
    expect(serialized.repositories).toEqual([
      { name: 'legacy-scripts', remote: null, identity: null },
    ]);
  });
});
