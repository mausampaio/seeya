/**
 * The V2-T84 archive sentences in `core/project-management-message.ts` — shared by the CLI and the
 * window's dialogs.
 */
import { describe, expect, it } from 'vitest';
import {
  formatArchiveDate,
  formatArchiveStateText,
  formatArchivedProjectRefusalLine,
  formatProjectAlreadyActiveLine,
  formatProjectAlreadyArchivedLine,
  formatProjectArchivedLine,
  formatProjectLockedRefusalLine,
  formatProjectUnarchivedLine,
} from '@seeya-ai/engine/core/project-management-message.js';

const WHEN = new Date('2026-10-02T23:59:00.000Z');

describe('archive sentences', () => {
  it('formats the date as YYYY-MM-DD (UTC)', () => {
    expect(formatArchiveDate(WHEN)).toBe('2026-10-02');
  });

  it('states the archive state with and without a note', () => {
    expect(formatArchiveStateText(WHEN, null)).toBe('Archived on 2026-10-02');
    expect(formatArchiveStateText(WHEN, 'Finished — shipped')).toBe(
      'Archived on 2026-10-02 — Finished — shipped',
    );
  });

  it('says what archiving did and how to undo it', () => {
    expect(formatProjectArchivedLine('auth-hardening', null)).toBe(
      'Project "auth-hardening" archived. It is hidden from the day-to-day views; nothing was ' +
        'deleted. Run "seeya project unarchive auth-hardening" to bring it back.',
    );
    expect(formatProjectArchivedLine('auth-hardening', 'Done')).toContain('archived — Done.');
  });

  it('says the no-op cases plainly', () => {
    expect(formatProjectAlreadyArchivedLine('auth-hardening', WHEN)).toBe(
      'Project "auth-hardening" is already archived (since 2026-10-02).',
    );
    expect(formatProjectAlreadyActiveLine('auth-hardening')).toBe(
      'Project "auth-hardening" is not archived — nothing to do.',
    );
    expect(formatProjectUnarchivedLine('auth-hardening')).toBe(
      'Project "auth-hardening" unarchived. It is back in the day-to-day views.',
    );
  });

  it('the open refusal says how to unarchive', () => {
    expect(formatArchivedProjectRefusalLine('auth-hardening')).toBe(
      'seeya: project "auth-hardening" is archived — run "seeya project unarchive ' +
        'auth-hardening" first, then open it again.',
    );
  });

  it('the locked refusal accepts the two new actions', () => {
    const holder = {
      sessionId: 'abc123',
      pid: 1,
      procStart: undefined,
      acquiredAt: new Date('2026-10-01T00:00:00.000Z'),
    };
    expect(formatProjectLockedRefusalLine('p', holder, 'archive it')).toContain(
      'refusing to archive it',
    );
    expect(formatProjectLockedRefusalLine('p', holder, 'unarchive it')).toContain(
      'refusing to unarchive it',
    );
  });
});
