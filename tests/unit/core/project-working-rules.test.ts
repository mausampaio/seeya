/**
 * `core/project-working-rules.ts` (V2-T34 item 5). Pure text.
 */
import { describe, expect, it } from 'vitest';
import { buildProjectWorkingRulesText } from '@seeya-ai/engine/core/project-working-rules.js';

describe('buildProjectWorkingRulesText', () => {
  it('names the project by id', () => {
    const text = buildProjectWorkingRulesText('auth-hardening');
    expect(text).toContain('"auth-hardening"');
  });

  it('covers every rule the task specifies at minimum', () => {
    const text = buildProjectWorkingRulesText('auth-hardening');
    expect(text).toContain('Commit as you go');
    expect(text).toContain('trailers');
    expect(text).toContain('One project per commit');
    expect(text).toContain('.seeya-lock');
    expect(text).toContain('journal/');
    expect(text).toContain('never its value');
  });

  it('tells the session not to touch git configuration (V2-T58, D-047 emendment)', () => {
    const text = buildProjectWorkingRulesText('auth-hardening');
    expect(text).toContain('Do not change git configuration');
  });

  it('names where the guard stops (item 7)', () => {
    const text = buildProjectWorkingRulesText('auth-hardening');
    expect(text.toLowerCase()).toContain('--no-verify');
  });

  it('tells the session CLAUDE.md is generated and not to edit it (D-050/V2-T61)', () => {
    const text = buildProjectWorkingRulesText('auth-hardening');
    expect(text).toContain('CLAUDE.md');
    expect(text).toContain('never hand-edited');
    expect(text).toContain('AGENTS.md');
  });

  it('stays well under the D-015 argument ceiling', () => {
    // The resume-prompt ceiling this project has actually measured is 16,384 characters
    // (docs/QUESTOES.md Q-069) — this text travels on a DIFFERENT flag (--append-system-prompt for
    // "open", never --resume), but is still comfortably an order of magnitude under that measured
    // real-world ceiling, with room for the lock warning and leftover-files note appended after it.
    expect(buildProjectWorkingRulesText('auth-hardening').length).toBeLessThan(4000);
  });
});
