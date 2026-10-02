/**
 * V2-T84 CLI text: `archive`/`unarchive` reports, `list` (archived section, byte-identical when
 * nothing is archived), `show` (the state line) and the `open` refusal.
 */
import { describe, expect, it } from 'vitest';
import {
  formatProjectsReport,
  formatShowProjectReport,
} from '../../../packages/cli/src/format-project-lifecycle.js';
import { formatOpenProjectReport } from '../../../packages/cli/src/format-project-open.js';
import {
  formatArchiveProjectReport,
  formatUnarchiveProjectReport,
} from '../../../packages/cli/src/project-archive-command.js';
import type { ProjectManifest } from '@seeya-ai/engine/core/types.js';

const ACTIVE: ProjectManifest = {
  id: 'auth-hardening',
  name: 'Auth hardening',
  defaultHarness: 'claude',
  repositories: [],
  trackers: [],
  lifecycle: { kind: 'active' },
};
const ARCHIVED: ProjectManifest = {
  id: 'old-thing',
  name: 'Old thing',
  defaultHarness: null,
  repositories: [],
  trackers: [],
  lifecycle: {
    kind: 'archived',
    archivedAt: new Date('2026-10-02T10:00:00.000Z'),
    note: 'Finished — shipped',
  },
};
const HOLDER = {
  sessionId: 'abc123',
  pid: 1,
  procStart: undefined,
  acquiredAt: new Date('2026-10-01T00:00:00.000Z'),
};

describe('formatProjectsReport with archived projects', () => {
  it('with nothing archived the text is byte-identical to the pre-archiving output', () => {
    const text = formatProjectsReport({ root: 'W', manifests: [ACTIVE], rejected: [] });
    expect(text).toBe(
      [
        'Workspace: W',
        '1 project found.',
        '',
        '- auth-hardening — Auth hardening',
        '    default harness: claude | repositories: none',
      ].join('\n'),
    );
  });

  it('lists archived projects in their own section AFTER the active ones, with date and note', () => {
    const text = formatProjectsReport({ root: 'W', manifests: [ARCHIVED, ACTIVE], rejected: [] });
    expect(text).toBe(
      [
        'Workspace: W',
        '1 project found, 1 archived.',
        '',
        '- auth-hardening — Auth hardening',
        '    default harness: claude | repositories: none',
        '',
        'Archived:',
        '- old-thing — Old thing',
        '    Archived on 2026-10-02 — Finished — shipped | repositories: none',
      ].join('\n'),
    );
  });

  it('a workspace with only archived projects still says 0 found and shows the section', () => {
    const text = formatProjectsReport({ root: 'W', manifests: [ARCHIVED], rejected: [] });
    expect(text).toContain('0 projects found, 1 archived.');
    expect(text).toContain('Archived:');
  });
});

describe('formatShowProjectReport state line', () => {
  const unlocked = { kind: 'unlocked' } as const;

  it('says active for an active project', () => {
    const text = formatShowProjectReport({
      kind: 'found',
      manifest: ACTIVE,
      root: 'W',
      lockStatus: unlocked,
    });
    expect(text).toContain('  state: active');
  });

  it('says archived with the date and note', () => {
    const text = formatShowProjectReport({
      kind: 'found',
      manifest: ARCHIVED,
      root: 'W',
      lockStatus: unlocked,
    });
    expect(text).toContain('  state: archived on 2026-10-02 — Finished — shipped');
  });
});

describe('archive/unarchive reports', () => {
  it('covers every archive result', () => {
    const when = new Date('2026-10-02T10:00:00.000Z');
    expect(formatArchiveProjectReport({ kind: 'invalidId', projectId: 'X Y' })).toContain('"X Y"');
    expect(formatArchiveProjectReport({ kind: 'notFound', projectId: 'ghost' })).toBe(
      'Project "ghost" not found.',
    );
    expect(formatArchiveProjectReport({ kind: 'locked', projectId: 'p', heldBy: HOLDER })).toMatch(
      /locked by .*refusing to archive it/,
    );
    expect(
      formatArchiveProjectReport({ kind: 'alreadyArchived', projectId: 'p', archivedAt: when }),
    ).toBe('Project "p" is already archived (since 2026-10-02).');
    expect(
      formatArchiveProjectReport({
        kind: 'archived',
        projectId: 'p',
        archivedAt: when,
        note: 'Done',
      }),
    ).toContain('archived — Done.');
  });

  it('covers every unarchive result', () => {
    expect(formatUnarchiveProjectReport({ kind: 'invalidId', projectId: 'X Y' })).toContain(
      '"X Y"',
    );
    expect(formatUnarchiveProjectReport({ kind: 'notFound', projectId: 'ghost' })).toBe(
      'Project "ghost" not found.',
    );
    expect(
      formatUnarchiveProjectReport({ kind: 'locked', projectId: 'p', heldBy: HOLDER }),
    ).toContain('refusing to unarchive it');
    expect(formatUnarchiveProjectReport({ kind: 'alreadyActive', projectId: 'p' })).toBe(
      'Project "p" is not archived — nothing to do.',
    );
    expect(formatUnarchiveProjectReport({ kind: 'unarchived', projectId: 'p' })).toBe(
      'Project "p" unarchived. It is back in the day-to-day views.',
    );
  });
});

describe('formatOpenProjectReport for an archived project', () => {
  it('refuses and says how to unarchive', () => {
    const text = formatOpenProjectReport({
      kind: 'projectArchived',
      projectId: 'old-thing',
      archivedAt: new Date('2026-10-02T10:00:00.000Z'),
      note: null,
    });
    expect(text).toContain('seeya project unarchive old-thing');
  });
});
