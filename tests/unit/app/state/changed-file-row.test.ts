import { describe, expect, it } from 'vitest';
import { formatChangedFileStatusLetter } from '../../../../packages/app/src/state/changed-file-row.js';

describe('formatChangedFileStatusLetter (V2-T71)', () => {
  it.each([
    ['modified', 'M'],
    ['added', 'A'],
    ['deleted', 'D'],
    ['renamed', 'R'],
    ['other', '?'],
  ] as const)('%s -> %s', (status, letter) => {
    expect(formatChangedFileStatusLetter(status)).toBe(letter);
  });
});
