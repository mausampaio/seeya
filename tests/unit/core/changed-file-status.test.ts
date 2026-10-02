import { describe, expect, it } from 'vitest';
import { parseChangedFileStatusLine } from '@seeya-ai/engine/core/changed-file-status.js';

describe('parseChangedFileStatusLine (V2-T71)', () => {
  it('reads an untracked file as added', () => {
    expect(parseChangedFileStatusLine('?? context/know-how.md')).toEqual({
      path: 'context/know-how.md',
      status: 'added',
    });
  });

  it('reads an unstaged modification (staged column blank)', () => {
    expect(parseChangedFileStatusLine(' M AGENTS.md')).toEqual({
      path: 'AGENTS.md',
      status: 'modified',
    });
  });

  it('reads a staged addition', () => {
    expect(parseChangedFileStatusLine('A  status/current.md')).toEqual({
      path: 'status/current.md',
      status: 'added',
    });
  });

  it('reads a deletion', () => {
    expect(parseChangedFileStatusLine(' D decisions/old.md')).toEqual({
      path: 'decisions/old.md',
      status: 'deleted',
    });
  });

  it('reads a rename, keeping the "old -> new" form as the path', () => {
    expect(parseChangedFileStatusLine('R  old-name.md -> new-name.md')).toEqual({
      path: 'old-name.md -> new-name.md',
      status: 'renamed',
    });
  });

  it('falls back to "other" for a porcelain code this parser does not special-case', () => {
    expect(parseChangedFileStatusLine('UU conflicted.md')).toEqual({
      path: 'conflicted.md',
      status: 'other',
    });
  });

  it('prefers the staged column over the unstaged one when both are set', () => {
    // staged: added, unstaged: modified — the staged half is what will actually be committed.
    expect(parseChangedFileStatusLine('AM both.md')).toEqual({
      path: 'both.md',
      status: 'added',
    });
  });
});
