/**
 * `core/project-claude-md.ts` (D-050/V2-T61). Pure text.
 */
import { describe, expect, it } from 'vitest';
import { buildGeneratedClaudeMd } from '@seeya-ai/engine/core/project-claude-md.js';

describe('buildGeneratedClaudeMd', () => {
  it('starts with the @AGENTS.md import (D-050: the only place the content lives)', () => {
    expect(buildGeneratedClaudeMd().startsWith('@AGENTS.md')).toBe(true);
  });

  it('never duplicates AGENTS.md content — the import line is the only mention of it', () => {
    const text = buildGeneratedClaudeMd();
    const occurrences = text.split('AGENTS.md').length - 1;
    expect(occurrences).toBe(1);
  });

  it('carries a Compact Instructions section', () => {
    expect(buildGeneratedClaudeMd()).toContain('## Compact Instructions');
  });

  it('tells the summary to preserve the task/decisions/files/know-how the spec lists', () => {
    const text = buildGeneratedClaudeMd();
    expect(text).toContain('task currently in progress');
    expect(text).toContain('next step');
    expect(text.toLowerCase()).toContain('decisions');
    expect(text).toContain('not yet committed');
    expect(text).toContain('know-how.md');
  });

  it('tells the session to re-read INDEX.md and status/ after compacting', () => {
    const text = buildGeneratedClaudeMd();
    expect(text).toContain('re-read `INDEX.md` and `status/`');
  });

  it('stays short (D-050: "Curta")', () => {
    expect(buildGeneratedClaudeMd().length).toBeLessThan(1500);
  });

  it('is deterministic — no clock, no randomness, no argument', () => {
    expect(buildGeneratedClaudeMd()).toBe(buildGeneratedClaudeMd());
  });
});
