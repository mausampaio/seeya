/**
 * `core/project-lock-message.ts` (V2-T35). Pure text — no I/O. `formatProjectLockWarningLines`
 * used to live in `cli/format-project.ts`; moved here so `application/project-open.ts` (item 2's
 * own `--append-system-prompt` text) can reuse the exact same wording `cli/` prints to the
 * terminal, without either layer importing the other (`docs/ARQUITETURA.md`'s matrix).
 */
import { describe, expect, it } from 'vitest';
import {
  formatLockHolderDescription,
  formatProjectLockWarningLines,
  renderReadOnlyOpenQuestion,
} from '@seeya-ai/engine/core/project-lock-message.js';
import type { ProjectLockInfo } from '@seeya-ai/engine/core/project-lock.js';

const SOME_LOCK: ProjectLockInfo = {
  sessionId: 'abc123',
  pid: 9999,
  procStart: undefined,
  acquiredAt: new Date('2026-09-20T09:00:00.000Z'),
};

describe('formatLockHolderDescription', () => {
  it('names the session, pid and instant when the holder is known', () => {
    const text = formatLockHolderDescription(SOME_LOCK);
    expect(text).toContain('session abc123');
    expect(text).toContain('pid 9999');
    expect(text).toContain('2026-09-20T09:00:00.000Z');
  });

  it('says "an unidentified session" without inventing an id (D-025)', () => {
    const text = formatLockHolderDescription({ ...SOME_LOCK, sessionId: undefined });
    expect(text).toContain('an unidentified session');
    expect(text).not.toContain('undefined');
  });
});

describe('formatProjectLockWarningLines', () => {
  it('a genuinely free acquisition prints nothing — no lock ever existed to comment on', () => {
    const lines = formatProjectLockWarningLines('auth-hardening', {
      kind: 'acquired',
      reclaimedStale: null,
    });
    expect(lines).toEqual([]);
  });

  it('reclaiming a stale lock names who it took it from', () => {
    const lines = formatProjectLockWarningLines('auth-hardening', {
      kind: 'acquired',
      reclaimedStale: SOME_LOCK,
    });
    expect(lines.join('\n')).toContain('was stale');
    expect(lines.join('\n')).toContain('session abc123');
    expect(lines.join('\n')).toContain('reclaimed');
  });

  it('readOnly names who holds the project and warns that writes will not be recorded', () => {
    const lines = formatProjectLockWarningLines('auth-hardening', {
      kind: 'readOnly',
      heldBy: SOME_LOCK,
    });
    const text = lines.join('\n');
    expect(text).toContain('"auth-hardening"');
    expect(text).toContain('locked by session abc123');
    expect(text).toContain('reading only');
  });
});

describe('renderReadOnlyOpenQuestion', () => {
  it('names the holder without any interface-specific prompt suffix (V2-T30)', () => {
    const text = renderReadOnlyOpenQuestion(SOME_LOCK);
    expect(text).toContain('reading only');
    expect(text).toContain('locked by session abc123');
    expect(text).not.toContain('[y/N]');
    expect(text).not.toContain('\n');
  });
});
