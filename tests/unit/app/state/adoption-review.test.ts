import { describe, expect, it } from 'vitest';
import {
  buildAdoptionReviewRows,
  formatChangedFileLines,
} from '../../../../packages/app/src/state/adoption-review.js';

describe('formatChangedFileLines (V2-T70)', () => {
  it('formats added/removed counts', () => {
    expect(formatChangedFileLines({ added: 4, removed: 1 })).toBe('+4 −1');
    expect(formatChangedFileLines({ added: 0, removed: 3 })).toBe('+0 −3');
  });

  it('is undefined for null — never a fabricated count (D-025)', () => {
    expect(formatChangedFileLines(null)).toBeUndefined();
  });
});

describe('buildAdoptionReviewRows (V2-T70)', () => {
  it('maps every entry kind/path/lines straight through', () => {
    const rows = buildAdoptionReviewRows([
      { kind: 'added', path: 'context/know-how.md', lines: { added: 4, removed: 0 } },
      { kind: 'modified', path: 'INDEX.md', lines: { added: 2, removed: 1 } },
      { kind: 'deleted', path: 'AGENTS.md', lines: { added: 0, removed: 3 } },
      { kind: 'added', path: 'context/data.bin', lines: null },
    ]);

    expect(rows).toEqual([
      { path: 'context/know-how.md', kind: 'added', linesSummary: '+4 −0' },
      { path: 'INDEX.md', kind: 'modified', linesSummary: '+2 −1' },
      { path: 'AGENTS.md', kind: 'deleted', linesSummary: '+0 −3' },
      { path: 'context/data.bin', kind: 'added', linesSummary: undefined },
    ]);
  });

  it('is empty for an empty input', () => {
    expect(buildAdoptionReviewRows([])).toEqual([]);
  });
});
