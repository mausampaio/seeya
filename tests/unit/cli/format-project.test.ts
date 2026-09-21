import { describe, expect, it } from 'vitest';
import {
  formatCreateProjectReport,
  formatProjectsReport,
  formatShowProjectReport,
} from '../../../packages/cli/src/format-project.js';
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';

const EMPTY_MANIFEST: ProjectManifest = {
  id: 'auth-hardening',
  name: 'auth-hardening',
  defaultHarness: null,
  repositories: [],
  trackers: [],
};

describe('formatCreateProjectReport', () => {
  it('invalidId names the id and the allowed shape', () => {
    const text = formatCreateProjectReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
    expect(text).toContain('lowercase');
  });

  it('alreadyExists names the project', () => {
    const text = formatCreateProjectReport({ kind: 'alreadyExists', projectId: 'auth-hardening' });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('already exists');
  });

  it('created names the project and the path', () => {
    const text = formatCreateProjectReport({
      kind: 'created',
      projectId: 'auth-hardening',
      root: 'C:\\seeya-home\\workspace\\auth-hardening',
    });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('C:\\seeya-home\\workspace\\auth-hardening');
  });
});

describe('formatProjectsReport', () => {
  it('says "no projects" honestly when the workspace is empty', () => {
    const text = formatProjectsReport({ root: 'C:\\workspace', manifests: [], rejected: [] });
    expect(text).toContain('0 projects found');
    expect(text).not.toContain('Ignored entries');
  });

  it('lists each project with its default harness and repositories, D-025 says "not set" not a guess', () => {
    const text = formatProjectsReport({
      root: 'C:\\workspace',
      manifests: [EMPTY_MANIFEST],
      rejected: [],
    });
    expect(text).toContain('1 project found');
    expect(text).toContain('auth-hardening');
    expect(text).toContain('default harness: not set');
    expect(text).toContain('repositories: none');
  });

  it('D-022: both sides — a summary that mentions ignored entries and lists the reason', () => {
    const text = formatProjectsReport({
      root: 'C:\\workspace',
      manifests: [],
      rejected: [{ file: 'C:\\workspace\\broken\\seeya.json', raw: undefined, reason: 'bad json' }],
    });
    expect(text).toContain('0 projects found, 1 entry ignored');
    expect(text).toContain('Ignored entries:');
    expect(text).toContain('bad json');
  });
});

describe('formatShowProjectReport', () => {
  it('invalidId names the id', () => {
    const text = formatShowProjectReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
  });

  it('notFound names the id', () => {
    const text = formatShowProjectReport({ kind: 'notFound', projectId: 'ghost' });
    expect(text).toContain('"ghost"');
    expect(text).toContain('not found');
  });

  it('found shows path, default harness, repositories and trackers', () => {
    const text = formatShowProjectReport({
      kind: 'found',
      manifest: {
        ...EMPTY_MANIFEST,
        defaultHarness: 'claude',
        repositories: [{ name: 'api', remote: 'https://example.com/a.git' }],
        trackers: [{ type: 'gitlab', project: 'acme/app' }],
      },
      root: 'C:\\workspace\\auth-hardening',
    });
    expect(text).toContain('C:\\workspace\\auth-hardening');
    expect(text).toContain('default harness: claude');
    expect(text).toContain('repositories: api');
    expect(text).toContain('trackers: gitlab:acme/app');
  });
});
