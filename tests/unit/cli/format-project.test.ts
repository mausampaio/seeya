import { describe, expect, it } from 'vitest';
import {
  formatAddRepoReport,
  formatCreateProjectReport,
  formatMissingRepositoryLines,
  formatOpenProjectReport,
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
        repositories: [
          {
            hasRemote: true,
            name: 'api',
            remote: 'https://host/acme-widgets/a.git',
            identity: null,
          },
        ],
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

describe('formatAddRepoReport', () => {
  it('invalidId names the id', () => {
    const text = formatAddRepoReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
  });

  it('projectNotFound names the id', () => {
    const text = formatAddRepoReport({ kind: 'projectNotFound', projectId: 'ghost' });
    expect(text).toContain('"ghost" not found');
  });

  it('pathNotFound names the path', () => {
    const text = formatAddRepoReport({ kind: 'pathNotFound', path: 'C:\\code\\missing' });
    expect(text).toContain('"C:\\code\\missing" does not exist');
  });

  it('alreadyAssociated names both the repository and the project', () => {
    const text = formatAddRepoReport({
      kind: 'alreadyAssociated',
      projectId: 'auth-hardening',
      name: 'app-api',
    });
    expect(text).toContain('"app-api"');
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('already associated');
  });

  it('added with a remote names the repository and the project, no "no remote" note', () => {
    const text = formatAddRepoReport({
      kind: 'added',
      projectId: 'auth-hardening',
      name: 'app-api',
      hasRemote: true,
    });
    expect(text).toContain('Linked repository "app-api" to project "auth-hardening"');
    expect(text).not.toContain('no remote');
  });

  it('added without a remote says so — D-025, never silent', () => {
    const text = formatAddRepoReport({
      kind: 'added',
      projectId: 'auth-hardening',
      name: 'legacy-scripts',
      hasRemote: false,
    });
    expect(text).toContain('no remote');
    expect(text).toContain('only resolvable on this device');
  });
});

describe('formatMissingRepositoryLines', () => {
  it('notInDeviceMap points at add-repo with the project id already filled in', () => {
    const lines = formatMissingRepositoryLines('auth-hardening', [
      { name: 'frontend', reason: 'notInDeviceMap' },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"frontend"');
    expect(lines[0]).toContain('not registered on this device');
    expect(lines[0]).toContain('seeya project add-repo auth-hardening <path>');
  });

  it('pathMissing names both the old path and how to update it', () => {
    const lines = formatMissingRepositoryLines('auth-hardening', [
      { name: 'frontend', reason: 'pathMissing', path: 'C:\\code\\app-web' },
    ]);
    expect(lines[0]).toContain('"C:\\code\\app-web"');
    expect(lines[0]).toContain('no longer exists');
  });

  it('empty list for no missing repositories', () => {
    expect(formatMissingRepositoryLines('auth-hardening', [])).toEqual([]);
  });
});

describe('formatOpenProjectReport', () => {
  it('invalidId names the id', () => {
    const text = formatOpenProjectReport({ kind: 'invalidId', projectId: 'Not Valid' });
    expect(text).toContain('"Not Valid"');
  });

  it('notFound names the id', () => {
    const text = formatOpenProjectReport({ kind: 'notFound', projectId: 'ghost' });
    expect(text).toContain('"ghost" not found');
  });

  it('noHarnessChosen tells how to choose one, never assumes claude', () => {
    const text = formatOpenProjectReport({ kind: 'noHarnessChosen', projectId: 'auth-hardening' });
    expect(text).toContain('no default harness set');
    expect(text).toContain('--with');
  });

  it('unsupportedHarness names the harness and says only claude is supported', () => {
    const text = formatOpenProjectReport({ kind: 'unsupportedHarness', harness: 'codex' });
    expect(text).toContain('"codex"');
    expect(text).toContain('not supported yet');
    expect(text).toContain('"claude"');
  });

  it('failedToStart names the harness and the project', () => {
    const text = formatOpenProjectReport({
      kind: 'failedToStart',
      projectId: 'auth-hardening',
      harness: 'claude',
    });
    expect(text).toContain('claude');
    expect(text).toContain('"auth-hardening"');
  });

  it('opened names the project, the harness and the exit code', () => {
    const text = formatOpenProjectReport({
      kind: 'opened',
      projectId: 'auth-hardening',
      harness: 'claude',
      exitCode: 0,
      addedDirs: ['C:\\code\\app-api'],
      missing: [],
    });
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('claude');
    expect(text).toContain('code 0');
  });
});
