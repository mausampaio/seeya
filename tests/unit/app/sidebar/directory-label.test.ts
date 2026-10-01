import { describe, expect, it } from 'vitest';
import {
  collapseHomeDirectory,
  formatDirectoryPathForDisplay,
  shortenDirectoryPath,
} from '../../../../packages/app/src/sidebar/directory-label.js';

describe('shortenDirectoryPath', () => {
  it('a short Windows path that fits whole is returned unchanged', () => {
    expect(shortenDirectoryPath('C:\\code\\seeya', 32)).toBe('C:\\code\\seeya');
  });

  it('a short POSIX path that fits whole is returned unchanged', () => {
    expect(shortenDirectoryPath('/code/seeya', 32)).toBe('/code/seeya');
  });

  it('a path exactly at the length budget is returned unchanged (boundary)', () => {
    const path = 'x'.repeat(32);
    expect(shortenDirectoryPath(path, 32)).toBe(path);
  });

  it('a long Windows path keeps the distinguishing tail, ellipsis-prefixed', () => {
    const path = 'C:\\ProvaSeeya\\projetos\\um-nome-de-diretorio-bem-comprido-mesmo';
    const result = shortenDirectoryPath(path, 32);

    expect(result.length).toBe(32);
    expect(result.startsWith('…')).toBe(true);
    expect(path.endsWith(result.slice(1))).toBe(true);
  });

  it('a long POSIX path keeps the distinguishing tail, ellipsis-prefixed', () => {
    const path = '/home/<usuario>/projetos/um-nome-de-diretorio-bem-comprido-mesmo';
    const result = shortenDirectoryPath(path, 32);

    expect(result.length).toBe(32);
    expect(result.startsWith('…')).toBe(true);
    expect(path.endsWith(result.slice(1))).toBe(true);
  });

  it('a long path with no separator at all still shortens cleanly', () => {
    const path = 'a'.repeat(50);
    const result = shortenDirectoryPath(path, 32);

    expect(result).toBe(`…${'a'.repeat(31)}`);
    expect(result.length).toBe(32);
  });

  it('respects a custom maxLength', () => {
    const path = 'C:\\code\\seeya\\packages\\app\\src';
    expect(shortenDirectoryPath(path, 10).length).toBe(10);
  });

  it('the default maxLength applies when omitted', () => {
    const path = 'C:\\'.padEnd(60, 'x');
    expect(shortenDirectoryPath(path).length).toBe(32);
  });
});

describe('collapseHomeDirectory (PO review of V2-T66, item 2)', () => {
  it('Windows: a path under the home directory is abbreviated to ~', () => {
    expect(
      collapseHomeDirectory('C:\\Users\\<usuario>\\code\\seeya', 'C:\\Users\\<usuario>', 'win32'),
    ).toBe('~\\code\\seeya');
  });

  it('Windows: the home directory itself collapses to exactly ~', () => {
    expect(collapseHomeDirectory('C:\\Users\\<usuario>', 'C:\\Users\\<usuario>', 'win32')).toBe(
      '~',
    );
  });

  it('Windows: matching is case-insensitive (drive letters, segment casing)', () => {
    expect(
      collapseHomeDirectory('c:\\users\\<USUARIO>\\code', 'C:\\Users\\<usuario>', 'win32'),
    ).toBe('~\\code');
  });

  it('Windows: a trailing separator on homeDir does not break the match', () => {
    expect(
      collapseHomeDirectory('C:\\Users\\<usuario>\\code', 'C:\\Users\\<usuario>\\', 'win32'),
    ).toBe('~\\code');
  });

  it('POSIX: a path under the home directory is abbreviated to ~', () => {
    expect(collapseHomeDirectory('/home/<usuario>/code/seeya', '/home/<usuario>', 'posix')).toBe(
      '~/code/seeya',
    );
  });

  it('POSIX: the home directory itself collapses to exactly ~', () => {
    expect(collapseHomeDirectory('/home/<usuario>', '/home/<usuario>', 'posix')).toBe('~');
  });

  it('POSIX: matching is case-SENSITIVE, unlike Windows', () => {
    expect(collapseHomeDirectory('/home/<USUARIO>/code', '/home/<usuario>', 'posix')).toBe(
      '/home/<USUARIO>/code',
    );
  });

  it('a path outside the home directory is returned unchanged (POSIX)', () => {
    expect(collapseHomeDirectory('/var/data', '/home/<usuario>', 'posix')).toBe('/var/data');
  });

  it('a path outside the home directory is returned unchanged (Windows)', () => {
    expect(collapseHomeDirectory('D:\\projects\\seeya', 'C:\\Users\\<usuario>', 'win32')).toBe(
      'D:\\projects\\seeya',
    );
  });

  it('a sibling directory that merely shares the home prefix as text is not collapsed', () => {
    // '/home/<usuario>-other' starts with '/home/<usuario>' as a STRING, but is not inside it — the
    // trailing-separator check in the implementation is what tells these apart.
    expect(collapseHomeDirectory('/home/<usuario>-other/code', '/home/<usuario>', 'posix')).toBe(
      '/home/<usuario>-other/code',
    );
  });

  it('an empty homeDir (not yet resolved) never guesses — the path is returned unchanged (D-025)', () => {
    expect(collapseHomeDirectory('/home/<usuario>/code', '', 'posix')).toBe('/home/<usuario>/code');
  });
});

describe('formatDirectoryPathForDisplay (PO review of V2-T66, item 2)', () => {
  it('collapses the home directory, then shortens from the end, Windows', () => {
    const path = 'C:\\Users\\<usuario>\\code\\seeya\\.claude\\worktrees\\abc123\\new-directory';
    const result = formatDirectoryPathForDisplay(path, 'C:\\Users\\<usuario>', 'win32', 24);

    expect(result.length).toBe(24);
    expect(result.startsWith('…')).toBe(true);
    const collapsed = collapseHomeDirectory(path, 'C:\\Users\\<usuario>', 'win32');
    expect(collapsed.endsWith(result.slice(1))).toBe(true);
  });

  it('collapses the home directory, then shortens from the end, POSIX', () => {
    const path = '/home/<usuario>/code/seeya/.claude/worktrees/abc123/new-directory';
    const result = formatDirectoryPathForDisplay(path, '/home/<usuario>', 'posix', 24);

    expect(result.length).toBe(24);
    expect(result.startsWith('…')).toBe(true);
  });

  it('a short path under home needs no shortening, only collapsing', () => {
    expect(formatDirectoryPathForDisplay('/home/<usuario>/code', '/home/<usuario>', 'posix')).toBe(
      '~/code',
    );
  });
});
