import { describe, expect, it } from 'vitest';
import {
  NEW_TAB_KINDS,
  NEW_TAB_KIND_LABEL,
  resolveNewTabCommand,
} from '../../../../packages/app/src/tabs/new-tab-kind.js';

describe('resolveNewTabCommand (V2-T64)', () => {
  it('claude/codex resolve to their own literal command', () => {
    expect(resolveNewTabCommand('claude', '')).toBe('claude');
    expect(resolveNewTabCommand('codex', '')).toBe('codex');
  });

  it('shell resolves to the empty string — main.ts\'s own "default system shell" signal', () => {
    expect(resolveNewTabCommand('shell', '')).toBe('');
    // The free-text field is ignored entirely for every kind but 'other'.
    expect(resolveNewTabCommand('shell', 'npx tsx')).toBe('');
  });

  it('other resolves to the trimmed free-text command', () => {
    expect(resolveNewTabCommand('other', '  npx tsx  ')).toBe('npx tsx');
    expect(resolveNewTabCommand('other', '')).toBe('');
  });
});

describe('NEW_TAB_KINDS / NEW_TAB_KIND_LABEL', () => {
  it("lists the four kinds in the spec's own fixed order", () => {
    expect(NEW_TAB_KINDS).toEqual(['claude', 'codex', 'shell', 'other']);
  });

  it('has a label for every kind', () => {
    for (const kind of NEW_TAB_KINDS) {
      expect(NEW_TAB_KIND_LABEL[kind].length).toBeGreaterThan(0);
    }
  });
});
