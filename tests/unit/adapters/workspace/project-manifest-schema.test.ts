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

  it("parses a fully populated manifest, the rumo's own example shape", () => {
    const document = {
      ...MINIMAL_DOCUMENT,
      name: 'Auth hardening',
      defaultHarness: 'claude',
      repositories: [
        { name: 'api', remote: 'https://example.com/acme/app-api.git' },
        { name: 'frontend', remote: 'https://example.com/acme/app-web.git' },
      ],
      trackers: [{ type: 'gitlab', project: 'acme/app', labels: ['security'] }],
    };
    const manifest = parseProjectManifestDocument(document);
    expect(manifest.defaultHarness).toBe('claude');
    expect(manifest.repositories).toEqual([
      { name: 'api', remote: 'https://example.com/acme/app-api.git' },
      { name: 'frontend', remote: 'https://example.com/acme/app-web.git' },
    ]);
    expect(manifest.trackers).toEqual([
      { type: 'gitlab', project: 'acme/app', labels: ['security'] },
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
      repositories: [{ name: 'api', remote: 'https://example.com/a.git', addedBy: 'someone' }],
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
});

describe('serializeProjectManifestDocument', () => {
  it('round-trips through parse', () => {
    const manifest = parseProjectManifestDocument(MINIMAL_DOCUMENT);
    const serialized = serializeProjectManifestDocument(manifest);
    expect(parseProjectManifestDocument(serialized)).toEqual(manifest);
  });

  it('writes the current schemaVersion', () => {
    const manifest = parseProjectManifestDocument(MINIMAL_DOCUMENT);
    expect(serializeProjectManifestDocument(manifest).schemaVersion).toBe(
      PROJECT_MANIFEST_SCHEMA_VERSION,
    );
  });
});
